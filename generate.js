import mongoose from "mongoose";
import { PDFParse } from "pdf-parse";
import Vocabulary from "./models/Vocabulary.js";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const API = axios.create({
    baseURL: "https://openrouter.ai/api/v1",
    headers: {
        Authorization: `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
    },
    timeout: 60000,
});

const CONCURRENCY = 3;
const MAX_RETRIES = 3;

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
}

function safeParseJSON(text) {
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) return null;

        try {
            return JSON.parse(match[0]);
        } catch {
            return null;
        }
    }
}

async function callAI(prompt, retry = 0) {
    try {
        const res = await API.post("/chat/completions", {
            model: "arcee-ai/trinity-large-preview:free",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2
        });

        const content = res.data.choices?.[0]?.message?.content;

        const parsed = safeParseJSON(content);

        if (!parsed && retry < MAX_RETRIES) {
            console.log("Retry parse...");
            return callAI(prompt, retry + 1);
        }

        return parsed;

    } catch (err) {
        console.log('err', err)

        if (retry < MAX_RETRIES) {
            console.log("Retry request...", retry);
            await new Promise(r => setTimeout(r, 2000));
            return callAI(prompt, retry + 1);
        }

        console.error("AI Error:", err.message);
        return null;
    }
}

function buildPrompt(text) {

    return `
You are an expert linguistic extraction system for English language learners.

Your task is to analyze the following English text and extract vocabulary items that are:

- Useful for learning
- Advanced or uncommon
- Actually present in the text

TEXT:
"""
${text}
"""

-----------------------
TASK INSTRUCTIONS
-----------------------

1. Extract vocabulary items that appear in the text.
2. Each item MUST belong to **exactly one** of the allowed types below.
3. Avoid duplicates.
4. Maximum 40 items.

-----------------------
ALLOWED TYPES
-----------------------

word
- Single word (noun, verb, adjective, adverb)
- Examples: run, beautiful, quickly

phrasal verb
- Verb + particle(s) or preposition(s)
- Canonical form required
- Examples: give up, look after, run into

idiom
- Fixed expression with figurative meaning
- Examples: break the ice, hit the nail on the head

collocation
- Words that naturally appear together
- Examples: make a decision, heavy rain, strong coffee

compound
- Word formed by combining two or more words
- Examples: toothbrush, mother-in-law, sunlight

slang
- Informal, casual words or phrases
- Examples: cool, dude, gonna, wanna

proverb
- Traditional short saying expressing common wisdom
- Examples: Practice makes perfect, Better late than never

-----------------------
DO NOT EXTRACT
-----------------------

- Very common words: the, is, go, make, do, get, say, etc.
- Names of people or places
- Numbers
- Programming syntax or variable names
- Fragments of words
- Words/phrases not present in the text

-----------------------
NORMALIZATION RULES
-----------------------

- verbs → base form
- nouns → singular form
- phrasal verbs → canonical form
- idioms → exact fixed form

-----------------------
POS GUIDELINES
-----------------------

- word → noun, verb, adjective, adverb
- phrasal verb → verb
- idiom → phrase
- collocation → phrase
- compound → noun
- slang → noun, adjective, or verb depending on context
- proverb → proverb

-----------------------
OUTPUT REQUIREMENTS
-----------------------

Each item must contain:

word: string
type: string (must be exactly one of the allowed types)
pos: string (part of speech following POS guidelines)
translation: string (short Persian translation)
example: string (short sentence, maximum 10 words)

-----------------------
STRICT JSON FORMAT
-----------------------

Return ONLY valid JSON, strictly following this format:

{
 "items":[
  {
   "word":"string",
   "type":"word | phrasal verb | idiom | collocation | compound | slang | proverb",
   "pos":"noun | verb | adjective | adverb | phrase | proverb",
   "translation":"string",
   "example":"string"
  }
 ]
}

Do not include explanations, comments, or text outside JSON.

-----------------------
EXAMPLE
-----------------------

Input text:
He finally gave up smoking after many years.

Output JSON:
{
 "items":[
  {
   "word":"give up",
   "type":"phrasal verb",
   "pos":"verb",
   "translation":"ترک کردن",
   "example":"He gave up smoking."
  }
 ]
}
`;
}

function cleanText(text) {

    if (!text) return "";

    let cleaned = text;

    // حذف hyphenation بین خطوط (auto-\nmation -> automation)
    cleaned = cleaned.replace(/-\s*\n\s*/g, "");

    // تبدیل newline های زیاد به یک newline
    cleaned = cleaned.replace(/\n{2,}/g, "\n");

    // حذف شماره صفحه ها (Page 12, page 12, PAGE 12)
    cleaned = cleaned.replace(/\bpage\s*\d+\b/gi, "");

    // حذف Chapter ها
    cleaned = cleaned.replace(/\bchapter\s*\d+\b/gi, "");

    // حذف section numbers مثل 1.2.3
    cleaned = cleaned.replace(/\b\d+(\.\d+)+\b/g, "");

    // حذف bullet ها
    cleaned = cleaned.replace(/[•▪●◦►]/g, "");

    // حذف شماره لیست‌ها
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");

    // حذف فاصله قبل از punctuation
    cleaned = cleaned.replace(/\s+([.,!?;:])/g, "$1");

    // حذف فاصله‌های زیاد
    cleaned = cleaned.replace(/\s{2,}/g, " ");

    // حذف کاراکترهای عجیب unicode
    cleaned = cleaned.replace(/[^\x00-\x7F]+/g, " ");

    // تبدیل newline به فاصله
    cleaned = cleaned.replace(/\n/g, " ");

    // trim نهایی
    cleaned = cleaned.trim();

    return cleaned;
}

async function processPage(pageNumber, text) {

    const cleantext = cleanText(text)

    const prompt = buildPrompt(cleantext);

    const parsed = await callAI(prompt);

    if (!parsed?.items?.length) return;

    const words = parsed.items.map(i => i.word);

    const existing = await Vocabulary.find({ word: { $in: words } }).select("word");

    const existingSet = new Set(existing.map(e => e.word));

    const docs = parsed.items
        .filter(item => !existingSet.has(item.word))
        .map(item => ({
            ...item,
            context: text,
            page: pageNumber
        }));

    if (docs.length === 0) {
        console.log(`Page ${pageNumber}: no new words`);
        return;
    }

    await Vocabulary.insertMany(docs);

    console.log(`Page ${pageNumber}: added ${docs.length} words`);
}

async function extractPDFPages(path) {
    const parser = new PDFParse({ url: path });
    const result = await parser.getText();
    return result.pages;
}

async function processPages(pages, start, end) {

    const queue = [];

    for (let i = start - 1; i < end; i++) {

        const pageText = pages[i]?.text;

        if (!pageText || pageText.length < 20) {
            console.log(`Page ${i + 1} empty`);
            continue;
        }

        const task = processPage(i + 1, pageText);

        queue.push(task);

        if (queue.length >= CONCURRENCY) {
            await Promise.all(queue);
            queue.length = 0;
        }
    }

    if (queue.length) {
        await Promise.all(queue);
    }
}

async function main() {

    const startPage = parseInt(process.argv[2]);
    const endPage = parseInt(process.argv[3]);

    if (!startPage || !endPage || startPage > endPage) {
        console.log("Usage: node generate.js 10 20");
        process.exit(1);
    }

    await connectDB();

    const pages = await extractPDFPages(
        "/home/amir/Downloads/book/js/automate/book1Js.pdf"
    );

    if (endPage > pages.length) {
        console.log("Page range invalid");
        process.exit(1);
    }

    await processPages(pages, startPage, endPage);

    await mongoose.disconnect();

    console.log("Finished");
}

main();
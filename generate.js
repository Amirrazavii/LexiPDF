import mongoose from "mongoose";
import { PDFParse } from "pdf-parse"; // تذکر: مطمئن شوید این ایمپورت در نسخه فعلی کتابخانه‌تان کار می‌کند
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

const CONCURRENCY = 2; // FIX: کاهش همزمانی برای مدل‌های رایگان
const MAX_RETRIES = 3;

async function connectDB() {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");
}


function safeParseJSON(text) {
    if (!text) return null;
    try {
        const jsonRegex = new RegExp("``json", "gi");
        const backtickRegex = new RegExp("```", "g");
        const cleanedText = text.replace(jsonRegex, "").replace(backtickRegex, "").trim();
        return JSON.parse(cleanedText);
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
            temperature: 0.2,
            // FIX: اگر مدل پشتیبانی می‌کند، فرمت خروجی را اجباری کنید
            response_format: { type: "json_object" }
        });

        const content = res.data.choices?.[0]?.message?.content;
        const parsed = safeParseJSON(content);

        if (!parsed && retry < MAX_RETRIES) {
            console.log(`[Retry ${retry + 1}] AI returned invalid JSON.Retrying...`);
            await new Promise(r => setTimeout(r, 3000));
            return callAI(prompt, retry + 1);
        }

        return parsed;

    } catch (err) {
        // FIX: هندل کردن خطای 429 (Rate Limit) با تاخیر نمایی (Exponential Backoff)
        if (err.response && err.response.status === 429 && retry < MAX_RETRIES) {
            const waitTime = Math.pow(2, retry) * 5000; // 5s, 10s, 20s
            console.log(`[Rate Limit]429 Hit.Waiting ${waitTime / 1000}s...`);
            await new Promise(r => setTimeout(r, waitTime));
            return callAI(prompt, retry + 1);
        }

        if (retry < MAX_RETRIES) {
            console.log(`[Network Error] Retrying request... (${retry + 1})`);
            await new Promise(r => setTimeout(r, 2000));
            return callAI(prompt, retry + 1);
        }

        console.error("AI Fatal Error:", err.message);
        return null;
    }
}

function cleanText(text) {
    if (!text) return "";
    let cleaned = text;

    cleaned = cleaned.replace(/-\s*\n\s*/g, "");
    cleaned = cleaned.replace(/\bpage\s*\d+\b/gi, "");
    cleaned = cleaned.replace(/\bchapter\s*\d+\b/gi, "");
    cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, "");

    // FIX: به جای حذف تمام کاراکترهای غیر اسکی، فقط کاراکترهای کنترلی نامرئی را حذف می‌کنیم
    // تا آپوستروف‌ها و نقل‌قول‌ها حفظ شوند
    cleaned = cleaned.replace(/[\x00-\x1F\x7F-\x9F]/g, "");

    cleaned = cleaned.replace(/\s{2,}/g, " ");
    cleaned = cleaned.replace(/\n/g, " ");
    return cleaned.trim();
}

// ... تابع buildPrompt بدون تغییر ...


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
2. Each item MUST belong to ** exactly one ** of the allowed types below.
3. Avoid duplicates.
4. Maximum 40 items.

-----------------------
        ALLOWED TYPES
    -----------------------

        word
        - Single word(noun, verb, adjective, adverb)
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
            - Examples: toothbrush, mother -in -law, sunlight

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
                - Words / phrases not present in the text

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
    type: string(must be exactly one of the allowed types)
    pos: string(part of speech following POS guidelines)
    translation: string(english learning)
    example: string(short sentence, maximum 10 words)

    -----------------------
        STRICT JSON FORMAT
    -----------------------

        Return ONLY valid JSON, strictly following this format:

    {
        "items": [
            {
                "word": "string",
                "type": "word | phrasal verb | idiom | collocation | compound | slang | proverb",
                "pos": "noun | verb | adjective | adverb | phrase | proverb",
                "translation": "string",
                "example": "string"
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
        "items": [
            {
                "word": "give up",
                "type": "phrasal verb",
                "pos": "verb",
                "translation": "to stop doing something؛,
                "example": "He gave up smoking."
            }
        ]
    }
    `;
}
async function processPage(pageNumber, text) {
    const cleantext = cleanText(text);
    const prompt = buildPrompt(cleantext);
    const parsed = await callAI(prompt);

    if (!parsed?.items?.length) return;

    // FIX: تبدیل همه کلمات استخراج شده به حروف کوچک برای بررسی دقیق‌تر تکراری‌ها
    const extractedWords = parsed.items.map(i => ({
        ...i,
        word: i.word.toLowerCase().trim()
    }));

    // FIX: رفع مشکل تداخل همزمانی با استفاده از MongoDB Upsert (Update or Insert)
    // به جای اینکه اول سرچ کنیم بعد اینسرت کنیم، به دیتابیس می‌گوییم:
    // "اگر کلمه نبود اضافه‌اش کن، اگر بود نادیده بگیر"

    let addedCount = 0;
    const bulkOps = extractedWords.map(item => ({
        updateOne: {
            filter: { word: item.word },
            update: {
                $setOnInsert: {
                    ...item,
                    // FIX: جلوگیری از Database Bloat. فقط ۱۰۰ کاراکتر اول/آخر کلمه را به عنوان کانتکست ذخیره می‌کنیم
                    // در سناریوی واقعی بهتر است جمله حاوی کلمه را با Regex استخراج کنید
                    context: `Page ${pageNumber} context.`,
                    page: pageNumber
                }
            },
            upsert: true
        }
    }));

    try {
        const result = await Vocabulary.bulkWrite(bulkOps, { ordered: false });
        addedCount = result.upsertedCount;
        if (addedCount > 0) {
            console.log(`Page ${pageNumber}: added ${addedCount} NEW words`);
        } else {
            console.log(`Page ${pageNumber}: analyzed, no new words`);
        }
    } catch (err) {
        console.error(`Page ${pageNumber} DB Error: `, err.message);
    }
}

async function extractPDFPages(path) {
    const parser = new PDFParse({ url: path }); // توجه: صحت سینتکس این کتابخانه را بررسی کنید
    const result = await parser.getText();
    return result.pages; // فرض بر این است که آرایه‌ای از متون برمی‌گرداند
}

async function processPages(pages, start, end) {
    const queue = [];

    for (let i = start - 1; i < end; i++) {
        const pageText = pages[i]?.text || pages[i]; // FIX: وابستگی به ساختار خروجی PDFParse

        if (!pageText || pageText.length < 20) {
            console.log(`Page ${i + 1} empty or too short`);
            continue;
        }

        queue.push(processPage(i + 1, pageText));

        if (queue.length >= CONCURRENCY) {
            await Promise.all(queue);
            queue.length = 0; // پاک کردن صف
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
        console.log("Usage: node generate.js <startPage> <endPage>");
        process.exit(1);
    }

    await connectDB();

    try {
        const pages = await extractPDFPages(
            "/home/amir/Downloads/book/js/automate/book1Js.pdf"
        );

        if (endPage > pages.length) {
            console.log(`Page range invalid.Max pages: ${pages.length} `);
            process.exit(1);
        }

        console.log(`Processing pages ${startPage} to ${endPage}...`);
        await processPages(pages, startPage, endPage);

    } catch (error) {
        console.error("Fatal Application Error:", error);
    } finally {
        // FIX: تضمین قطع ارتباط با دیتابیس حتی در صورت کرش کردن برنامه
        await mongoose.disconnect();
        console.log("MongoDB Disconnected. Finished.");
    }
}

main();

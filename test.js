function greet(name, callback) {
    console.log("Hi " + name);
    callback();
}

greet("Amir", function () {
    console.log("Done greeting!");
});


console.log("ddd")


import { PDFParse } from "pdf-parse";


// --- استخراج صفحات PDF ---
async function extractPDFPages(path) {
    const parser = new PDFParse({ url: path });
    const result = await parser.getText();
    return result.pages;
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
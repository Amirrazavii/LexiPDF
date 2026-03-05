# LexiPDF

**LexiPDF** is a project for extracting advanced vocabulary, phrasal verbs, idioms, collocations, compounds, slang, and proverbs from PDF books using AI. Extracted words are stored in a MongoDB database for language learners.

**LexiPDF** پروژه‌ای برای استخراج لغات پیشرفته، phrasal verb، idiom، collocation، compound، slang و proverb از کتاب‌های PDF با استفاده از هوش مصنوعی است. لغات استخراج‌شده در MongoDB ذخیره می‌شوند تا زبان‌آموزان بتوانند راحت‌تر مطالعه کنند.

---

## Features / ویژگی‌ها

- Analyze PDF text page by page / پردازش متن PDF صفحه به صفحه
- Extract useful vocabulary items / استخراج لغات مفید برای یادگیری
- Avoid common words, names, numbers, and programming syntax / حذف کلمات رایج، اسامی، اعداد و syntax برنامه‌نویسی
- Store results in MongoDB / ذخیره نتایج در MongoDB
- Configurable concurrency and retry / قابلیت تنظیم concurrency و retry
- Clean text from hyphenation, chapters, bullets, and Unicode noise / پاک‌سازی متن از hyphenation، chapter، bullet و کاراکترهای عجیب

---

## Prerequisites / پیش‌نیازها

- Node.js >= 18
- npm or yarn
- Docker (optional, for MongoDB)
- OpenRouter API key

---

## Setup / راه‌اندازی

1. Clone the repository / کلون کردن مخزن:

```bash
git clone https://github.com/Amirrazavii/LexiPDF.git
cd LexiPDF


node generate.js 10 20
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";
import Vocabulary from "./models/Vocabulary.js";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

await mongoose.connect(process.env.MONGO_URI);

// --- تابع کمکی برای امنیت جستجو (جلوگیری از ReDoS) ---
function escapeRegex(text) {
    if (!text) return "";
    return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

// --- روت اصلی (SSR - بارگذاری اولیه صفحه) ---
app.get("/", async (req, res) => {
    // تغییر: اضافه کردن bookPage به مقادیر دریافتی
    const { page = 1, bookPage, type, word, sortBy = "word", sortDir = "asc" } = req.query;

    const filter = {};
    if (type) filter.type = type;

    // تغییر: استفاده از تابع امن برای Regex
    if (word) filter.word = { $regex: escapeRegex(word), $options: "i" };

    // تغییر: اعمال فیلتر شماره صفحه دیتابیس (مانند API)
    if (bookPage && !isNaN(parseInt(bookPage))) {
        filter.page = parseInt(bookPage);
    }

    const pageSize = 10;

    // تغییر: جلوگیری از Crash سرور در صورت وارد کردن صفحه منفی
    const safePage = Math.max(1, parseInt(page) || 1);
    const skip = (safePage - 1) * pageSize;

    try {
        const total = await Vocabulary.countDocuments(filter);
        const vocabularies = await Vocabulary.find(filter)
            .sort({ [sortBy]: sortDir === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(pageSize);

        // ارسال داده‌ها به فایل index.ejs
        res.render("index", {
            vocabularies,
            currentPage: safePage,
            totalPages: Math.ceil(total / pageSize),
            // اضافه کردن bookPage به آبجکت فیلترها تا در فرانت‌اند حفظ شود
            filters: { type, word, bookPage, sortBy, sortDir }
        });
    } catch (err) {
        console.error("Route Error:", err);
        res.status(500).send("Internal Server Error");
    }
});

// --- API برای AJAX search و pagination ---
app.get("/api/search", async (req, res) => {
    const { type, word, bookPage, sortBy = "word", sortDir = "asc", page = 1 } = req.query;

    const filter = {};
    if (type) filter.type = type;

    // تغییر: استفاده از تابع امن برای Regex
    if (word) filter.word = { $regex: escapeRegex(word), $options: "i" };

    if (bookPage && !isNaN(parseInt(bookPage))) {
        filter.page = parseInt(bookPage);
    }

    const pageSize = 10;

    // تغییر: جلوگیری از Crash سرور (اعداد منفی)
    const safePage = Math.max(1, parseInt(page) || 1);
    const skip = (safePage - 1) * pageSize;

    try {
        const total = await Vocabulary.countDocuments(filter);
        const vocabularies = await Vocabulary.find(filter)
            .sort({ [sortBy]: sortDir === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(pageSize);

        res.json({ vocabularies, total });
    } catch (err) {
        console.error("API Search Error:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// --- API برای اضافه کردن کلمه دستی ---
app.post("/api/add", async (req, res) => {
    const { word, type, pos, translation, example, context, page } = req.body;
    try {
        // پاکسازی فاصله‌های اضافی در ابتدا و انتهای کلمه قبل از ذخیره و جستجو
        const cleanWord = word.trim();

        const exists = await Vocabulary.findOne({ word: cleanWord });
        if (exists) return res.status(400).json({ error: "Word already exists" });

        const newWord = await Vocabulary.create({
            word: cleanWord,
            type,
            pos,
            translation,
            example,
            context,
            page: page ? parseInt(page) : null // اطمینان از اینکه عدد ذخیره می‌شود
        });

        res.json(newWord);
    } catch (err) {
        console.error("API Add Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// --- API برای حذف کلمه ---
app.delete("/api/delete/:id", async (req, res) => {
    const { id } = req.params;
    try {
        const deletedWord = await Vocabulary.findByIdAndDelete(id);

        if (!deletedWord) {
            return res.status(404).json({ error: "Word not found" });
        }

        res.json({ success: true });
    } catch (err) {
        console.error("API Delete Error:", err);
        // جلوگیری از کرش وقتی که آیدی فرمت درستی برای MongoDB ندارد
        res.status(500).json({ error: "Failed to delete word. Invalid ID." });
    }
});


app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
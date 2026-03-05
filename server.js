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

// --- روت اصلی با pagination اولیه ---
app.get("/", async (req, res) => {
    const { page = 1, type, word, sortBy = "word", sortDir = "asc" } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (word) filter.word = { $regex: word, $options: "i" };

    const pageSize = 10;
    const skip = (parseInt(page) - 1) * pageSize;

    try {
        const total = await Vocabulary.countDocuments(filter);
        const vocabularies = await Vocabulary.find(filter)
            .sort({ [sortBy]: sortDir === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(pageSize);

        res.render("index", {
            vocabularies,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / pageSize),
            filters: { type, word, sortBy, sortDir }
        });
    } catch (err) {
        res.status(500).send(err.message);
    }
});

// --- API برای AJAX search و pagination ---
app.get("/api/search", async (req, res) => {
    const { type, word, sortBy = "word", sortDir = "asc", page = 1 } = req.query;
    const filter = {};
    if (type) filter.type = type;
    if (word) filter.word = { $regex: word, $options: "i" };

    const pageSize = 10;
    const skip = (parseInt(page) - 1) * pageSize;

    try {
        const total = await Vocabulary.countDocuments(filter);
        const vocabularies = await Vocabulary.find(filter)
            .sort({ [sortBy]: sortDir === "asc" ? 1 : -1 })
            .skip(skip)
            .limit(pageSize);
        res.json({ vocabularies, total });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// --- API برای اضافه کردن کلمه دستی ---
app.post("/api/add", async (req, res) => {
    const { word, type, pos, translation, example, context, page } = req.body;
    try {
        const exists = await Vocabulary.findOne({ word });
        if (exists) return res.status(400).json({ error: "Word already exists" });

        const newWord = await Vocabulary.create({ word, type, pos, translation, example, context, page });
        res.json(newWord);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.delete("/api/delete/:id", async (req, res) => {
    const { id } = req.params;
    try {
        await Vocabulary.findByIdAndDelete(id);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
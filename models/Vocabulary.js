import mongoose from "mongoose";

const vocabularySchema = new mongoose.Schema({
    word: { type: String, unique: true }, // جلوگیری از تکرار
    type: String, // word / phrasal verb / idiom
    pos: String, // Part of Speech
    translation: String, // ترجمه فارسی
    example: String, // جمله مثال
    context: String, // متن اصلی پاراگراف
    page: Number, // شماره صفحه
    createdAt: { type: Date, default: Date.now }
});

// 👇 این خط رو اضافه کن
export default mongoose.model("Vocabulary", vocabularySchema);
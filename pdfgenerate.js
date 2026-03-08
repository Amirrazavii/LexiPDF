import { PDFParse } from "pdf-parse"; // تذکر: مطمئن شوید این ایمپورت در نسخه فعلی کتابخانه‌تان کار می‌کند




async function extractPDFPages(path) {
    const parser = new PDFParse({ url: path }); // توجه: صحت سینتکس این کتابخانه را بررسی کنید
    const result = await parser.getText();
    return result.pages; // فرض بر این است که آرایه‌ای از متون برمی‌گرداند
}


const pages = await extractPDFPages(
    "/home/amir/Downloads/book/js/automate/book1Js.pdf"
);
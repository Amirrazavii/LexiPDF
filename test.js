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
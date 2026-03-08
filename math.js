// math.js
// کلمه کلیدی export این تابع را برای دنیای بیرون قابل دسترس می‌کند
export function calculateTax(price) {
    const taxRate = 0.09;
    return price + (price * taxRate);
}

// متغیرهای داخل این فایل، به بیرون نشت نمی‌کنند (کپسوله‌سازی)
const secretAlgorithm = "xyz";

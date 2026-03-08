// const obj = {

//     a: "sd"
// }


// const { a } = obj

// a == "df"

// console.log(obj)



// const moduleA = {
//     count: {
//         a: 1,
//         b: 2
//     }
// };

// const moduleB = {};

// Object.defineProperty(moduleB, "count", {
//     get() {
//         return moduleA.count; // فقط یک getter داریم
//     },
//     // writable: true, // اگر این را بگذاریم، صراحتاً غیر قابل نوشتن می‌شود
//     // configurable: true
// });

// moduleB.count.a = 10
// console.log(moduleA.count)

// // console.log(moduleB.count)

// // moduleB.count = "sd"


// let a = {
//     b: 10,
//     c: 20
// }


const B = {}

let _a = 10  // storage داخلی

Object.defineProperty(B, "a", {
    get() {
        return _a
    },
    set(value) {
        _a = value
    }
})

console.log(B.a)
B.a = 80
console.log(_a)
_a = 60
console.log(B.a)


// «primitive snapshot vs object reference»





1436550454
1983890814

111623432
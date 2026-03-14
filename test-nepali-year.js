const NepaliDate = require("nepali-date-converter");
const np = new NepaliDate(new Date());
const start = new NepaliDate(np.getYear(), 0, 1).toJsDate();
console.log(start);

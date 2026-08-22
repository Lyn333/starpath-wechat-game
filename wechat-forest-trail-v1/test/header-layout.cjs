const assert = require("assert");
const fs = require("fs");
const source = fs.readFileSync(require.resolve("../core/SingleBoardRenderer"), "utf8");

assert.match(source, /statsY = headerY \+ 62/, "计时与分数应位于顶部云朵之间的中央下方区域");
assert.match(source, /700 17px Microsoft YaHei, sans-serif/, "计时与分数字号应放大并使用清晰中文字体栈");
assert.match(source, /this\.width \/ 2, statsY/, "计时与分数应相对于屏幕水平居中");
console.log("顶部居中时间与分数布局校验通过");

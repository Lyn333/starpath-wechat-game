const assert = require("assert");
const { effectiveScore } = require("../cloudfunctions/submitGameResult/scorePolicy");

assert.equal(effectiveScore(undefined, 120), 120, "首次成绩应作为持久化最佳分数");
assert.equal(effectiveScore(120, 90), 120, "较低新成绩不得降低排行榜持久化最佳分数");
assert.equal(effectiveScore(120, 180), 180, "较高新成绩应覆盖旧最佳分数");
console.log("排行榜最佳成绩策略校验通过");

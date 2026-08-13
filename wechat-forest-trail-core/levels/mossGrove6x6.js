/** 原创 6×6 苔影林地关卡；solution 用于叶径提示和自动化测试，不应直接显示给玩家。 */

const solution = [];
for (let row = 0; row < 6; row += 1) {
  const columns = row % 2 === 0 ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
  columns.forEach((col) => solution.push({ row, col }));
}

const mossGrove6x6 = {
  id: "moss-grove-01",
  name: "苔影林地 · 01",
  rows: 6,
  cols: 6,
  waypoints: [
    { number: 1, cell: { row: 0, col: 0 } },
    { number: 2, cell: { row: 0, col: 5 } },
    { number: 3, cell: { row: 1, col: 5 } },
    { number: 4, cell: { row: 1, col: 0 } },
    { number: 5, cell: { row: 2, col: 5 } },
    { number: 6, cell: { row: 3, col: 0 } },
    { number: 7, cell: { row: 4, col: 5 } },
    { number: 8, cell: { row: 5, col: 0 } },
  ],
  walls: ["H_0_1", "H_1_4", "H_2_0", "H_3_3", "H_4_2"],
  solution,
};

module.exports = { mossGrove6x6 };

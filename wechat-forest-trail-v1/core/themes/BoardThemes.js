const DEFAULT_BOARD_THEME_ID = "tai-bai";

// Board fills come from the "知笔墨 · 诗意中国色" colour cards supplied for this release.
// Every board intentionally shares the original green path gradient.
const ORIGINAL_GREEN_PATH = {
  pathStart: "#0E9F57",
  pathMiddle: "#2FE278",
  pathEnd: "#087F46",
  pathFallback: "#20C96B",
};

function theme(id, label, subtitle, boardFill, boardBorder, grid, wall, number, extra = {}) {
  const path = extra.path || ORIGINAL_GREEN_PATH;
  return { id, label, subtitle, swatch: boardFill, palette: { boardFill, boardBorder, grid, wall, number, ...path }, unlock: extra.unlock || null };
}

const BOARD_THEMES = [
  theme("tai-bai", "肽白", "默认 · 皎皎白驹", "#F8F8F8", "#B8B8B8", "rgba(60,60,60,.20)", "#5A5A5A", "#2A2A2A"),
  theme("zhu-sha", "硃砂", "使朱则太赤", "#C62918", "#F2B8AE", "rgba(255,255,255,.24)", "#5A0E06", "#FFF4F0"),
  theme("zhu-biao", "硃磦", "缥色自循茶盏釉", "#CF420A", "#F5C3A8", "rgba(255,255,255,.24)", "#5E1C02", "#FFF6EE"),
  theme("teng-huang", "藤黄", "海藤树脂", "#FFB61E", "#A86E00", "rgba(90,58,0,.24)", "#6E4700", "#3A2600"),
  theme("san-qing", "三青", "石青之一", "#20C6E0", "#0F6F7E", "rgba(0,60,70,.24)", "#0A4D58", "#083840"),
  theme("san-lv", "三绿", "石绿之一", "#45B9A2", "#1E6B5B", "rgba(0,55,45,.24)", "#134A3E", "#0E362D"),
  theme("yan-zhi", "胭脂", "俗称洋红", "#AB1D22", "#F0B7BA", "rgba(255,255,255,.24)", "#4C0A0D", "#FFF2F2"),
  theme("shu-hong", "曙红", "旭日初升", "#C72A17", "#F3B9B0", "rgba(255,255,255,.24)", "#5A1008", "#FFF4F1"),
  theme("zhe-shi", "赭石", "赤土也", "#612405", "#D9B08C", "rgba(255,255,255,.20)", "#F0D6BC", "#FFF3E6"),
  theme("mo-hei", "墨黑", "墨具五色", "#090B0C", "#5C6266", "rgba(255,255,255,.18)", "#C9CDD0", "#F2F4F5"),
  theme("hua-qing", "花青", "蓼蓝为蓝", "#191A48", "#9EA0D6", "rgba(255,255,255,.20)", "#D4D5F5", "#F1F1FF"),
  theme("tai-qing-lan", "酞青蓝", "铜酞青", "#012772", "#8FAEE8", "rgba(255,255,255,.22)", "#CBDBFA", "#EFF4FF"),
  theme("fruit-grove", "果园暮光", "通关水果乐园解锁", "#FFF1D6", "#E0A86A", "rgba(120,70,20,.18)", "#8A4B1A", "#4A2A12", { unlock: { challengeTheme: "fruit", hint: "完成水果乐园全部关卡解锁" } }),
  theme("harvest-realm", "丰收秘境", "通关丰收秘境解锁", "#F4E1B5", "#C4892A", "rgba(120,70,20,.20)", "#8A4B1A", "#4A2A12", { unlock: { challengeLevel: "challenge-fruit-5", hint: "完成丰收秘境解锁" } }),
  theme("rainbow-fruit", "彩虹水果", "三星通关丰收秘境解锁", "#FFF7E8", "#E36A3E", "rgba(227,106,62,.18)", "#AB1D22", "#4A2A12", {
    unlock: { challengeLevel: "challenge-fruit-5", minStars: 3, hint: "三星通关丰收秘境解锁" },
    path: { pathStart: "#FF6B8A", pathMiddle: "#FFD35A", pathEnd: "#45B9A2", pathFallback: "#9B7CFF" },
  }),
  theme("nebula-night", "星云夜航", "通关太空旅行解锁", "#16122C", "#8B7CFF", "rgba(255,255,255,.16)", "#D7CFFF", "#F4F0FF", { unlock: { challengeTheme: "space", hint: "完成太空旅行全部关卡解锁" } }),
];

function getBoardTheme(id) { return BOARD_THEMES.find((item) => item.id === id) || BOARD_THEMES.find((item) => item.id === DEFAULT_BOARD_THEME_ID); }
function isBoardThemeId(id) { return BOARD_THEMES.some((item) => item.id === id); }

module.exports = { BOARD_THEMES, DEFAULT_BOARD_THEME_ID, ORIGINAL_GREEN_PATH, getBoardTheme, isBoardThemeId };

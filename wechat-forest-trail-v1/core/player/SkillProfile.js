const DEFAULT_SKILL = { rating: 500, games: 0, wins: 0, recentResults: [], preferredSize: "6x6", averageElapsedMs: 0 };

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function expectedScore(playerRating, puzzleRating) { return 1 / (1 + 10 ** ((puzzleRating - playerRating) / 400)); }

function normalizeSkill(value = {}) {
  return {
    ...DEFAULT_SKILL,
    ...value,
    rating: clamp(Math.round(Number(value.rating) || DEFAULT_SKILL.rating), 0, 2000),
    games: Math.max(0, Math.floor(Number(value.games) || 0)),
    wins: Math.max(0, Math.floor(Number(value.wins) || 0)),
    recentResults: Array.isArray(value.recentResults) ? value.recentResults.slice(-20) : [],
  };
}

function updateSkill(profile, puzzle, result) {
  const current = normalizeSkill(profile);
  const completed = result?.completed !== false;
  const puzzleRating = puzzle?.difficultyProfile?.rating || ({ easy: 500, medium: 900, hard: 1300, expert: 1650 }[puzzle?.difficulty] || 900);
  const expected = expectedScore(current.rating, puzzleRating);
  const undoPenalty = Math.min(.15, Math.max(0, Number(result?.undos) || 0) * .015);
  const hintPenalty = Math.min(.25, Math.max(0, Number(result?.hints) || 0) * .08);
  const actual = clamp((completed ? 1 : 0) - undoPenalty - hintPenalty, 0, 1);
  const k = current.games < 5 ? 48 : current.games < 30 ? 32 : 20;
  const rating = clamp(Math.round(current.rating + k * (actual - expected)), 0, 2000);
  const games = current.games + 1;
  const wins = current.wins + (completed ? 1 : 0);
  const elapsedMs = Math.max(0, Number(result?.elapsedMs) || 0);
  const averageElapsedMs = elapsedMs ? Math.round((current.averageElapsedMs * current.games + elapsedMs) / games) : current.averageElapsedMs;
  return {
    ...current,
    rating,
    games,
    wins,
    preferredSize: puzzle?.gridSize || current.preferredSize,
    averageElapsedMs,
    recentResults: [...current.recentResults, { completed, puzzleRating, elapsedMs, at: Date.now() }].slice(-20),
  };
}

function recommendedGridSize(rating) {
  if (rating >= 1600) return "12x12";
  if (rating >= 1200) return "10x10";
  if (rating >= 700) return "8x8";
  return "6x6";
}

module.exports = { DEFAULT_SKILL, expectedScore, normalizeSkill, recommendedGridSize, updateSkill };

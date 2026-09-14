const { PuzzlePipeline } = require("./puzzle/PuzzlePipeline");
const { CLOCK_TIERS, chinaDateKey, clockRequest, dailyRequest, unlimitedRequest } = require("./modes/ModeCatalog");

const defaultPipeline = new PuzzlePipeline();

function createSeededLevel({ gridSize = "8x8", difficulty = "medium", seed, id, title, sourceKind = "seed", checkUniqueness }) {
  return defaultPipeline.build({ gridSize, difficulty, seed, id, title, sourceKind, checkUniqueness });
}

function createDailyChallenge(date = new Date()) {
  const request = dailyRequest(date);
  return defaultPipeline.build(request);
}

function createContinuation(gridSize, difficulty, ordinal) {
  const request = unlimitedRequest({ gridSize, difficulty, ordinal });
  return defaultPipeline.build({ ...request, sourceKind: "continuation" });
}

function createClockLevel(tierId, ordinal) {
  return defaultPipeline.build(clockRequest(tierId, ordinal));
}

module.exports = { CLOCK_TIERS, chinaDateKey, createDailyChallenge, createContinuation, createClockLevel, createSeededLevel };

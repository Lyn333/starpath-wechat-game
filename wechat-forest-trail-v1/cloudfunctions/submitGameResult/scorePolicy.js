function effectiveScore(previousScore, attemptScore) {
  const prior = Number(previousScore);
  const attempt = Number(attemptScore);
  if (!Number.isFinite(attempt)) throw new Error("invalid-attempt-score");
  return Number.isFinite(prior) ? Math.max(prior, attempt) : attempt;
}

module.exports = { effectiveScore };

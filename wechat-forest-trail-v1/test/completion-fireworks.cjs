const assert = require("assert");
const { FIREWORK_DURATION_MS, createFireworks, createHarvest, createNebula, createCompletionEffect, drawFireworks, particleFrame } = require("../core/effects/CompletionFireworks");

const effect = createFireworks(390, 844, 1000);
assert.strictEqual(effect.duration, FIREWORK_DURATION_MS);
assert.strictEqual(effect.particles.length, 66);
assert.ok(effect.particles.every((particle) => particle.life >= 780 && particle.life < 1080));
const sample = effect.particles[0];
assert.strictEqual(particleFrame(sample, sample.delay - 1), null);
assert.ok(particleFrame(sample, sample.delay + 1));
assert.strictEqual(particleFrame(sample, sample.delay + sample.life), null);

const operations = [];
const context = {
  globalAlpha: 1,
  beginPath() { operations.push("begin"); },
  moveTo() { operations.push("move"); },
  lineTo() { operations.push("line"); },
  stroke() { operations.push("stroke"); },
  arc() { operations.push("arc"); },
  fill() { operations.push("fill"); },
};
assert.strictEqual(drawFireworks(context, effect, 1150), true);
assert.ok(operations.includes("arc"));
assert.ok(operations.includes("stroke"));
assert.strictEqual(context.globalAlpha, 1);
assert.strictEqual(drawFireworks(context, effect, 1000 + FIREWORK_DURATION_MS), false);

const harvest = createHarvest(390, 844, 2000);
assert.strictEqual(harvest.kind, "harvest");
assert.ok(harvest.particles.length >= 40);
assert.strictEqual(drawFireworks(context, harvest, 2300), true);
assert.strictEqual(drawFireworks(context, harvest, 2000 + FIREWORK_DURATION_MS), false);

const nebula = createNebula(390, 844, 3000);
assert.strictEqual(nebula.kind, "nebula");
assert.ok(nebula.particles.length >= 48);
assert.strictEqual(drawFireworks(context, nebula, 3300), true);
assert.strictEqual(createCompletionEffect(390, 844, 1, "harvest").kind, "harvest");
assert.strictEqual(createCompletionEffect(390, 844, 1, "nebula").kind, "nebula");
assert.strictEqual(createCompletionEffect(390, 844, 1, "fireworks").kind, "fireworks");
console.log("PASS completion-fireworks");

const FIREWORK_DURATION_MS = 2400;
const FIREWORK_COLORS = ["#ff5f7e", "#ffd43b", "#63e6be", "#74c0fc", "#da77f2", "#ff922b"];

function seededRandom(seed) {
  let state = (Math.floor(seed) || 1) >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ value >>> 15, value | 1);
    value ^= value + Math.imul(value ^ value >>> 7, value | 61);
    return ((value ^ value >>> 14) >>> 0) / 4294967296;
  };
}

function createFireworks(width, height, startedAt = Date.now()) {
  const random = seededRandom(startedAt + width * 17 + height * 31);
  const centers = [
    { x: width * .22, y: height * .27, delay: 0 },
    { x: width * .76, y: height * .24, delay: 180 },
    { x: width * .5, y: height * .17, delay: 360 },
  ];
  const particles = [];
  centers.forEach((center, burstIndex) => {
    const count = 20 + burstIndex * 2;
    for (let index = 0; index < count; index += 1) {
      const angle = (Math.PI * 2 * index) / count + (random() - .5) * .18;
      const speed = 58 + random() * 72;
      particles.push({
        x: center.x,
        y: center.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 35,
        gravity: 115 + random() * 35,
        delay: center.delay + Math.floor(random() * 70),
        life: 780 + Math.floor(random() * 300),
        size: 1.6 + random() * 2.2,
        color: FIREWORK_COLORS[Math.floor(random() * FIREWORK_COLORS.length)],
      });
    }
  });
  return { startedAt, duration: FIREWORK_DURATION_MS, particles };
}

function particleFrame(particle, elapsedMs) {
  const activeMs = elapsedMs - particle.delay;
  if (activeMs < 0 || activeMs >= particle.life) return null;
  const t = activeMs / 1000;
  const progress = activeMs / particle.life;
  return {
    x: particle.x + particle.vx * t,
    y: particle.y + particle.vy * t + .5 * particle.gravity * t * t,
    trailX: particle.x + particle.vx * Math.max(0, t - .035),
    trailY: particle.y + particle.vy * Math.max(0, t - .035) + .5 * particle.gravity * Math.max(0, t - .035) ** 2,
    alpha: Math.max(0, 1 - progress) ** 1.6,
    size: particle.size * (1 - progress * .35),
  };
}

function drawFireworks(context, effect, now = Date.now()) {
  if (!effect) return false;
  if (effect.kind === "harvest") return drawHarvest(context, effect, now);
  if (effect.kind === "nebula") return drawNebula(context, effect, now);
  const elapsedMs = now - effect.startedAt;
  if (elapsedMs < 0 || elapsedMs >= effect.duration) return false;
  let drew = false;
  const originalAlpha = context.globalAlpha;
  effect.particles.forEach((particle) => {
    const frame = particleFrame(particle, elapsedMs);
    if (!frame) return;
    drew = true;
    context.globalAlpha = frame.alpha * .45;
    context.strokeStyle = particle.color;
    context.lineWidth = Math.max(.8, frame.size * .55);
    context.beginPath();
    context.moveTo(frame.trailX, frame.trailY);
    context.lineTo(frame.x, frame.y);
    context.stroke();
    context.globalAlpha = frame.alpha;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(frame.x, frame.y, frame.size, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = originalAlpha === undefined ? 1 : originalAlpha;
  return drew;
}

const HARVEST_COLORS = ["#FF6B8A", "#FFD35A", "#45B9A2", "#FF922B", "#F08C8C", "#9B7CFF"];
const NEBULA_COLORS = ["#9D83FF", "#74C0FC", "#F8F0FF", "#63E6BE", "#DA77F2", "#4C6EF5"];

function createHarvest(width, height, startedAt = Date.now()) {
  const random = seededRandom(startedAt + width * 11 + height * 23);
  const particles = [];
  for (let index = 0; index < 42; index += 1) {
    particles.push({
      x: width * (.08 + random() * .84),
      y: -18 - random() * 90,
      vx: (random() - .5) * 36,
      vy: 70 + random() * 90,
      gravity: 95 + random() * 40,
      delay: Math.floor(random() * 420),
      life: 1100 + Math.floor(random() * 500),
      size: 3.2 + random() * 3.6,
      color: HARVEST_COLORS[Math.floor(random() * HARVEST_COLORS.length)],
      spin: (random() - .5) * 4,
    });
  }
  return { kind: "harvest", startedAt, duration: FIREWORK_DURATION_MS, particles };
}

function createNebula(width, height, startedAt = Date.now()) {
  const random = seededRandom(startedAt + width * 13 + height * 29);
  const cx = width / 2, cy = height * .28;
  const particles = [];
  for (let index = 0; index < 56; index += 1) {
    const radius = 18 + random() * 92;
    const angle = random() * Math.PI * 2;
    particles.push({
      cx, cy, radius, angle,
      speed: .9 + random() * 1.6,
      delay: Math.floor(random() * 280),
      life: 1400 + Math.floor(random() * 600),
      size: 1.4 + random() * 2.4,
      color: NEBULA_COLORS[Math.floor(random() * NEBULA_COLORS.length)],
      expand: 18 + random() * 40,
    });
  }
  return { kind: "nebula", startedAt, duration: FIREWORK_DURATION_MS, particles };
}

function createCompletionEffect(width, height, startedAt = Date.now(), kind = "fireworks") {
  if (kind === "harvest") return createHarvest(width, height, startedAt);
  if (kind === "nebula") return createNebula(width, height, startedAt);
  return { kind: "fireworks", ...createFireworks(width, height, startedAt) };
}

function drawHarvest(context, effect, now = Date.now()) {
  const elapsedMs = now - effect.startedAt;
  if (elapsedMs < 0 || elapsedMs >= effect.duration) return false;
  let drew = false;
  const originalAlpha = context.globalAlpha;
  effect.particles.forEach((particle) => {
    const frame = particleFrame(particle, elapsedMs);
    if (!frame) return;
    drew = true;
    context.globalAlpha = frame.alpha;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(frame.x, frame.y, frame.size, 0, Math.PI * 2);
    context.fill();
    context.globalAlpha = frame.alpha * .35;
    context.beginPath();
    context.arc(frame.x - frame.size * .4, frame.y + frame.size * .2, frame.size * .55, 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = originalAlpha === undefined ? 1 : originalAlpha;
  return drew;
}

function drawNebula(context, effect, now = Date.now()) {
  const elapsedMs = now - effect.startedAt;
  if (elapsedMs < 0 || elapsedMs >= effect.duration) return false;
  let drew = false;
  const originalAlpha = context.globalAlpha;
  effect.particles.forEach((particle) => {
    const activeMs = elapsedMs - particle.delay;
    if (activeMs < 0 || activeMs >= particle.life) return;
    const progress = activeMs / particle.life;
    const t = activeMs / 1000;
    const radius = particle.radius + particle.expand * progress;
    const angle = particle.angle + particle.speed * t;
    const x = particle.cx + Math.cos(angle) * radius;
    const y = particle.cy + Math.sin(angle) * radius * .62;
    drew = true;
    context.globalAlpha = Math.max(0, 1 - progress) ** 1.35;
    context.fillStyle = particle.color;
    context.beginPath();
    context.arc(x, y, particle.size * (1 - progress * .25), 0, Math.PI * 2);
    context.fill();
  });
  context.globalAlpha = originalAlpha === undefined ? 1 : originalAlpha;
  return drew;
}

module.exports = { FIREWORK_COLORS, FIREWORK_DURATION_MS, HARVEST_COLORS, NEBULA_COLORS, createFireworks, createHarvest, createNebula, createCompletionEffect, drawFireworks, particleFrame };

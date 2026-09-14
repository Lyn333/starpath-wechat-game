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

module.exports = { FIREWORK_COLORS, FIREWORK_DURATION_MS, createFireworks, drawFireworks, particleFrame };

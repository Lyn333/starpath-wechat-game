/**
 * 亚马逊云林环境天气：纯函数，根据时间戳与画布尺寸确定性地生成一帧场景。
 * 不依赖 wx / Canvas，渲染器只负责把 scene 画出来。
 *
 * 一个周期内的时间轴（比例）：
 *   0.00–0.42  晴光：光柱缓慢摇曳，云慢漂
 *   0.42–0.78  微雨：天空略暗，细雨斜落
 *   0.78–1.00  雨后：薄雾自林间升起，光柱重新透出
 */

const WEATHER_CYCLE_MS = 150000;
const RAIN_WINDOW = { start: .42, end: .78, ramp: .06 };
const MAX_RAINDROPS = 72;
const LIGHT_SHAFT_COUNT = 3;
const MIST_BAND_COUNT = 2;

function clamp(value, min = 0, max = 1) { return Math.max(min, Math.min(max, value)); }
function smoothstep(edge0, edge1, value) { const t = clamp((value - edge0) / (edge1 - edge0)); return t * t * (3 - 2 * t); }

// 与 SeededRandom 相同风格的整数散列，只依赖下标，保证同一帧同一雨滴永远落在同一轨道上。
function hash01(index, salt = 0) {
  let value = (index * 0x9E3779B1 + salt * 0x85EBCA77) >>> 0;
  value = Math.imul(value ^ (value >>> 15), 0x2C1B3C6D);
  value = Math.imul(value ^ (value >>> 12), 0x297A2D39);
  return ((value ^ (value >>> 15)) >>> 0) / 4294967296;
}

function cyclePosition(now, cycleMs = WEATHER_CYCLE_MS) {
  const wrapped = ((now % cycleMs) + cycleMs) % cycleMs;
  return wrapped / cycleMs;
}

function rainIntensityAt(position) {
  const { start, end, ramp } = RAIN_WINDOW;
  return smoothstep(start, start + ramp, position) * (1 - smoothstep(end - ramp, end, position));
}

function mistIntensityAt(position) {
  return smoothstep(RAIN_WINDOW.end - .04, RAIN_WINDOW.end + .08, position) * (1 - smoothstep(.9, 1, position));
}

function lightIntensityAt(position, now) {
  const shimmer = .5 + .5 * Math.sin(now / 4200) * Math.cos(now / 6700);
  const clearSky = 1 - rainIntensityAt(position) * .85;
  return clamp(.35 + .65 * clearSky) * (.75 + .25 * shimmer);
}

function buildRaindrops(now, width, height, intensity) {
  const count = Math.round(MAX_RAINDROPS * intensity);
  const drops = [];
  const seconds = now / 1000;
  const slant = .16;
  for (let index = 0; index < count; index += 1) {
    const speed = 560 + hash01(index, 1) * 260;
    const length = 12 + hash01(index, 2) * 14;
    const travel = height + length * 2;
    const y = ((seconds * speed + hash01(index, 3) * travel) % travel) - length;
    const baseX = hash01(index, 4) * (width + height * slant) - height * slant * .5;
    const x = ((baseX + y * slant) % (width + 40) + width + 40) % (width + 40) - 20;
    drops.push({ x, y, length, alpha: (.18 + hash01(index, 5) * .27) * intensity, slant });
  }
  return drops;
}

function buildLightShafts(now, width, height, intensity) {
  const shafts = [];
  for (let index = 0; index < LIGHT_SHAFT_COUNT; index += 1) {
    const sway = Math.sin(now / (9000 + index * 1700) + index * 2.1) * width * .05;
    const topX = width * (.18 + index * .3) + sway;
    const spread = width * (.045 + hash01(index, 6) * .03);
    shafts.push({ topX, bottomX: topX + width * .22, spread, alpha: (.035 + hash01(index, 7) * .035) * intensity, height: height * .78 });
  }
  return shafts;
}

function buildMistBands(now, width, height, intensity) {
  const bands = [];
  for (let index = 0; index < MIST_BAND_COUNT; index += 1) {
    const drift = ((now / (26000 + index * 9000)) % 1) * width * 2 - width;
    // 两条雾带分别贴近棋盘上方间隙与底部控件区，避免整段被棋盘遮住。
    bands.push({ x: drift, y: height * (.22 + index * .5), width: width * 1.2, height: height * .12, alpha: (.09 + index * .03) * intensity });
  }
  return bands;
}

function createWeatherScene(now, width, height) {
  const position = cyclePosition(now);
  const rain = rainIntensityAt(position);
  const mist = mistIntensityAt(position);
  const light = lightIntensityAt(position, now);
  const phase = rain > .5 ? "rain" : mist > .3 ? "clearing" : "sunlit";
  return {
    now, width, height, position, phase, rain, mist, light,
    skyDim: rain * .22,
    cloudShift: (now / 38000 % 1) * width,
    raindrops: buildRaindrops(now, width, height, rain),
    lightShafts: buildLightShafts(now, width, height, light),
    mistBands: buildMistBands(now, width, height, mist),
  };
}

function drawWeatherBackdrop(context, scene) {
  if (!scene) return;
  const originalAlpha = context.globalAlpha;
  if (scene.skyDim > 0) { context.fillStyle = `rgba(22,52,84,${scene.skyDim.toFixed(3)})`; context.fillRect(0, 0, scene.width, scene.height); }
  for (const shaft of scene.lightShafts) {
    if (shaft.alpha <= 0) continue;
    let fill = `rgba(255,250,214,${shaft.alpha.toFixed(3)})`;
    if (context.createLinearGradient) {
      const gradient = context.createLinearGradient(shaft.topX, 0, shaft.bottomX, shaft.height);
      if (gradient?.addColorStop) { gradient.addColorStop(0, `rgba(255,250,214,${(shaft.alpha * 1.6).toFixed(3)})`); gradient.addColorStop(1, "rgba(255,250,214,0)"); fill = gradient; }
    }
    context.fillStyle = fill; context.beginPath();
    context.moveTo(shaft.topX - shaft.spread * .5, 0); context.lineTo(shaft.topX + shaft.spread * .5, 0);
    context.lineTo(shaft.bottomX + shaft.spread * 1.4, shaft.height); context.lineTo(shaft.bottomX - shaft.spread * 1.4, shaft.height);
    context.closePath(); context.fill();
  }
  context.globalAlpha = originalAlpha === undefined ? 1 : originalAlpha;
}

function drawWeatherMist(context, scene) {
  if (!scene || scene.mist <= 0) return;
  for (const band of scene.mistBands) {
    if (band.alpha <= 0) continue;
    let fill = `rgba(236,246,250,${band.alpha.toFixed(3)})`;
    if (context.createLinearGradient) {
      const gradient = context.createLinearGradient(band.x, band.y, band.x + band.width, band.y);
      if (gradient?.addColorStop) { gradient.addColorStop(0, "rgba(236,246,250,0)"); gradient.addColorStop(.5, `rgba(236,246,250,${(band.alpha * 1.8).toFixed(3)})`); gradient.addColorStop(1, "rgba(236,246,250,0)"); fill = gradient; }
    }
    context.fillStyle = fill; context.fillRect(band.x, band.y, band.width, band.height);
  }
}

function drawWeatherRain(context, scene) {
  if (!scene || !scene.raindrops.length) return 0;
  const originalAlpha = context.globalAlpha;
  context.lineCap = "round"; context.lineWidth = 1.2; context.strokeStyle = "rgba(226,242,255,1)";
  let drawn = 0;
  for (const drop of scene.raindrops) {
    if (drop.alpha <= 0) continue;
    context.globalAlpha = drop.alpha; context.beginPath();
    context.moveTo(drop.x, drop.y); context.lineTo(drop.x - drop.length * drop.slant, drop.y - drop.length); context.stroke();
    drawn += 1;
  }
  context.globalAlpha = originalAlpha === undefined ? 1 : originalAlpha;
  return drawn;
}

module.exports = {
  LIGHT_SHAFT_COUNT, MAX_RAINDROPS, MIST_BAND_COUNT, RAIN_WINDOW, WEATHER_CYCLE_MS,
  createWeatherScene, cyclePosition, drawWeatherBackdrop, drawWeatherMist, drawWeatherRain, hash01,
  lightIntensityAt, mistIntensityAt, rainIntensityAt, smoothstep,
};

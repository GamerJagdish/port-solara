// Every surface texture in Port Solara is painted here on a canvas at start-up: asphalt, sidewalk,
// sand, facades for each building style, roofs and the shop signs and billboards. Nothing is loaded.
import * as THREE from 'three';
import { createRandom } from '../core/random.js';

const cache = new Map();

function canvasOf(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return { canvas, ctx: canvas.getContext('2d') };
}

function toTexture(canvas, repeat = true) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  if (repeat) texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

function speckle(ctx, width, height, count, colors, seed, size = 1.5) {
  const rand = createRandom(seed);
  for (let i = 0; i < count; i += 1) {
    ctx.fillStyle = colors[Math.floor(rand() * colors.length)];
    ctx.fillRect(rand() * width, rand() * height, size * (0.5 + rand()), size * (0.5 + rand()));
  }
}

function memo(key, paint) {
  if (!cache.has(key)) cache.set(key, paint());
  return cache.get(key);
}

export const asphaltTexture = () => memo('asphalt', () => {
  const { canvas, ctx } = canvasOf(256, 256);
  ctx.fillStyle = '#4a4b50';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 5200, ['#3d3e43', '#55565b', '#45464a', '#5d5e62'], 11);
  ctx.strokeStyle = 'rgba(30,30,34,0.35)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(30, 0);
  ctx.bezierCurveTo(60, 80, 20, 160, 70, 256);
  ctx.stroke();
  return toTexture(canvas);
});

export const sidewalkTexture = () => memo('sidewalk', () => {
  const { canvas, ctx } = canvasOf(128, 128);
  ctx.fillStyle = '#cfc8ba';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, 900, ['#c4bdaf', '#d8d2c5', '#bfb8aa'], 12, 1);
  ctx.strokeStyle = '#ada597';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 126, 126);
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, 128);
  ctx.moveTo(0, 64);
  ctx.lineTo(128, 64);
  ctx.stroke();
  return toTexture(canvas);
});

export const sandTexture = () => memo('sand', () => {
  const { canvas, ctx } = canvasOf(256, 256);
  ctx.fillStyle = '#ead7ac';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 6000, ['#e2cc9c', '#f1e0ba', '#d9c290', '#f5e7c7'], 13, 1.2);
  return toTexture(canvas);
});

export const grassTexture = () => memo('grass', () => {
  const { canvas, ctx } = canvasOf(256, 256);
  ctx.fillStyle = '#6fa64a';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 7000, ['#5f9640', '#7db556', '#68a044', '#89bd5f'], 14, 1.4);
  return toTexture(canvas);
});

export const plazaTexture = () => memo('plaza', () => {
  const { canvas, ctx } = canvasOf(128, 128);
  ctx.fillStyle = '#e4d6c0';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#d2a98a';
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 4; x += 1) if ((x + y) % 2 === 0) ctx.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
  speckle(ctx, 128, 128, 500, ['rgba(0,0,0,0.05)', 'rgba(255,255,255,0.08)'], 15, 1);
  return toTexture(canvas);
});

export const concreteTexture = () => memo('concrete', () => {
  const { canvas, ctx } = canvasOf(256, 256);
  ctx.fillStyle = '#a9a8a3';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 4000, ['#9f9e99', '#b4b3ae', '#96958f'], 16, 1.5);
  ctx.strokeStyle = 'rgba(70,70,70,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, 256, 256);
  ctx.fillStyle = 'rgba(214,180,40,0.75)';
  ctx.fillRect(0, 120, 256, 6);
  return toTexture(canvas);
});

export const roofTexture = () => memo('roof', () => {
  const { canvas, ctx } = canvasOf(128, 128);
  ctx.fillStyle = '#9a958d';
  ctx.fillRect(0, 0, 128, 128);
  speckle(ctx, 128, 128, 2500, ['#8c877f', '#aaa59c', '#7f7a72'], 17, 1.2);
  return toTexture(canvas);
});

/** Glass curtain wall: 2 bays by 2 floors (8 m by 7.2 m). */
export const towerFacadeTexture = () => memo('tower', () => {
  const { canvas, ctx } = canvasOf(256, 256);
  ctx.fillStyle = '#e3e7ea';
  ctx.fillRect(0, 0, 256, 256);
  const rand = createRandom(21);
  for (let floor = 0; floor < 2; floor += 1) {
    for (let bay = 0; bay < 4; bay += 1) {
      const x = bay * 64 + 3;
      const y = floor * 128 + 4;
      const shade = 0.55 + rand() * 0.35;
      const gradient = ctx.createLinearGradient(x, y, x + 58, y + 104);
      gradient.addColorStop(0, `rgb(${Math.round(150 * shade)},${Math.round(185 * shade)},${Math.round(215 * shade)})`);
      gradient.addColorStop(1, `rgb(${Math.round(70 * shade)},${Math.round(98 * shade)},${Math.round(130 * shade)})`);
      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, 58, 104);
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.moveTo(x, y + 60);
      ctx.lineTo(x + 40, y);
      ctx.lineTo(x + 58, y);
      ctx.lineTo(x, y + 90);
      ctx.fill();
    }
    ctx.fillStyle = '#b9c0c6';
    ctx.fillRect(0, floor * 128 + 110, 256, 18);
  }
  return toTexture(canvas);
});

/** Stucco wall with framed windows: 2 bays by 2 floors (8 m by 7 m). */
export const stuccoFacadeTexture = () => memo('stucco', () => {
  const { canvas, ctx } = canvasOf(256, 256);
  ctx.fillStyle = '#f6f1e8';
  ctx.fillRect(0, 0, 256, 256);
  speckle(ctx, 256, 256, 1600, ['#efe9de', '#fbf8f1', '#ebe4d8'], 22, 1.3);
  for (let floor = 0; floor < 2; floor += 1) {
    for (let bay = 0; bay < 2; bay += 1) {
      const x = bay * 128 + 34;
      const y = floor * 128 + 30;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 5, y - 5, 70, 78);
      const glass = ctx.createLinearGradient(x, y, x, y + 68);
      glass.addColorStop(0, '#5d7c96');
      glass.addColorStop(1, '#2b3d4f');
      ctx.fillStyle = glass;
      ctx.fillRect(x, y, 60, 68);
      ctx.fillStyle = '#e9e3d7';
      ctx.fillRect(x + 28, y, 4, 68);
      ctx.fillStyle = '#d9d2c4';
      ctx.fillRect(x - 8, y + 70, 76, 7);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.06)';
    ctx.fillRect(0, floor * 128 + 122, 256, 6);
  }
  return toTexture(canvas);
});

/** Small house wall: 2 bays by one storey (8 m by 3.5 m). */
export const houseFacadeTexture = () => memo('house', () => {
  const { canvas, ctx } = canvasOf(256, 128);
  ctx.fillStyle = '#f7f2ea';
  ctx.fillRect(0, 0, 256, 128);
  speckle(ctx, 256, 128, 900, ['#efe8dc', '#fffdf8'], 23, 1.3);
  for (let bay = 0; bay < 2; bay += 1) {
    const x = bay * 128 + 30;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 4, 26, 76, 60);
    ctx.fillStyle = '#3c5468';
    ctx.fillRect(x, 30, 68, 52);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 32, 30, 4, 52);
    ctx.fillRect(x, 54, 68, 3);
  }
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  ctx.fillRect(0, 120, 256, 8);
  return toTexture(canvas);
});

/** Corrugated warehouse cladding: 8 m by 8 m. */
export const warehouseFacadeTexture = () => memo('warehouse', () => {
  const { canvas, ctx } = canvasOf(256, 256);
  ctx.fillStyle = '#e8e8e6';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 8) {
    ctx.fillStyle = 'rgba(0,0,0,0.13)';
    ctx.fillRect(x, 0, 3, 256);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(x + 4, 0, 2, 256);
  }
  ctx.fillStyle = '#56636e';
  for (let i = 0; i < 4; i += 1) ctx.fillRect(i * 64 + 8, 24, 48, 22);
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  ctx.fillRect(0, 230, 256, 26);
  return toTexture(canvas);
});

/** Ground-floor shop front: 8 m by 4.2 m of glass, doors and a fascia. */
export const shopfrontTexture = () => memo('shopfront', () => {
  const { canvas, ctx } = canvasOf(256, 128);
  ctx.fillStyle = '#f1ece2';
  ctx.fillRect(0, 0, 256, 128);
  const glass = ctx.createLinearGradient(0, 30, 0, 128);
  glass.addColorStop(0, '#7f9bb0');
  glass.addColorStop(1, '#2e3f4d');
  ctx.fillStyle = glass;
  ctx.fillRect(10, 34, 150, 90);
  ctx.fillRect(176, 40, 66, 88);
  ctx.fillStyle = '#e8e2d6';
  ctx.fillRect(82, 34, 5, 90);
  ctx.fillStyle = 'rgba(255,240,200,0.55)';
  ctx.fillRect(20, 80, 50, 30);
  ctx.fillRect(100, 72, 46, 40);
  ctx.fillStyle = '#d4c9b5';
  ctx.fillRect(0, 0, 256, 24);
  return toTexture(canvas);
});

/** A soft round sprite used by particles and light glows. */
export const softDotTexture = () => memo('dot', () => {
  const { canvas, ctx } = canvasOf(64, 64);
  const gradient = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255,255,255,1)');
  gradient.addColorStop(0.35, 'rgba(255,255,255,0.7)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 64, 64);
  return toTexture(canvas, false);
});

/**
 * A painted sign or billboard: big title, optional subtitle, in a brand's colours.
 * style: 'banner' (flat board), 'neon' (dark board with glowing text) or 'billboard' (poster art).
 */
export function signTexture({ title, subtitle = '', background = '#ffffff', color = '#1b1b1b', accent = '#ff6b4a', style = 'banner', width = 512, height = 128 }) {
  const key = `sign:${title}:${subtitle}:${style}:${background}:${color}`;
  return memo(key, () => {
    const { canvas, ctx } = canvasOf(width, height);
    ctx.fillStyle = background;
    ctx.fillRect(0, 0, width, height);
    if (style === 'billboard') {
      const sky = ctx.createLinearGradient(0, 0, 0, height);
      sky.addColorStop(0, background);
      sky.addColorStop(1, accent);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, width, height);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();
      ctx.arc(width * 0.82, height * 0.42, height * 0.26, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 4; i += 1) {
        ctx.fillStyle = background;
        ctx.fillRect(width * 0.7, height * (0.44 + i * 0.07), width * 0.25, height * 0.025);
      }
    }
    ctx.fillStyle = accent;
    if (style === 'banner') ctx.fillRect(0, height - 12, width, 12);
    ctx.textAlign = style === 'billboard' ? 'left' : 'center';
    ctx.textBaseline = 'middle';
    const x = style === 'billboard' ? width * 0.06 : width / 2;
    if (style === 'neon') {
      ctx.shadowColor = color;
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = color;
    ctx.font = `900 ${Math.round(height * (subtitle ? 0.42 : 0.56))}px "Arial Black", Impact, sans-serif`;
    ctx.fillText(title, x, height * (subtitle ? 0.4 : 0.5), width * 0.9);
    if (subtitle) {
      ctx.shadowBlur = 0;
      ctx.font = `700 ${Math.round(height * 0.2)}px "Trebuchet MS", Arial, sans-serif`;
      ctx.fillStyle = style === 'billboard' ? '#ffffff' : color;
      ctx.fillText(subtitle, x, height * 0.78, width * 0.9);
    }
    return toTexture(canvas, false);
  });
}

import * as THREE from 'three';

export interface ProceduralTexturePack {
  carbonWeave: THREE.CanvasTexture;
  brushedMetal: THREE.CanvasTexture;
  rustedContainer: THREE.CanvasTexture;
  rustedRoughness: THREE.CanvasTexture;
  hazardStripes: THREE.CanvasTexture;
  rivetedSteel: THREE.CanvasTexture;
  circuitGlass: THREE.CanvasTexture;
  crateredAsteroid: THREE.CanvasTexture;
  woodPlank: THREE.CanvasTexture;
  stoneIsland: THREE.CanvasTexture;
  trampolinePad: THREE.CanvasTexture;
  solarGrid: THREE.CanvasTexture;
  summitGold: THREE.CanvasTexture;
}

let cachedPack: ProceduralTexturePack | null = null;

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function finalize(
  canvas: HTMLCanvasElement,
  repeatX = 1,
  repeatY = 1,
  srgb = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function getProceduralTextures(): ProceduralTexturePack {
  if (cachedPack) return cachedPack;

  // 1. Carbon fiber weave
  const [c1, x1] = makeCanvas(128, 128);
  x1.fillStyle = '#151922';
  x1.fillRect(0, 0, 128, 128);
  for (let y = 0; y < 128; y += 16) {
    for (let x = 0; x < 128; x += 16) {
      const even = ((x + y) / 16) % 2 === 0;
      x1.fillStyle = even ? '#283142' : '#0f131b';
      x1.fillRect(x, y, 14, 7);
      x1.fillStyle = even ? '#181e29' : '#313c52';
      x1.fillRect(x, y + 8, 14, 7);
    }
  }
  const carbonWeave = finalize(c1, 4, 4);

  // 2. Brushed metal grain
  const [c2, x2] = makeCanvas(256, 256);
  x2.fillStyle = '#b4c0cf';
  x2.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 420; i++) {
    const y = Math.random() * 256;
    const alpha = 0.04 + Math.random() * 0.09;
    x2.fillStyle = Math.random() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(15,23,42,${alpha})`;
    x2.fillRect(0, y, 256, 1 + Math.random() * 1.5);
  }
  const brushedMetal = finalize(c2, 2, 2);

  // 3. Corrugated rusted shipping container + matching roughness map
  const [c3, x3] = makeCanvas(256, 128);
  const [c3r, x3r] = makeCanvas(256, 128);
  x3.fillStyle = '#d4d4d8';
  x3.fillRect(0, 0, 256, 128);
  x3r.fillStyle = '#7a7a7a';
  x3r.fillRect(0, 0, 256, 128);

  for (let x = 0; x < 256; x += 16) {
    const g = x3.createLinearGradient(x, 0, x + 16, 0);
    g.addColorStop(0, '#8f8f99');
    g.addColorStop(0.45, '#f4f4f5');
    g.addColorStop(0.55, '#f4f4f5');
    g.addColorStop(1, '#686872');
    x3.fillStyle = g;
    x3.fillRect(x, 0, 16, 128);
  }
  // Rust wear blotches
  for (let i = 0; i < 75; i++) {
    const rx = Math.random() * 256;
    const ry = Math.random() * 128;
    const rad = 4 + Math.random() * 14;
    x3.fillStyle = `rgba(124, 45, 18, ${0.14 + Math.random() * 0.25})`;
    x3.beginPath();
    x3.arc(rx, ry, rad, 0, Math.PI * 2);
    x3.fill();
    x3r.fillStyle = `rgba(235, 235, 235, ${0.35 + Math.random() * 0.4})`;
    x3r.beginPath();
    x3r.arc(rx, ry, rad, 0, Math.PI * 2);
    x3r.fill();
  }
  x3.strokeStyle = 'rgba(0,0,0,0.35)';
  x3.lineWidth = 6;
  x3.strokeRect(3, 3, 250, 122);
  const rustedContainer = finalize(c3, 2, 1);
  const rustedRoughness = finalize(c3r, 2, 1, false);

  // 4. Yellow / black hazard caution stripes
  const [cHaz, xHaz] = makeCanvas(256, 256);
  xHaz.fillStyle = '#eab308';
  xHaz.fillRect(0, 0, 256, 256);
  xHaz.fillStyle = '#18181b';
  for (let i = -256; i < 512; i += 48) {
    xHaz.beginPath();
    xHaz.moveTo(i, 0);
    xHaz.lineTo(i + 24, 0);
    xHaz.lineTo(i + 280, 256);
    xHaz.lineTo(i + 256, 256);
    xHaz.closePath();
    xHaz.fill();
  }
  const hazardStripes = finalize(cHaz, 2, 1);

  // 5. Riveted steel beam
  const [cRiv, xRiv] = makeCanvas(256, 128);
  xRiv.fillStyle = '#64748b';
  xRiv.fillRect(0, 0, 256, 128);
  xRiv.fillStyle = '#475569';
  xRiv.fillRect(0, 0, 256, 20);
  xRiv.fillRect(0, 108, 256, 20);
  for (let x = 16; x < 256; x += 32) {
    for (const ry of [10, 118]) {
      xRiv.fillStyle = '#cbd5e1';
      xRiv.beginPath();
      xRiv.arc(x, ry, 4.5, 0, Math.PI * 2);
      xRiv.fill();
      xRiv.strokeStyle = '#1e293b';
      xRiv.lineWidth = 1.5;
      xRiv.stroke();
    }
  }
  const rivetedSteel = finalize(cRiv, 3, 1);

  // 6. Circuit-etched translucent cyber-glass
  const [cGl, xGl] = makeCanvas(256, 256);
  xGl.fillStyle = '#bae6fd';
  xGl.fillRect(0, 0, 256, 256);
  xGl.strokeStyle = '#0284c7';
  xGl.lineWidth = 3;
  xGl.strokeRect(6, 6, 244, 244);
  xGl.strokeStyle = 'rgba(255, 255, 255, 0.85)';
  xGl.lineWidth = 2;
  for (let i = 32; i < 256; i += 48) {
    xGl.beginPath();
    xGl.moveTo(16, i);
    xGl.lineTo(i, i);
    xGl.lineTo(i + 24, i + 24);
    xGl.lineTo(240, i + 24);
    xGl.stroke();
    xGl.fillStyle = '#e0f2fe';
    xGl.beginPath();
    xGl.arc(i, i, 4, 0, Math.PI * 2);
    xGl.fill();
  }
  const circuitGlass = finalize(cGl, 1, 1);

  // 7. Cratered space asteroid
  const [cAst, xAst] = makeCanvas(256, 256);
  xAst.fillStyle = '#475569';
  xAst.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const cx = Math.random() * 256;
    const cy = Math.random() * 256;
    const r = 8 + Math.random() * 22;
    xAst.fillStyle = '#1e293b';
    xAst.beginPath();
    xAst.arc(cx, cy, r, 0, Math.PI * 2);
    xAst.fill();
    xAst.strokeStyle = '#94a3b8';
    xAst.lineWidth = 2.5;
    xAst.stroke();
  }
  const crateredAsteroid = finalize(cAst, 2, 2);

  // 8. Wood plank grain
  const [c4, x4] = makeCanvas(256, 128);
  x4.fillStyle = '#9a6638';
  x4.fillRect(0, 0, 256, 128);
  for (let y = 0; y < 128; y += 32) {
    x4.fillStyle = y % 64 === 0 ? '#a67141' : '#8d5b30';
    x4.fillRect(0, y, 256, 30);
    x4.fillStyle = '#5c3818';
    x4.fillRect(0, y + 30, 256, 2);
  }
  for (let i = 0; i < 120; i++) {
    x4.fillStyle = 'rgba(58, 32, 12, 0.16)';
    x4.fillRect(Math.random() * 256, Math.random() * 128, 30 + Math.random() * 50, 1.5);
  }
  const woodPlank = finalize(c4, 1, 1);

  // 9. Stone island rock
  const [c5, x5] = makeCanvas(256, 256);
  x5.fillStyle = '#64748b';
  x5.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 220; i++) {
    const shade = 75 + Math.floor(Math.random() * 65);
    x5.fillStyle = `rgba(${shade}, ${shade + 8}, ${shade + 18}, 0.35)`;
    x5.beginPath();
    x5.arc(Math.random() * 256, Math.random() * 256, 6 + Math.random() * 18, 0, Math.PI * 2);
    x5.fill();
  }
  const stoneIsland = finalize(c5, 2, 2);

  // 10. Trampoline target pad
  const [c6, x6] = makeCanvas(256, 256);
  x6.fillStyle = '#18181b';
  x6.fillRect(0, 0, 256, 256);
  const drawRing = (r: number, color: string) => {
    x6.beginPath();
    x6.arc(128, 128, r, 0, Math.PI * 2);
    x6.fillStyle = color;
    x6.fill();
  };
  drawRing(116, '#f97316');
  drawRing(94, '#18181b');
  drawRing(72, '#fbbf24');
  drawRing(46, '#18181b');
  drawRing(24, '#22d3ee');
  const trampolinePad = finalize(c6, 1, 1);

  // 11. Satellite solar grid
  const [c7, x7] = makeCanvas(256, 256);
  x7.fillStyle = '#0f2557';
  x7.fillRect(0, 0, 256, 256);
  x7.strokeStyle = '#60a5fa';
  x7.lineWidth = 2;
  for (let i = 0; i <= 256; i += 32) {
    x7.beginPath();
    x7.moveTo(i, 0);
    x7.lineTo(i, 256);
    x7.stroke();
    x7.beginPath();
    x7.moveTo(0, i);
    x7.lineTo(256, i);
    x7.stroke();
  }
  const solarGrid = finalize(c7, 2, 1);

  // 12. Golden Summit Emblem
  const [c8, x8] = makeCanvas(256, 256);
  const grad = x8.createRadialGradient(128, 128, 12, 128, 128, 128);
  grad.addColorStop(0, '#fef9c3');
  grad.addColorStop(0.5, '#f59e0b');
  grad.addColorStop(1, '#78350f');
  x8.fillStyle = grad;
  x8.fillRect(0, 0, 256, 256);
  x8.strokeStyle = '#fffbeb';
  x8.lineWidth = 5;
  x8.beginPath();
  x8.arc(128, 128, 100, 0, Math.PI * 2);
  x8.stroke();
  x8.beginPath();
  x8.arc(128, 128, 65, 0, Math.PI * 2);
  x8.stroke();
  const summitGold = finalize(c8, 1, 1);

  cachedPack = {
    carbonWeave,
    brushedMetal,
    rustedContainer,
    rustedRoughness,
    hazardStripes,
    rivetedSteel,
    circuitGlass,
    crateredAsteroid,
    woodPlank,
    stoneIsland,
    trampolinePad,
    solarGrid,
    summitGold,
  };
  return cachedPack;
}

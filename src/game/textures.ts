import * as THREE from 'three';

export interface ProceduralTexturePack {
  carvedObsidian: THREE.CanvasTexture;
  ancientGoldRune: THREE.CanvasTexture;
  astralCrystal: THREE.CanvasTexture;
  crackedStone: THREE.CanvasTexture;
  cursedSwordSteel: THREE.CanvasTexture;
  runeJumpPad: THREE.CanvasTexture;
  throneMarble: THREE.CanvasTexture;
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
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

export function getProceduralTextures(): ProceduralTexturePack {
  if (cachedPack) return cachedPack;

  // 1. Carved Obsidian
  const [cObs, xObs] = makeCanvas(256, 256);
  xObs.fillStyle = '#14111c';
  xObs.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 160; i++) {
    xObs.strokeStyle =
      i % 3 === 0 ? 'rgba(251, 191, 36, 0.14)' : 'rgba(139, 92, 246, 0.12)';
    xObs.lineWidth = 1.5;
    const rx = Math.random() * 256;
    const ry = Math.random() * 256;
    xObs.beginPath();
    xObs.moveTo(rx, ry);
    xObs.lineTo(rx + (Math.random() - 0.5) * 44, ry + (Math.random() - 0.5) * 44);
    xObs.stroke();
  }
  xObs.strokeStyle = 'rgba(245, 158, 11, 0.35)';
  xObs.lineWidth = 4;
  xObs.strokeRect(8, 8, 240, 240);
  const carvedObsidian = finalize(cObs, 2, 2);

  // 2. Ancient Gold Runes
  const [cGold, xGold] = makeCanvas(256, 256);
  const gradG = xGold.createLinearGradient(0, 0, 256, 256);
  gradG.addColorStop(0, '#b45309');
  gradG.addColorStop(0.5, '#fbbf24');
  gradG.addColorStop(1, '#78350f');
  xGold.fillStyle = gradG;
  xGold.fillRect(0, 0, 256, 256);
  xGold.strokeStyle = '#fef3c7';
  xGold.lineWidth = 3;
  xGold.strokeRect(12, 12, 232, 232);
  xGold.beginPath();
  xGold.arc(128, 128, 72, 0, Math.PI * 2);
  xGold.stroke();
  xGold.beginPath();
  xGold.moveTo(128, 28);
  xGold.lineTo(228, 128);
  xGold.lineTo(128, 228);
  xGold.lineTo(28, 128);
  xGold.closePath();
  xGold.stroke();
  const ancientGoldRune = finalize(cGold, 1, 1);

  // 3. Glowing Astral Crystal
  const [cCry, xCry] = makeCanvas(256, 256);
  const gradC = xCry.createLinearGradient(0, 0, 256, 256);
  gradC.addColorStop(0, '#0891b2');
  gradC.addColorStop(0.5, '#67e8f9');
  gradC.addColorStop(1, '#6d28d9');
  xCry.fillStyle = gradC;
  xCry.fillRect(0, 0, 256, 256);
  xCry.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  xCry.lineWidth = 2;
  for (let i = 0; i < 24; i++) {
    xCry.beginPath();
    xCry.moveTo(Math.random() * 256, 0);
    xCry.lineTo(Math.random() * 256, 256);
    xCry.stroke();
  }
  const astralCrystal = finalize(cCry, 2, 2);

  // 4. Cracked Stone
  const [cSt, xSt] = makeCanvas(256, 256);
  xSt.fillStyle = '#475569';
  xSt.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 180; i++) {
    const shade = 55 + Math.floor(Math.random() * 60);
    xSt.fillStyle = `rgba(${shade}, ${shade + 4}, ${shade + 10}, 0.4)`;
    xSt.fillRect(Math.random() * 256, Math.random() * 256, 12 + Math.random() * 28, 8 + Math.random() * 20);
  }
  xSt.strokeStyle = 'rgba(15, 23, 42, 0.7)';
  xSt.lineWidth = 2.2;
  for (let i = 0; i < 18; i++) {
    let cx = Math.random() * 256;
    let cy = Math.random() * 256;
    xSt.beginPath();
    xSt.moveTo(cx, cy);
    for (let s = 0; s < 4; s++) {
      cx += (Math.random() - 0.5) * 40;
      cy += (Math.random() - 0.5) * 40;
      xSt.lineTo(cx, cy);
    }
    xSt.stroke();
  }
  const crackedStone = finalize(cSt, 2, 2);

  // 5. Cursed Colossal Blade Steel
  const [cSw, xSw] = makeCanvas(256, 128);
  const gradS = xSw.createLinearGradient(0, 0, 0, 128);
  gradS.addColorStop(0, '#94a3b8');
  gradS.addColorStop(0.5, '#1e293b');
  gradS.addColorStop(1, '#94a3b8');
  xSw.fillStyle = gradS;
  xSw.fillRect(0, 0, 256, 128);
  xSw.fillStyle = '#f59e0b';
  xSw.fillRect(0, 60, 256, 8);
  const cursedSwordSteel = finalize(cSw, 2, 1);

  // 6. Golden Rune Jump Pad
  const [cPad, xPad] = makeCanvas(256, 256);
  xPad.fillStyle = '#18121e';
  xPad.fillRect(0, 0, 256, 256);
  const ring = (r: number, col: string, w = 8) => {
    xPad.beginPath();
    xPad.arc(128, 128, r, 0, Math.PI * 2);
    xPad.strokeStyle = col;
    xPad.lineWidth = w;
    xPad.stroke();
  };
  ring(112, '#f59e0b', 10);
  ring(82, '#fde047', 6);
  ring(52, '#22d3ee', 8);
  xPad.fillStyle = '#fffbeb';
  xPad.beginPath();
  xPad.arc(128, 128, 22, 0, Math.PI * 2);
  xPad.fill();
  const runeJumpPad = finalize(cPad, 1, 1);

  // 7. Throne of Eternity Marble
  const [cTh, xTh] = makeCanvas(256, 256);
  xTh.fillStyle = '#f8fafc';
  xTh.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    xTh.strokeStyle = i % 2 === 0 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(148, 163, 184, 0.3)';
    xTh.lineWidth = 2;
    xTh.beginPath();
    xTh.moveTo(0, Math.random() * 256);
    xTh.bezierCurveTo(85, Math.random() * 256, 170, Math.random() * 256, 256, Math.random() * 256);
    xTh.stroke();
  }
  const throneMarble = finalize(cTh, 2, 2);

  cachedPack = {
    carvedObsidian,
    ancientGoldRune,
    astralCrystal,
    crackedStone,
    cursedSwordSteel,
    runeJumpPad,
    throneMarble,
  };
  return cachedPack;
}

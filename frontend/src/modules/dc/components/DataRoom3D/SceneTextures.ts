import * as THREE from 'three';

// ── 纹理缓存 ──
const texCache: Record<string, THREE.CanvasTexture> = {};

function floorTex(): THREE.CanvasTexture {
  if (texCache._floor) return texCache._floor;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#4a5a6a';
  ctx.fillRect(0, 0, 256, 256);
  for (let x = 0; x < 256; x += 3) {
    for (let y = 0; y < 256; y += 3) {
      const n = (Math.random() - 0.5) * 10;
      const v = Math.max(0, Math.min(255, 74 + n));
      ctx.fillStyle = `rgb(${v},${v+8},${v+20})`;
      ctx.fillRect(x, y, 3, 3);
    }
  }
  ctx.strokeStyle = '#3a4a55';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, 254, 254);
  ctx.strokeStyle = 'rgba(100,120,140,0.5)';
  ctx.lineWidth = 1;
  [64, 128, 192].forEach(p => {
    ctx.beginPath(); ctx.moveTo(p, 4); ctx.lineTo(p, 252); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, p); ctx.lineTo(252, p); ctx.stroke();
  });
  texCache._floor = new THREE.CanvasTexture(c);
  return texCache._floor;
}

function labelTex(id: string, warn: boolean): THREE.CanvasTexture {
  const k = `L_${id}_${warn}`;
  if (texCache[k]) return texCache[k];
  const c = document.createElement('canvas');
  c.width = 256; c.height = 64;
  const ctx = c.getContext('2d')!;
  const g = ctx.createLinearGradient(0, 0, 256, 0);
  if (warn) { g.addColorStop(0, 'rgba(255,80,50,0.15)'); g.addColorStop(0.5, 'rgba(255,80,50,0.3)'); g.addColorStop(1, 'rgba(255,80,50,0.15)'); }
  else { g.addColorStop(0, 'rgba(0,212,255,0.1)'); g.addColorStop(0.5, 'rgba(0,212,255,0.22)'); g.addColorStop(1, 'rgba(0,212,255,0.1)'); }
  ctx.fillStyle = g; ctx.fillRect(0, 0, 256, 64);
  ctx.strokeStyle = warn ? 'rgba(255,100,60,0.6)' : 'rgba(0,212,255,0.5)';
  ctx.lineWidth = 2; ctx.strokeRect(2, 2, 252, 60);
  ctx.fillStyle = warn ? '#ff8866' : '#00d4ff';
  ctx.font = 'bold 32px Arial'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.shadowColor = warn ? '#ff4422' : '#00aacc'; ctx.shadowBlur = 8;
  ctx.fillText(id, 128, 34);
  texCache[k] = new THREE.CanvasTexture(c);
  return texCache[k];
}

/** 设备名称 Sprite（始终面向相机；高度按占用 U 数缩放，避免 1U 设备名称互相重叠） */
function deviceNameSprite(name: string, warn: boolean, uHeight = 1): THREE.Sprite {
  const k = `DEVN_${name}_${warn}_${uHeight}`;
  let tex = texCache[k];
  if (!tex) {
    const c = document.createElement('canvas');
    c.width = 512; c.height = 64;
    const ctx = c.getContext('2d')!;
    ctx.font = 'bold 40px Arial';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = warn ? 'rgba(255,170,120,0.95)' : 'rgba(185,235,255,0.95)';
    ctx.shadowColor = 'rgba(0,10,20,0.9)'; ctx.shadowBlur = 8;
    ctx.fillText(name, 256, 32);
    tex = new THREE.CanvasTexture(c);
    texCache[k] = tex;
  }
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  // 宽高比 8:1；高度不超过 0.24，宽度随比例
  const h = Math.min(0.24, Math.max(0.1, uHeight * 0.11));
  sp.scale.set(h * 8, h, 1);
  return sp;
}

export { floorTex, labelTex, deviceNameSprite };

// Live animated Snake Garden ("蛇蛇花园"): grass, flowers, candy parasol, butterflies & playful snakes.
import { getSnake } from './snakes.js';
const OUTLINE = '#6b2d47';
const SPEECHES = ['贴贴~', '好开心!', '晒太阳~', '哼歌♪', '软乎乎~', '想吃草莓!'];

function createGarden(ctx, opts = {}) {
  let width = opts.width || 340;
  let height = opts.height || 380;
  let elapsed = 0;
  let actors = [];
  let floats = [];
  let butterflies = [
    { x: 0.22, y: 0.34, vx: 0.04, phase: 0, color: '#ff9ec8' },
    { x: 0.74, y: 0.28, vx: -0.035, phase: 2.1, color: '#ffe066' }
  ];

  // Static decorative props (normalized coordinates)
  const grassTufts = [
    [0.10, 0.56], [0.24, 0.62], [0.42, 0.55], [0.85, 0.60],
    [0.14, 0.80], [0.36, 0.86], [0.62, 0.84], [0.88, 0.82],
    [0.08, 0.68], [0.54, 0.68], [0.92, 0.70]
  ];
  const flowers = [
    [0.16, 0.58, '#ff85b3'], [0.29, 0.65, '#ffe066'], [0.47, 0.58, '#ffffff'],
    [0.19, 0.84, '#ffc2dc'], [0.44, 0.88, '#ffe066'], [0.81, 0.86, '#ff85b3'],
    [0.89, 0.64, '#ffffff'], [0.11, 0.74, '#ffe066']
  ];

  function makeActor(id, idx, total) {
    const skin = getSnake(id);
    const angle = (idx / Math.max(1, total)) * Math.PI * 2;
    const cx = width * (0.22 + ((idx * 0.23) % 0.58));
    const cy = height * (0.58 + ((idx * 0.13) % 0.28));
    return {
      id: skin.id,
      skin,
      x: cx,
      y: cy,
      vx: Math.cos(angle) * 24,
      vy: Math.sin(angle) * 14,
      facing: Math.cos(angle) >= 0 ? 1 : -1,
      action: idx % 3 === 1 ? 'nap' : 'walk', // walk | hop | nap | spin | sing
      actionTimer: 2.2 + (idx * 0.9) % 3,
      phase: idx * 1.4,
      speech: '',
      speechTimer: 0
    };
  }

  function setSnakes(ids) {
    const list = Array.isArray(ids) && ids.length ? ids : ['strawberry'];
    const map = {};
    actors.forEach(a => { map[a.id] = a; });
    actors = list.map((id, i) => map[id] || makeActor(id, i, list.length));
  }

  function resize(w, h) {
    if (w > 0) width = w;
    if (h > 0) height = h;
    actors.forEach(a => {
      a.x = Math.max(36, Math.min(width - 36, a.x));
      a.y = Math.max(height * 0.50, Math.min(height - 34, a.y));
    });
  }

  function pickNextAction(a) {
    const r = Math.random();
    if (r < 0.42) {
      a.action = 'walk';
      const ang = Math.random() * Math.PI * 2;
      const spd = 20 + Math.random() * 18;
      a.vx = Math.cos(ang) * spd;
      a.vy = Math.sin(ang) * spd * 0.55;
      a.facing = a.vx >= 0 ? 1 : -1;
      a.actionTimer = 2.6 + Math.random() * 2.5;
    } else if (r < 0.62) {
      a.action = 'hop';
      a.vx = 0; a.vy = 0;
      a.actionTimer = 2.0 + Math.random() * 1.2;
      floats.push({ x: a.x, y: a.y - 22, text: '💗', life: 0, maxLife: 1.3 });
    } else if (r < 0.78) {
      a.action = 'nap';
      a.vx = 0; a.vy = 0;
      a.actionTimer = 3.2 + Math.random() * 2.2;
    } else if (r < 0.90) {
      a.action = 'spin';
      a.vx = 0; a.vy = 0;
      a.actionTimer = 1.8 + Math.random() * 1.0;
      floats.push({ x: a.x, y: a.y - 22, text: '✨', life: 0, maxLife: 1.2 });
    } else {
      a.action = 'sing';
      a.vx = 0; a.vy = 0;
      a.actionTimer = 2.2 + Math.random() * 1.4;
      floats.push({ x: a.x + 8, y: a.y - 22, text: '♪', life: 0, maxLife: 1.4 });
    }
  }

  function tap(px, py) {
    let hit = null, bestDist = 48;
    actors.forEach(a => {
      const d = Math.hypot(a.x - px, a.y - py);
      if (d < bestDist) { bestDist = d; hit = a; }
    });
    if (!hit) return null;
    hit.action = 'hop';
    hit.vx = 0; hit.vy = 0;
    hit.actionTimer = 2.2;
    hit.speech = SPEECHES[Math.floor(Math.random() * SPEECHES.length)];
    hit.speechTimer = 1.8;
    floats.push({ x: hit.x - 10, y: hit.y - 24, text: '💗', life: 0, maxLife: 1.2 });
    floats.push({ x: hit.x + 12, y: hit.y - 18, text: '✨', life: 0, maxLife: 1.1 });
    return hit.skin;
  }

  function drawSkyAndMeadow() {
    // Sunny pastel sky
    const sky = ctx.createLinearGradient(0, 0, 0, height * 0.48);
    sky.addColorStop(0, '#c8f1ff');
    sky.addColorStop(0.68, '#fff2f7');
    sky.addColorStop(1, '#ffe5f0');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height * 0.50);

    // Smiling soft sun
    const sunX = width * 0.16, sunY = height * 0.14;
    ctx.fillStyle = 'rgba(255, 236, 138, 0.35)';
    ctx.beginPath(); ctx.arc(sunX, sunY, 32 + Math.sin(elapsed * 2) * 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffe57f';
    ctx.beginPath(); ctx.arc(sunX, sunY, 20, 0, Math.PI * 2); ctx.fill();

    // Fluffy drifting clouds
    const drawCloud = (cx, cy, s) => {
      ctx.fillStyle = 'rgba(255,255,255,0.88)';
      ctx.beginPath();
      ctx.arc(cx, cy, 14 * s, 0, Math.PI * 2);
      ctx.arc(cx + 14 * s, cy - 4 * s, 16 * s, 0, Math.PI * 2);
      ctx.arc(cx + 28 * s, cy, 13 * s, 0, Math.PI * 2);
      ctx.fill();
    };
    const c1 = ((elapsed * 7) % (width + 80)) - 40;
    const c2 = ((elapsed * 4.5 + width * 0.55) % (width + 90)) - 45;
    drawCloud(c1, height * 0.12, 0.9);
    drawCloud(c2, height * 0.21, 0.72);

    // Rolling back hill
    ctx.fillStyle = '#b4e89c';
    ctx.beginPath();
    ctx.moveTo(0, height * 0.45);
    ctx.quadraticCurveTo(width * 0.3, height * 0.35, width * 0.62, height * 0.43);
    ctx.quadraticCurveTo(width * 0.85, height * 0.48, width, height * 0.40);
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath();
    ctx.fill();

    // White garden picket fence
    const fy = height * 0.44;
    ctx.fillStyle = '#fff9f4';
    ctx.strokeStyle = '#d9a4b8';
    ctx.lineWidth = 1.2;
    ctx.fillRect(0, fy + 8, width, 4);
    ctx.fillRect(0, fy + 18, width, 4);
    for (let x = 8; x < width; x += 22) {
      ctx.beginPath();
      ctx.moveTo(x, fy + 24); ctx.lineTo(x, fy + 4); ctx.lineTo(x + 5, fy - 2);
      ctx.lineTo(x + 10, fy + 4); ctx.lineTo(x + 10, fy + 24); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }

    // Main sunlit lawn
    const lawn = ctx.createLinearGradient(0, height * 0.47, 0, height);
    lawn.addColorStop(0, '#c6f0a8');
    lawn.addColorStop(0.5, '#a8e38a');
    lawn.addColorStop(1, '#8fd472');
    ctx.fillStyle = lawn;
    ctx.fillRect(0, height * 0.48, width, height * 0.52);

    // Soft picnic blanket near parasol
    const px = width * 0.70, py = height * 0.64;
    ctx.save();
    ctx.translate(px, py);
    ctx.fillStyle = '#fff4f8';
    ctx.strokeStyle = '#ff9ec8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 12, 46, 20, 0, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    // Parasol shade shadow
    ctx.fillStyle = 'rgba(84, 126, 74, 0.22)';
    ctx.beginPath();
    ctx.ellipse(-6, 10, 40, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Grass tufts (swaying gently)
    const sway = Math.sin(elapsed * 2.4) * 2.2;
    grassTufts.forEach(([nx, ny], i) => {
      const gx = nx * width, gy = ny * height;
      const s = sway * (i % 2 === 0 ? 1 : -0.8);
      ctx.strokeStyle = '#5da858';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx - 4 + s, gy - 8, gx - 6 + s, gy - 11);
      ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + s * 0.6, gy - 9, gx + s, gy - 13);
      ctx.moveTo(gx, gy); ctx.quadraticCurveTo(gx + 4 + s, gy - 8, gx + 6 + s, gy - 10);
      ctx.stroke();
    });

    // Little garden flowers
    flowers.forEach(([nx, ny, col], i) => {
      const fx = nx * width, fy2 = ny * height;
      const bob = Math.sin(elapsed * 2.6 + i) * 1.2;
      ctx.fillStyle = col;
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        ctx.beginPath();
        ctx.arc(fx + Math.cos(a) * 4.2, fy2 + bob + Math.sin(a) * 4.2, 2.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#ffd954';
      ctx.beginPath(); ctx.arc(fx, fy2 + bob, 2.5, 0, Math.PI * 2); ctx.fill();
    });
  }

  function drawParasol() {
    const px = width * 0.72, baseY = height * 0.66, topY = height * 0.44;
    // Wooden pole
    ctx.strokeStyle = '#9c5a46';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(px, baseY); ctx.lineTo(px + 4, topY); ctx.stroke();

    // Candy-striped umbrella canopy
    const cx = px + 4, cy = topY + 2, rx = 50, ry = 26;
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#ff7eb3';
    ctx.fill();

    // White & butter stripes
    ctx.fillStyle = '#fff9f2';
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry + 8);
    ctx.lineTo(cx - 22, cy + 8);
    ctx.lineTo(cx - 8, cy + 8);
    ctx.closePath();
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx, cy - ry + 8);
    ctx.lineTo(cx + 8, cy + 8);
    ctx.lineTo(cx + 22, cy + 8);
    ctx.closePath();
    ctx.fill();

    // Scalloped outline
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.ellipse(cx, cy + 8, rx, ry, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(cx - rx, cy + 8);
    ctx.stroke();

    // Cute top knob
    ctx.fillStyle = '#ffe066';
    ctx.beginPath(); ctx.arc(cx, cy - ry + 6, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  function drawAccessory(skin, r) {
    ctx.save();
    ctx.lineWidth = 1.6;
    ctx.strokeStyle = OUTLINE;
    if (skin.accessory === 'crown' || skin.accessory === 'rainbow') {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(-7, -r + 2); ctx.lineTo(-8, -r - 7); ctx.lineTo(-3, -r - 3);
      ctx.lineTo(0, -r - 9); ctx.lineTo(3, -r - 3); ctx.lineTo(8, -r - 7);
      ctx.lineTo(7, -r + 2); ctx.closePath();
      ctx.fill(); ctx.stroke();
    } else if (skin.accessory === 'leaf') {
      ctx.fillStyle = '#6be072';
      ctx.beginPath();
      ctx.ellipse(-4, -r - 4, 6, 3.5, -0.5, 0, Math.PI * 2);
      ctx.ellipse(4, -r - 4, 6, 3.5, 0.5, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
    } else if (skin.accessory === 'bow') {
      ctx.fillStyle = '#ff7597';
      ctx.beginPath();
      ctx.ellipse(-6, -r - 2, 5.5, 3.8, -0.3, 0, Math.PI * 2);
      ctx.ellipse(6, -r - 2, 5.5, 3.8, 0.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe066';
      ctx.beginPath(); ctx.arc(0, -r - 2, 2.8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (skin.accessory === 'star') {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? 6.5 : 3;
        const a = (i * Math.PI) / 5 - Math.PI / 2;
        const px = 4 + Math.cos(a) * rad, py = -r - 3 + Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    } else if (skin.accessory === 'heart') {
      ctx.fillStyle = '#ff6699';
      ctx.beginPath();
      ctx.arc(-3, -r - 4, 3.5, 0, Math.PI * 2);
      ctx.arc(3, -r - 4, 3.5, 0, Math.PI * 2);
      ctx.lineTo(0, -r + 2); ctx.closePath();
      ctx.fill(); ctx.stroke();
    }
    ctx.restore();
  }

  function drawActor(a) {
    const t = elapsed + a.phase;
    const hopY = a.action === 'hop' ? -Math.abs(Math.sin(t * 7.5)) * 14 : (a.action === 'sing' ? -Math.abs(Math.sin(t * 5)) * 4 : 0);
    const spinRot = a.action === 'spin' ? Math.sin(t * 8) * 0.28 : 0;
    const facing = a.facing;

    ctx.save();
    ctx.translate(a.x, a.y);

    // Ground shadow
    ctx.fillStyle = 'rgba(72, 114, 64, 0.22)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 22, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(0, hopY);
    ctx.rotate(spinRot);

    // Draw 3 cute trailing body segments + head
    const segs = a.action === 'nap'
      ? [[-12 * facing, 3, 9.5], [-6 * facing, 6, 10.5], [2 * facing, 4, 11.5]]
      : [[-24 * facing, Math.sin(t * 6 + 2) * 3.5, 8.5], [-16 * facing, Math.sin(t * 6 + 1) * 3, 10], [-8 * facing, Math.sin(t * 6) * 2, 11]];

    segs.forEach(([sx, sy, sr], idx) => {
      const col = a.skin.rainbow ? a.skin.rainbow[(idx + 1) % a.skin.rainbow.length] : (idx % 2 === 0 ? a.skin.bodyDark : a.skin.bodyMid);
      ctx.fillStyle = col;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.beginPath(); ctx.arc(sx - 2, sy - 3, sr * 0.35, 0, Math.PI * 2); ctx.fill();
    });

    // Cute round head
    const hr = 13.5;
    ctx.fillStyle = a.skin.rainbow ? a.skin.rainbow[0] : a.skin.bodyLight;
    ctx.strokeStyle = OUTLINE;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(2 * facing, -1, hr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();

    // Accessory on top of head
    ctx.save();
    ctx.translate(2 * facing, -1);
    drawAccessory(a.skin, hr);
    ctx.restore();

    // Eyes & cheeks
    const ex = 2 * facing, ey = -2;
    if (a.action === 'nap') {
      // Closed sleepy eyes
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.arc(ex - 4.5, ey + 1, 2.5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex + 4.5, ey + 1, 2.5, 0.1 * Math.PI, 0.9 * Math.PI);
      ctx.stroke();
    } else {
      ctx.fillStyle = OUTLINE;
      ctx.beginPath(); ctx.arc(ex - 4.5, ey, 2.4, 0, Math.PI * 2); ctx.arc(ex + 4.5, ey, 2.4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(ex - 5.2, ey - 0.8, 0.9, 0, Math.PI * 2); ctx.arc(ex + 3.8, ey - 0.8, 0.9, 0, Math.PI * 2); ctx.fill();
    }
    // Rosy cheeks
    ctx.fillStyle = a.skin.cheek;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.ellipse(ex - 8, ey + 3.5, 3, 1.8, 0, 0, Math.PI * 2); ctx.ellipse(ex + 8, ey + 3.5, 3, 1.8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    // Cute smile
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(ex, ey + 3, 2.6, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();

    // Sleeping Zzz bubble
    if (a.action === 'nap') {
      const zy = -20 - ((elapsed * 12 + a.phase * 5) % 14);
      ctx.fillStyle = '#7c4d6b';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Zzz', ex + 10, zy);
    }

    // Cute rounded speech bubble on tap
    if (a.speechTimer > 0 && a.speech) {
      const bw = 58, bh = 22, bx = -bw / 2, by = -hr - 32, br = 9;
      ctx.fillStyle = '#fffdf9';
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(bx + br, by);
      ctx.lineTo(bx + bw - br, by);
      ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + br);
      ctx.lineTo(bx + bw, by + bh - br);
      ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - br, by + bh);
      ctx.lineTo(bx + br, by + bh);
      ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - br);
      ctx.lineTo(bx, by + br);
      ctx.quadraticCurveTo(bx, by, bx + br, by);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = OUTLINE;
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(a.speech, 0, by + bh / 2);
    }

    ctx.restore();
  }

  function drawButterflies() {
    butterflies.forEach(b => {
      const bx = b.x * width, by = b.y * height + Math.sin(elapsed * 4 + b.phase) * 8;
      const flap = Math.abs(Math.sin(elapsed * 11 + b.phase));
      ctx.save();
      ctx.translate(bx, by);
      ctx.fillStyle = b.color;
      ctx.strokeStyle = OUTLINE;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.ellipse(-4, 0, 5 * flap + 1.5, 4, -0.3, 0, Math.PI * 2);
      ctx.ellipse(4, 0, 5 * flap + 1.5, 4, 0.3, 0, Math.PI * 2);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    });
  }

  function tick(dt) {
    dt = Math.max(0, Math.min(dt || 0.033, 0.08));
    elapsed += dt;

    // Update butterflies
    butterflies.forEach(b => {
      b.x += b.vx * dt;
      if (b.x > 1.08) b.x = -0.08;
      if (b.x < -0.08) b.x = 1.08;
    });

    // Update snake actors
    actors.forEach(a => {
      a.actionTimer -= dt;
      if (a.speechTimer > 0) a.speechTimer = Math.max(0, a.speechTimer - dt);
      if (a.action === 'walk') {
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        const minX = 34, maxX = width - 34, minY = height * 0.54, maxY = height - 28;
        if (a.x < minX) { a.x = minX; a.vx = Math.abs(a.vx); a.facing = 1; }
        if (a.x > maxX) { a.x = maxX; a.vx = -Math.abs(a.vx); a.facing = -1; }
        if (a.y < minY) { a.y = minY; a.vy = Math.abs(a.vy); }
        if (a.y > maxY) { a.y = maxY; a.vy = -Math.abs(a.vy); }
      }
      if (a.actionTimer <= 0) pickNextAction(a);
    });

    // Update floating icons
    for (let i = floats.length - 1; i >= 0; i--) {
      floats[i].life += dt;
      floats[i].y -= dt * 22;
      if (floats[i].life >= floats[i].maxLife) floats.splice(i, 1);
    }

    // Render scene
    ctx.save();
    drawSkyAndMeadow();
    // Depth sort snakes by y
    const sorted = actors.slice().sort((a, b) => a.y - b.y);
    sorted.forEach(a => { if (a.y < height * 0.66) drawActor(a); });
    drawParasol();
    sorted.forEach(a => { if (a.y >= height * 0.66) drawActor(a); });
    drawButterflies();

    // Floating hearts / sparkles / notes
    floats.forEach(f => {
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.life / f.maxLife);
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.restore();
    });
    ctx.restore();
  }

  setSnakes(opts.unlockedIds || ['strawberry']);
  return { tick, resize, setSnakes, tap };
}

export { createGarden };

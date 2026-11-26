(function () {
  window.KOF = window.KOF || {};

  function loadStageImage(src) {
    const img = new Image();
    img.src = src;
    return img;
  }

  function drawArtBackdrop(ctx, img, w, h, camX, tintColor, floorY, time) {
    if (img && img.complete && img.naturalWidth > 0) {
      // Smooth parallax pan across the wide 1536x1024 arcade backdrop
      const scale = Math.max((w + 260) / img.naturalWidth, h / img.naturalHeight);
      const drawW = img.naturalWidth * scale;
      const drawH = img.naturalHeight * scale;
      const maxShift = Math.max(0, drawW - w);
      const panRatio = Math.max(0, Math.min(1, camX / 320));
      const drawX = -panRatio * maxShift;
      const drawY = h - drawH;

      ctx.drawImage(img, drawX, drawY, drawW, drawH);

      // Subtle cinematic vignette & floor contrast gradient so fighters always pop cleanly
      const groundShade = ctx.createLinearGradient(0, floorY - 50, 0, h);
      groundShade.addColorStop(0, 'rgba(8, 10, 18, 0)');
      groundShade.addColorStop(0.6, 'rgba(8, 10, 18, 0.34)');
      groundShade.addColorStop(1, 'rgba(5, 6, 12, 0.65)');
      ctx.fillStyle = groundShade;
      ctx.fillRect(0, floorY - 50, w, h - floorY + 50);

      // Subtle glowing horizon fight-line
      ctx.strokeStyle = tintColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, floorY + 1);
      ctx.lineTo(w, floorY + 1);
      ctx.stroke();

      // Atmospheric floating particles
      ctx.fillStyle = tintColor;
      for (let i = 0; i < 18; i++) {
        const px = ((i * 113 + time * (0.45 + (i % 3) * 0.25)) % (w + 30)) - 15;
        const py = floorY - ((i * 57 + time * (0.8 + (i % 4) * 0.22)) % (floorY - 40));
        ctx.globalAlpha = 0.25 + Math.sin(time * 0.06 + i) * 0.15;
        ctx.beginPath();
        ctx.arc(px, py, 1.8 + (i % 2), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      return true;
    }
    return false;
  }

  const osakaImg = loadStageImage('assets/stages/osaka.png');
  const shrineImg = loadStageImage('assets/stages/shrine.png');
  const harborImg = loadStageImage('assets/stages/harbor.png');

  const STAGES = [
    {
      id: 'osaka',
      name: '大阪夜街',
      subtitle: 'NEO OSAKA ALLEY',
      thumb: 'assets/stages/osaka.png',
      draw(ctx, w, h, floorY, time, camX) {
        if (drawArtBackdrop(ctx, osakaImg, w, h, camX, 'rgba(244, 63, 94, 0.42)', floorY, time)) return;

        // Fallback procedural night alley while image loads
        const sky = ctx.createLinearGradient(0, 0, 0, floorY);
        sky.addColorStop(0, '#070b18');
        sky.addColorStop(1, '#2b193d');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, floorY);
        ctx.fillStyle = '#171525';
        ctx.fillRect(0, floorY, w, h - floorY);
      }
    },
    {
      id: 'shrine',
      name: '神社烈焰',
      subtitle: 'KYOTO FLAME SHRINE',
      thumb: 'assets/stages/shrine.png',
      draw(ctx, w, h, floorY, time, camX) {
        if (drawArtBackdrop(ctx, shrineImg, w, h, camX, 'rgba(251, 146, 60, 0.5)', floorY, time)) return;

        const sky = ctx.createLinearGradient(0, 0, 0, floorY);
        sky.addColorStop(0, '#1a060b');
        sky.addColorStop(1, '#7c1d1d');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, floorY);
        ctx.fillStyle = '#241414';
        ctx.fillRect(0, floorY, w, h - floorY);
      }
    },
    {
      id: 'harbor',
      name: '码头铁桥',
      subtitle: 'HARBOR STEEL BRIDGE',
      thumb: 'assets/stages/harbor.png',
      draw(ctx, w, h, floorY, time, camX) {
        if (drawArtBackdrop(ctx, harborImg, w, h, camX, 'rgba(251, 191, 36, 0.45)', floorY, time)) return;

        const sky = ctx.createLinearGradient(0, 0, 0, floorY);
        sky.addColorStop(0, '#0f172a');
        sky.addColorStop(1, '#f59e0b');
        ctx.fillStyle = sky;
        ctx.fillRect(0, 0, w, floorY);
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, floorY, w, h - floorY);
      }
    }
  ];

  window.KOF.STAGES = STAGES;
  window.KOF.getStageById = function (id) {
    return STAGES.find((s) => s.id === id) || STAGES[0];
  };
})();

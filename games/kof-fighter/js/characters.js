(function () {
  window.KOF = window.KOF || {};

  // 6 Classic KOF '97/'98 Inspired Fighters (including 3 iconic female fighters)
  window.KOF.CHARACTERS = [
    {
      id: 'kyo',
      name: '草薙京',
      enName: 'KYO KUSANAGI',
      style: '草薙流古武术 · 苍炎均衡',
      badge: '京',
      gender: 'male',
      portrait: 'assets/portraits/kyo.jpg',
      quote: '「燃尽吧！这就是草薙之炎！」',
      colors: {
        primary: '#f97316',
        secondary: '#dc2626',
        jacket: '#18181b',
        pants: '#1e293b',
        skin: '#f5cba7',
        hair: '#2d1b12',
        accent: '#ffffff',
        aura: '#ff6b1a',
        flameCore: '#fef08a'
      },
      stats: {
        power: 82,
        speed: 84,
        defense: 78,
        maxHp: 1000,
        walkSpeed: 5.0,
        jumpForce: -16.8,
        weight: 1.0
      },
      specialNames: {
        projectile: '百八式·暗拂',
        antiAir: '百式·鬼烧',
        rush: '百十四式·荒咬',
        super: '里百八式·大蛇薙'
      },
      moves: {
        lp: { name: '轻拳', startup: 4, active: 4, recovery: 7, damage: 42, hitstun: 14, blockstun: 10, rangeX: 74, rangeY: 36, offsetY: -96, push: 5, level: 'mid', powerGain: 6, knockback: 5 },
        lk: { name: '轻脚', startup: 5, active: 4, recovery: 8, damage: 48, hitstun: 15, blockstun: 10, rangeX: 82, rangeY: 32, offsetY: -42, push: 6, level: 'low', powerGain: 7, knockback: 5 },
        hp: { name: '重拳', startup: 8, active: 5, recovery: 14, damage: 85, hitstun: 21, blockstun: 14, rangeX: 88, rangeY: 44, offsetY: -94, push: 9, level: 'mid', powerGain: 12, knockback: 9, heavy: true },
        hk: { name: '重脚', startup: 10, active: 6, recovery: 17, damage: 95, hitstun: 24, blockstun: 15, rangeX: 98, rangeY: 38, offsetY: -56, push: 11, level: 'low', powerGain: 13, knockback: 11, heavy: true, knockdown: true },
        sp1: { name: '百八式·暗拂', type: 'projectile', startup: 11, active: 6, recovery: 18, damage: 90, chip: 15, projSpeed: 10.2, projGround: true, powerGain: 10 },
        sp2: { name: '百式·鬼烧', type: 'antiAir', startup: 5, active: 14, recovery: 20, damage: 125, chip: 20, rangeX: 86, rangeY: 118, offsetY: -120, vy: -14.5, vx: 4.2, invincibleFrames: 10, knockdown: true, launchY: -12, powerGain: 14 },
        sp3: { name: '百十四式·荒咬', type: 'rush', startup: 8, active: 12, recovery: 16, damage: 110, chip: 18, rangeX: 92, rangeY: 54, offsetY: -88, vx: 9.2, knockdown: false, powerGain: 12 },
        super: { name: '里百八式·大蛇薙', type: 'superWave', startup: 12, active: 22, recovery: 24, damage: 240, chip: 42, rangeX: 250, rangeY: 140, offsetY: -115, knockdown: true, launchY: -14, multiHit: 4 }
      }
    },
    {
      id: 'iori',
      name: '八神庵',
      enName: 'IORI YAGAMI',
      style: '八神流古武术 · 紫炎压制',
      badge: '庵',
      gender: 'male',
      portrait: 'assets/portraits/iori.jpg',
      quote: '「记住这片紫色的火焰吧……哼！」',
      colors: {
        primary: '#a855f7',
        secondary: '#7e22ce',
        jacket: '#1e1b2e',
        pants: '#991b1b',
        skin: '#f8d7c4',
        hair: '#b91c1c',
        accent: '#e9d5ff',
        aura: '#c084fc',
        flameCore: '#f5d0fe'
      },
      stats: {
        power: 86,
        speed: 90,
        defense: 72,
        maxHp: 960,
        walkSpeed: 5.5,
        jumpForce: -17.2,
        weight: 0.96
      },
      specialNames: {
        projectile: '百八式·暗拂·紫',
        antiAir: '百式·鬼烧·紫',
        rush: '百二十七式·葵花',
        super: '禁千二百十一式·八稚女'
      },
      moves: {
        lp: { name: '利爪轻击', startup: 4, active: 4, recovery: 6, damage: 44, hitstun: 14, blockstun: 10, rangeX: 78, rangeY: 36, offsetY: -96, push: 5, level: 'mid', powerGain: 7, knockback: 5 },
        lk: { name: '快踢', startup: 5, active: 4, recovery: 7, damage: 46, hitstun: 15, blockstun: 10, rangeX: 84, rangeY: 32, offsetY: -44, push: 6, level: 'low', powerGain: 7, knockback: 5 },
        hp: { name: '紫炎撕裂', startup: 7, active: 5, recovery: 13, damage: 88, hitstun: 22, blockstun: 14, rangeX: 94, rangeY: 46, offsetY: -94, push: 9, level: 'mid', powerGain: 13, knockback: 9, heavy: true },
        hk: { name: '旋风扫踢', startup: 9, active: 6, recovery: 16, damage: 94, hitstun: 24, blockstun: 15, rangeX: 100, rangeY: 38, offsetY: -54, push: 11, level: 'low', powerGain: 13, knockback: 11, heavy: true, knockdown: true },
        sp1: { name: '百八式·暗拂·紫', type: 'projectile', startup: 10, active: 6, recovery: 17, damage: 88, chip: 15, projSpeed: 11.4, projGround: true, powerGain: 10 },
        sp2: { name: '百式·鬼烧·紫', type: 'antiAir', startup: 5, active: 14, recovery: 20, damage: 130, chip: 20, rangeX: 90, rangeY: 122, offsetY: -122, vy: -15.0, vx: 4.8, invincibleFrames: 10, knockdown: true, launchY: -12.5, powerGain: 14 },
        sp3: { name: '百二十七式·葵花', type: 'rush', startup: 7, active: 14, recovery: 15, damage: 118, chip: 19, rangeX: 96, rangeY: 56, offsetY: -88, vx: 10.6, knockdown: true, launchY: -8, powerGain: 13 },
        super: { name: '禁千二百十一式·八稚女', type: 'superDash', startup: 10, active: 26, recovery: 22, damage: 255, chip: 45, rangeX: 120, rangeY: 110, offsetY: -95, vx: 14.5, knockdown: true, launchY: -13, multiHit: 5 }
      }
    },
    {
      id: 'mai',
      name: '不知火舞',
      enName: 'MAI SHIRANUI',
      style: '不知火流忍术 · 魅惑牵制',
      badge: '舞',
      gender: 'female',
      portrait: 'assets/portraits/mai.jpg',
      quote: '「日本第一的女忍者，可不是浪得虚名哟！」',
      colors: {
        primary: '#f43f5e',
        secondary: '#be123c',
        jacket: '#e11d48',
        pants: '#ffffff',
        skin: '#fde0cc',
        hair: '#3b1c0e',
        accent: '#fef08a',
        aura: '#fb7185',
        flameCore: '#fff1f2'
      },
      stats: {
        power: 76,
        speed: 96,
        defense: 70,
        maxHp: 930,
        walkSpeed: 6.0,
        jumpForce: -17.8,
        weight: 0.92
      },
      specialNames: {
        projectile: '花蝶扇',
        antiAir: '龙炎舞',
        rush: '必杀忍蜂',
        super: '超必杀忍蜂'
      },
      moves: {
        lp: { name: '疾风扇击', startup: 3, active: 4, recovery: 6, damage: 38, hitstun: 13, blockstun: 9, rangeX: 78, rangeY: 36, offsetY: -94, push: 5, level: 'mid', powerGain: 6, knockback: 4 },
        lk: { name: '轻盈踢', startup: 4, active: 4, recovery: 7, damage: 42, hitstun: 14, blockstun: 10, rangeX: 84, rangeY: 32, offsetY: -44, push: 5, level: 'low', powerGain: 6, knockback: 5 },
        hp: { name: '炎扇重击', startup: 7, active: 5, recovery: 13, damage: 78, hitstun: 20, blockstun: 13, rangeX: 94, rangeY: 44, offsetY: -92, push: 8, level: 'mid', powerGain: 12, knockback: 8, heavy: true },
        hk: { name: '滑铲扫腿', startup: 8, active: 6, recovery: 16, damage: 86, hitstun: 22, blockstun: 14, rangeX: 106, rangeY: 34, offsetY: -38, push: 10, level: 'low', powerGain: 12, knockback: 10, heavy: true, knockdown: true },
        sp1: { name: '花蝶扇', type: 'projectile', startup: 9, active: 5, recovery: 15, damage: 78, chip: 12, projSpeed: 12.6, projGround: false, powerGain: 9 },
        sp2: { name: '龙炎舞', type: 'antiAir', startup: 6, active: 14, recovery: 18, damage: 112, chip: 18, rangeX: 105, rangeY: 105, offsetY: -102, vy: -10.5, vx: 3.5, invincibleFrames: 8, knockdown: true, launchY: -11, powerGain: 13 },
        sp3: { name: '必杀忍蜂', type: 'rush', startup: 7, active: 15, recovery: 16, damage: 108, chip: 18, rangeX: 98, rangeY: 50, offsetY: -82, vx: 12.5, knockdown: true, launchY: -9, powerGain: 12 },
        super: { name: '超必杀忍蜂', type: 'superDash', startup: 9, active: 28, recovery: 20, damage: 235, chip: 40, rangeX: 130, rangeY: 96, offsetY: -88, vx: 16.5, knockdown: true, launchY: -13.5, multiHit: 5 }
      }
    },
    {
      id: 'terry',
      name: '特瑞·博加德',
      enName: 'TERRY BOGARD',
      style: '八极圣拳 · 饿狼爆发',
      badge: '狼',
      gender: 'male',
      portrait: 'assets/portraits/terry.jpg',
      quote: '「Are you OK?! 接下这记能量喷泉吧！」',
      colors: {
        primary: '#f59e0b',
        secondary: '#b45309',
        jacket: '#dc2626',
        pants: '#1d4ed8',
        skin: '#eec199',
        hair: '#eab308',
        accent: '#ffffff',
        aura: '#fbbf24',
        flameCore: '#fef9c3'
      },
      stats: {
        power: 96,
        speed: 74,
        defense: 92,
        maxHp: 1120,
        walkSpeed: 4.4,
        jumpForce: -16.0,
        weight: 1.12
      },
      specialNames: {
        projectile: '能量波',
        antiAir: '碎地掌',
        rush: '火焰冲拳',
        super: '能量喷泉'
      },
      moves: {
        lp: { name: '重直拳', startup: 5, active: 4, recovery: 7, damage: 50, hitstun: 15, blockstun: 11, rangeX: 78, rangeY: 38, offsetY: -98, push: 6, level: 'mid', powerGain: 7, knockback: 6 },
        lk: { name: '低踢', startup: 6, active: 4, recovery: 8, damage: 52, hitstun: 16, blockstun: 11, rangeX: 84, rangeY: 34, offsetY: -44, push: 6, level: 'low', powerGain: 7, knockback: 6 },
        hp: { name: '霸王勾拳', startup: 9, active: 6, recovery: 15, damage: 102, hitstun: 24, blockstun: 16, rangeX: 94, rangeY: 48, offsetY: -96, push: 11, level: 'mid', powerGain: 14, knockback: 11, heavy: true },
        hk: { name: '铁山扫腿', startup: 11, active: 6, recovery: 18, damage: 110, hitstun: 26, blockstun: 16, rangeX: 102, rangeY: 42, offsetY: -54, push: 12, level: 'low', powerGain: 15, knockback: 12, heavy: true, knockdown: true },
        sp1: { name: '能量波', type: 'projectile', startup: 12, active: 6, recovery: 19, damage: 102, chip: 18, projSpeed: 9.2, projGround: true, powerGain: 11 },
        sp2: { name: '碎地掌', type: 'antiAir', startup: 7, active: 14, recovery: 21, damage: 138, chip: 24, rangeX: 120, rangeY: 116, offsetY: -112, vy: -12.0, vx: 3.4, invincibleFrames: 11, knockdown: true, launchY: -13.5, powerGain: 15 },
        sp3: { name: '火焰冲拳', type: 'rush', startup: 9, active: 14, recovery: 17, damage: 128, chip: 22, rangeX: 100, rangeY: 56, offsetY: -92, vx: 11.2, knockdown: true, launchY: -9.5, powerGain: 14 },
        super: { name: '能量喷泉', type: 'superWave', startup: 13, active: 24, recovery: 25, damage: 270, chip: 48, rangeX: 270, rangeY: 160, offsetY: -130, knockdown: true, launchY: -15.5, multiHit: 4 }
      }
    },
    {
      id: 'shermie',
      name: '夏尔米',
      enName: 'SHERMIE',
      style: '荒狂雷光 · 性感摔投',
      badge: '雷',
      gender: 'female',
      portrait: 'assets/portraits/shermie.jpg',
      quote: '「讨厌啦，被雷电麻痹的感觉很棒吧？」',
      colors: {
        primary: '#ec4899',
        secondary: '#db2777',
        jacket: '#e11d48',
        pants: '#f43f5e',
        skin: '#fde2d0',
        hair: '#db2777',
        accent: '#ffffff',
        aura: '#38bdf8',
        flameCore: '#e0f2fe'
      },
      stats: {
        power: 88,
        speed: 88,
        defense: 76,
        maxHp: 970,
        walkSpeed: 5.4,
        jumpForce: -17.3,
        weight: 0.94
      },
      specialNames: {
        projectile: '无月之雷云',
        antiAir: '斜日之踊',
        rush: '夏尔米螺旋',
        super: '宿命·幻影·振子'
      },
      moves: {
        lp: { name: '魅影掌击', startup: 4, active: 4, recovery: 6, damage: 42, hitstun: 14, blockstun: 10, rangeX: 78, rangeY: 36, offsetY: -94, push: 5, level: 'mid', powerGain: 7, knockback: 5 },
        lk: { name: '高跟快踢', startup: 4, active: 4, recovery: 7, damage: 46, hitstun: 15, blockstun: 10, rangeX: 86, rangeY: 32, offsetY: -44, push: 6, level: 'low', powerGain: 7, knockback: 5 },
        hp: { name: '雷光鞭腿', startup: 7, active: 5, recovery: 13, damage: 88, hitstun: 22, blockstun: 14, rangeX: 98, rangeY: 46, offsetY: -92, push: 9, level: 'mid', powerGain: 13, knockback: 9, heavy: true },
        hk: { name: '剪刀腿扫击', startup: 9, active: 6, recovery: 16, damage: 94, hitstun: 24, blockstun: 15, rangeX: 104, rangeY: 36, offsetY: -48, push: 10, level: 'low', powerGain: 13, knockback: 11, heavy: true, knockdown: true },
        sp1: { name: '无月之雷云', type: 'projectile', startup: 10, active: 6, recovery: 17, damage: 92, chip: 16, projSpeed: 10.6, projGround: false, powerGain: 11 },
        sp2: { name: '斜日之踊', type: 'antiAir', startup: 5, active: 14, recovery: 19, damage: 128, chip: 20, rangeX: 96, rangeY: 118, offsetY: -116, vy: -14.2, vx: 4.4, invincibleFrames: 10, knockdown: true, launchY: -12.5, powerGain: 14 },
        sp3: { name: '夏尔米螺旋', type: 'rush', startup: 7, active: 14, recovery: 16, damage: 118, chip: 20, rangeX: 96, rangeY: 54, offsetY: -86, vx: 11.8, knockdown: true, launchY: -9.5, powerGain: 13 },
        super: { name: '宿命·幻影·振子', type: 'superWave', startup: 11, active: 24, recovery: 22, damage: 258, chip: 46, rangeX: 260, rangeY: 155, offsetY: -125, knockdown: true, launchY: -14.5, multiHit: 5 }
      }
    },
    {
      id: 'mary',
      name: '布鲁·玛丽',
      enName: 'BLUE MARY',
      style: '疾风桑搏 · 性感特工',
      badge: '玫',
      gender: 'female',
      portrait: 'assets/portraits/mary.jpg',
      quote: '「任务完成！下次可要更加认真一点哦。」',
      colors: {
        primary: '#38bdf8',
        secondary: '#e11d48',
        jacket: '#e11d48',
        pants: '#2563eb',
        skin: '#fde0cc',
        hair: '#facc15',
        accent: '#ffffff',
        aura: '#60a5fa',
        flameCore: '#fef9c3'
      },
      stats: {
        power: 84,
        speed: 93,
        defense: 80,
        maxHp: 990,
        walkSpeed: 5.7,
        jumpForce: -17.5,
        weight: 0.95
      },
      specialNames: {
        projectile: '旋转落花',
        antiAir: '垂直之箭',
        rush: '指天回旋脚',
        super: '玛丽台风'
      },
      moves: {
        lp: { name: '特工直拳', startup: 4, active: 4, recovery: 6, damage: 42, hitstun: 14, blockstun: 10, rangeX: 78, rangeY: 36, offsetY: -94, push: 5, level: 'mid', powerGain: 6, knockback: 5 },
        lk: { name: '桑搏低踢', startup: 4, active: 4, recovery: 7, damage: 44, hitstun: 14, blockstun: 10, rangeX: 84, rangeY: 32, offsetY: -44, push: 5, level: 'low', powerGain: 7, knockback: 5 },
        hp: { name: '铁肘重击', startup: 7, active: 5, recovery: 13, damage: 84, hitstun: 21, blockstun: 14, rangeX: 90, rangeY: 44, offsetY: -92, push: 9, level: 'mid', powerGain: 12, knockback: 9, heavy: true },
        hk: { name: '回旋滑踢', startup: 8, active: 6, recovery: 16, damage: 90, hitstun: 23, blockstun: 15, rangeX: 106, rangeY: 34, offsetY: -40, push: 10, level: 'low', powerGain: 13, knockback: 10, heavy: true, knockdown: true },
        sp1: { name: '旋转落花', type: 'projectile', startup: 9, active: 5, recovery: 16, damage: 84, chip: 14, projSpeed: 12.0, projGround: false, powerGain: 10 },
        sp2: { name: '垂直之箭', type: 'antiAir', startup: 5, active: 14, recovery: 19, damage: 126, chip: 20, rangeX: 92, rangeY: 122, offsetY: -120, vy: -15.2, vx: 4.8, invincibleFrames: 10, knockdown: true, launchY: -13.0, powerGain: 14 },
        sp3: { name: '指天回旋脚', type: 'rush', startup: 7, active: 15, recovery: 15, damage: 114, chip: 19, rangeX: 100, rangeY: 52, offsetY: -84, vx: 12.8, knockdown: true, launchY: -9.5, powerGain: 13 },
        super: { name: '玛丽台风', type: 'superDash', startup: 9, active: 27, recovery: 21, damage: 248, chip: 44, rangeX: 128, rangeY: 105, offsetY: -92, vx: 15.8, knockdown: true, launchY: -14.0, multiHit: 5 }
      }
    }
  ];

  window.KOF.getCharacterById = function (id) {
    return window.KOF.CHARACTERS.find((c) => c.id === id) || window.KOF.CHARACTERS[0];
  };

  // Preload transparent 4-pose sprite sheets for all fighters
  window.KOF.SPRITES = {};
  window.KOF.CHARACTERS.forEach((ch) => {
    ch.sprite = `assets/sprites/${ch.id}.png`;
    const img = new Image();
    img.src = ch.sprite;
    window.KOF.SPRITES[ch.id] = img;
  });
})();

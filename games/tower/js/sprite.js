// ── 스프라이트 이미지 로더 ────────────────────────────────
const SPRITES = {};

function _loadImage(key, src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => { SPRITES[key] = img; resolve(); };
    img.onerror = () => { console.warn(`스프라이트 로드 실패: ${src}`); resolve(); };
    img.src = src;
  });
}

function loadSprites() {
  const c = './assets/characters/';
  const e = './assets/enemies/';
  const t = './assets/tiles/';
  return Promise.all([
    // 냥이 검사
    _loadImage('cat_idle_0',       c + 'cat_idle_0.png'),
    _loadImage('cat_idle_1',       c + 'cat_idle_1.png'),
    _loadImage('cat_idle_0_white', c + 'cat_idle_0_white.png'),
    _loadImage('cat_idle_1_white', c + 'cat_idle_1_white.png'),
    _loadImage('cat_run_0',        c + 'cat_run_0.png'),
    _loadImage('cat_run_1',        c + 'cat_run_1.png'),
    _loadImage('cat_jump',         c + 'cat_jump.png'),
    _loadImage('cat_fall',         c + 'cat_fall.png'),
    // 멍멍이 검사
    _loadImage('dog_idle_0',       c + 'dog_idle_0.png'),
    _loadImage('dog_idle_1',       c + 'dog_idle_1.png'),
    _loadImage('dog_run_0',        c + 'dog_run_0.png'),
    _loadImage('dog_run_1',        c + 'dog_run_1.png'),
    _loadImage('dog_jump_0',       c + 'dog_jump_0.png'),
    _loadImage('dog_jump_1',       c + 'dog_jump_1.png'),
    _loadImage('dog_jump_2',       c + 'dog_jump_2.png'),
    _loadImage('dog_fall',         c + 'dog_fall.png'),
    // 슬라임 고블린
    _loadImage('slime_0',          e + 'slime_0.png'),
    _loadImage('slime_1',          e + 'slime_1.png'),
    // 발판
    _loadImage('platform',         t + 'platform.png'),
  ]);
}

// ── 애니메이션 프레임 정의 ────────────────────────────────
const CHAR_FRAMES = {
  cat: {
    idle: ['cat_idle_0', 'cat_idle_1'],
    run:  ['cat_run_0',  'cat_run_1'],
    jump: ['cat_jump'],
    fall: ['cat_fall'],
  },
  dog: {
    idle: ['dog_idle_0', 'dog_idle_1'],
    run:  ['dog_run_0',  'dog_run_1'],
    jump: ['dog_jump_0', 'dog_jump_1', 'dog_jump_2'],
    fall: ['dog_fall'],
  },
};

// game.js 에서 프레임 카운터 순환에 사용 (캐릭터별)
const FRAME_COUNT = {
  cat: { idle: 2, run: 2, jump: 1, fall: 1 },
  dog: { idle: 2, run: 2, jump: 3, fall: 1 },
};

// 상태×프레임별 Y 오프셋 (픽셀, scale=3 기준)
const Y_OFFSETS = {
  idle: [0,  3],
  run:  [0,  3],
  jump: [-6],
  fall: [ 3],
};

// ── 크기 상수 (game.js 공용) ──────────────────────────────
const CHAR_W  = 36;
const CHAR_H  = 36;
const ENEMY_W = 30;
const ENEMY_H = 30;

// ── 이미지 드로잉 헬퍼 ────────────────────────────────────
function _drawSprite(ctx, img, x, y, w, h, flipX) {
  if (!img) return;
  if (flipX) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(img, -(x + w), y, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, x, y, w, h);
  }
}

// ── 캐릭터 드로우 ─────────────────────────────────────────
// charId: 'cat' | 'dog'  /  state: 'idle' | 'run' | 'jump' | 'fall'
function drawCharacter(ctx, charId, x, y, state, frame, facingR) {
  const frames = CHAR_FRAMES[charId]?.[state] ?? CHAR_FRAMES[charId]?.idle ?? [];
  const f      = frame % Math.max(1, frames.length);
  const key    = frames[f];
  const yOff   = Y_OFFSETS[state]?.[f % (Y_OFFSETS[state]?.length ?? 1)] ?? 0;
  _drawSprite(ctx, SPRITES[key], x, y + yOff, CHAR_W, CHAR_H, !facingR);
}

// ── 슬라임 고블린 드로우 ──────────────────────────────────
function drawSlimeEnemy(ctx, x, y, facingR) {
  // Date.now() 기반으로 200ms마다 프레임 교체 (5fps)
  const frame = Math.floor(Date.now() / 200) % 2;
  _drawSprite(ctx, SPRITES[`slime_${frame}`], x, y, ENEMY_W, ENEMY_H, !facingR);
}

// ── 발판 드로우 ───────────────────────────────────────────
function drawPlatformTile(ctx, x, y, w, h) {
  const img = SPRITES.platform;
  if (!img) {
    ctx.fillStyle = '#3a3f50';
    ctx.fillRect(x, y, w, h);
    return;
  }
  // 이미지 너비 단위로 수평 타일링
  const tw = img.width || w;
  for (let px = 0; px < w; px += tw) {
    ctx.drawImage(img, x + px, y, Math.min(tw, w - px), h);
  }
}
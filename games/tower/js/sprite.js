// ── 스프라이트 시트 로더 ─────────────────────────────────────
// 학습 포인트: 개별 이미지 → 시트 1장으로 교체해 HTTP 요청 수 감소
const SHEET = { img: null };

function loadSprites() {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload  = () => { SHEET.img = img; resolve(); };
    img.onerror = () => { console.warn('스프라이트 시트 로드 실패'); resolve(); };
    img.src = './assets/sheet/sheet.png';
  });
}

// ── 시트 내 프레임 좌표 정의 ─────────────────────────────────
// 학습 포인트: drawImage 9인수 — (img, sx,sy,sw,sh, dx,dy,dw,dh) 로 소스 영역을 잘라내어 그림
//
// 시트 규격: 1496 × 704 px
//   셀 가로 간격: 181 px / 좌측 여백: 24 px
//   Row1 고양이  y=24,  h=178  char_w=170  | col 0~7: idle_0 idle_1 run_0 run_1 jump_0 jump_1 jump_2 fall
//   Row2 강아지  y=219, h=175  char_w=170  | col 0~7: idle_0 idle_1 run_0 run_1 jump_0 jump_1 jump_2 fall
//   Row3 몬스터  바닥 y=585    셀 간격 동일 | col 0~7: 슬라임×2 버섯×2 불꽃×2 유령×2
//   Row4 플랫폼  y=593, h=94, w=640, 가로 중앙(x=428)

// 셀 내 가로 중앙 정렬 좌표 계산
// col: 0~7 / charW: 실제 스프라이트 폭
const _CW = 182;
const _PX = 24;
const _cx = (col, charW) => _PX + col * _CW + Math.round((_CW - charW) / 2);

// ── 캐릭터 프레임 ─────────────────────────────────────────────
const CAT_SY = 24,  CAT_SH = 178, CAT_CW = 170;
const DOG_SY = 219, DOG_SH = 175, DOG_CW = 170;

const CHAR_FRAMES = {
  cat: {
    idle: [
      { sx: _cx(0, CAT_CW), sy: CAT_SY, sw: CAT_CW, sh: CAT_SH },
      { sx: _cx(1, CAT_CW), sy: CAT_SY, sw: CAT_CW, sh: CAT_SH },
    ],
    run: [
      { sx: _cx(2, CAT_CW), sy: CAT_SY, sw: CAT_CW, sh: CAT_SH },
      { sx: _cx(3, CAT_CW), sy: CAT_SY, sw: CAT_CW, sh: CAT_SH },
    ],
    jump: [
      { sx: _cx(4, CAT_CW), sy: CAT_SY, sw: CAT_CW, sh: CAT_SH },
      { sx: _cx(5, CAT_CW), sy: CAT_SY, sw: CAT_CW, sh: CAT_SH },
      { sx: _cx(6, CAT_CW), sy: CAT_SY, sw: CAT_CW, sh: CAT_SH },
    ],
    fall: [
      { sx: _cx(7, CAT_CW), sy: CAT_SY, sw: CAT_CW, sh: CAT_SH },
    ],
  },
  dog: {
    idle: [
      { sx: _cx(0, DOG_CW), sy: DOG_SY, sw: DOG_CW, sh: DOG_SH },
      { sx: _cx(1, DOG_CW), sy: DOG_SY, sw: DOG_CW, sh: DOG_SH },
    ],
    run: [
      { sx: _cx(2, DOG_CW), sy: DOG_SY, sw: DOG_CW, sh: DOG_SH },
      { sx: _cx(3, DOG_CW), sy: DOG_SY, sw: DOG_CW, sh: DOG_SH },
    ],
    jump: [
      { sx: _cx(4, DOG_CW), sy: DOG_SY, sw: DOG_CW, sh: DOG_SH },
      { sx: _cx(5, DOG_CW), sy: DOG_SY, sw: DOG_CW, sh: DOG_SH },
      { sx: _cx(6, DOG_CW), sy: DOG_SY, sw: DOG_CW, sh: DOG_SH },
    ],
    fall: [
      { sx: _cx(7, DOG_CW), sy: DOG_SY, sw: DOG_CW, sh: DOG_SH },
    ],
  },
};

// ── 몬스터 프레임 (Row3, 바닥 y=585 기준 bottom-align) ────────
// 슬라임: col0(142×98), col1(141×74)
const SLIME_FRAMES = [
  { sx: _cx(0, 142), sy: 585 - 98,  sw: 142, sh: 98  },
  { sx: _cx(1, 141), sy: 585 - 74,  sw: 141, sh: 74  },
];
// 버섯: col2(135×129), col3(135×129)
const MUSHROOM_FRAMES = [
  { sx: _cx(2, 135), sy: 585 - 129, sw: 135, sh: 129 },
  { sx: _cx(3, 135), sy: 585 - 129, sw: 135, sh: 129 },
];
// 불꽃: col4(128×158), col5(128×166)
const FLAME_FRAMES = [
  { sx: _cx(4, 128), sy: 585 - 158, sw: 128, sh: 158 },
  { sx: _cx(5, 128), sy: 585 - 166, sw: 128, sh: 166 },
];
// 유령: col6(128×121), col7(128×121)
const GHOST_FRAMES = [
  { sx: _cx(6, 128), sy: 585 - 121, sw: 128, sh: 121 },
  { sx: _cx(7, 128), sy: 585 - 121, sw: 128, sh: 121 },
];

// ── 플랫폼 프레임 (Row4, 640×94, 가로 중앙) ──────────────────
const PLATFORM_FRAME = { sx: 428, sy: 593, sw: 640, sh: 94 };

// ── 애니메이션 프레임 카운트 (game.js 공용) ───────────────────
const FRAME_COUNT = {
  cat: { idle: 2, run: 2, jump: 3, fall: 1 },
  dog: { idle: 2, run: 2, jump: 3, fall: 1 },
};

// 상태×프레임별 Y 오프셋 (픽셀, 36px 표시 기준)
const Y_OFFSETS = {
  idle: [0,  3],
  run:  [0,  3],
  jump: [0, 0, 0],
  fall: [ 3],
};

// ── 크기 상수 (game.js 공용) ──────────────────────────────────
const CHAR_W  = 36;
const CHAR_H  = 36;
const ENEMY_W = 30;
const ENEMY_H = 30;

// ── 시트 자르기 드로잉 헬퍼 ──────────────────────────────────
function _drawFrame(ctx, frame, x, y, w, h, flipX) {
  const img = SHEET.img;
  if (!img || !frame) return;
  if (flipX) {
    ctx.save();
    ctx.scale(-1, 1);
    ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, -(x + w), y, w, h);
    ctx.restore();
  } else {
    ctx.drawImage(img, frame.sx, frame.sy, frame.sw, frame.sh, x, y, w, h);
  }
}

// ── 캐릭터 드로우 ─────────────────────────────────────────────
// charId: 'cat' | 'dog'  /  state: 'idle' | 'run' | 'jump' | 'fall'
function drawCharacter(ctx, charId, x, y, state, frame, facingR) {
  const frames = CHAR_FRAMES[charId]?.[state] ?? CHAR_FRAMES[charId]?.idle ?? [];
  const f      = frame % Math.max(1, frames.length);
  const src    = frames[f];
  const yOff   = Y_OFFSETS[state]?.[f % (Y_OFFSETS[state]?.length ?? 1)] ?? 0;
  _drawFrame(ctx, src, x, y + yOff, CHAR_W, CHAR_H, !facingR);
}

// ── 적 드로우 ─────────────────────────────────────────────────
function _enemyFrame(frameArr, intervalMs) {
  return frameArr[Math.floor(Date.now() / intervalMs) % frameArr.length];
}

function drawSlimeEnemy(ctx, x, y, facingR) {
  _drawFrame(ctx, _enemyFrame(SLIME_FRAMES, 200), x, y, ENEMY_W, ENEMY_H, !facingR);
}
function drawMushroomEnemy(ctx, x, y, facingR) {
  _drawFrame(ctx, _enemyFrame(MUSHROOM_FRAMES, 200), x, y, ENEMY_W, ENEMY_H, !facingR);
}
function drawFlameEnemy(ctx, x, y, facingR) {
  // 불꽃은 조금 더 빠르게 (150ms)
  _drawFrame(ctx, _enemyFrame(FLAME_FRAMES, 150), x, y, ENEMY_W, ENEMY_H, !facingR);
}
function drawGhostEnemy(ctx, x, y, facingR) {
  _drawFrame(ctx, _enemyFrame(GHOST_FRAMES, 200), x, y, ENEMY_W, ENEMY_H, !facingR);
}

// ── 발판 드로우 (3-슬라이스) ─────────────────────────────────
// 학습 포인트: 좌우 끝(캡)은 고정, 가운데만 반복해 어떤 폭에도 자연스럽게 보임
// PLAT_CAP: 소스 이미지에서 왼쪽(=오른쪽) 캡의 px 너비. 조정이 필요하면 이 값만 바꿀 것.
const PLAT_CAP = 94; // 플랫폼 높이(94)와 동일 비율(정사각 캡)

function drawPlatformTile(ctx, x, y, w, h) {
  const img = SHEET.img;
  if (!img) {
    ctx.fillStyle = '#3a3f50';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const { sx, sy, sw, sh } = PLATFORM_FRAME;

  const midSrcX = sx + PLAT_CAP;
  const midSrcW = sw - PLAT_CAP * 2;
  const capW    = Math.round(PLAT_CAP * (h / sh));

  if (w <= capW * 2) {
    const half = Math.floor(w / 2);
    ctx.drawImage(img, sx,                 sy, PLAT_CAP, sh, x,           y, half,      h);
    ctx.drawImage(img, sx + sw - PLAT_CAP, sy, PLAT_CAP, sh, x + w - half, y, w - half, h);
    return;
  }

  ctx.drawImage(img, sx,                 sy, PLAT_CAP, sh, x,           y, capW, h);
  ctx.drawImage(img, sx + sw - PLAT_CAP, sy, PLAT_CAP, sh, x + w - capW, y, capW, h);

  const midDstX = x + capW;
  const midDstW = w - capW * 2;
  const tileW   = Math.round(midSrcW * (h / sh));
  for (let px = 0; px < midDstW; px += tileW) {
    const drawW = Math.min(tileW, midDstW - px);
    const srcW  = Math.round(midSrcW * (drawW / tileW));
    ctx.drawImage(img, midSrcX, sy, srcW, sh, midDstX + px, y, drawW, h);
  }
}
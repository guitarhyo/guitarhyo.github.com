// ── 스프라이트 시트 로더 ─────────────────────────────────────
// 학습 포인트: 개별 이미지 18개 → 시트 1장으로 교체해 HTTP 요청 수 감소
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
// 학습 포인트: drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh) 9인수 형태로 소스 영역을 잘라냄
// 시트 규격: 1056×499px, PAD=16, ROW_GAP=8, CELL=128
//   Row0 고양이 (sy=16):  col0 x16  col1 x144  col2 x272  col3 x400  col4 x528  col5 x656  col6 x784  col7 x912
//                         idle_0    idle_1     run_0      run_1      jump_0     jump_1     jump_2     fall
//   Row1 강아지 (sy=152): col0 x16  col1 x144  col2 x272  col3 x400  col4 x528  col5 x656  col6 x784  col7 x912
//                         idle_0    idle_1     run_0      run_1      jump_0     jump_1     jump_2     fall
//   Row2 슬라임 (sy=288): col0 x16  col1 x144
//                         slime_0   slime_1
//   Platform (sy=424):    x=305 (가로 중앙), w=446, h=59
const CELL = 128;

const CHAR_FRAMES = {
  cat: {
    idle: [
      { sx:  16, sy:  16, sw: CELL, sh: CELL },
      { sx: 144, sy:  16, sw: CELL, sh: CELL },
    ],
    run: [
      { sx: 272, sy:  16, sw: CELL, sh: CELL },
      { sx: 400, sy:  16, sw: CELL, sh: CELL },
    ],
    jump: [
      { sx: 528, sy:  16, sw: CELL, sh: CELL },
      { sx: 656, sy:  16, sw: CELL, sh: CELL },
      { sx: 784, sy: 16, sw: CELL, sh: CELL },
    ],
    fall: [
      { sx: 912, sy:  16, sw: CELL, sh: CELL },
    ],
  },
  dog: {
    idle: [
      { sx:  16, sy: 152, sw: CELL, sh: CELL },
      { sx: 144, sy: 152, sw: CELL, sh: CELL },
    ],
    run: [
      { sx: 272, sy: 152, sw: CELL, sh: CELL },
      { sx: 400, sy: 152, sw: CELL, sh: CELL },
    ],
    jump: [
      { sx: 528, sy: 152, sw: CELL, sh: CELL },
      { sx: 656, sy: 152, sw: CELL, sh: CELL },
      { sx: 784, sy: 152, sw: CELL, sh: CELL },
    ],
    fall: [
      { sx: 912, sy: 152, sw: CELL, sh: CELL },
    ],
  },
};

const SLIME_FRAMES = [
  { sx:  16, sy: 288, sw: CELL, sh: CELL },
  { sx: 144, sy: 288, sw: CELL, sh: CELL },
];

const PLATFORM_FRAME = { sx: 305, sy: 424, sw: 445, sh: 59 };

// ── 애니메이션 프레임 카운트 (game.js 공용) ───────────────────
const FRAME_COUNT = {
  cat: { idle: 2, run: 2, jump: 3, fall: 1 },
  dog: { idle: 2, run: 2, jump: 3, fall: 1 },
};

// 상태×프레임별 Y 오프셋 (픽셀, 36px 표시 기준)
const Y_OFFSETS = {
  idle: [0,  3],
  run:  [0,  3],
  jump: [-6, -6],
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

// ── 슬라임 고블린 드로우 ──────────────────────────────────────
function drawSlimeEnemy(ctx, x, y, facingR) {
  // Date.now() 기반으로 200ms마다 프레임 교체 (5fps)
  const frame = Math.floor(Date.now() / 200) % 2;
  _drawFrame(ctx, SLIME_FRAMES[frame], x, y, ENEMY_W, ENEMY_H, !facingR);
}

// ── 발판 드로우 (3-슬라이스) ─────────────────────────────────
// 학습 포인트: 9-slice/3-slice — 좌우 끝(캡)은 고정, 가운데만 반복해 어떤 폭에도 자연스럽게 보임
// PLAT_CAP: 소스 이미지에서 왼쪽(=오른쪽) 캡의 px 너비. 조정이 필요하면 이 값만 바꿀 것.
const PLAT_CAP = 59; // 높이와 동일한 비율(정사각 캡)

function drawPlatformTile(ctx, x, y, w, h) {
  const img = SHEET.img;
  if (!img) {
    ctx.fillStyle = '#3a3f50';
    ctx.fillRect(x, y, w, h);
    return;
  }
  const { sx, sy, sw, sh } = PLATFORM_FRAME;

  // 소스 중앙 영역
  const midSrcX = sx + PLAT_CAP;
  const midSrcW = sw - PLAT_CAP * 2;

  // 화면 캡 너비 = 소스 캡을 h 비율로 환산
  const capW = Math.round(PLAT_CAP * (h / sh));

  // 플랫폼이 좁아 캡 두 개로 꽉 차는 경우: 좌/우 캡만 절반씩
  if (w <= capW * 2) {
    const half = Math.floor(w / 2);
    ctx.drawImage(img, sx,                    sy, PLAT_CAP, sh, x,          y, half,    h);
    ctx.drawImage(img, sx + sw - PLAT_CAP,    sy, PLAT_CAP, sh, x + w - half, y, w - half, h);
    return;
  }

  // 왼쪽 캡
  ctx.drawImage(img, sx,              sy, PLAT_CAP, sh, x,          y, capW, h);
  // 오른쪽 캡
  ctx.drawImage(img, sx + sw - PLAT_CAP, sy, PLAT_CAP, sh, x + w - capW, y, capW, h);

  // 가운데 반복 타일
  const midDstX = x + capW;
  const midDstW = w - capW * 2;
  const tileW   = Math.round(midSrcW * (h / sh)); // 중앙 소스를 h 비율로 환산한 타일 폭
  for (let px = 0; px < midDstW; px += tileW) {
    const drawW = Math.min(tileW, midDstW - px);
    const srcW  = Math.round(midSrcW * (drawW / tileW));
    ctx.drawImage(img, midSrcX, sy, srcW, sh, midDstX + px, y, drawW, h);
  }
}
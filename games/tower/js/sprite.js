// ── 팔레트 ─────────────────────────────────────────────────
// 한 글자 = 한 논리 픽셀 (scale 2 → 화면에서 2×2)
const PAL = {
  '_': null,       // 투명
  'k': '#12151b',  // 외곽선
  'a': '#8090b0',  // 실버 갑옷
  'e': '#202020',  // 눈
  'b': '#4f8cff',  // 파란 보석/강조
  'w': '#e0e8ff',  // 검날 / 하이라이트
};

// ── 프레임 데이터 (12×12 논리 픽셀) ────────────────────────
// 캐릭터 기본형: 냥이 검사 (오른쪽을 향함 기준)
// 검은 col 0 의 'w' → 왼손에서 왼쪽으로 뻗음

const _BASE_ROWS = [
  '__kk___kk___',  //  0: 귀 끝
  '_kak___kak__',  //  1: 귀 내부
  '_kaaaaaaak__',  //  2: 머리 상단
  '_kaaaaaaak__',  //  3: 얼굴 위
  '_kaeaaaeak__',  //  4: 눈
  '_kaaaaaaak__',  //  5: 얼굴 아래
  '__kaaaak____',  //  6: 턱 (좁아짐)
  '_kbbbbbbbk__',  //  7: 갑옷 상단
  'wkbbbbbbbk__',  //  8: 검 팔 + 갑옷 중단
  '_kbbbbbbbk__',  //  9: 갑옷 하단
  '__kak__kak__',  // 10: 다리
  '__kkk__kkk__',  // 11: 발
];

const FRAMES = {
  // idle: 데이터는 동일, draw 시 yOffset 으로 bob 처리
  idle: [
    _BASE_ROWS,
    _BASE_ROWS,
  ],

  // run: 다리 교차 애니메이션
  run: [
    [
      ..._BASE_ROWS.slice(0, 10),
      '_kak___kkk__',  // 10: 왼 다리 앞 (a=빛), 오른 다리 뒤 (k=그림자)
      '_kkk___kkk__',  // 11
    ],
    [
      ..._BASE_ROWS.slice(0, 10),
      '_kkk___kak__',  // 10: 왼 뒤, 오른 앞
      '_kkk___kkk__',  // 11
    ],
  ],

  // jump: 발 숨김 (공중 느낌)
  jump: [
    [
      ..._BASE_ROWS.slice(0, 8),
      'wkbbbbbbbkw_',  // 8: 양 팔 벌림
      ..._BASE_ROWS.slice(9, 10),
      '__kak__kak__',  // 10: 다리
      '____________',  // 11: 발 숨김
    ],
  ],

  // fall: 팔 벌림 + 다리 늘어짐
  fall: [
    [
      ..._BASE_ROWS.slice(0, 8),
      'wkbbbbbbbkw_',  // 8: 양 팔 벌림
      ..._BASE_ROWS.slice(9),
    ],
  ],
};

// 상태별 프레임 수
const FRAME_COUNT = {
  idle: 2,
  run:  2,
  jump: 1,
  fall: 1,
};

// 상태×프레임별 Y 오프셋 (bob / 점프 연출)
const Y_OFFSETS = {
  idle: [0, 1],   // 1px bob
  run:  [0, 1],   // 달리기 바운스
  jump: [-2],     // 위로 당김
  fall: [1],      // 아래로 늘어짐
};

// ── 픽셀 아트 렌더러 ───────────────────────────────────────
// palette 를 인자로 받아 캐릭터·적 등 여러 스프라이트에 재사용
function drawPixelArt(ctx, rows, palette, x, y, scale, flipX) {
  const width = rows[0].length;
  for (let row = 0; row < rows.length; row++) {
    const line = rows[row];
    for (let col = 0; col < line.length; col++) {
      const color = palette[line[col]];
      if (!color) continue;
      ctx.fillStyle = color;
      const px = flipX
        ? x + (width - 1 - col) * scale
        : x + col * scale;
      ctx.fillRect(px, y + row * scale, scale, scale);
    }
  }
}

// ── 적 스프라이트 (10×10 → scale 3 = 30×30) ──────────────
const ENEMY_PAL = {
  '_': null,
  'k': '#12151b',  // 외곽선
  'g': '#50a830',  // 녹색 몸
  'e': '#f0f040',  // 노란 눈
  'r': '#c04040',  // 붉은 발
};

// 10×10 슬라임 고블린
const ENEMY_BASE = [
  '__kkkk____',  //  0
  '_kggggk___',  //  1
  '_kegegk___',  //  2: 눈
  '_kggggk___',  //  3
  'kkggggkk__',  //  4: 어깨
  'kgggggggk_',  //  5
  'kgggggggk_',  //  6
  '_kgggggk__',  //  7
  '__krkrk___',  //  8: 발 색상
  '__k___k___',  //  9: 다리
];

function drawSlimeEnemy(ctx, x, y, facingR) {
  drawPixelArt(ctx, ENEMY_BASE, ENEMY_PAL, x, y, 3, !facingR);
}

// ── 멍멍이 검사 스프라이트 (12×12 → scale 3 = 36×36) ──────
const DOG_PAL = {
  '_': null,
  'k': '#12151b',  // 외곽선
  'd': '#b07830',  // 갈색 털
  'e': '#202020',  // 눈
  'b': '#4f8cff',  // 갑옷 (파랑)
  'w': '#e0e8ff',  // 검날
};

// 고양이와 동일 구조, 귀 모양·털 색만 다름
// Row1: 2칸 귀(kddk) → 고양이보다 넓고 묵직한 느낌
// Row7-9: 1칸 더 넓은 갑옷(bbbbbbbb = 8칸 vs 고양이 7칸)
const DOG_BASE = [
  '__kk___kk___',  //  0: 귀 끝
  '_kddk__kddk_',  //  1: 넓은 처진 귀 (2칸)
  '_kdddddddk__',  //  2: 머리 상단
  '_kdddddddk__',  //  3: 얼굴
  '_kdedddedk__',  //  4: 눈
  '_kdddddddk__',  //  5: 얼굴 하단
  '__kddddk____',  //  6: 턱
  '_kbbbbbbbbk_',  //  7: 갑옷 (고양이보다 1칸 넓음)
  'wkbbbbbbbbk_',  //  8: 검 팔
  '_kbbbbbbbbk_',  //  9: 갑옷 하단
  '__kdk__kdk__',  // 10: 다리
  '__kkk__kkk__',  // 11: 발
];

const DOG_FRAMES = {
  idle: [DOG_BASE, DOG_BASE],
  run: [
    [...DOG_BASE.slice(0, 10), '_kdk___kkk__', '_kkk___kkk__'],
    [...DOG_BASE.slice(0, 10), '_kkk___kdk__', '_kkk___kkk__'],
  ],
  jump: [
    [...DOG_BASE.slice(0, 8), 'wkbbbbbbbbkw', ...DOG_BASE.slice(9, 10),
     '__kdk__kdk__', '____________'],
  ],
  fall: [
    [...DOG_BASE.slice(0, 8), 'wkbbbbbbbbkw', ...DOG_BASE.slice(9)],
  ],
};

function drawDogKnight(ctx, x, y, state, frame, facingR) {
  const frames = DOG_FRAMES[state] ?? DOG_FRAMES.idle;
  const f      = frame % frames.length;
  const yOff   = (Y_OFFSETS[state]?.[f] ?? 0) * 3;
  drawPixelArt(ctx, frames[f], DOG_PAL, x, y + yOff, 3, !facingR);
}

// ── 공개 API ───────────────────────────────────────────────
// charId  : 'cat' | 'dog'
function drawCharacter(ctx, charId, x, y, state, frame, facingR) {
  if (charId === 'dog') drawDogKnight(ctx, x, y, state, frame, facingR);
  else                  drawCatKnight(ctx, x, y, state, frame, facingR);
}

function drawCatKnight(ctx, x, y, state, frame, facingR) {
  const stateFrames = FRAMES[state] ?? FRAMES.idle;
  const f           = frame % stateFrames.length;
  const yOff        = (Y_OFFSETS[state]?.[f] ?? 0) * 3; // scale=3 이므로 ×3
  drawPixelArt(ctx, stateFrames[f], PAL, x, y + yOff, 3, !facingR);
}

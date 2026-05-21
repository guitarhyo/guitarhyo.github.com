const LOGICAL_W = 360;
const LOGICAL_H = 640;

// 텍스트 가독성용 그림자 — 하늘 배경 위 어떤 색 글자도 읽힘
function _setShadow(ctx) {
  ctx.shadowColor   = 'rgba(0,0,0,0.85)';
  ctx.shadowOffsetX = 1;
  ctx.shadowOffsetY = 1;
  ctx.shadowBlur    = 4;
}

// ── 물리 상수 (공통) ───────────────────────────────────────
const GRAVITY = 1400; // px/s²

// ── 발판 상수 ──────────────────────────────────────────────
const PLAT_H     = 12;
const PLAT_GAP_Y = 75;
const PLAT_W_MIN = 65;
const PLAT_W_MAX = 120;

// ── 적 상수 ────────────────────────────────────────────────
// ENEMY_W / ENEMY_H 는 sprite.js 에서 정의
const ENEMY_SPEED_BASE       = 55;
const ENEMY_SPAWN_MIN_HEIGHT = 150;

// ── 캐릭터 정의 ────────────────────────────────────────────
const CHARACTERS = {
  cat: {
    id:           'cat',
    name:         '냥이 검사',
    icon:         '🐱',
    desc:         '빠른 공중 콤보 특화',
    moveSpeed:    170,
    jumpPower:    -680,
    bounceBase:   -520,
    bounceBonus:   20,   // 콤보당 반동 증가량
    bounceMax:    -680,
    comboTimeout:  2.0,
    attackRange:   0,    // 기본 판정 (스프라이트 크기 그대로)
  },
  dog: {
    id:           'dog',
    name:         '멍멍이 검사',
    icon:         '🐶',
    desc:         '묵직한 범위 공격 특화',
    moveSpeed:    140,   // 느림
    jumpPower:    -620,  // 낮은 점프
    bounceBase:   -580,  // 강한 단타 반동
    bounceBonus:   10,   // 콤보 증가량 낮음 (대신 기본이 강함)
    bounceMax:    -680,
    comboTimeout:  1.5,  // 콤보 유지 시간 짧음
    attackRange:   12,   // 판정 범위 12px 확장 → 범위형 공격
  },
};

let currentChar = CHARACTERS.cat; // 기본값, 캐릭터 선택 시 교체

const canvas = document.getElementById('game-canvas');
const ctx    = canvas.getContext('2d');

function resize() {
  const scale = Math.min(window.innerWidth / LOGICAL_W, window.innerHeight / LOGICAL_H);
  canvas.width  = LOGICAL_W;
  canvas.height = LOGICAL_H;
  canvas.style.width  = `${LOGICAL_W * scale}px`;
  canvas.style.height = `${LOGICAL_H * scale}px`;
  // 픽셀아트 스프라이트 스케일다운 시 인접 셀 블렌딩 방지
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);
resize();

// ── 플레이어 ───────────────────────────────────────────────
const FLOOR_WORLD_Y = 600; // 시작 바닥 world Y

const player = {
  x: LOGICAL_W / 2 - 18,
  y: FLOOR_WORLD_Y - 36,
  w: 36,
  h: 36,
  vx: 0,
  vy: 0,
  onGround: false,
};

// ── 점수 ───────────────────────────────────────────────────
// score.total = 높이(px/10) + 킬 × 100
const SCORE_KEY = 'score:cloudtower:best';
const score = { height: 0, kills: 0, total: 0 };
let bestScore = parseInt(localStorage.getItem(SCORE_KEY) || '0', 10);

function calcScore() {
  score.height = Math.max(score.height,
    Math.max(0, Math.floor((FLOOR_WORLD_Y - (player.y + player.h)) / 10)));
  score.total  = score.height + score.kills * 100;
}

function saveBestScore() {
  if (score.total > bestScore) {
    bestScore = score.total;
    localStorage.setItem(SCORE_KEY, String(bestScore));
  }
}

function resetScore() {
  score.height = 0;
  score.kills  = 0;
  score.total  = 0;
}

// ── 콤보 ───────────────────────────────────────────────────
const combo = { count: 0, timer: 0 };

function updateCombo(dt) {
  if (combo.count === 0) return;
  combo.timer += dt;
  if (combo.timer >= currentChar.comboTimeout) {
    combo.count = 0;
    combo.timer = 0;
  }
}

// ── 카메라 ─────────────────────────────────────────────────
// cameraY : 화면 상단에 해당하는 world Y
// screenY = worldY - cameraY
let cameraY = 0;

function updateCamera() {
  // 플레이어가 화면 위쪽 40% 선보다 올라가면 카메라 따라감
  // 카메라는 위로만 이동 (내려오지 않음 → 떨어진 발판 복귀 불가)
  const target = player.y - LOGICAL_H * 0.4;
  if (target < cameraY) cameraY = target;
}

// ── 발판 ───────────────────────────────────────────────────
const platforms = [];
let nextPlatY;
// 이전 발판 중심 X — 다음 발판이 너무 멀리 생성되지 않도록 추적
let lastPlatCX = LOGICAL_W / 2;

// 최대 수평 이동 거리: MOVE_SPEED(170) × 공중 체공시간(~0.97s) ≈ 165px
// 여유 45px 를 뺀 120px 이내로 중심 이동을 제한
const MAX_PLAT_SHIFT = 120;

function makePlatform(worldY) {
  const w  = PLAT_W_MIN + Math.random() * (PLAT_W_MAX - PLAT_W_MIN);
  const lo = Math.max(w / 2,           lastPlatCX - MAX_PLAT_SHIFT);
  const hi = Math.min(LOGICAL_W - w / 2, lastPlatCX + MAX_PLAT_SHIFT);
  const cx = lo + Math.random() * (hi - lo);
  lastPlatCX = cx;
  return { x: Math.round(cx - w / 2), y: worldY, w: Math.round(w), h: PLAT_H };
}

function initPlatforms() {
  platforms.length = 0;
  enemies.length   = 0;
  lastPlatCX       = LOGICAL_W / 2; // 시작 바닥 중심에서 시작
  platforms.push({ x: 0, y: FLOOR_WORLD_Y, w: LOGICAL_W, h: PLAT_H });
  nextPlatY = FLOOR_WORLD_Y - PLAT_GAP_Y;
  for (let i = 0; i < 10; i++) {
    const p = makePlatform(nextPlatY);
    platforms.push(p);
    maybeSpawnEnemy(p);
    nextPlatY -= PLAT_GAP_Y + Math.random() * 15;
  }
}

function spawnPlatformsAbove() {
  while (nextPlatY > cameraY - 200) {
    const p = makePlatform(nextPlatY);
    platforms.push(p);
    maybeSpawnEnemy(p);
    nextPlatY -= PLAT_GAP_Y + Math.random() * 15;
  }
}

function cleanupPlatforms() {
  for (let i = platforms.length - 1; i >= 0; i--) {
    if (platforms[i].y - cameraY > LOGICAL_H + 100) {
      platforms.splice(i, 1);
    }
  }
}

// ── 적 ────────────────────────────────────────────────────
const enemies = [];

function makeEnemy(plat) {
  const x = plat.x + Math.random() * Math.max(0, plat.w - ENEMY_W);
  return {
    x,
    y:       plat.y - ENEMY_H,
    w:       ENEMY_W,
    h:       ENEMY_H,
    vx:      Math.random() < 0.5 ? -ENEMY_SPEED_BASE : ENEMY_SPEED_BASE,
    patrolX: plat.x,
    patrolW: plat.w,
    alive:   true,
    type:    ['slime', 'mushroom', 'flame', 'ghost'][Math.floor(Math.random() * 4)],
  };
}

// 높이가 높을수록 스폰 확률 증가
function maybeSpawnEnemy(plat) {
  const height = FLOOR_WORLD_Y - plat.y;
  if (height < ENEMY_SPAWN_MIN_HEIGHT) return;
  const chance = Math.min(0.65, (height - ENEMY_SPAWN_MIN_HEIGHT) / 800);
  if (Math.random() < chance) enemies.push(makeEnemy(plat));
}

function updateEnemies(dt) {
  for (const e of enemies) {
    if (!e.alive) continue;
    e.x += e.vx * dt;
    // 발판 끝에서 방향 전환
    if (e.x <= e.patrolX) {
      e.x  = e.patrolX;
      e.vx = Math.abs(e.vx);
    }
    if (e.x + e.w >= e.patrolX + e.patrolW) {
      e.x  = e.patrolX + e.patrolW - e.w;
      e.vx = -Math.abs(e.vx);
    }
  }
}

// 자동 공격: 공중이거나 이동 중(|vx|>20)이면 접촉 즉시 처치 + 바운스
// 지상에서 멈춘 채 접촉 = 즉사 (항상 움직이도록 유도)
function checkEnemyCollisions() {
  for (const e of enemies) {
    if (!e.alive) continue;
    if (!_overlapsAttack(player, e)) continue;

    const attacking = !player.onGround || Math.abs(player.vx) > 20;

    if (attacking) {
      e.alive = false;
      enemyHitBounce();
    } else {
      saveBestScore();
      state = 'gameover';
      return;
    }
  }
}

// 콤보 누적 → 반동력 증가 (최대 BOUNCE_MAX 까지)
function enemyHitBounce() {
  combo.count++;
  combo.timer = 0;
  score.kills++;

  const power = Math.max(currentChar.bounceMax,
                         currentChar.bounceBase - combo.count * currentChar.bounceBonus);
  player.vy       = power;
  player.onGround = false;

  // 이펙트: 처치 위치에 파티클 + 콤보 수에 비례한 흔들림
  spawnKillParticles(
    player.x + player.w / 2,
    player.y + player.h / 2,
    combo.count
  );
  triggerShake(3 + Math.min(combo.count, 5), 0.15);
}

function _overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

// attackRange 만큼 판정 확장 (멍멍이 범위 공격)
function _overlapsAttack(a, b) {
  const r = currentChar.attackRange;
  return a.x - r < b.x + b.w && a.x + a.w + r > b.x &&
         a.y - r < b.y + b.h && a.y + a.h + r > b.y;
}

function cleanupEnemies() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    if (!enemies[i].alive || enemies[i].y - cameraY > LOGICAL_H + 100) {
      enemies.splice(i, 1);
    }
  }
}

// ── 플레이어 물리 & 발판 충돌 ─────────────────────────────
function updatePlayer(dt) {
  // 입력 → 속도
  player.vx = input.left  ? -currentChar.moveSpeed
            : input.right ?  currentChar.moveSpeed
            : 0;

  // 방향을 누르고 있으면 바닥 착지 즉시 자동 점프
  // jump() 내부에서 onGround 체크하므로 공중에서는 무시됨
  if (input.left || input.right) jump();

  const prevY = player.y; // 충돌 감지를 위해 이전 위치 보존

  player.vy += GRAVITY * dt;
  player.y  += player.vy * dt;
  player.x  += player.vx * dt;

  // 좌우 wrap
  if (player.x + player.w < 0) player.x = LOGICAL_W;
  if (player.x > LOGICAL_W)    player.x = -player.w;

  player.onGround = false;

  // 발판 충돌: 하강 중(vy >= 0)에만 체크
  // prevBottom → currBottom 이 발판 상단을 통과했는지 확인 (관통 방지)
  if (player.vy >= 0) {
    const prevBottom = prevY       + player.h;
    const currBottom = player.y    + player.h;
    for (const plat of platforms) {
      if (
        player.x + player.w > plat.x &&
        player.x < plat.x + plat.w &&
        prevBottom <= plat.y &&
        currBottom >= plat.y
      ) {
        player.y        = plat.y - player.h;
        player.vy       = 0;
        player.onGround = true;
        break;
      }
    }
  }
}

function jump() {
  if (!player.onGround) return;
  player.vy       = currentChar.jumpPower;
  player.onGround = false;
}

// ── 플레이어 애니메이터 ────────────────────────────────────
const playerAnim = {
  state:    'idle',  // 'idle' | 'run' | 'jump' | 'fall'
  frame:    0,
  timer:    0,
  facingR:  true,    // true = 오른쪽
};

// 상태별 재생 fps
const ANIM_FPS = { idle: 4, run: 10, jump: 1, fall: 1 };

// frameIndex = (frameIndex + 1) % maxFrame  ← 학습 포인트: 순환 카운터
function updateAnim(dt) {
  if (player.vx > 1)  playerAnim.facingR = true;
  if (player.vx < -1) playerAnim.facingR = false;

  const newState = !player.onGround
    ? (player.vy < 0 ? 'jump' : 'fall')
    : (Math.abs(player.vx) > 1 ? 'run' : 'idle');

  if (newState !== playerAnim.state) {
    playerAnim.state = newState;
    playerAnim.frame = 0;
    playerAnim.timer = 0;
  }

  playerAnim.timer += dt;
  const interval = 1 / ANIM_FPS[newState];
  if (playerAnim.timer >= interval) {
    playerAnim.timer -= interval;
    playerAnim.frame = (playerAnim.frame + 1) % FRAME_COUNT[currentChar.id][newState];
  }
}

// ── 게임 리셋 ──────────────────────────────────────────────
function resetGame() {
  player.x        = LOGICAL_W / 2 - 18;
  player.y        = FLOOR_WORLD_Y - player.h;
  player.vx       = 0;
  player.vy       = 0;
  player.onGround = false;
  cameraY         = 0;
  enemies.length  = 0;
  combo.count     = 0;
  combo.timer     = 0;
  resetScore();
  resetEffects();
  playerAnim.state  = 'idle';
  playerAnim.frame  = 0;
  playerAnim.timer  = 0;
  playerAnim.facingR = true;
  initPlatforms();
}

// ── 언어 토글 버튼 (비게임 화면 우상단) ────────────────────
const LANG_BTN = { x: 312, y: 8, w: 40, h: 22 };

function _inLangBtn(tx, ty) {
  return tx >= LANG_BTN.x && tx <= LANG_BTN.x + LANG_BTN.w &&
         ty >= LANG_BTN.y && ty <= LANG_BTN.y + LANG_BTN.h;
}

function drawLangToggle(ctx) {
  const lang = getLang();
  ctx.save();
  ctx.fillStyle   = '#1a1d24';
  ctx.strokeStyle = '#4f8cff';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.roundRect(LANG_BTN.x, LANG_BTN.y, LANG_BTN.w, LANG_BTN.h, 4);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle    = '#4f8cff';
  ctx.font         = 'bold 11px system-ui';
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(lang === 'ko' ? 'KO' : 'EN',
               LANG_BTN.x + LANG_BTN.w / 2,
               LANG_BTN.y + LANG_BTN.h / 2);
  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

// ── 게임 상태 ──────────────────────────────────────────────
// 'title' | 'select' | 'playing' | 'gameover'
let state = 'title';

function update(dt) {
  updateBgClouds(cameraY, dt);

  if (state !== 'playing') {
    if (input.anyTapDown) {
      // 언어 토글 버튼 탭 우선 처리
      if (_inLangBtn(input.lastTapX, input.lastTapY)) {
        setLang(getLang() === 'ko' ? 'en' : 'ko');
        input.anyTapDown = false;
        return;
      }
      if (state === 'title') {
        state = 'select';
      } else if (state === 'select') {
        // 탭한 영역에 따라 캐릭터 선택
        currentChar = input.left ? CHARACTERS.cat : CHARACTERS.dog;
        resetGame();
        state = 'playing';
      } else if (state === 'gameover') {
        state = 'title';
      }
    }
    input.anyTapDown = false;
    return;
  }

  input.anyTapDown = false; // playing 중에는 사용 안 함

  updatePlayer(dt);
  updateAnim(dt);
  updateCombo(dt);
  updateParticles(dt);
  updateShake(dt);

  updateCamera();
  spawnPlatformsAbove();
  cleanupPlatforms();
  updateEnemies(dt);
  checkEnemyCollisions();
  cleanupEnemies();

  calcScore();

  // 낙사 판정: 플레이어가 화면 아래로 완전히 벗어나면 게임 오버
  if (player.y - cameraY > LOGICAL_H + 50) {
    saveBestScore();
    state = 'gameover';
  }
}

// ── 드로우 ─────────────────────────────────────────────────
function draw() {
  ctx.clearRect(0, 0, LOGICAL_W, LOGICAL_H);
  if      (state === 'title')    drawTitle();
  else if (state === 'select')   drawSelectScreen();
  else if (state === 'playing')  drawGame();
  else if (state === 'gameover') drawGameOver();
}

function drawGame() {
  drawBackground(ctx, cameraY);

  // ── 월드 (화면 흔들림 적용) ────────────────────────────
  ctx.save();
  const s = getShake();
  ctx.translate(s.x, s.y);

  // 발판
  for (const plat of platforms) {
    const sy = plat.y - cameraY;
    if (sy > -PLAT_H && sy < LOGICAL_H) {
      drawPlatformTile(ctx, Math.round(plat.x), Math.round(sy), plat.w, plat.h);
    }
  }

  // 적
  for (const e of enemies) {
    if (!e.alive) continue;
    const sy = e.y - cameraY;
    if (sy > -ENEMY_H && sy < LOGICAL_H) {
      const ex = Math.round(e.x), ey = Math.round(sy), ef = e.vx > 0;
      if      (e.type === 'mushroom') drawMushroomEnemy(ctx, ex, ey, ef);
      else if (e.type === 'flame')    drawFlameEnemy(ctx, ex, ey, ef);
      else if (e.type === 'ghost')    drawGhostEnemy(ctx, ex, ey, ef);
      else                            drawSlimeEnemy(ctx, ex, ey, ef);
    }
  }

  // 플레이어
  drawCharacter(
    ctx,
    currentChar.id,
    Math.round(player.x),
    Math.round(player.y - cameraY),
    playerAnim.state,
    playerAnim.frame,
    playerAnim.facingR
  );

  // 파티클 (플레이어 위)
  drawParticles(ctx, cameraY);

  ctx.restore();

  // ── HUD (흔들림 없음) ──────────────────────────────────
  drawInputHUD(ctx);
  drawScoreHUD(ctx);
  drawComboHUD(ctx);
}

function drawScoreHUD(ctx) {
  ctx.save();
  _setShadow(ctx);
  ctx.textAlign    = 'right';
  ctx.textBaseline = 'top';

  ctx.fillStyle = '#e8e8ea';
  ctx.font      = 'bold 14px system-ui';
  ctx.fillText(score.total, LOGICAL_W - 8, 8);

  if (bestScore > 0) {
    ctx.fillStyle = '#c0d0e8';
    ctx.font      = '11px system-ui';
    ctx.fillText(`${t('best')} ${bestScore}`, LOGICAL_W - 8, 26);
  }

  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawComboHUD(ctx) {
  if (combo.count < 2) return;

  // 콤보 타임아웃이 가까울수록 투명해짐
  const fade = 1 - combo.timer / currentChar.comboTimeout;
  // 콤보 수에 따라 폰트 크기 증가 (최대 32px)
  const size = Math.min(32, 18 + combo.count * 2);

  ctx.save();
  ctx.globalAlpha  = fade;
  ctx.textAlign    = 'center';
  ctx.textBaseline = 'middle';

  // 그림자로 가독성 확보
  ctx.fillStyle = '#000000';
  ctx.font = `bold ${size + 2}px system-ui`;
  ctx.fillText(`${combo.count} COMBO!`, LOGICAL_W / 2 + 1, 75);

  ctx.fillStyle = combo.count >= 5 ? '#f0a020' : '#f0f040';
  ctx.font = `bold ${size}px system-ui`;
  ctx.fillText(`${combo.count} COMBO!`, LOGICAL_W / 2, 74);

  ctx.textBaseline = 'alphabetic';
  ctx.restore();
}

function drawSelectScreen() {
  drawBackground(ctx, cameraY);

  // 호버 하이라이트 (shadow 없이)
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.fillStyle = '#4f8cff';
  if (input.left)  ctx.fillRect(0,   0, 180, LOGICAL_H);
  if (input.right) ctx.fillRect(180, 0, 180, LOGICAL_H);
  ctx.restore();

  // 구분선 (shadow 없이)
  ctx.save();
  ctx.strokeStyle = '#2a2d38';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(180, 80);
  ctx.lineTo(180, LOGICAL_H - 60);
  ctx.stroke();
  ctx.restore();

  // 텍스트 (shadow 적용)
  ctx.save();
  _setShadow(ctx);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#e8e8ea';
  ctx.font = 'bold 20px system-ui';
  ctx.fillText(t('select_prompt'), LOGICAL_W / 2, 60);

  const chars = [CHARACTERS.cat, CHARACTERS.dog];
  const xs = [90, 270];

  chars.forEach((ch, i) => {
    const cx = xs[i];
    const spriteX = cx - 18;
    const spriteY = LOGICAL_H / 2 - 60;

    drawCharacter(ctx, ch.id, spriteX, spriteY, 'idle', 0, true);

    ctx.fillStyle = '#e8e8ea';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(ch.icon + ' ' + t(ch.id + '_name'), cx, spriteY + 60);

    ctx.fillStyle = '#ffffff';
    ctx.font = '12px system-ui';
    ctx.fillText(t(ch.id + '_desc'), cx, spriteY + 80);

    ctx.fillStyle = '#a0cfff';
    ctx.font = '11px system-ui';
    ctx.fillText(ch.id === 'cat' ? t('spd_fast') : t('spd_slow'), cx, spriteY + 100);
    ctx.fillText(ch.id === 'cat' ? t('range_narrow') : t('range_wide'), cx, spriteY + 116);
  });

  ctx.fillStyle = '#a0cfff';
  ctx.font = '14px system-ui';
  ctx.fillText(t('select_hint'), LOGICAL_W / 2, LOGICAL_H - 30);
  ctx.restore();

  drawLangToggle(ctx);
}

function drawTitle() {
  drawBackground(ctx, cameraY);

  ctx.save();
  _setShadow(ctx);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#e8e8ea';
  ctx.font = 'bold 28px system-ui';
  ctx.fillText(t('title'), LOGICAL_W / 2, LOGICAL_H / 2 - 30);

  if (bestScore > 0) {
    ctx.fillStyle = '#f0a020';
    ctx.font = '14px system-ui';
    ctx.fillText(`${t('best')}: ${bestScore}`, LOGICAL_W / 2, LOGICAL_H / 2 + 5);
  }

  ctx.fillStyle = '#4f8cff';
  ctx.font = '16px system-ui';
  ctx.fillText(t('tap_to_start'), LOGICAL_W / 2, LOGICAL_H / 2 + 35);
  ctx.restore();

  drawLangToggle(ctx);
}

function drawGameOver() {
  drawBackground(ctx, cameraY);

  ctx.save();
  _setShadow(ctx);
  ctx.textAlign = 'center';

  ctx.fillStyle = '#e8e8ea';
  ctx.font = 'bold 28px system-ui';
  ctx.fillText(t('game_over'), LOGICAL_W / 2, LOGICAL_H / 2 - 50);

  ctx.fillStyle = '#e8e8ea';
  ctx.font = 'bold 22px system-ui';
  ctx.fillText(String(score.total), LOGICAL_W / 2, LOGICAL_H / 2);

  ctx.fillStyle = '#8090b0';
  ctx.font = '13px system-ui';
  ctx.fillText(`${t('stat_height')} ${score.height}  ${t('stat_kills')} ${score.kills}`,
               LOGICAL_W / 2, LOGICAL_H / 2 + 22);

  if (score.total > 0 && score.total === bestScore) {
    ctx.fillStyle = '#f0a020';
    ctx.font = 'bold 14px system-ui';
    ctx.fillText(t('new_best'), LOGICAL_W / 2, LOGICAL_H / 2 + 46);
  } else if (bestScore > 0) {
    ctx.fillStyle = '#8090b0';
    ctx.font = '13px system-ui';
    ctx.fillText(`${t('best')}: ${bestScore}`, LOGICAL_W / 2, LOGICAL_H / 2 + 46);
  }

  ctx.fillStyle = '#4f8cff';
  ctx.font = '16px system-ui';
  ctx.fillText(t('tap_to_restart'), LOGICAL_W / 2, LOGICAL_H / 2 + 80);
  ctx.restore();

  drawLangToggle(ctx);
}

// ── 입력 초기화 ────────────────────────────────────────────
initInput(canvas);

// ── 게임 루프 ──────────────────────────────────────────────
// 학습 포인트: loadI18n()가 resolve된 뒤 루프 시작 → 첫 프레임부터 번역 사용 가능
let lastTime = 0;
function loop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

Promise.all([loadI18n(), loadSprites(), loadBgAssets()]).then(() => {
  initBgClouds();
  requestAnimationFrame(loop);
});

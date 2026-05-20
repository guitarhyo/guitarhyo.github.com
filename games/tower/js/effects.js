// ── 하늘 배경 + 구름 ─────────────────────────────────────────
// 학습 포인트: 시차(parallax) — 배경이 게임 세계보다 느리게 스크롤되면 원근감이 생김
const _bgClouds = [];
const _BG_CLOUD_N = 10;
let   _bgCamY = 0; // 이전 프레임 cameraY (시차 델타 계산용)
const _PARALLAX = 0.25; // 구름이 카메라의 25% 속도로 이동

function _makeCloud(sy) {
  return {
    sx:    Math.random() * (LOGICAL_W + 80) - 40,
    sy,
    w:     55 + Math.random() * 90,
    h:     20 + Math.random() * 20,
    alpha: 0.5 + Math.random() * 0.4,
  };
}

function initBgClouds() {
  _bgClouds.length = 0;
  _bgCamY = 0;
  for (let i = 0; i < _BG_CLOUD_N; i++) {
    _bgClouds.push(_makeCloud(Math.random() * LOGICAL_H));
  }
}

// 카메라가 올라간 만큼만 구름을 시차 비율로 이동 (자율 드리프트 없음)
function updateBgClouds(cameraY, dt) {
  const camDelta = _bgCamY - cameraY;   // 올라갈수록 양수
  _bgCamY = cameraY;

  const drift = camDelta * _PARALLAX;

  for (const c of _bgClouds) {
    c.sy += drift;
    if (c.sy >  LOGICAL_H + c.h + 10) c.sy = -(c.h + 10);
    if (c.sy < -(c.h + 10))           c.sy =  LOGICAL_H + c.h + 10;
  }
}

// t=0: 지상(밝은 하늘) / t=1: 고고도(짙은 남색)
function _skyChannel(ch, t) {
  const lo = [110, 185, 240];
  const hi = [ 12,  18,  55];
  return Math.round(lo[ch] + (hi[ch] - lo[ch]) * t);
}

function drawBackground(ctx, cameraY) {
  // 고도 비율 (0 ~ 3000 px 상승 기준)
  const t    = Math.max(0, Math.min(1, -cameraY / 3000));
  const tTop = Math.min(1, t + 0.12); // 화면 위쪽은 조금 더 어둡게

  const grad = ctx.createLinearGradient(0, 0, 0, LOGICAL_H);
  grad.addColorStop(0, `rgb(${_skyChannel(0, tTop)},${_skyChannel(1, tTop)},${_skyChannel(2, tTop)})`);
  grad.addColorStop(1, `rgb(${_skyChannel(0, t)},${_skyChannel(1, t)},${_skyChannel(2, t)})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, LOGICAL_W, LOGICAL_H);

  // 구름 (높을수록 점점 사라짐)
  ctx.save();
  for (const c of _bgClouds) {
    ctx.globalAlpha = c.alpha * (1 - t * 0.7);
    _drawCloud(ctx, c.sx, c.sy, c.w, c.h);
  }
  ctx.restore();
}

// 타원 3개 겹쳐 픽셀아트 구름 모양 구현
function _drawCloud(ctx, x, y, w, h) {
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.ellipse(x + w * 0.50, y + h * 0.65, w * 0.44, h * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.27, y + h * 0.62, w * 0.26, h * 0.44, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(x + w * 0.73, y + h * 0.62, w * 0.22, h * 0.38, 0, 0, Math.PI * 2);
  ctx.fill();
}

// ── 파티클 ─────────────────────────────────────────────────
// 픽셀아트 느낌: 크기를 짝수(2/4/6px)로만 사용
const particles = [];
const _KILL_COLORS = ['#50a830', '#f0f040', '#c0ffc0', '#ffffff'];

function spawnKillParticles(worldX, worldY, comboCount) {
  const count = 6 + Math.min(comboCount * 2, 12);
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 80 + Math.random() * 130;
    particles.push({
      wx:    worldX,
      wy:    worldY,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed - 80, // 위쪽 편향
      life:  1.0,                          // 0→1 감소
      size:  2 + Math.floor(Math.random() * 3) * 2, // 2, 4, 6
      color: _KILL_COLORS[Math.floor(Math.random() * _KILL_COLORS.length)],
    });
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life -= dt * 2.2;  // ~0.45초에 소멸
    if (p.life <= 0) { particles.splice(i, 1); continue; }
    p.wx += p.vx * dt;
    p.wy += p.vy * dt;
    p.vy += 550 * dt; // 파티클에 중력 적용
  }
}

function drawParticles(ctx, cameraY) {
  ctx.save();
  for (const p of particles) {
    ctx.globalAlpha = p.life;
    ctx.fillStyle   = p.color;
    ctx.fillRect(
      Math.round(p.wx - p.size / 2),
      Math.round(p.wy - p.size / 2 - cameraY),
      p.size, p.size
    );
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ── 화면 흔들림 ────────────────────────────────────────────
// power: 최대 진폭(px),  duration: 지속 시간(초)
const _shake = { power: 0, timer: 0, x: 0, y: 0 };

function triggerShake(power, duration) {
  if (_shake.power >= power) return; // 더 강한 흔들림 중이면 무시
  _shake.power = power;
  _shake.timer = duration;
}

function updateShake(dt) {
  if (_shake.timer <= 0) { _shake.x = 0; _shake.y = 0; return; }
  _shake.timer -= dt;
  // 타이머가 줄수록 진폭 감소 (감쇠)
  const intensity = _shake.power * Math.max(0, _shake.timer / 0.2);
  _shake.x = (Math.random() - 0.5) * intensity * 2;
  _shake.y = (Math.random() - 0.5) * intensity * 2;
}

// drawGame에서 ctx.translate에 사용
function getShake() { return { x: _shake.x, y: _shake.y }; }

// ── 전체 리셋 ──────────────────────────────────────────────
function resetEffects() {
  particles.length = 0;
  _shake.power = 0; _shake.timer = 0; _shake.x = 0; _shake.y = 0;
  _bgCamY = 0;
}

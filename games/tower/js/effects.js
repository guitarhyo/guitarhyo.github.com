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

// ── 잔상 ───────────────────────────────────────────────────
// 이동/공중 상태일 때만 표시. 파란 반투명 사각형으로 단순하게 표현
const trail = [];
const TRAIL_LEN = 4;

function updateTrail(player) {
  const active = !player.onGround || Math.abs(player.vx) > 80;
  if (!active) { trail.length = 0; return; }

  trail.unshift({ wx: player.x, wy: player.y });
  if (trail.length > TRAIL_LEN) trail.pop();
}

function drawTrail(ctx, player, cameraY) {
  if (trail.length === 0) return;
  ctx.save();
  for (let i = 0; i < trail.length; i++) {
    const t = trail[i];
    // i=0 이 가장 최근 (가장 진함) → 뒤로 갈수록 옅어짐
    ctx.globalAlpha = 0.25 * (1 - i / trail.length);
    ctx.fillStyle   = '#6fa8ff';
    ctx.fillRect(Math.round(t.wx), Math.round(t.wy - cameraY), player.w, player.h);
  }
  ctx.restore();
}

// ── 전체 리셋 ──────────────────────────────────────────────
function resetEffects() {
  particles.length = 0;
  trail.length     = 0;
  _shake.power = 0; _shake.timer = 0; _shake.x = 0; _shake.y = 0;
}

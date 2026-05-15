// ── 존 기반 원터치 입력 ────────────────────────────────────
// 화면 왼쪽 절반 = 왼쪽 이동,  오른쪽 절반 = 오른쪽 이동
// 누르는 순간 방향 결정, 드래그로 전환 가능
// setPointerCapture → 손가락이 canvas 밖으로 나가도 pointerup 보장

const _pointers = new Map(); // pointerId → 'left' | 'right'

const input = {
  left:       false,
  right:      false,
  anyTapDown: false,
  lastTapX:   0,
  lastTapY:   0,
};

function _zone(e, canvas) {
  const r = canvas.getBoundingClientRect();
  const lx = (e.clientX - r.left) * (360 / r.width);
  return lx < 180 ? 'left' : 'right';
}

function _recompute() {
  const held  = [..._pointers.values()];
  input.left  = held.includes('left');
  input.right = held.includes('right');
}

function initInput(canvas) {
  canvas.addEventListener('pointerdown', e => {
    canvas.setPointerCapture(e.pointerId);
    input.anyTapDown = true;
    const r = canvas.getBoundingClientRect();
    input.lastTapX = (e.clientX - r.left) * (360 / r.width);
    input.lastTapY = (e.clientY - r.top)  * (640 / r.height);
    _pointers.set(e.pointerId, _zone(e, canvas));
    _recompute();
  });

  // 드래그로 좌↔우 전환 허용
  canvas.addEventListener('pointermove', e => {
    if (!_pointers.has(e.pointerId)) return;
    _pointers.set(e.pointerId, _zone(e, canvas));
    _recompute();
  });

  canvas.addEventListener('pointerup',     e => { _pointers.delete(e.pointerId); _recompute(); });
  canvas.addEventListener('pointercancel', e => { _pointers.delete(e.pointerId); _recompute(); });
}

// 누른 쪽 절반을 아주 연하게 표시 (버튼 없이 터치 피드백만)
function drawInputHUD(ctx) {
  if (!input.left && !input.right) return;
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle   = '#4f8cff';
  if (input.left)  ctx.fillRect(0,   0, 180, 640);
  if (input.right) ctx.fillRect(180, 0, 180, 640);
  ctx.restore();
}

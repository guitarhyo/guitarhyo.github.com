const SUPPORTED_LANGS = ['ko', 'en'];
const DEFAULT_LANG = 'ko';
const BEST_KEY = 'score:2048:best';

// ── 언어 설정 ────────────────────────────────────────────────
let t = {};

function detectLang() {
  const saved = localStorage.getItem('lang');
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  const browser = navigator.language.slice(0, 2);
  return SUPPORTED_LANGS.includes(browser) ? browser : DEFAULT_LANG;
}

async function applyLang(lang) {
  const res = await fetch(`./lang/${lang}.json`);
  t = await res.json();
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if (t[key] !== undefined) el.textContent = t[key];
  });
  document.documentElement.lang = lang;
  document.getElementById('lang-btn').textContent = lang === 'ko' ? 'EN' : 'KO';
  localStorage.setItem('lang', lang);
}

let currentLang = detectLang();

document.getElementById('lang-btn').addEventListener('click', () => {
  currentLang = currentLang === 'ko' ? 'en' : 'ko';
  applyLang(currentLang);
});

// ── 게임 상태 ────────────────────────────────────────────────
const SIZE = 4;
let grid, score, best, over, cleared;

function newGame() {
  grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  score = 0;
  over = false;
  cleared = false;
  best = parseInt(localStorage.getItem(BEST_KEY) || '0');
  spawnTile();
  spawnTile();
  hideOverlay();
  render();
}

function spawnTile() {
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (grid[r][c] === 0) empty.push([r, c]);
  if (!empty.length) return;
  const [r, c] = empty[Math.floor(Math.random() * empty.length)];
  grid[r][c] = Math.random() < 0.9 ? 2 : 4;
}

// ── 이동 로직 ────────────────────────────────────────────────
// 핵심 아이디어: "왼쪽 슬라이드" 하나만 구현하고,
// 나머지 방향은 행렬 변환(뒤집기·전치)으로 재활용한다.

function slideLeft(row) {
  // 0을 제거해 압축한 뒤, 인접한 같은 숫자를 합친다.
  // splice로 합친 타일을 제거하면 배열이 줄어들어
  // 루프가 자동으로 같은 타일을 두 번 합치는 것을 막는다.
  const nums = row.filter(x => x !== 0);
  for (let i = 0; i < nums.length - 1; i++) {
    if (nums[i] === nums[i + 1]) {
      nums[i] *= 2;
      score += nums[i];
      nums.splice(i + 1, 1);
    }
  }
  while (nums.length < SIZE) nums.push(0);
  return nums;
}

// 행렬 전치: 행과 열을 바꾼다 (up/down 이동에 재활용)
function transpose(g) {
  return g[0].map((_, col) => g.map(row => row[col]));
}

function move(dir) {
  if (over) return;
  const snapshot = JSON.stringify(grid);

  if (dir === 'left') {
    grid = grid.map(row => slideLeft(row));
  } else if (dir === 'right') {
    grid = grid.map(row => slideLeft([...row].reverse()).reverse());
  } else if (dir === 'up') {
    // 전치 → 왼쪽 슬라이드 → 전치 복원
    grid = transpose(transpose(grid).map(row => slideLeft(row)));
  } else if (dir === 'down') {
    // 전치 → 오른쪽 슬라이드 → 전치 복원
    grid = transpose(transpose(grid).map(row => slideLeft([...row].reverse()).reverse()));
  }

  if (JSON.stringify(grid) !== snapshot) {
    spawnTile();
    saveBest();
    render();
    checkEnd();
  }
}

// ── 종료 판정 ────────────────────────────────────────────────
function canMove() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === 0) return true;
      if (c < SIZE - 1 && grid[r][c] === grid[r][c + 1]) return true;
      if (r < SIZE - 1 && grid[r][c] === grid[r + 1][c]) return true;
    }
  }
  return false;
}

function checkEnd() {
  if (!cleared && grid.flat().includes(2048)) {
    cleared = true;
    showOverlay(t.win_msg, true);
  } else if (!canMove()) {
    over = true;
    showOverlay(t.gameover_msg, false);
  }
}

// ── 렌더링 ───────────────────────────────────────────────────
function render() {
  document.getElementById('score').textContent = score;
  document.getElementById('best').textContent = best;

  const board = document.getElementById('board');
  board.innerHTML = '';

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const cell = document.createElement('div');
      cell.className = 'cell';

      const val = grid[r][c];
      if (val !== 0) {
        const tile = document.createElement('div');
        tile.className = 'tile';
        tile.dataset.v = val;
        tile.textContent = val;
        cell.appendChild(tile);
      }

      board.appendChild(cell);
    }
  }
}

function saveBest() {
  if (score > best) {
    best = score;
    localStorage.setItem(BEST_KEY, best);
  }
}

function showOverlay(msg, isWin) {
  document.getElementById('overlay-msg').textContent = msg;
  const btn = document.getElementById('btn-overlay');
  btn.textContent = isWin ? t.btn_continue : t.btn_restart;
  btn.dataset.action = isWin ? 'continue' : 'restart';
  document.getElementById('overlay').classList.add('show');
}

function hideOverlay() {
  document.getElementById('overlay').classList.remove('show');
}

// ── 입력 처리 ────────────────────────────────────────────────
const KEY_MAP = {
  ArrowLeft: 'left', ArrowRight: 'right',
  ArrowUp: 'up', ArrowDown: 'down',
};

document.addEventListener('keydown', e => {
  const dir = KEY_MAP[e.key];
  if (dir) {
    e.preventDefault(); // 방향키로 페이지가 스크롤되는 것을 막기
    move(dir);
  }
});

// Pointer Events로 마우스·터치 스와이프 통합 처리
let pointerStart = null;
const boardEl = document.getElementById('board');

boardEl.addEventListener('pointerdown', e => {
  pointerStart = { x: e.clientX, y: e.clientY };
  boardEl.setPointerCapture(e.pointerId);
});

boardEl.addEventListener('pointerup', e => {
  if (!pointerStart) return;
  const dx = e.clientX - pointerStart.x;
  const dy = e.clientY - pointerStart.y;
  pointerStart = null;
  if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return; // 너무 짧은 스와이프 무시
  Math.abs(dx) > Math.abs(dy) ? move(dx > 0 ? 'right' : 'left') : move(dy > 0 ? 'down' : 'up');
});

document.getElementById('btn-new').addEventListener('click', newGame);
document.getElementById('btn-overlay').addEventListener('click', () => {
  document.getElementById('btn-overlay').dataset.action === 'continue' ? hideOverlay() : newGame();
});

// 언어 로드 완료 후 게임 시작
applyLang(currentLang).then(() => newGame());

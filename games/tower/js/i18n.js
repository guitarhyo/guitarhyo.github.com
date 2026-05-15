// ── 다국어(i18n) ───────────────────────────────────────────
// 학습 포인트: fetch() 대신 <script> 태그로 lang/ko.js, lang/en.js 를 미리 로드.
// file:// 프로토콜(로컬 직접 열기)에서도 CORS 없이 동작.

const _langs = {};
let _current = 'ko';

// 키 없으면 키 자체를 반환 (누락된 번역 표시용)
function t(key) {
  return _langs[_current]?.[key] ?? key;
}

function setLang(lang) {
  _current = lang;
  localStorage.setItem('lang', lang);
}

function getLang() { return _current; }

// 동기 초기화 — ko.js / en.js 가 이미 <script>로 로드됨
// game.js 의 loadI18n().then(...) API를 유지하기 위해 Promise.resolve() 반환
function loadI18n() {
  _langs.ko = _LANG_KO;
  _langs.en = _LANG_EN;

  const saved   = localStorage.getItem('lang');
  const browser = navigator.language.startsWith('ko') ? 'ko' : 'en';
  _current = saved ?? browser;

  return Promise.resolve();
}

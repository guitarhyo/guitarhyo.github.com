// 학습 포인트: fetch() 대신 <script> 태그로 lang/ko.js, lang/en.js 를 미리 로드.
// file:// 프로토콜(로컬 직접 열기)에서도 CORS 없이 동작.
const SUPPORTED_LANGS = ['ko', 'en'];
const DEFAULT_LANG = 'ko';
const LANGS = { ko: _LANG_KO, en: _LANG_EN };

function detectLang() {
  const saved = localStorage.getItem('lang');
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  const browser = navigator.language.slice(0, 2);
  return SUPPORTED_LANGS.includes(browser) ? browser : DEFAULT_LANG;
}

function applyLang(lang) {
  const t = LANGS[lang] ?? LANGS[DEFAULT_LANG];
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

applyLang(currentLang);
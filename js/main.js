const SUPPORTED_LANGS = ['ko', 'en'];
const DEFAULT_LANG = 'ko';

function detectLang() {
  const saved = localStorage.getItem('lang');
  if (saved && SUPPORTED_LANGS.includes(saved)) return saved;
  const browser = navigator.language.slice(0, 2);
  return SUPPORTED_LANGS.includes(browser) ? browser : DEFAULT_LANG;
}

async function applyLang(lang) {
  const res = await fetch(`./lang/${lang}.json`);
  const t = await res.json();
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

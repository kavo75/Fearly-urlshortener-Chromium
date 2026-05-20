const SUPPORTED_LANGS = [
  { code: 'en', label: 'English' },
  { code: 'nl', label: 'Nederlands' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
  { code: 'pl', label: 'Polski' },
  { code: 'pt', label: 'Português' },
  { code: 'cs', label: 'Čeština' },
  { code: 'sk', label: 'Slovenčina' },
  { code: 'hu', label: 'Magyar' },
  { code: 'hr', label: 'Hrvatski' },
];

let _messages = null;

async function initI18n() {
  const { language } = await chrome.storage.local.get('language');
  const code = SUPPORTED_LANGS.find(l => l.code === language)?.code;
  if (!code) return; // fall back to chrome.i18n (browser language)

  try {
    const url = chrome.runtime.getURL(`_locales/${code}/messages.json`);
    const res = await fetch(url);
    _messages = await res.json();
  } catch (_) {
    _messages = null;
  }
}

function t(key) {
  if (_messages?.[key]?.message) return _messages[key].message;
  const native = chrome.i18n.getMessage(key);
  return native || key;
}

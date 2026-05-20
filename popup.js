const API_BASE = 'https://www.fearly.eu/api/v1';

async function init() {
  await initI18n();
  applyI18n();

  const storage = await chrome.storage.local.get(['api_key', 'account_number', 'account_type', 'tier_name']);

  if (!storage.api_key || !storage.account_number) {
    showNotSetup();
    return;
  }

  showShortener();

  const badge = document.getElementById('account-badge');
  badge.textContent = storage.tier_name || storage.account_type || '';

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const url = tab?.url || '';
  const urlEl = document.getElementById('current-url');

  if (!isHttpUrl(url)) {
    urlEl.textContent = url || '—';
    urlEl.classList.add('invalid');
    document.getElementById('btn-shorten').disabled = true;
    showInfo(t('popup_error_empty'));
  } else {
    urlEl.textContent = url;
  }
}

function applyI18n() {
  document.getElementById('btn-shorten').textContent     = t('popup_shorten');
  document.getElementById('btn-copy').textContent        = t('popup_copy');
  document.getElementById('btn-open').textContent        = t('popup_open');
  document.getElementById('btn-settings').title          = t('popup_settings');
  document.getElementById('txt-not-setup').textContent   = t('popup_not_setup');
  document.getElementById('btn-has-account').textContent = t('wizard_btn_yes');
  document.getElementById('btn-no-account').textContent  = t('wizard_btn_no');
}

function showNotSetup() {
  document.getElementById('not-setup').style.display    = 'block';
  document.getElementById('shortener-ui').style.display = 'none';
}

function showShortener() {
  document.getElementById('not-setup').style.display    = 'none';
  document.getElementById('shortener-ui').style.display = 'block';
}

function isHttpUrl(url) {
  return url && (url.startsWith('http://') || url.startsWith('https://'));
}

// ── Shorten ───────────────────────────────────────────────────────────────

document.getElementById('btn-shorten').addEventListener('click', async () => {
  console.log('[fearly] shorten button clicked');
  const urlEl  = document.getElementById('current-url');
  const btnEl  = document.getElementById('btn-shorten');
  const resBox = document.getElementById('result-box');

  clearMessages();
  resBox.classList.remove('visible');

  const url = urlEl.textContent.trim();
  if (!isHttpUrl(url)) {
    showError(t('popup_error_empty'));
    return;
  }

  btnEl.disabled = true;
  btnEl.textContent = t('popup_shortening');

  try {
    const { api_key } = await chrome.storage.local.get('api_key');
    const res = await fetch(`${API_BASE}/shorten`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${api_key}`,
      },
      body: JSON.stringify({ long_url: url }),
    });

    const data = await res.json();

    if (!res.ok) {
      showError(mapError(res.status, data));
      return;
    }

    document.getElementById('short-url').textContent = data.short_url;
    resBox.classList.add('visible');
  } catch (err) {
    console.error('[fearly] shorten error:', err);
    showError(t('error_network'));
  } finally {
    btnEl.disabled = false;
    btnEl.textContent = t('popup_shorten');
  }
});

// ── Copy & Open ───────────────────────────────────────────────────────────

document.getElementById('btn-copy').addEventListener('click', async () => {
  const shortUrl = document.getElementById('short-url').textContent;
  await navigator.clipboard.writeText(shortUrl);
  const btn = document.getElementById('btn-copy');
  btn.textContent = t('popup_copied');
  setTimeout(() => { btn.textContent = t('popup_copy'); }, 1500);
});

document.getElementById('btn-open').addEventListener('click', () => {
  chrome.tabs.create({ url: document.getElementById('short-url').textContent });
});

// ── Settings ──────────────────────────────────────────────────────────────

document.getElementById('btn-settings').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Not-setup buttons
document.getElementById('btn-has-account').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

document.getElementById('btn-no-account').addEventListener('click', async () => {
  const btn = document.getElementById('btn-no-account');
  btn.disabled = true;

  try {
    const res  = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: 'Chrome Extension' }),
    });
    const data = await res.json();

    if (!res.ok || !data.account_number || !data.api_key?.key) {
      chrome.runtime.openOptionsPage();
      return;
    }

    await chrome.storage.local.set({
      account_number: data.account_number,
      api_key:        data.api_key.key,
      key_prefix:     data.api_key.key_prefix || data.api_key.key.slice(0, 12),
      account_type:   data.account_type || 'registered_anonymous',
      tier_name:      data.tier_name || '',
      setup_complete: true,
    });

    // Reload popup to show the shortener UI
    location.reload();
  } catch (_) {
    chrome.runtime.openOptionsPage();
  }
});

// ── Helpers ───────────────────────────────────────────────────────────────

function clearMessages() {
  document.getElementById('error-msg').classList.remove('visible');
  document.getElementById('info-msg').classList.remove('visible');
}
function showError(msg) {
  const el = document.getElementById('error-msg');
  el.textContent = msg;
  el.classList.add('visible');
}
function showInfo(msg) {
  const el = document.getElementById('info-msg');
  el.textContent = msg;
  el.classList.add('visible');
}
function mapError(status, data) {
  if (status === 401) return t('error_invalid_key');
  if (status === 429) return t('error_rate_limit');
  return data?.message || t('popup_error_failed');
}

init();

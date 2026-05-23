const API_BASE = 'https://www.fearly.eu/api/v1';

// ── Main tab switching ─────────────────────────────────────────────────────

document.querySelectorAll('.main-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.main-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.main-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.panel)?.classList.add('active');
    if (tab.dataset.panel === 'panel-history') loadHistory();
  });
});

const state = {
  accountNumber: null,
  apiKey:        null,
  accountType:   null,
};

// ── Bootstrap ─────────────────────────────────────────────────────────────

async function init() {
  await initI18n();
  buildLangSelector();
  applyStaticI18n();

  const storage = await chrome.storage.local.get(['api_key', 'account_number', 'account_type', 'tier_name', 'pending_step']);

  if (storage.api_key && storage.account_number) {
    showAccountView(storage);
  } else if (storage.pending_step === 'signin') {
    await chrome.storage.local.remove('pending_step');
    showStep('step-2');
  } else {
    showStep('step-1');
  }
}

// ── Language selector ─────────────────────────────────────────────────────

function buildLangSelector() {
  const sel = document.getElementById('lang-select');
  SUPPORTED_LANGS.forEach(({ code, label }) => {
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = label;
    sel.appendChild(opt);
  });

  chrome.storage.local.get('language', ({ language }) => {
    if (language) sel.value = language;
  });

  sel.addEventListener('change', async () => {
    await chrome.storage.local.set({ language: sel.value });
    location.reload();
  });
}

// ── i18n helpers ──────────────────────────────────────────────────────────

function applyStaticI18n() {
  setText('s1-title',    'wizard_step1_title');
  setText('s1-subtitle', 'wizard_step1_subtitle');
  setText('btn-has-account', 'wizard_btn_yes');
  setText('btn-no-account',  'wizard_btn_no');

  setText('s2-title',      'wizard_step2_title');
  setText('tab-code-btn',  'wizard_tab_code');
  setText('tab-email-btn', 'wizard_tab_email');
  setPlaceholder('input-code',  'wizard_code_placeholder');
  setPlaceholder('input-email', 'wizard_email_placeholder');
  setPlaceholder('input-pass',  'wizard_pass_placeholder');
  setText('lbl-code',  'wizard_tab_code');
  setText('lbl-email', 'wizard_email_placeholder');
  setText('lbl-pass',  'wizard_pass_placeholder');
  setText('btn-signin', 'wizard_btn_signin');

  setText('s3-title',       'wizard_step3_title');
  setText('s3-subtitle',    'wizard_step3_subtitle');
  setText('btn-have-key',   'wizard_btn_have_key');
  setText('btn-create-key', 'wizard_btn_create_key');

  setText('s4a-title',    'wizard_step4a_title');
  setText('btn-save-key', 'wizard_btn_save_key');

  setText('sdone-title',    'wizard_done_title');
  setText('sdone-subtitle', 'wizard_done_subtitle');
  setText('btn-start',      'wizard_btn_start');

  setText('lbl-save-number', 'wizard_save_number');
  setText('lbl-save-key',    'wizard_save_key');

  setText('tab-main-account',    'settings_account');
  setText('tab-main-history',    'tab_history');
  setText('tab-main-settings',   'popup_settings');

  setText('s-account-title',    'settings_account');
  setText('lbl-acc-type',       'settings_account_type');
  setText('lbl-acc-number',     'settings_account_number');
  setText('lbl-acc-key',        'settings_api_key');
  setText('btn-toggle-key',     'settings_api_key_show');
  setText('btn-copy-acc-key',   'settings_api_key_copy');
  setText('btn-open-dashboard',     'settings_dashboard');
  setText('btn-history-dashboard',  'settings_dashboard');
  setText('btn-disconnect',     'settings_logout');

  setText('modal-disc-title',  'settings_logout');
  setText('modal-disc-body',   'settings_logout_warning');
  setText('lbl-modal-number',  'settings_account_number');
  setText('btn-modal-cancel',  'settings_logout_cancel');
  setText('btn-modal-confirm', 'settings_logout');

  setText('settings-placeholder', 'settings_no_options');

  setLinkText('footer-privacy', 'footer_privacy');
  setLinkText('footer-terms',   'footer_terms');
  setLinkText('footer-bug',     'footer_bug');
  setLinkText('footer-review',  'footer_review');
}

function setText(id, key) {
  const el = document.getElementById(id);
  if (el) el.textContent = t(key);
}
function setPlaceholder(id, key) {
  const el = document.getElementById(id);
  if (el) el.placeholder = t(key);
}
// Inserts translated text before the SVG icon inside a footer link
function setLinkText(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  const svg = el.querySelector('svg');
  el.firstChild?.nodeType === Node.TEXT_NODE && el.firstChild.remove();
  el.insertBefore(document.createTextNode(t(key)), svg);
}

// ── Step navigation ───────────────────────────────────────────────────────

function showStep(id) {
  document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
}

// ── Step 1 ────────────────────────────────────────────────────────────────

document.getElementById('btn-has-account').addEventListener('click', () => showStep('step-2'));

document.getElementById('btn-no-account').addEventListener('click', async () => {
  showStep('step-loading');
  document.getElementById('loading-label').textContent = t('wizard_step_new_title');
  await autoRegister();
});

// ── Step 2: sign in ───────────────────────────────────────────────────────

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(tab.dataset.tab)?.classList.add('active');
  });
});

document.getElementById('btn-back-1').addEventListener('click', () => showStep('step-1'));

document.getElementById('btn-signin').addEventListener('click', async () => {
  const btn   = document.getElementById('btn-signin');
  const errEl = document.getElementById('s2-error');
  errEl.textContent = '';

  const activeTab = document.querySelector('.tab.active')?.dataset?.tab;
  let body = {};

  if (activeTab === 'tab-code') {
    const code = document.getElementById('input-code').value.trim();
    if (!code) { errEl.textContent = t('error_invalid_creds'); return; }
    body = { account_number: code, label: t('label_extension') };
  } else {
    const email = document.getElementById('input-email').value.trim();
    const pass  = document.getElementById('input-pass').value;
    if (!email || !pass) { errEl.textContent = t('error_invalid_creds'); return; }
    body = { email, password: pass, label: t('label_extension') };
  }

  btn.disabled = true;
  btn.textContent = t('wizard_signing_in');

  try {
    const res  = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();

    if (!res.ok) {
      console.error('[fearly] login failed:', res.status, data);
      errEl.textContent = res.status === 401 ? t('error_invalid_creds') : t('error_generic');
      return;
    }

    state.accountNumber = data.account_number;
    state.accountType   = data.account_type;
    state.apiKey        = data.api_key?.key;

    if (state.apiKey) {
      await saveCredentials(state.accountNumber, state.apiKey, data.account_type, data.api_key.key_prefix, data.tier_name);
      showDoneScreen(false, state.accountNumber, state.apiKey);
    } else {
      showStep('step-3');
    }
  } catch (_) {
    errEl.textContent = t('error_network');
  } finally {
    btn.disabled = false;
    btn.textContent = t('wizard_btn_signin');
  }
});

// ── Step 3: have API key? ─────────────────────────────────────────────────

document.getElementById('btn-have-key').addEventListener('click', () => showStep('step-4a'));

document.getElementById('btn-create-key').addEventListener('click', async () => {
  if (state.apiKey) {
    await saveCredentials(state.accountNumber, state.apiKey, state.accountType, state.apiKey.slice(0, 12));
    showDoneScreen(false, state.accountNumber, state.apiKey);
  } else {
    showStep('step-1');
  }
});

// ── Step 4a: enter key ────────────────────────────────────────────────────

document.getElementById('btn-back-3').addEventListener('click', () => showStep('step-3'));

document.getElementById('btn-save-key').addEventListener('click', async () => {
  const btn   = document.getElementById('btn-save-key');
  const errEl = document.getElementById('s4a-error');
  const key   = document.getElementById('input-apikey').value.trim();
  errEl.textContent = '';

  if (!key.startsWith('fearly_') || key.length < 20) {
    errEl.textContent = t('error_invalid_key');
    return;
  }

  btn.disabled = true;

  try {
    const res = await fetch(`${API_BASE}/keys`, {
      headers: { 'Authorization': `Bearer ${key}` },
    });
    if (!res.ok) { errEl.textContent = t('error_invalid_key'); return; }

    await saveCredentials(state.accountNumber, key, state.accountType, key.slice(0, 12));
    showDoneScreen(false, state.accountNumber, key);
  } catch (_) {
    errEl.textContent = t('error_network');
  } finally {
    btn.disabled = false;
  }
});

// ── Auto-register ─────────────────────────────────────────────────────────

async function autoRegister() {
  try {
    const res  = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: t('label_extension') }),
    });
    const data = await res.json();

    if (!res.ok || !data.account_number || !data.api_key?.key) {
      showStep('step-1');
      return;
    }

    await saveCredentials(data.account_number, data.api_key.key, data.account_type, data.api_key.key_prefix, data.tier_name);
    showDoneScreen(true, data.account_number, data.api_key.key);
  } catch (_) {
    showStep('step-1');
  }
}

// ── Done screen ───────────────────────────────────────────────────────────

function showDoneScreen(isNew, accountNumber, apiKey) {
  document.getElementById('sdone-subtitle').textContent = isNew
    ? t('wizard_new_done_subtitle')
    : t('wizard_done_subtitle');

  if (isNew) {
    document.getElementById('done-save-number').style.display = 'block';
    document.getElementById('val-save-number').textContent = accountNumber;
  } else {
    document.getElementById('done-save-number').style.display = 'none';
  }

  document.getElementById('done-save-key').style.display = 'block';
  document.getElementById('val-save-key').textContent = apiKey;

  showStep('step-done');
}

document.getElementById('btn-copy-number').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('val-save-number').textContent);
  flashCopy('btn-copy-number');
});
document.getElementById('btn-copy-key').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('val-save-key').textContent);
  flashCopy('btn-copy-key');
});
document.getElementById('btn-start').addEventListener('click', () => {
  location.reload();
});

// ── Account view ──────────────────────────────────────────────────────────

function showAccountView(storage) {
  showStep('step-account');

  document.getElementById('val-acc-type').textContent   = storage.tier_name || storage.account_type || '—';
  document.getElementById('val-acc-number').textContent = storage.account_number || '—';

  const keyEl = document.getElementById('val-acc-key');
  keyEl.dataset.full   = storage.api_key || '';
  keyEl.dataset.masked = maskKey(storage.api_key || '');
  keyEl.textContent    = keyEl.dataset.masked;
}

let keyVisible = false;
document.getElementById('btn-toggle-key').addEventListener('click', () => {
  const keyEl = document.getElementById('val-acc-key');
  keyVisible = !keyVisible;
  keyEl.textContent = keyVisible ? keyEl.dataset.full : keyEl.dataset.masked;
  document.getElementById('btn-toggle-key').textContent =
    t(keyVisible ? 'settings_api_key_hide' : 'settings_api_key_show');
});

document.getElementById('btn-copy-acc-key').addEventListener('click', async () => {
  await navigator.clipboard.writeText(document.getElementById('val-acc-key').dataset.full);
  const btn = document.getElementById('btn-copy-acc-key');
  btn.textContent = t('settings_api_key_copied');
  setTimeout(() => { btn.textContent = t('settings_api_key_copy'); }, 1500);
});

async function openDashboard() {
  const { api_key } = await chrome.storage.local.get('api_key');
  if (!api_key) {
    chrome.tabs.create({ url: 'https://www.fearly.eu/pages/authenticated/dashboard.html' });
    return;
  }
  try {
    const res = await fetch(`${API_BASE}/auth/exchange`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${api_key}` },
    });
    const data = await res.json();
    if (res.ok && data.token) {
      chrome.tabs.create({ url: `https://www.fearly.eu/ext-login.html?t=${data.token}` });
      return;
    }
  } catch (_) {}
  chrome.tabs.create({ url: 'https://www.fearly.eu/' });
}

document.getElementById('btn-open-dashboard').addEventListener('click', openDashboard);
document.getElementById('btn-history-dashboard').addEventListener('click', openDashboard);

document.getElementById('btn-disconnect').addEventListener('click', async () => {
  const { account_number } = await chrome.storage.local.get('account_number');
  document.getElementById('val-modal-number').textContent = account_number || '—';
  document.getElementById('modal-disconnect').style.display = 'flex';
});

document.getElementById('btn-modal-cancel').addEventListener('click', () => {
  document.getElementById('modal-disconnect').style.display = 'none';
});

document.getElementById('btn-modal-copy-number').addEventListener('click', () => {
  navigator.clipboard.writeText(document.getElementById('val-modal-number').textContent);
  flashCopy('btn-modal-copy-number');
});

document.getElementById('btn-modal-confirm').addEventListener('click', async () => {
  await chrome.storage.local.remove(['api_key', 'account_number', 'account_type', 'key_prefix', 'tier_name', 'setup_complete']);
  document.getElementById('modal-disconnect').style.display = 'none';
  showStep('step-1');
});

// ── Helpers ───────────────────────────────────────────────────────────────

async function saveCredentials(accountNumber, apiKey, accountType, keyPrefix, tierName) {
  await chrome.storage.local.set({
    account_number: accountNumber,
    api_key:        apiKey,
    key_prefix:     keyPrefix || apiKey.slice(0, 12),
    account_type:   accountType || 'registered_anonymous',
    tier_name:      tierName || '',
    setup_complete: true,
  });
}

function maskKey(key) {
  if (key.length <= 12) return key;
  return key.slice(0, 12) + '••••••••••••';
}

function flashCopy(btnId) {
  const btn = document.getElementById(btnId);
  const orig = btn.textContent;
  btn.textContent = '✓ Copied';
  setTimeout(() => { btn.textContent = orig; }, 1500);
}

// ── History ───────────────────────────────────────────────────────────────

let historyLoaded = false;

async function loadHistory() {
  if (historyLoaded) return;

  const container = document.getElementById('history-content');
  container.innerHTML = `<div class="spinner"></div>`;

  const { api_key } = await chrome.storage.local.get('api_key');
  if (!api_key) {
    container.innerHTML = `<p class="history-empty">${t('history_empty')}</p>`;
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/urls?limit=5`, {
      headers: { 'Authorization': `Bearer ${api_key}` },
    });

    if (!res.ok) {
      container.innerHTML = `<p class="history-empty">${t('history_error')}</p>`;
      return;
    }

    const data = await res.json();
    const urls = data.urls || [];

    if (!urls.length) {
      container.innerHTML = `<p class="history-empty">${t('history_empty')}</p>`;
      return;
    }

    const rows = urls.map(u => {
      const date = u.created_at ? u.created_at.slice(0, 10) : '—';
      const longUrl = u.long_url.length > 60 ? u.long_url.slice(0, 57) + '…' : u.long_url;
      return `<tr>
        <td class="col-date">${date}</td>
        <td class="col-code">${escHtml(u.short_code)}</td>
        <td class="col-url"  title="${escHtml(u.long_url)}">${escHtml(longUrl)}</td>
        <td class="col-clicks">${u.click_count ?? 0}</td>
      </tr>`;
    }).join('');

    container.innerHTML = `
      <table class="history-table">
        <thead>
          <tr>
            <th>${t('history_date')}</th>
            <th>${t('history_short_code')}</th>
            <th>${t('history_long_url')}</th>
            <th style="text-align:right">${t('history_clicks')}</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>`;

    historyLoaded = true;
  } catch (_) {
    container.innerHTML = `<p class="history-empty">${t('history_error')}</p>`;
  }
}

function escHtml(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

init();

const root = document.getElementById('app');

if (!root) {
  throw new Error('Missing app root container.');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(value) {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return String(value);
  return parsed.toLocaleString();
}

function formatNumber(value) {
  return Number(value ?? 0).toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value ?? 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let current = bytes;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const decimals = current >= 100 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(decimals)} ${units[unitIndex]}`;
}

function formatPercent(value, digits = 2) {
  const percent = Number(value ?? 0);
  if (!Number.isFinite(percent)) return '0%';
  const fixed = Number(percent.toFixed(digits));
  return `${fixed}%`;
}

function formatDurationSeconds(value) {
  const total = Math.max(0, Math.round(Number(value ?? 0)));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${seconds}s`;
}

function clampPercent(value) {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

async function buildUploadPayloadFromFile(file) {
  const arrayBuffer = await file.arrayBuffer();
  return {
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    base64Data: arrayBufferToBase64(arrayBuffer),
    sizeBytes: file.size,
  };
}

const THEME_STORAGE_KEY = 'ytmp-workspace-theme';

function readStoredTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return value === 'dark' || value === 'light' ? value : null;
  } catch {
    return null;
  }
}

function getSystemTheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function statusTone(status) {
  const normalized = String(status ?? '').toLowerCase();
  if (['completed', 'publicado', 'connected'].includes(normalized)) return 'success';
  if (['failed', 'erro', 'reauth_required'].includes(normalized)) return 'danger';
  if (['launching', 'enviando', 'ready', 'processing'].includes(normalized)) return 'warning';
  return 'neutral';
}

function statusPill(status) {
  const tone = statusTone(status);
  return `<span class="pill ${tone}">${escapeHtml(status)}</span>`;
}

function buildUrl(path, query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }
  const search = params.toString();
  return search ? `${path}?${search}` : path;
}

async function apiRequest(method, url, body) {
  const init = {
    method,
    credentials: 'include',
    headers: {},
  };

  if (body !== undefined) {
    init.headers['content-type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  const response = await fetch(url, init);
  let payload = null;
  const contentType = response.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    payload = await response.json();
  } else {
    payload = await response.text();
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: payload?.error ?? `Request failed with ${response.status}`,
      body: payload,
    };
  }

  return {
    ok: true,
    status: response.status,
    body: payload,
  };
}

const api = {
  me: () => apiRequest('GET', '/auth/me'),
  login: (credentials) => apiRequest('POST', '/auth/login', credentials),
  logout: () => apiRequest('POST', '/auth/logout'),
  dashboard: () => apiRequest('GET', '/api/dashboard'),
  campaigns: (filters = {}) => apiRequest('GET', buildUrl('/api/campaigns', filters)),
  campaignById: (id) => apiRequest('GET', `/api/campaigns/${encodeURIComponent(id)}`),
  campaignStatus: (id) => apiRequest('GET', `/api/campaigns/${encodeURIComponent(id)}/status`),
  campaignJobs: (id) => apiRequest('GET', `/api/campaigns/${encodeURIComponent(id)}/jobs`),
  campaignAudit: (id) => apiRequest('GET', `/api/campaigns/${encodeURIComponent(id)}/audit`),
  createCampaign: (data) => apiRequest('POST', '/api/campaigns', data),
  updateCampaign: (id, data) => apiRequest('PATCH', `/api/campaigns/${encodeURIComponent(id)}`, data),
  addTarget: (id, data) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/targets`, data),
  updateTarget: (campaignId, targetId, data) => apiRequest('PATCH', `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetId)}`, data),
  removeTarget: (campaignId, targetId) => apiRequest('DELETE', `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetId)}`),
  addTargetsBulk: (id, targets) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/targets/bulk`, { targets }),
  markReady: (id) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/ready`),
  launch: (id) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/launch`),
  clone: (id, title) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/clone`, title ? { title } : undefined),
  deleteCampaign: (id) => apiRequest('DELETE', `/api/campaigns/${encodeURIComponent(id)}`),
  retryTarget: (campaignId, targetId) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetId)}/retry`),
  accounts: () => apiRequest('GET', '/api/accounts'),
  startGoogleOauth: () => apiRequest('GET', '/api/accounts/oauth/google/start'),
  accountOauthCallback: (code, stateParam) => apiRequest('GET', buildUrl('/api/accounts/oauth/google/callback', { code, state: stateParam })),
  accountChannels: (accountId) => apiRequest('GET', `/api/accounts/${encodeURIComponent(accountId)}/channels`),
  toggleChannel: (accountId, channelId, isActive) => apiRequest('PATCH', `/api/accounts/${encodeURIComponent(accountId)}/channels/${encodeURIComponent(channelId)}`, { isActive }),
  disconnectAccount: (accountId) => apiRequest('DELETE', `/api/accounts/${encodeURIComponent(accountId)}`, { confirm: 'DISCONNECT' }),
  media: () => apiRequest('GET', '/api/media'),
  uploadMedia: (payload) => apiRequest('POST', '/api/media', payload),
  deleteMedia: (id) => apiRequest('DELETE', `/api/media/${encodeURIComponent(id)}`),
};

const state = {
  me: null,
  routeInFlight: false,
  rerenderQueued: false,
  theme: readStoredTheme() ?? getSystemTheme(),
  autoRefreshTimer: null,
};

function applyTheme(theme) {
  const nextTheme = theme === 'dark' ? 'dark' : 'light';
  state.theme = nextTheme;
  document.body.setAttribute('data-theme', nextTheme);
  document.body.style.colorScheme = nextTheme;
  try {
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
  } catch {
    // noop: storage can be unavailable in hardened browser contexts
  }
}

function toggleTheme() {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
}

function clearAutoRefreshTimer() {
  if (state.autoRefreshTimer) {
    clearTimeout(state.autoRefreshTimer);
    state.autoRefreshTimer = null;
  }
}

function activeTab(pathname) {
  if (pathname.startsWith('/workspace/accounts')) return 'accounts';
  if (pathname.startsWith('/workspace/media')) return 'media';
  if (pathname.startsWith('/workspace/campanhas')) return 'campanhas';
  return 'dashboard';
}

function renderWorkspaceShell(options) {
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', href: '/workspace/dashboard' },
    { id: 'campanhas', label: 'Campanhas', href: '/workspace/campanhas' },
    { id: 'accounts', label: 'Accounts', href: '/workspace/accounts' },
    { id: 'media', label: 'Media', href: '/workspace/media' },
  ];
  const currentTab = activeTab(window.location.pathname);
  const navHtml = tabs.map((tab) => (
    `<a class="nav-link ${tab.id === currentTab ? 'active' : ''}" data-link href="${tab.href}">${tab.label}</a>`
  )).join('');

  root.innerHTML = `
    <div class="page">
      <header class="header">
        <div class="container header-shell">
          <div class="brand">
            YT Multi Publi
            <small>Admin Workspace</small>
          </div>
          <nav class="nav">${navHtml}</nav>
          <div class="nav">
            <button id="theme-toggle-btn" class="theme-toggle-btn" type="button">
              ${state.theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
            <span class="user-email">${escapeHtml(state.me?.email ?? '')}</span>
            <button id="logout-btn" class="logout-btn" type="button">Logout</button>
          </div>
        </div>
      </header>
      <main class="container stack">
        <section class="title-row">
          <div>
            <h1 class="route-title">${escapeHtml(options.title)}</h1>
            ${options.subtitle ? `<p class="muted">${escapeHtml(options.subtitle)}</p>` : ''}
          </div>
          ${options.actionsHtml ?? ''}
        </section>
        ${options.noticeHtml ?? ''}
        ${options.contentHtml}
      </main>
    </div>
  `;

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await api.logout();
      state.me = null;
      navigate('/login', true);
    });
  }

  const themeToggleBtn = document.getElementById('theme-toggle-btn');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', () => {
      toggleTheme();
      void renderRoute();
    });
  }
}

function renderLoginPage(options = {}) {
  root.innerHTML = `
    <div class="login-wrap">
      <div class="login-toolbar">
        <button id="login-theme-toggle-btn" class="theme-toggle-btn" type="button">
          ${state.theme === 'dark' ? 'Light mode' : 'Dark mode'}
        </button>
      </div>
      <section class="login-card stack">
        <div>
          <h1>Admin sign in</h1>
          <p class="muted">Use the seeded admin credential to access the internal publishing workspace.</p>
        </div>
        ${options.error ? `<div class="notice error">${escapeHtml(options.error)}</div>` : ''}
        <form id="login-form" class="form-grid">
          <label>
            Email
            <input name="email" type="email" required autocomplete="username" />
          </label>
          <label>
            Password
            <input name="password" type="password" required autocomplete="current-password" />
          </label>
          <button class="btn-primary" type="submit">Sign in</button>
        </form>
        <p class="footnote">Default example from .env.example: admin@example.com / admin123</p>
      </section>
    </div>
  `;

  const form = document.getElementById('login-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const credentials = {
      email: String(data.get('email') ?? ''),
      password: String(data.get('password') ?? ''),
    };
    const result = await api.login(credentials);
    if (!result.ok) {
      renderLoginPage({ error: result.error });
      return;
    }
    state.me = result.body?.user ?? null;
    navigate('/workspace/dashboard', true);
  });

  const loginThemeToggleBtn = document.getElementById('login-theme-toggle-btn');
  if (loginThemeToggleBtn) {
    loginThemeToggleBtn.addEventListener('click', () => {
      toggleTheme();
      renderLoginPage(options);
    });
  }
}

function renderFatal(message) {
  root.innerHTML = `
    <div class="page">
      <main class="container">
        <section class="card stack">
          <h1>Unexpected error</h1>
          <div class="notice error">${escapeHtml(message)}</div>
          <a data-link href="/workspace/dashboard">Back to dashboard</a>
        </section>
      </main>
    </div>
  `;
}

async function ensureAuthenticated() {
  if (state.me?.email) return state.me;
  const meResult = await api.me();
  if (!meResult.ok) return null;
  state.me = meResult.body?.user ?? null;
  return state.me;
}

function parseCurrentQuery() {
  return new URLSearchParams(window.location.search);
}

function navigate(path, replace = false) {
  const target = String(path || '/');
  clearAutoRefreshTimer();
  if (replace) {
    history.replaceState({}, '', target);
  } else {
    history.pushState({}, '', target);
  }
  if (state.routeInFlight) {
    state.rerenderQueued = true;
    return;
  }
  void renderRoute();
}

function renderLoading(label = 'Loading...') {
  root.innerHTML = `
    <div class="page">
      <main class="container">
        <section class="card">${escapeHtml(label)}</section>
      </main>
    </div>
  `;
}

function attachGlobalNavigation() {
  document.addEventListener('click', (event) => {
    const anchor = event.target.closest('a[data-link]');
    if (!anchor) return;
    const href = anchor.getAttribute('href');
    if (!href) return;
    event.preventDefault();
    navigate(href);
  });
  window.addEventListener('popstate', () => {
    void renderRoute();
  });
}

function unauthorizedRedirect() {
  state.me = null;
  navigate('/login', true);
}

function normalizeLabel(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function parseInteger(value, fallback, min = Number.NEGATIVE_INFINITY, max = Number.POSITIVE_INFINITY) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function toDatetimeLocalValue(value) {
  if (!value) return '';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '';
  const localDate = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 16);
}

function renderBreakdownList(breakdown, emptyLabel = 'No data') {
  const entries = Object.entries(breakdown ?? {})
    .filter(([, count]) => Number(count ?? 0) > 0)
    .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0) || String(left[0]).localeCompare(String(right[0])));

  if (entries.length === 0) {
    return `<p class="muted">${escapeHtml(emptyLabel)}</p>`;
  }

  return `
    <div class="metric-list">
      ${entries.map(([status, count]) => `
        <div class="metric-row">
          ${statusPill(normalizeLabel(status))}
          <strong>${formatNumber(count)}</strong>
        </div>
      `).join('')}
    </div>
  `;
}

function summarizeCampaignOutcomes(campaign) {
  const targets = Array.isArray(campaign?.targets) ? campaign.targets : [];
  let published = 0;
  let failed = 0;
  let pending = 0;
  let reauthRequired = 0;

  for (const target of targets) {
    if (target.status === 'publicado' && target.youtubeVideoId) {
      published += 1;
      continue;
    }
    if (target.status === 'erro' && target.errorMessage) {
      failed += 1;
      if (target.errorMessage === 'REAUTH_REQUIRED' || target.reauthRequired === true) {
        reauthRequired += 1;
      }
      continue;
    }
    pending += 1;
  }

  return {
    total: targets.length,
    published,
    failed,
    pending,
    reauthRequired,
  };
}

async function renderDashboardPage() {
  const result = await api.dashboard();
  if (!result.ok) {
    if (result.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Dashboard',
      subtitle: 'Campaign health and operational summaries.',
      noticeHtml: `<div class="notice error">${escapeHtml(result.error)}</div>`,
      contentHtml: '<section class="card">Unable to load dashboard data.</section>',
    });
    return;
  }

  const stats = result.body ?? {};
  const campaignsByStatus = stats?.campaigns?.byStatus ?? {};
  const targetsByStatus = stats?.targets?.byStatus ?? {};
  const jobsByStatus = stats?.jobs?.byStatus ?? {};
  const channels = Array.isArray(stats?.channels) ? [...stats.channels] : [];
  channels.sort((left, right) => Number(right.published ?? 0) - Number(left.published ?? 0));

  const summaryCards = [
    { label: 'Campaigns', value: formatNumber(stats?.campaigns?.total ?? 0), hint: 'Total campaigns tracked' },
    { label: 'Targets', value: formatNumber(stats?.targets?.total ?? 0), hint: 'All targets across campaigns' },
    { label: 'Jobs', value: formatNumber(stats?.jobs?.total ?? 0), hint: 'Upload jobs queued + finished' },
    { label: 'Published', value: formatNumber(targetsByStatus.publicado ?? 0), hint: 'Targets successfully published' },
    { label: 'Failed', value: formatNumber(targetsByStatus.erro ?? 0), hint: 'Targets in error state' },
    { label: 'Success Rate', value: formatPercent(stats?.targets?.successRate ?? 0), hint: 'Published / terminal targets' },
    { label: 'Retry Attempts', value: formatNumber(stats?.jobs?.totalRetries ?? 0), hint: 'Retries spent so far' },
    { label: 'Blocked Targets', value: formatNumber(stats?.reauth?.blockedTargets ?? 0), hint: 'Need account reauth' },
  ];

  const cardsHtml = summaryCards.map((card) => (
    `<article class="card">
      <div class="summary-value">${escapeHtml(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-hint">${escapeHtml(card.hint)}</div>
    </article>`
  )).join('');

  const channelsTable = channels.length === 0
    ? '<p class="muted">No channel metrics available yet.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Channel</th>
            <th>Targets</th>
            <th>Published</th>
            <th>Failed</th>
            <th>Success</th>
          </tr>
        </thead>
        <tbody>
          ${channels.slice(0, 12).map((channel) => `
            <tr>
              <td>${escapeHtml(channel.channelId)}</td>
              <td>${formatNumber(channel.totalTargets)}</td>
              <td>${formatNumber(channel.published)}</td>
              <td>${formatNumber(channel.failed)}</td>
              <td>${escapeHtml(formatPercent(channel.successRate))}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  const quotaWarningState = stats?.quota?.warningState ?? 'healthy';
  const quotaNoticeTone = quotaWarningState === 'critical' ? 'error' : quotaWarningState === 'warning' ? 'warning' : 'info';
  const quotaUsedPercent = clampPercent(stats?.quota?.usagePercent);
  const quotaProjectedPercent = clampPercent(stats?.quota?.projectedPercent);
  const failureReasons = Array.isArray(stats?.failures?.reasons) ? stats.failures.reasons : [];
  const failureReasonsTable = failureReasons.length === 0
    ? '<p class="muted">No failure reasons recorded.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Reason</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${failureReasons.map((entry) => `
            <tr>
              <td>${escapeHtml(normalizeLabel(entry.reason))}</td>
              <td>${formatNumber(entry.count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  const auditByTypeRows = Object.entries(stats?.audit?.byType ?? {})
    .filter(([, count]) => Number(count ?? 0) > 0)
    .sort((left, right) => Number(right[1] ?? 0) - Number(left[1] ?? 0));
  const auditBreakdown = auditByTypeRows.length === 0
    ? '<p class="muted">No audit events yet.</p>'
    : `<table>
        <thead>
          <tr>
            <th>Event</th>
            <th>Count</th>
          </tr>
        </thead>
        <tbody>
          ${auditByTypeRows.map(([eventType, count]) => `
            <tr>
              <td>${escapeHtml(normalizeLabel(eventType))}</td>
              <td>${formatNumber(count)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  const notices = [];
  if (quotaWarningState !== 'healthy') {
    notices.push(`
      <div class="notice ${quotaNoticeTone}">
        <h4>Quota ${quotaWarningState === 'critical' ? 'critical' : 'warning'}</h4>
        <p>Projected usage is ${formatPercent(stats?.quota?.projectedPercent ?? 0)} of the daily limit.</p>
      </div>
    `);
  }
  if (Number(stats?.reauth?.blockedTargets ?? 0) > 0) {
    notices.push(`
      <div class="notice warning">
        <h4>Account reauthorization needed</h4>
        <p>${formatNumber(stats.reauth.blockedTargets)} targets are blocked across ${formatNumber(stats.reauth.blockedChannelCount ?? 0)} channels.</p>
      </div>
    `);
  }
  if (Number(stats?.failures?.failedTargets ?? 0) > 0) {
    notices.push(`
      <div class="notice warning">
        <h4>Failures detected</h4>
        <p>${formatNumber(stats.failures.failedTargets)} targets failed in ${formatNumber(stats.failures.failedCampaigns ?? 0)} campaigns.</p>
      </div>
    `);
  }

  renderWorkspaceShell({
    title: 'Dashboard',
    subtitle: 'Campaign health and operational summaries.',
    actionsHtml: `
      <div class="inline-actions">
        <a class="btn" data-link href="/workspace/campanhas">Open campaigns</a>
        <a class="btn" data-link href="/workspace/accounts">Review accounts</a>
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/dashboard'))}">Refresh</a>
      </div>
    `,
    noticeHtml: notices.join(''),
    contentHtml: `
      <section class="grid-4">${cardsHtml}</section>
      <section class="grid-2">
        <article class="card stack">
          <h3>Campaign pipeline</h3>
          <h4>Campaign status</h4>
          ${renderBreakdownList(campaignsByStatus, 'No campaigns in the pipeline yet.')}
          <h4>Target status</h4>
          ${renderBreakdownList(targetsByStatus, 'No targets available yet.')}
          <h4>Job status</h4>
          ${renderBreakdownList(jobsByStatus, 'No jobs recorded yet.')}
        </article>
        <article class="card stack">
          <h3>Quota forecast</h3>
          <div class="progress-block">
            <div class="progress-meta">
              <span>Consumed</span>
              <strong>${formatPercent(stats?.quota?.usagePercent ?? 0)}</strong>
            </div>
            <div class="progress-track"><span class="progress-fill" style="width:${quotaUsedPercent}%"></span></div>
          </div>
          <div class="progress-block">
            <div class="progress-meta">
              <span>Projected</span>
              <strong>${formatPercent(stats?.quota?.projectedPercent ?? 0)}</strong>
            </div>
            <div class="progress-track"><span class="progress-fill projected" style="width:${quotaProjectedPercent}%"></span></div>
          </div>
          <table>
            <tbody>
              <tr><th>Daily limit</th><td>${formatNumber(stats?.quota?.dailyLimitUnits ?? 0)}</td></tr>
              <tr><th>Consumed units</th><td>${formatNumber(stats?.quota?.estimatedConsumedUnits ?? 0)}</td></tr>
              <tr><th>Queued units</th><td>${formatNumber(stats?.quota?.estimatedQueuedUnits ?? 0)}</td></tr>
              <tr><th>Projected units</th><td>${formatNumber(stats?.quota?.estimatedProjectedUnits ?? 0)}</td></tr>
              <tr><th>Remaining units</th><td>${formatNumber(stats?.quota?.estimatedRemainingUnits ?? 0)}</td></tr>
            </tbody>
          </table>
        </article>
      </section>
      <section class="grid-3">
        <article class="card stack">
          <h3>Failures</h3>
          <div class="summary-inline">
            <span>Top reason: ${escapeHtml(normalizeLabel(stats?.failures?.topReason ?? 'none'))}</span>
            <span>Failed campaigns: ${formatNumber(stats?.failures?.failedCampaigns ?? 0)}</span>
            <span>Failed targets: ${formatNumber(stats?.failures?.failedTargets ?? 0)}</span>
          </div>
          ${failureReasonsTable}
        </article>
        <article class="card stack">
          <h3>Retries & reauth</h3>
          <div class="summary-inline">
            <span>Total retries: ${formatNumber(stats?.jobs?.totalRetries ?? 0)}</span>
            <span>Retried targets: ${formatNumber(stats?.retries?.retriedTargets ?? 0)}</span>
            <span>Highest attempt: ${formatNumber(stats?.retries?.highestAttempt ?? 0)}</span>
            <span>Hotspot channel: ${escapeHtml(stats?.retries?.hotspotChannelId ?? '-')}</span>
            <span>Hotspot retries: ${formatNumber(stats?.retries?.hotspotRetryCount ?? 0)}</span>
          </div>
          <div class="summary-inline">
            <span>Blocked campaigns: ${formatNumber(stats?.reauth?.blockedCampaigns ?? 0)}</span>
            <span>Blocked targets: ${formatNumber(stats?.reauth?.blockedTargets ?? 0)}</span>
            <span>Blocked channels: ${formatNumber(stats?.reauth?.blockedChannelCount ?? 0)}</span>
          </div>
        </article>
        <article class="card stack">
          <h3>Audit</h3>
          <div class="summary-inline">
            <span>Total events: ${formatNumber(stats?.audit?.totalEvents ?? 0)}</span>
            <span>Latest: ${escapeHtml(formatDate(stats?.audit?.lastEventAt))}</span>
            <span>Type: ${escapeHtml(normalizeLabel(stats?.audit?.lastEventType ?? '-'))}</span>
            <span>Actor: ${escapeHtml(stats?.audit?.lastActorEmail ?? '-')}</span>
          </div>
          ${auditBreakdown}
        </article>
      </section>
      <section class="card stack">
        <h3>Channel leaderboard</h3>
        ${channelsTable}
      </section>
    `,
  });
}

async function renderAccountsOauthCallbackPage() {
  const query = parseCurrentQuery();
  const code = query.get('code') ?? '';
  const stateParam = query.get('state') ?? '';

  if (!code || !stateParam) {
    renderWorkspaceShell({
      title: 'Accounts',
      subtitle: 'Google OAuth callback',
      noticeHtml: '<div class="notice error">Missing OAuth callback parameters (code/state).</div>',
      contentHtml: '<section class="card"><a class="btn" data-link href="/workspace/accounts">Back to accounts</a></section>',
    });
    return;
  }

  renderWorkspaceShell({
    title: 'Accounts',
    subtitle: 'Finishing Google connection...',
    contentHtml: '<section class="card">Connecting your Google account...</section>',
  });

  const callbackResult = await api.accountOauthCallback(code, stateParam);
  if (!callbackResult.ok) {
    if (callbackResult.status === 401) {
      unauthorizedRedirect();
      return;
    }

    navigate(buildUrl('/workspace/accounts', {
      oauth: 'error',
      oauthMessage: callbackResult.error ?? 'OAuth callback failed.',
    }), true);
    return;
  }

  navigate(buildUrl('/workspace/accounts', { oauth: 'success' }), true);
}

async function renderAccountsPage() {
  const listResult = await api.accounts();
  if (!listResult.ok) {
    if (listResult.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Accounts',
      subtitle: 'Connected Google accounts and YouTube channels.',
      noticeHtml: `<div class="notice error">${escapeHtml(listResult.error)}</div>`,
      contentHtml: '<section class="card">Unable to load accounts.</section>',
    });
    return;
  }

  const accounts = Array.isArray(listResult.body?.accounts) ? listResult.body.accounts : [];
  const query = parseCurrentQuery();
  const search = (query.get('search') ?? '').trim();
  const statusFilter = (query.get('status') ?? '').trim();
  const oauth = (query.get('oauth') ?? '').trim();
  const oauthMessage = (query.get('oauthMessage') ?? '').trim();

  const channelResponses = await Promise.all(accounts.map((account) => api.accountChannels(account.id)));
  const channelsByAccountId = new Map();
  const channelErrors = [];
  let totalChannels = 0;
  let activeChannels = 0;

  accounts.forEach((account, index) => {
    const channelResponse = channelResponses[index];
    if (!channelResponse?.ok) {
      if (channelResponse?.error) {
        channelErrors.push(`${account.displayName ?? account.email ?? account.id}: ${channelResponse.error}`);
      }
      channelsByAccountId.set(account.id, []);
      return;
    }
    const channels = Array.isArray(channelResponse.body?.channels) ? channelResponse.body.channels : [];
    channelsByAccountId.set(account.id, channels);
    totalChannels += channels.length;
    activeChannels += channels.filter((channel) => channel.isActive).length;
  });

  const normalizedSearch = search.toLowerCase();
  const filteredAccounts = accounts.filter((account) => {
    if (statusFilter && account.status !== statusFilter) {
      return false;
    }
    if (!normalizedSearch) {
      return true;
    }
    const haystack = [
      account.displayName,
      account.email,
      account.id,
      account.googleSubject,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(normalizedSearch);
  });

  const selectedQueryAccountId = query.get('account');
  const selectedAccountId = selectedQueryAccountId && filteredAccounts.some((account) => account.id === selectedQueryAccountId)
    ? selectedQueryAccountId
    : filteredAccounts[0]?.id ?? accounts[0]?.id ?? null;
  const channels = selectedAccountId ? (channelsByAccountId.get(selectedAccountId) ?? []) : [];

  const connectedCount = accounts.filter((account) => account.status === 'connected').length;
  const reauthCount = accounts.filter((account) => account.status === 'reauth_required').length;
  const disconnectedCount = accounts.filter((account) => account.status === 'disconnected').length;

  const metricsCards = [
    { label: 'Connected', value: connectedCount, hint: 'Accounts ready to publish' },
    { label: 'Reauth Required', value: reauthCount, hint: 'Accounts needing reconnection' },
    { label: 'Disconnected', value: disconnectedCount, hint: 'Manually disconnected accounts' },
    { label: 'Active Channels', value: activeChannels, hint: `${formatNumber(totalChannels)} channels total` },
  ];

  const metricsHtml = metricsCards.map((card) => `
    <article class="card">
      <div class="summary-value">${formatNumber(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-hint">${escapeHtml(card.hint)}</div>
    </article>
  `).join('');

  const accountsRows = filteredAccounts.length === 0
    ? '<tr><td colspan="6" class="muted">No connected accounts.</td></tr>'
    : filteredAccounts.map((account) => {
      const channels = channelsByAccountId.get(account.id) ?? [];
      const activeCount = channels.filter((channel) => channel.isActive).length;
      const rowHref = buildUrl('/workspace/accounts', {
        account: account.id,
        search,
        status: statusFilter,
      });

      return `
      <tr>
        <td>${escapeHtml(account.displayName ?? account.email ?? account.id)}</td>
        <td>${escapeHtml(account.email ?? '-')}</td>
        <td>${statusPill(account.status)}</td>
        <td>${formatNumber(activeCount)} / ${formatNumber(channels.length)}</td>
        <td>${escapeHtml(formatDate(account.connectedAt))}</td>
        <td>
          <div class="inline-actions">
            <a class="btn" data-link href="${rowHref}">View channels</a>
            <button class="btn-danger" data-action="disconnect-account" data-account-id="${escapeHtml(account.id)}" type="button">Disconnect</button>
          </div>
        </td>
      </tr>
    `;
    }).join('');

  const channelsRows = !selectedAccountId
    ? '<tr><td colspan="5" class="muted">Select an account to view channels.</td></tr>'
    : channels.length === 0
      ? '<tr><td colspan="5" class="muted">No channels returned for this account.</td></tr>'
      : channels.map((channel) => `
        <tr>
          <td>
            <div class="channel-cell">
              ${channel.thumbnailUrl ? `<img class="channel-avatar" src="${escapeHtml(channel.thumbnailUrl)}" alt="" />` : '<span class="channel-avatar placeholder">YT</span>'}
              <div>
                <strong>${escapeHtml(channel.title ?? channel.youtubeChannelId ?? channel.id)}</strong>
                <div class="muted">${escapeHtml(channel.id)}</div>
              </div>
            </div>
          </td>
          <td>${escapeHtml(channel.handle ?? '-')}</td>
          <td>${statusPill(channel.isActive ? 'active' : 'inactive')}</td>
          <td>${escapeHtml(channel.youtubeChannelId ?? '-')}</td>
          <td>
            <button data-action="toggle-channel" data-account-id="${escapeHtml(selectedAccountId)}" data-channel-id="${escapeHtml(channel.id)}" data-next-active="${channel.isActive ? 'false' : 'true'}" type="button">
              ${channel.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </td>
        </tr>
      `).join('');

  const notices = [];
  if (oauth === 'success') {
    notices.push(`
      <div class="notice info">
        <h4>Google account connected</h4>
        <p>The OAuth callback completed successfully.</p>
      </div>
    `);
  }
  if (oauth === 'error') {
    notices.push(`
      <div class="notice error">
        <h4>Google OAuth failed</h4>
        <p>${escapeHtml(oauthMessage || 'Unable to finish OAuth callback.')}</p>
      </div>
    `);
  }
  if (channelErrors.length > 0) {
    notices.push(`
      <div class="notice warning">
        <h4>Some channel lists failed to load</h4>
        <p>${escapeHtml(channelErrors[0])}${channelErrors.length > 1 ? ` (+${channelErrors.length - 1} more)` : ''}</p>
      </div>
    `);
  }

  renderWorkspaceShell({
    title: 'Accounts',
    subtitle: 'Connected Google accounts and YouTube channels.',
    actionsHtml: `
      <div class="inline-actions">
        <button class="btn" type="button" data-action="start-google-oauth">Connect Google account</button>
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/accounts', { search, status: statusFilter }))}">Refresh</a>
      </div>
    `,
    noticeHtml: notices.join(''),
    contentHtml: `
      <section class="grid-4">${metricsHtml}</section>
      <section class="card stack">
        <h3>Connected accounts</h3>
        <form id="account-filter-form" class="grid-3">
          <label>
            Search
            <input name="search" value="${escapeHtml(search)}" placeholder="Name, email, id..." />
          </label>
          <label>
            Status
            <select name="status">
              <option value="">All</option>
              <option value="connected" ${statusFilter === 'connected' ? 'selected' : ''}>connected</option>
              <option value="reauth_required" ${statusFilter === 'reauth_required' ? 'selected' : ''}>reauth_required</option>
              <option value="disconnected" ${statusFilter === 'disconnected' ? 'selected' : ''}>disconnected</option>
            </select>
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Apply</button>
            <a class="btn" data-link href="/workspace/accounts">Clear</a>
          </div>
        </form>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Email</th>
              <th>Status</th>
              <th>Channels (active/total)</th>
              <th>Connected</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${accountsRows}</tbody>
        </table>
      </section>
      <section class="card stack">
        <h3>Channels${selectedAccountId ? ` (${escapeHtml(selectedAccountId)})` : ''}</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Handle</th>
              <th>State</th>
              <th>YouTube ID</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>${channelsRows}</tbody>
        </table>
      </section>
    `,
  });

  const accountFilterForm = document.getElementById('account-filter-form');
  accountFilterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(accountFilterForm);
    const href = buildUrl('/workspace/accounts', {
      search: String(data.get('search') ?? ''),
      status: String(data.get('status') ?? ''),
      account: selectedAccountId ?? '',
    });
    navigate(href);
  });

  document.querySelectorAll('[data-action="start-google-oauth"]').forEach((button) => {
    button.addEventListener('click', async () => {
      button.setAttribute('disabled', 'true');
      const result = await api.startGoogleOauth();
      button.removeAttribute('disabled');

      if (!result.ok) {
        alert(result.error);
        return;
      }

      const redirectUrl = result.body?.redirectUrl;
      if (!redirectUrl) {
        alert('OAuth redirect URL not returned by API.');
        return;
      }
      window.location.assign(redirectUrl);
    });
  });

  document.querySelectorAll('[data-action="disconnect-account"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const accountId = button.getAttribute('data-account-id');
      if (!accountId) return;
      const confirmed = window.confirm('Disconnect this account?');
      if (!confirmed) return;
      const result = await api.disconnectAccount(accountId);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      await renderAccountsPage();
    });
  });

  document.querySelectorAll('[data-action="toggle-channel"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const accountId = button.getAttribute('data-account-id');
      const channelId = button.getAttribute('data-channel-id');
      const nextActive = button.getAttribute('data-next-active') === 'true';
      if (!accountId || !channelId) return;
      const result = await api.toggleChannel(accountId, channelId, nextActive);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      await renderAccountsPage();
    });
  });
}

async function renderMediaPage() {
  const result = await api.media();
  if (!result.ok) {
    if (result.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Media',
      subtitle: 'Uploaded reusable assets.',
      noticeHtml: `<div class="notice error">${escapeHtml(result.error)}</div>`,
      contentHtml: '<section class="card">Unable to load media assets.</section>',
    });
    return;
  }

  const assets = Array.isArray(result.body?.assets) ? result.body.assets : [];
  const query = parseCurrentQuery();
  const searchInput = (query.get('search') ?? '').trim();
  const search = searchInput.toLowerCase();
  const typeFilter = (query.get('type') ?? 'all').trim();

  const filteredAssets = assets.filter((asset) => {
    if (typeFilter !== 'all' && asset.asset_type !== typeFilter) {
      return false;
    }
    if (!search) {
      return true;
    }
    const haystack = [
      asset.original_name,
      asset.mime_type,
      asset.id,
      asset.storage_path,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(search);
  });

  const totalSize = filteredAssets.reduce((sum, asset) => sum + Number(asset.size_bytes ?? 0), 0);
  const totalDurationSeconds = filteredAssets.reduce((sum, asset) => sum + Number(asset.duration_seconds ?? 0), 0);
  const withThumbnail = filteredAssets.filter((asset) => asset.thumbnail).length;

  const metricsHtml = [
    { label: 'Assets', value: formatNumber(filteredAssets.length), hint: `of ${formatNumber(assets.length)} total` },
    { label: 'Storage', value: formatBytes(totalSize), hint: `${formatNumber(totalSize)} bytes` },
    { label: 'Duration', value: formatDurationSeconds(totalDurationSeconds), hint: 'Combined media duration' },
    { label: 'With Thumbnail', value: formatNumber(withThumbnail), hint: 'Video + linked thumbnail' },
  ].map((card) => `
    <article class="card">
      <div class="summary-value">${escapeHtml(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-hint">${escapeHtml(card.hint)}</div>
    </article>
  `).join('');

  const rows = filteredAssets.length === 0
    ? '<tr><td colspan="8" class="muted">No media assets found.</td></tr>'
    : filteredAssets.map((asset) => `
      <tr>
        <td>
          <strong>${escapeHtml(asset.original_name)}</strong>
          <div class="muted">${escapeHtml(asset.mime_type ?? '-')}</div>
        </td>
        <td>${statusPill(asset.asset_type ?? 'video')}</td>
        <td>${escapeHtml(formatBytes(asset.size_bytes))}</td>
        <td>${escapeHtml(formatDurationSeconds(asset.duration_seconds))}</td>
        <td>${asset.thumbnail ? statusPill('linked') : '-'}</td>
        <td>${escapeHtml(formatDate(asset.created_at))}</td>
        <td>
          <code>${escapeHtml(asset.id)}</code>
          <div class="muted">${escapeHtml(asset.storage_path ?? '-')}</div>
        </td>
        <td>
          <div class="inline-actions">
            <button class="btn" type="button" data-action="copy-media-id" data-media-id="${escapeHtml(asset.id)}">Copy ID</button>
            <button class="btn-danger" type="button" data-action="delete-media" data-media-id="${escapeHtml(asset.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

  renderWorkspaceShell({
    title: 'Media',
    subtitle: 'Uploaded reusable assets.',
    actionsHtml: `
      <div class="inline-actions">
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/media', { search: searchInput, type: typeFilter }))}">Refresh</a>
      </div>
    `,
    noticeHtml: `
      <div class="notice info">
        Upload supports JSON/base64 from the browser form below. Large files may take time to convert before upload.
      </div>
    `,
    contentHtml: `
      <section class="grid-4">${metricsHtml}</section>
      <section class="card stack">
        <h3>Upload new media</h3>
        <form id="media-upload-form" class="form-grid">
          <label>
            Video file (required)
            <input name="video" type="file" accept="video/mp4,video/quicktime" required />
          </label>
          <label>
            Thumbnail file (optional)
            <input name="thumbnail" type="file" accept="image/jpeg,image/png" />
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Upload media</button>
          </div>
        </form>
      </section>
      <section class="card stack">
        <h3>Filters</h3>
        <form id="media-filter-form" class="grid-3">
          <label>
            Search
            <input name="search" value="${escapeHtml(searchInput)}" placeholder="Name, mime, id..." />
          </label>
          <label>
            Type
            <select name="type">
              <option value="all" ${typeFilter === 'all' ? 'selected' : ''}>All</option>
              <option value="video" ${typeFilter === 'video' ? 'selected' : ''}>Video</option>
              <option value="thumbnail" ${typeFilter === 'thumbnail' ? 'selected' : ''}>Thumbnail</option>
            </select>
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Apply</button>
            <a class="btn" data-link href="/workspace/media">Clear</a>
          </div>
        </form>
      </section>
      <section class="card stack">
        <h3>Asset library (${formatNumber(filteredAssets.length)})</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size</th>
              <th>Duration</th>
              <th>Thumbnail</th>
              <th>Created</th>
              <th>ID / Storage path</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `,
  });

  const mediaUploadForm = document.getElementById('media-upload-form');
  mediaUploadForm?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const videoInput = mediaUploadForm.querySelector('input[name="video"]');
    const thumbnailInput = mediaUploadForm.querySelector('input[name="thumbnail"]');
    const submitButton = mediaUploadForm.querySelector('button[type="submit"]');
    if (!(videoInput instanceof HTMLInputElement)) return;
    if (!(thumbnailInput instanceof HTMLInputElement)) return;
    if (!(submitButton instanceof HTMLButtonElement)) return;

    const videoFile = videoInput.files?.[0];
    const thumbnailFile = thumbnailInput.files?.[0];
    if (!videoFile) {
      alert('Select a video file to upload.');
      return;
    }

    submitButton.setAttribute('disabled', 'true');
    try {
      const payload = {
        video: await buildUploadPayloadFromFile(videoFile),
      };
      if (thumbnailFile) {
        payload.thumbnail = await buildUploadPayloadFromFile(thumbnailFile);
      }

      const uploadResult = await api.uploadMedia(payload);
      if (!uploadResult.ok) {
        alert(uploadResult.error);
        return;
      }

      await renderMediaPage();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Upload failed.';
      alert(message);
    } finally {
      submitButton.removeAttribute('disabled');
    }
  });

  const mediaFilterForm = document.getElementById('media-filter-form');
  mediaFilterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(mediaFilterForm);
    const href = buildUrl('/workspace/media', {
      search: String(data.get('search') ?? ''),
      type: String(data.get('type') ?? 'all'),
    });
    navigate(href);
  });

  document.querySelectorAll('[data-action="copy-media-id"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const mediaId = button.getAttribute('data-media-id');
      if (!mediaId) return;
      try {
        await navigator.clipboard.writeText(mediaId);
      } catch {
        alert('Unable to copy ID to clipboard.');
      }
    });
  });

  document.querySelectorAll('[data-action="delete-media"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const mediaId = button.getAttribute('data-media-id');
      if (!mediaId) return;
      const confirmed = window.confirm('Delete this media asset?');
      if (!confirmed) return;
      const deleteResult = await api.deleteMedia(mediaId);
      if (!deleteResult.ok) {
        alert(deleteResult.error);
        return;
      }
      await renderMediaPage();
    });
  });
}

function campaignActionButtons(campaign) {
  const targetCount = Number(campaign.targetCount ?? campaign.targets?.length ?? 0);
  const buttons = [
    `<a class="btn" data-link href="/workspace/campanhas/${encodeURIComponent(campaign.id)}">View</a>`,
    `<button type="button" data-action="clone-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Clone</button>`,
  ];
  if (campaign.status === 'draft' && targetCount > 0) {
    buttons.push(`<button type="button" data-action="mark-ready" data-campaign-id="${escapeHtml(campaign.id)}">Mark ready</button>`);
  }
  if (campaign.status === 'ready' && targetCount > 0) {
    buttons.push(`<button class="btn-primary" type="button" data-action="launch-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Launch</button>`);
  }
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    buttons.push(`<button class="btn-danger" type="button" data-action="delete-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Delete</button>`);
  }
  return `<div class="inline-actions">${buttons.join('')}</div>`;
}

async function renderCampaignsPage() {
  const query = parseCurrentQuery();
  const filters = {
    status: (query.get('status') ?? '').trim(),
    search: (query.get('search') ?? '').trim(),
    limit: parseInteger(query.get('limit') ?? '20', 20, 1, 200),
    offset: parseInteger(query.get('offset') ?? '0', 0, 0),
  };
  const result = await api.campaigns(filters);
  if (!result.ok) {
    if (result.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'Campanhas',
      subtitle: 'Campaign list and lifecycle actions.',
      noticeHtml: `<div class="notice error">${escapeHtml(result.error)}</div>`,
      contentHtml: '<section class="card">Unable to load campaigns.</section>',
    });
    return;
  }

  const campaigns = Array.isArray(result.body?.campaigns) ? result.body.campaigns : [];
  const total = Number(result.body?.total ?? campaigns.length);
  const pageLimit = parseInteger(result.body?.limit ?? filters.limit, filters.limit, 1, 200);
  const pageOffset = parseInteger(result.body?.offset ?? filters.offset, filters.offset, 0);
  const pageStart = total === 0 ? 0 : pageOffset + 1;
  const pageEnd = Math.min(pageOffset + pageLimit, total);
  const totalPages = Math.max(1, Math.ceil(total / pageLimit));
  const currentPage = total === 0 ? 1 : Math.floor(pageOffset / pageLimit) + 1;

  const statusTotals = {
    draft: campaigns.filter((campaign) => campaign.status === 'draft').length,
    ready: campaigns.filter((campaign) => campaign.status === 'ready').length,
    launching: campaigns.filter((campaign) => campaign.status === 'launching').length,
    completed: campaigns.filter((campaign) => campaign.status === 'completed').length,
    failed: campaigns.filter((campaign) => campaign.status === 'failed').length,
  };

  const metricsHtml = [
    { label: 'Results', value: formatNumber(total), hint: 'Total campaigns matching filters' },
    { label: 'Showing', value: `${formatNumber(pageStart)}-${formatNumber(pageEnd)}`, hint: `Page ${formatNumber(currentPage)} of ${formatNumber(totalPages)}` },
    { label: 'Draft/Ready', value: `${formatNumber(statusTotals.draft)} / ${formatNumber(statusTotals.ready)}`, hint: 'Current page' },
    { label: 'Launching', value: formatNumber(statusTotals.launching), hint: 'Current page' },
    { label: 'Completed', value: formatNumber(statusTotals.completed), hint: 'Current page' },
    { label: 'Failed', value: formatNumber(statusTotals.failed), hint: 'Current page' },
  ].map((card) => `
    <article class="card">
      <div class="summary-value">${escapeHtml(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
      <div class="summary-hint">${escapeHtml(card.hint)}</div>
    </article>
  `).join('');

  const rows = campaigns.length === 0
    ? '<tr><td colspan="7" class="muted">No campaigns found.</td></tr>'
    : campaigns.map((campaign) => `
      ${(() => {
        const summary = summarizeCampaignOutcomes(campaign);
        const scheduledLabel = campaign.scheduledAt ? formatDate(campaign.scheduledAt) : 'Immediate';
        return `
      <tr>
        <td>
          <strong>${escapeHtml(campaign.title)}</strong>
          <div class="muted">${escapeHtml(campaign.videoAssetName ?? campaign.videoAssetId ?? '-')}</div>
          <code>${escapeHtml(campaign.id)}</code>
        </td>
        <td>${statusPill(campaign.status)}</td>
        <td>${escapeHtml(scheduledLabel)}</td>
        <td>${formatNumber(campaign.targetCount ?? summary.total)}</td>
        <td>
          <div class="summary-inline">
            <span>Published: ${formatNumber(summary.published)}</span>
            <span>Failed: ${formatNumber(summary.failed)}</span>
            <span>Pending: ${formatNumber(summary.pending)}</span>
            <span>Reauth: ${formatNumber(summary.reauthRequired)}</span>
          </div>
        </td>
        <td>${escapeHtml(formatDate(campaign.createdAt))}</td>
        <td>${campaignActionButtons(campaign)}</td>
      </tr>
    `;
      })()}
    `).join('');

  const previousHref = pageOffset > 0
    ? buildUrl('/workspace/campanhas', {
      status: filters.status,
      search: filters.search,
      limit: pageLimit,
      offset: Math.max(pageOffset - pageLimit, 0),
    })
    : '';
  const nextHref = pageEnd < total
    ? buildUrl('/workspace/campanhas', {
      status: filters.status,
      search: filters.search,
      limit: pageLimit,
      offset: pageOffset + pageLimit,
    })
    : '';

  renderWorkspaceShell({
    title: 'Campanhas',
    subtitle: 'Campaign list and lifecycle actions.',
    actionsHtml: `
      <div class="inline-actions">
        <a class="btn btn-primary" data-link href="/workspace/campanhas/nova">Create campaign</a>
        <a class="btn" data-link href="${escapeHtml(buildUrl('/workspace/campanhas', {
          status: filters.status,
          search: filters.search,
          limit: pageLimit,
          offset: pageOffset,
        }))}">Refresh</a>
      </div>
    `,
    contentHtml: `
      <section class="grid-3">${metricsHtml}</section>
      <section class="card stack">
        <form id="campaign-filter-form" class="grid-3">
          <label>
            Status
            <select name="status">
              <option value="">All</option>
              <option value="draft" ${filters.status === 'draft' ? 'selected' : ''}>draft</option>
              <option value="ready" ${filters.status === 'ready' ? 'selected' : ''}>ready</option>
              <option value="launching" ${filters.status === 'launching' ? 'selected' : ''}>launching</option>
              <option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>completed</option>
              <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>failed</option>
            </select>
          </label>
          <label>
            Search
            <input name="search" value="${escapeHtml(filters.search)}" placeholder="Title contains..." />
          </label>
          <label>
            Page size
            <input name="limit" type="number" min="1" max="200" value="${escapeHtml(pageLimit)}" />
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Apply filters</button>
            <a class="btn" data-link href="/workspace/campanhas">Clear</a>
          </div>
        </form>
      </section>
      <section class="card stack">
        <div class="title-row">
          <h3>Campaigns (${formatNumber(total)})</h3>
          <div class="inline-actions">
            ${previousHref
              ? `<a class="btn" data-link href="${previousHref}">Previous</a>`
              : '<button class="btn" type="button" disabled>Previous</button>'}
            ${nextHref
              ? `<a class="btn" data-link href="${nextHref}">Next</a>`
              : '<button class="btn" type="button" disabled>Next</button>'}
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Campaign</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Targets</th>
              <th>Outcome</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="muted">Showing ${formatNumber(pageStart)}-${formatNumber(pageEnd)} of ${formatNumber(total)} campaigns.</p>
      </section>
    `,
  });

  const filterForm = document.getElementById('campaign-filter-form');
  filterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(filterForm);
    const href = buildUrl('/workspace/campanhas', {
      status: String(data.get('status') ?? ''),
      search: String(data.get('search') ?? ''),
      limit: String(data.get('limit') ?? ''),
      offset: '0',
    });
    navigate(href);
  });

  document.querySelectorAll('[data-action="mark-ready"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      const response = await api.markReady(campaignId);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      await renderCampaignsPage();
    });
  });

  document.querySelectorAll('[data-action="launch-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      const response = await api.launch(campaignId);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      await renderCampaignsPage();
    });
  });

  document.querySelectorAll('[data-action="delete-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      const confirmed = window.confirm('Delete this campaign?');
      if (!confirmed) return;
      const response = await api.deleteCampaign(campaignId);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      await renderCampaignsPage();
    });
  });

  document.querySelectorAll('[data-action="clone-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const campaignId = button.getAttribute('data-campaign-id');
      if (!campaignId) return;
      const title = window.prompt('Optional clone title (leave blank for default):') ?? '';
      const response = await api.clone(campaignId, title.trim() || undefined);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      const newId = response.body?.campaign?.id;
      if (newId) {
        navigate(`/workspace/campanhas/${encodeURIComponent(newId)}`);
        return;
      }
      await renderCampaignsPage();
    });
  });
}

async function renderCampaignComposerPage() {
  const [mediaResult, accountsResult] = await Promise.all([api.media(), api.accounts()]);
  if (!mediaResult.ok || !accountsResult.ok) {
    const failing = !mediaResult.ok ? mediaResult : accountsResult;
    if (failing.status === 401) {
      unauthorizedRedirect();
      return;
    }
    renderWorkspaceShell({
      title: 'New Campaign',
      subtitle: 'Create campaign and optional target batch.',
      noticeHtml: `<div class="notice error">${escapeHtml(failing.error)}</div>`,
      contentHtml: '<section class="card">Unable to load campaign composer dependencies.</section>',
    });
    return;
  }

  const assets = Array.isArray(mediaResult.body?.assets) ? mediaResult.body.assets : [];
  const videos = assets.filter((asset) => asset.asset_type === 'video' || asset.asset_type === undefined);
  const accounts = Array.isArray(accountsResult.body?.accounts) ? accountsResult.body.accounts : [];
  const channelResponses = await Promise.all(accounts.map((account) => api.accountChannels(account.id)));
  const channels = channelResponses
    .filter((response) => response.ok)
    .flatMap((response) => Array.isArray(response.body?.channels) ? response.body.channels : [])
    .filter((channel) => channel.isActive);

  const channelCheckboxes = channels.length === 0
    ? '<p class="muted">No active channels available.</p>'
    : channels.map((channel) => `
      <label>
        <input type="checkbox" name="channelId" value="${escapeHtml(channel.id)}" />
        ${escapeHtml(channel.title)} (${escapeHtml(channel.id)})
      </label>
    `).join('');

  const videoOptions = videos.map((video) => (
    `<option value="${escapeHtml(video.id)}">${escapeHtml(video.original_name)}</option>`
  )).join('');

  renderWorkspaceShell({
    title: 'New Campaign',
    subtitle: 'Create campaign and optional target batch.',
    contentHtml: `
      <section class="card stack">
        <div class="notice info">If no channels are selected, a draft campaign is created without targets.</div>
        <form id="campaign-create-form" class="form-grid">
          <label>
            Campaign title
            <input name="title" required placeholder="My campaign" />
          </label>
          <label>
            Video asset
            <select name="videoAssetId" required>
              <option value="">Select a video</option>
              ${videoOptions}
            </select>
          </label>
          <label>
            Scheduled at (optional)
            <input name="scheduledAt" type="datetime-local" />
          </label>
          <label>
            Target video title
            <input name="videoTitle" required placeholder="Video title for selected channels" />
          </label>
          <label>
            Target video description
            <textarea name="videoDescription" required placeholder="Description for selected channels"></textarea>
          </label>
          <label>
            Tags (comma-separated)
            <input name="tags" placeholder="news, update, launch" />
          </label>
          <label>
            Publish at per target (optional)
            <input name="publishAt" type="datetime-local" />
          </label>
          <label>
            Privacy
            <select name="privacy">
              <option value="">Default</option>
              <option value="public">public</option>
              <option value="unlisted">unlisted</option>
              <option value="private">private</option>
            </select>
          </label>
          <label>
            Playlist ID (optional)
            <input name="playlistId" />
          </label>
          <fieldset class="card">
            <legend>Active channels</legend>
            <div class="stack">${channelCheckboxes}</div>
          </fieldset>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Save draft</button>
            <a class="btn" data-link href="/workspace/campanhas">Cancel</a>
          </div>
        </form>
      </section>
    `,
  });

  const form = document.getElementById('campaign-create-form');
  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const campaignPayload = {
      title: String(data.get('title') ?? ''),
      videoAssetId: String(data.get('videoAssetId') ?? ''),
      scheduledAt: data.get('scheduledAt') ? new Date(String(data.get('scheduledAt'))).toISOString() : undefined,
    };
    const created = await api.createCampaign(campaignPayload);
    if (!created.ok) {
      alert(created.error);
      return;
    }

    const selectedChannelIds = data.getAll('channelId').map((entry) => String(entry));
    const newCampaignId = created.body?.campaign?.id;
    if (!newCampaignId) {
      alert('Campaign created but id is missing.');
      return;
    }

    if (selectedChannelIds.length > 0) {
      const tags = String(data.get('tags') ?? '')
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);
      const targetTemplate = {
        videoTitle: String(data.get('videoTitle') ?? ''),
        videoDescription: String(data.get('videoDescription') ?? ''),
        tags: tags.length > 0 ? tags : undefined,
        publishAt: data.get('publishAt') ? new Date(String(data.get('publishAt'))).toISOString() : undefined,
        playlistId: String(data.get('playlistId') ?? '').trim() || undefined,
        privacy: String(data.get('privacy') ?? '').trim() || undefined,
      };

      const addTargets = await api.addTargetsBulk(
        newCampaignId,
        selectedChannelIds.map((channelId) => ({
          channelId,
          ...targetTemplate,
        })),
      );
      if (!addTargets.ok) {
        alert(`Campaign created, but targets failed: ${addTargets.error}`);
      }
    }

    navigate(`/workspace/campanhas/${encodeURIComponent(newCampaignId)}`);
  });
}

function mergeTimeline(jobsByTarget, auditEvents) {
  const jobEvents = Object.entries(jobsByTarget ?? {}).flatMap(([targetId, jobs]) =>
    jobs
      .map((job) => ({
        kind: 'job',
        timestamp: job.completedAt || job.startedAt || job.createdAt,
        targetId,
        label: `${job.status} (attempt ${job.attempt})`,
      }))
      .filter((event) => Boolean(event.timestamp)),
  );
  const auditTimeline = (auditEvents ?? []).map((event) => ({
    kind: 'audit',
    timestamp: event.createdAt,
    targetId: event.targetId,
    label: `${event.eventType} by ${event.actorEmail}`,
  }));
  return [...jobEvents, ...auditTimeline]
    .sort((left, right) => (left.timestamp < right.timestamp ? 1 : -1));
}

function applyTimelineFilters(timeline, activityFilter, targetFilter) {
  return timeline.filter((entry) => {
    if (activityFilter === 'jobs' && entry.kind !== 'job') return false;
    if (activityFilter === 'audit' && entry.kind !== 'audit') return false;
    if (targetFilter && entry.targetId !== targetFilter) return false;
    return true;
  });
}

async function renderCampaignDetailPage(campaignId) {
  const [campaignResult, statusResult, jobsResult, auditResult] = await Promise.all([
    api.campaignById(campaignId),
    api.campaignStatus(campaignId),
    api.campaignJobs(campaignId),
    api.campaignAudit(campaignId),
  ]);

  const firstError = [campaignResult, statusResult, jobsResult, auditResult].find((result) => !result.ok);
  if (firstError && firstError.status === 401) {
    unauthorizedRedirect();
    return;
  }

  if (!campaignResult.ok) {
    renderWorkspaceShell({
      title: `Campaign ${campaignId}`,
      subtitle: 'Detail',
      noticeHtml: `<div class="notice error">${escapeHtml(campaignResult.error)}</div>`,
      contentHtml: '<section class="card">Unable to load campaign detail.</section>',
    });
    return;
  }

  const campaign = campaignResult.body?.campaign;
  const status = statusResult.ok ? statusResult.body : null;
  const jobsByTarget = jobsResult.ok ? jobsResult.body?.jobsByTarget : {};
  const auditEvents = auditResult.ok ? auditResult.body?.events : [];
  const canMutateTargets = campaign.status === 'draft' || campaign.status === 'ready';
  const canEditCampaign = campaign.status === 'draft' || campaign.status === 'ready';

  const actions = [];
  if (campaign.status === 'draft' && (campaign.targets?.length ?? 0) > 0) {
    actions.push(`<button type="button" data-action="mark-ready" data-campaign-id="${escapeHtml(campaign.id)}">Mark ready</button>`);
  }
  if (campaign.status === 'ready' && (campaign.targets?.length ?? 0) > 0) {
    actions.push(`<button class="btn-primary" type="button" data-action="launch-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Launch</button>`);
  }
  if (campaign.status === 'draft' || campaign.status === 'ready') {
    actions.push(`<button class="btn-danger" type="button" data-action="delete-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Delete</button>`);
  }
  actions.push(`<button type="button" data-action="clone-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Clone</button>`);
  actions.push(`<a class="btn" data-link href="/workspace/campanhas">Back</a>`);

  const targets = Array.isArray(campaign.targets) ? campaign.targets : [];
  const targetRows = targets.length === 0
    ? '<tr><td colspan="9" class="muted">No targets configured.</td></tr>'
    : targets.map((target) => {
      const actionButtons = [];
      if (target.status === 'erro') {
        actionButtons.push(`<button type="button" data-action="retry-target" data-campaign-id="${escapeHtml(campaign.id)}" data-target-id="${escapeHtml(target.id)}">Retry</button>`);
      }
      if (canMutateTargets) {
        actionButtons.push(`<button type="button" data-action="edit-target" data-target-id="${escapeHtml(target.id)}">Edit</button>`);
        actionButtons.push(`<button class="btn-danger" type="button" data-action="remove-target" data-target-id="${escapeHtml(target.id)}">Remove</button>`);
      }

      return `
        <tr>
          <td>${escapeHtml(target.channelTitle ?? target.channelId ?? target.id)}</td>
          <td>${escapeHtml(target.videoTitle ?? '-')}</td>
          <td>${statusPill(target.status)}</td>
          <td>${target.publishAt ? escapeHtml(formatDate(target.publishAt)) : '-'}</td>
          <td>${target.youtubeVideoId ? `<a target="_blank" href="https://www.youtube.com/watch?v=${encodeURIComponent(target.youtubeVideoId)}">${escapeHtml(target.youtubeVideoId)}</a>` : '-'}</td>
          <td>${target.retryCount ?? 0}</td>
          <td>${target.errorMessage ? escapeHtml(target.errorMessage) : '-'}</td>
          <td>${target.reauthRequired ? statusPill('reauth_required') : '-'}</td>
          <td>
            <div class="inline-actions">
              ${actionButtons.join('')}
            </div>
          </td>
        </tr>
      `;
    }).join('');

  const timeline = mergeTimeline(jobsByTarget, auditEvents);
  const query = parseCurrentQuery();
  const activityFilter = query.get('activity') || 'all';
  const targetFilter = query.get('targetId') || '';
  const filteredTimeline = applyTimelineFilters(timeline, activityFilter, targetFilter);

  const filterHrefs = {
    all: buildUrl(`/workspace/campanhas/${campaign.id}`),
    jobs: buildUrl(`/workspace/campanhas/${campaign.id}`, { activity: 'jobs', targetId: targetFilter || '' }),
    audit: buildUrl(`/workspace/campanhas/${campaign.id}`, { activity: 'audit', targetId: targetFilter || '' }),
  };

  const distinctTargetIds = Array.from(
    new Set(timeline.map((entry) => entry.targetId).filter(Boolean)),
  );
  const targetOptions = [
    `<option value="">All targets</option>`,
    ...distinctTargetIds.map((id) => `<option value="${escapeHtml(id)}" ${targetFilter === id ? 'selected' : ''}>${escapeHtml(id)}</option>`),
  ].join('');

  const timelineRows = filteredTimeline.length === 0
    ? '<tr><td colspan="4" class="muted">No activity found for the selected filters.</td></tr>'
    : filteredTimeline.map((entry) => `
      <tr>
        <td>${statusPill(entry.kind)}</td>
        <td>${escapeHtml(formatDate(entry.timestamp))}</td>
        <td>${escapeHtml(entry.targetId ?? '-')}</td>
        <td>${escapeHtml(entry.label)}</td>
      </tr>
    `).join('');

  renderWorkspaceShell({
    title: `Campaign ${campaign.title}`,
    subtitle: `ID: ${campaign.id}`,
    actionsHtml: `<div class="inline-actions">${actions.join('')}</div>`,
    noticeHtml: statusResult.ok
      ? `<div class="notice info">Live status: ${escapeHtml(status?.campaignStatus ?? campaign.status)} | progress ${escapeHtml(`${status?.progress?.completed ?? 0}/${status?.progress?.total ?? targets.length}`)} | poll ${status?.shouldPoll ? 'enabled' : 'disabled'}</div>`
      : `<div class="notice warning">Status unavailable: ${escapeHtml(statusResult.error)}</div>`,
    contentHtml: `
      <section class="grid-3">
        <article class="card"><div class="summary-value">${formatNumber(targets.length)}</div><div class="summary-label">Targets</div></article>
        <article class="card"><div class="summary-value">${formatNumber((auditEvents ?? []).length)}</div><div class="summary-label">Audit events</div></article>
        <article class="card"><div class="summary-value">${formatNumber(timeline.length)}</div><div class="summary-label">Total activity entries</div></article>
      </section>
      ${canEditCampaign ? `
      <section class="card stack">
        <h3>Campaign settings</h3>
        <form id="campaign-edit-form" class="grid-3">
          <label>
            Title
            <input name="title" required value="${escapeHtml(campaign.title ?? '')}" />
          </label>
          <label>
            Scheduled at
            <input name="scheduledAt" type="datetime-local" value="${escapeHtml(toDatetimeLocalValue(campaign.scheduledAt))}" />
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Save campaign</button>
          </div>
        </form>
      </section>
      <section class="card stack">
        <h3>Add target</h3>
        <form id="campaign-add-target-form" class="grid-3">
          <label>
            Channel ID
            <input name="channelId" required placeholder="channel-id" />
          </label>
          <label>
            Video title
            <input name="videoTitle" required placeholder="Target title" />
          </label>
          <label>
            Video description
            <textarea name="videoDescription" required placeholder="Target description"></textarea>
          </label>
          <label>
            Tags (comma-separated)
            <input name="tags" placeholder="tag1, tag2" />
          </label>
          <label>
            Publish at
            <input name="publishAt" type="datetime-local" />
          </label>
          <label>
            Privacy
            <select name="privacy">
              <option value="">Default</option>
              <option value="public">public</option>
              <option value="unlisted">unlisted</option>
              <option value="private">private</option>
            </select>
          </label>
          <label>
            Playlist ID
            <input name="playlistId" />
          </label>
          <label>
            Thumbnail asset ID
            <input name="thumbnailAssetId" />
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Add target</button>
          </div>
        </form>
      </section>
      ` : ''}
      <section class="card stack">
        <h3>Targets</h3>
        <table>
          <thead>
            <tr>
              <th>Channel</th>
              <th>Video title</th>
              <th>Status</th>
              <th>Publish at</th>
              <th>YouTube</th>
              <th>Retries</th>
              <th>Error</th>
              <th>Reauth</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${targetRows}</tbody>
        </table>
      </section>
      <section class="card stack">
        <div class="title-row">
          <h3>Activity timeline</h3>
          <div class="inline-actions">
            <a class="btn ${activityFilter === 'all' ? 'btn-primary' : ''}" data-link href="${filterHrefs.all}">All</a>
            <a class="btn ${activityFilter === 'jobs' ? 'btn-primary' : ''}" data-link href="${filterHrefs.jobs}">Jobs</a>
            <a class="btn ${activityFilter === 'audit' ? 'btn-primary' : ''}" data-link href="${filterHrefs.audit}">Audit</a>
          </div>
        </div>
        <form id="timeline-filter-form" class="inline-actions">
          <input type="hidden" name="activity" value="${escapeHtml(activityFilter === 'all' ? '' : activityFilter)}" />
          <label>
            Target filter
            <select name="targetId">${targetOptions}</select>
          </label>
          <button type="submit">Apply</button>
        </form>
        <table>
          <thead>
            <tr>
              <th>Type</th>
              <th>Timestamp</th>
              <th>Target</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>${timelineRows}</tbody>
        </table>
      </section>
      <section class="card stack">
        <h3>Raw audit payload</h3>
        <pre>${escapeHtml(JSON.stringify(auditEvents ?? [], null, 2))}</pre>
      </section>
    `,
  });

  const campaignEditForm = document.getElementById('campaign-edit-form');
  campaignEditForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(campaignEditForm);
    const payload = {
      title: String(data.get('title') ?? ''),
      scheduledAt: data.get('scheduledAt')
        ? new Date(String(data.get('scheduledAt'))).toISOString()
        : undefined,
    };
    const response = await api.updateCampaign(campaign.id, payload);
    if (!response.ok) {
      alert(response.error);
      return;
    }
    await renderCampaignDetailPage(campaign.id);
  });

  const addTargetForm = document.getElementById('campaign-add-target-form');
  addTargetForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(addTargetForm);
    const tags = String(data.get('tags') ?? '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const payload = {
      channelId: String(data.get('channelId') ?? ''),
      videoTitle: String(data.get('videoTitle') ?? ''),
      videoDescription: String(data.get('videoDescription') ?? ''),
      tags: tags.length > 0 ? tags : undefined,
      publishAt: data.get('publishAt') ? new Date(String(data.get('publishAt'))).toISOString() : undefined,
      privacy: String(data.get('privacy') ?? '').trim() || undefined,
      playlistId: String(data.get('playlistId') ?? '').trim() || undefined,
      thumbnailAssetId: String(data.get('thumbnailAssetId') ?? '').trim() || undefined,
    };
    const response = await api.addTarget(campaign.id, payload);
    if (!response.ok) {
      alert(response.error);
      return;
    }
    await renderCampaignDetailPage(campaign.id);
  });

  const timelineFilterForm = document.getElementById('timeline-filter-form');
  timelineFilterForm?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(timelineFilterForm);
    const nextHref = buildUrl(`/workspace/campanhas/${campaign.id}`, {
      activity: data.get('activity') ? String(data.get('activity')) : '',
      targetId: String(data.get('targetId') ?? ''),
    });
    navigate(nextHref);
  });

  document.querySelectorAll('[data-action="retry-target"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-target-id');
      if (!targetId) return;
      const response = await api.retryTarget(campaign.id, targetId);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="edit-target"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-target-id');
      if (!targetId) return;

      const target = targets.find((entry) => entry.id === targetId);
      if (!target) return;

      const videoTitle = window.prompt('Video title', target.videoTitle ?? '') ?? '';
      if (!videoTitle.trim()) return;

      const videoDescription = window.prompt('Video description', target.videoDescription ?? '') ?? '';
      if (!videoDescription.trim()) return;

      const publishAtInput = window.prompt(
        'Publish at (optional, ISO date or empty)',
        target.publishAt ?? '',
      );
      if (publishAtInput === null) return;

      let publishAt;
      if (publishAtInput.trim()) {
        const parsedPublishAt = new Date(publishAtInput.trim());
        if (Number.isNaN(parsedPublishAt.getTime())) {
          alert('Invalid publishAt date.');
          return;
        }
        publishAt = parsedPublishAt.toISOString();
      }

      const payload = {
        videoTitle: videoTitle.trim(),
        videoDescription: videoDescription.trim(),
        publishAt,
      };

      const response = await api.updateTarget(campaign.id, targetId, payload);
      if (!response.ok) {
        alert(response.error);
        return;
      }

      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="remove-target"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const targetId = button.getAttribute('data-target-id');
      if (!targetId) return;
      const confirmed = window.confirm('Remove this target?');
      if (!confirmed) return;

      const response = await api.removeTarget(campaign.id, targetId);
      if (!response.ok) {
        alert(response.error);
        return;
      }

      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="mark-ready"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const response = await api.markReady(campaign.id);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="launch-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const response = await api.launch(campaign.id);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      await renderCampaignDetailPage(campaign.id);
    });
  });

  document.querySelectorAll('[data-action="delete-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const confirmed = window.confirm('Delete this campaign?');
      if (!confirmed) return;
      const response = await api.deleteCampaign(campaign.id);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      navigate('/workspace/campanhas');
    });
  });

  document.querySelectorAll('[data-action="clone-campaign"]').forEach((button) => {
    button.addEventListener('click', async () => {
      const title = window.prompt('Optional clone title (leave blank for default):') ?? '';
      const response = await api.clone(campaign.id, title.trim() || undefined);
      if (!response.ok) {
        alert(response.error);
        return;
      }
      const newId = response.body?.campaign?.id;
      if (!newId) {
        await renderCampaignDetailPage(campaign.id);
        return;
      }
      navigate(`/workspace/campanhas/${encodeURIComponent(newId)}`);
    });
  });

  if (statusResult.ok && status?.shouldPoll) {
    clearAutoRefreshTimer();
    state.autoRefreshTimer = setTimeout(() => {
      if (window.location.pathname !== `/workspace/campanhas/${encodeURIComponent(campaign.id)}`) {
        return;
      }
      void renderCampaignDetailPage(campaign.id);
    }, 3000);
  }
}

function renderNotFoundPage() {
  const isWorkspace = window.location.pathname.startsWith('/workspace');
  if (!isWorkspace) {
    root.innerHTML = `
      <div class="page">
        <main class="container">
          <section class="card stack">
            <h1>Not found</h1>
            <p class="muted">The page does not exist.</p>
            <a data-link href="/login">Go to login</a>
          </section>
        </main>
      </div>
    `;
    return;
  }

  renderWorkspaceShell({
    title: 'Not found',
    subtitle: 'This workspace page does not exist.',
    contentHtml: '<section class="card"><a data-link href="/workspace/dashboard">Back to dashboard</a></section>',
  });
}

async function renderRoute() {
  if (state.routeInFlight) return;
  clearAutoRefreshTimer();
  state.routeInFlight = true;
  try {
    const path = window.location.pathname;
    if (path === '/') {
      renderLoading('Checking session...');
      const me = await ensureAuthenticated();
      navigate(me ? '/workspace/dashboard' : '/login', true);
      return;
    }

    if (path === '/login') {
      renderLoginPage();
      return;
    }

    if (path.startsWith('/workspace')) {
      const me = await ensureAuthenticated();
      if (!me) {
        unauthorizedRedirect();
        return;
      }

      if (path === '/workspace') {
        navigate('/workspace/dashboard', true);
        return;
      }

      if (path === '/workspace/dashboard') {
        await renderDashboardPage();
        return;
      }

      if (path === '/workspace/accounts/callback') {
        await renderAccountsOauthCallbackPage();
        return;
      }

      if (path === '/workspace/accounts') {
        await renderAccountsPage();
        return;
      }

      if (path === '/workspace/media') {
        await renderMediaPage();
        return;
      }

      if (path === '/workspace/campanhas') {
        await renderCampaignsPage();
        return;
      }

      if (path === '/workspace/campanhas/nova') {
        await renderCampaignComposerPage();
        return;
      }

      const detailMatch = path.match(/^\/workspace\/campanhas\/([^/]+)$/);
      if (detailMatch) {
        await renderCampaignDetailPage(decodeURIComponent(detailMatch[1]));
        return;
      }
    }

    renderNotFoundPage();
  } catch (error) {
    renderFatal(error instanceof Error ? error.message : 'Unknown error');
  } finally {
    state.routeInFlight = false;
    if (state.rerenderQueued) {
      state.rerenderQueued = false;
      void renderRoute();
    }
  }
}

applyTheme(state.theme);
attachGlobalNavigation();
void renderRoute();

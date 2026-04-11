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
  addTargetsBulk: (id, targets) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/targets/bulk`, { targets }),
  markReady: (id) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/ready`),
  launch: (id) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/launch`),
  clone: (id, title) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(id)}/clone`, title ? { title } : undefined),
  deleteCampaign: (id) => apiRequest('DELETE', `/api/campaigns/${encodeURIComponent(id)}`),
  retryTarget: (campaignId, targetId) => apiRequest('POST', `/api/campaigns/${encodeURIComponent(campaignId)}/targets/${encodeURIComponent(targetId)}/retry`),
  accounts: () => apiRequest('GET', '/api/accounts'),
  accountChannels: (accountId) => apiRequest('GET', `/api/accounts/${encodeURIComponent(accountId)}/channels`),
  toggleChannel: (accountId, channelId, isActive) => apiRequest('PATCH', `/api/accounts/${encodeURIComponent(accountId)}/channels/${encodeURIComponent(channelId)}`, { isActive }),
  disconnectAccount: (accountId) => apiRequest('DELETE', `/api/accounts/${encodeURIComponent(accountId)}`, { confirm: 'DISCONNECT' }),
  media: () => apiRequest('GET', '/api/media'),
  deleteMedia: (id) => apiRequest('DELETE', `/api/media/${encodeURIComponent(id)}`),
};

const state = {
  me: null,
  routeInFlight: false,
};

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
            <span>${escapeHtml(state.me?.email ?? '')}</span>
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
}

function renderLoginPage(options = {}) {
  root.innerHTML = `
    <div class="login-wrap">
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
  if (replace) {
    history.replaceState({}, '', target);
  } else {
    history.pushState({}, '', target);
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

  const stats = result.body;
  const summaryCards = [
    { label: 'Campaigns', value: formatNumber(stats?.campaigns?.total ?? 0) },
    { label: 'Targets', value: formatNumber(stats?.targets?.total ?? 0) },
    { label: 'Jobs', value: formatNumber(stats?.jobs?.total ?? 0) },
    { label: 'Success Rate', value: `${stats?.targets?.successRate ?? 0}%` },
    { label: 'Quota Used', value: `${stats?.quota?.usagePercent ?? 0}%` },
    { label: 'Blocked Targets', value: formatNumber(stats?.reauth?.blockedTargets ?? 0) },
  ];
  const cardsHtml = summaryCards.map((card) => (
    `<article class="card">
      <div class="summary-value">${escapeHtml(card.value)}</div>
      <div class="summary-label">${escapeHtml(card.label)}</div>
    </article>`
  )).join('');

  const channels = Array.isArray(stats?.channels) ? stats.channels : [];
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
          ${channels.map((channel) => `
            <tr>
              <td>${escapeHtml(channel.channelId)}</td>
              <td>${formatNumber(channel.totalTargets)}</td>
              <td>${formatNumber(channel.published)}</td>
              <td>${formatNumber(channel.failed)}</td>
              <td>${escapeHtml(`${channel.successRate}%`)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>`;

  renderWorkspaceShell({
    title: 'Dashboard',
    subtitle: 'Campaign health and operational summaries.',
    contentHtml: `
      <section class="grid-3">${cardsHtml}</section>
      <section class="card stack">
        <h3>Failure reasons</h3>
        <pre>${escapeHtml(JSON.stringify(stats?.failures ?? {}, null, 2))}</pre>
      </section>
      <section class="card stack">
        <h3>Audit snapshot</h3>
        <pre>${escapeHtml(JSON.stringify(stats?.audit ?? {}, null, 2))}</pre>
      </section>
      <section class="card stack">
        <h3>Channel leaderboard</h3>
        ${channelsTable}
      </section>
    `,
  });
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
  const selectedAccountId = query.get('account') || accounts[0]?.id || null;

  let channels = [];
  let channelsError = null;
  if (selectedAccountId) {
    const channelsResult = await api.accountChannels(selectedAccountId);
    if (channelsResult.ok) {
      channels = Array.isArray(channelsResult.body?.channels) ? channelsResult.body.channels : [];
    } else {
      channelsError = channelsResult.error;
    }
  }

  const accountsRows = accounts.length === 0
    ? '<tr><td colspan="6" class="muted">No connected accounts.</td></tr>'
    : accounts.map((account) => `
      <tr>
        <td>${escapeHtml(account.displayName ?? account.email ?? account.id)}</td>
        <td>${escapeHtml(account.email ?? '-')}</td>
        <td>${statusPill(account.status)}</td>
        <td>${formatNumber(account.channelCount ?? 0)}</td>
        <td>${escapeHtml(formatDate(account.connectedAt))}</td>
        <td>
          <div class="inline-actions">
            <a class="btn" data-link href="${buildUrl('/workspace/accounts', { account: account.id })}">View channels</a>
            <button class="btn-danger" data-action="disconnect-account" data-account-id="${escapeHtml(account.id)}" type="button">Disconnect</button>
          </div>
        </td>
      </tr>
    `).join('');

  const channelsRows = !selectedAccountId
    ? '<tr><td colspan="5" class="muted">Select an account to view channels.</td></tr>'
    : channels.length === 0
      ? '<tr><td colspan="5" class="muted">No channels returned for this account.</td></tr>'
      : channels.map((channel) => `
        <tr>
          <td>${escapeHtml(channel.title ?? channel.youtubeChannelId ?? channel.id)}</td>
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

  renderWorkspaceShell({
    title: 'Accounts',
    subtitle: 'Connected Google accounts and YouTube channels.',
    noticeHtml: channelsError ? `<div class="notice warning">${escapeHtml(channelsError)}</div>` : '',
    contentHtml: `
      <section class="card stack">
        <div class="title-row">
          <h3>Connected accounts</h3>
          <button class="btn" type="button" disabled title="OAuth start route not exposed in API router yet">Connect Google account</button>
        </div>
        <table>
          <thead>
            <tr>
              <th>Account</th>
              <th>Email</th>
              <th>Status</th>
              <th>Channels</th>
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
  const rows = assets.length === 0
    ? '<tr><td colspan="7" class="muted">No media assets uploaded.</td></tr>'
    : assets.map((asset) => `
      <tr>
        <td>${escapeHtml(asset.original_name)}</td>
        <td>${escapeHtml(asset.asset_type)}</td>
        <td>${formatNumber(asset.size_bytes)}</td>
        <td>${formatNumber(asset.duration_seconds)}</td>
        <td>${escapeHtml(asset.mime_type)}</td>
        <td>${escapeHtml(formatDate(asset.created_at))}</td>
        <td>
          <div class="inline-actions">
            <button class="btn-danger" type="button" data-action="delete-media" data-media-id="${escapeHtml(asset.id)}">Delete</button>
          </div>
        </td>
      </tr>
    `).join('');

  renderWorkspaceShell({
    title: 'Media',
    subtitle: 'Uploaded reusable assets.',
    noticeHtml: `<div class="notice info">Upload endpoint is not wired in the API router yet. List/delete is available.</div>`,
    contentHtml: `
      <section class="card stack">
        <h3>Asset library</h3>
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Size (bytes)</th>
              <th>Duration (s)</th>
              <th>MIME</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </section>
    `,
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
  const buttons = [
    `<a class="btn" data-link href="/workspace/campanhas/${encodeURIComponent(campaign.id)}">View</a>`,
    `<button type="button" data-action="clone-campaign" data-campaign-id="${escapeHtml(campaign.id)}">Clone</button>`,
  ];
  if (campaign.status === 'draft' && Number(campaign.targetCount ?? 0) > 0) {
    buttons.push(`<button type="button" data-action="mark-ready" data-campaign-id="${escapeHtml(campaign.id)}">Mark ready</button>`);
  }
  if (campaign.status === 'ready' && Number(campaign.targetCount ?? 0) > 0) {
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
    status: query.get('status') ?? '',
    search: query.get('search') ?? '',
    limit: query.get('limit') ?? '',
    offset: query.get('offset') ?? '',
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
  const rows = campaigns.length === 0
    ? '<tr><td colspan="8" class="muted">No campaigns found.</td></tr>'
    : campaigns.map((campaign) => `
      <tr>
        <td>${escapeHtml(campaign.title)}</td>
        <td>${escapeHtml(campaign.videoAssetName ?? '-')}</td>
        <td>${formatNumber(campaign.targetCount ?? campaign.targets?.length ?? 0)}</td>
        <td>${statusPill(campaign.status)}</td>
        <td>${campaign.scheduledAt ? escapeHtml(formatDate(campaign.scheduledAt)) : '-'}</td>
        <td>${escapeHtml(formatDate(campaign.createdAt))}</td>
        <td>${escapeHtml(campaign.id)}</td>
        <td>${campaignActionButtons(campaign)}</td>
      </tr>
    `).join('');

  renderWorkspaceShell({
    title: 'Campanhas',
    subtitle: 'Campaign list and lifecycle actions.',
    actionsHtml: `<a class="btn btn-primary" data-link href="/workspace/campanhas/nova">Create campaign</a>`,
    contentHtml: `
      <section class="card stack">
        <form id="campaign-filter-form" class="grid-3">
          <label>
            Status
            <select name="status">
              <option value="">All</option>
              <option value="draft" ${filters.status === 'draft' ? 'selected' : ''}>Draft</option>
              <option value="ready" ${filters.status === 'ready' ? 'selected' : ''}>Ready</option>
              <option value="launching" ${filters.status === 'launching' ? 'selected' : ''}>Launching</option>
              <option value="completed" ${filters.status === 'completed' ? 'selected' : ''}>Completed</option>
              <option value="failed" ${filters.status === 'failed' ? 'selected' : ''}>Failed</option>
            </select>
          </label>
          <label>
            Search
            <input name="search" value="${escapeHtml(filters.search)}" placeholder="Title contains..." />
          </label>
          <label>
            Page size
            <input name="limit" type="number" min="1" max="200" value="${escapeHtml(filters.limit || '20')}" />
          </label>
          <div class="inline-actions">
            <button class="btn-primary" type="submit">Apply filters</button>
            <a class="btn" data-link href="/workspace/campanhas">Clear</a>
          </div>
        </form>
      </section>
      <section class="card stack">
        <h3>Campaigns (${formatNumber(result.body?.total ?? campaigns.length)})</h3>
        <table>
          <thead>
            <tr>
              <th>Title</th>
              <th>Video</th>
              <th>Targets</th>
              <th>Status</th>
              <th>Scheduled</th>
              <th>Created</th>
              <th>ID</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
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
      offset: '',
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
    : targets.map((target) => `
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
            <button type="button" data-action="retry-target" data-campaign-id="${escapeHtml(campaign.id)}" data-target-id="${escapeHtml(target.id)}">Retry</button>
          </div>
        </td>
      </tr>
    `).join('');

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
  }
}

attachGlobalNavigation();
void renderRoute();

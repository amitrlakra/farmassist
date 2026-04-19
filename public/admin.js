/* FarmAssist Admin Console — admin.js */
'use strict';

const API_BASE = '';
const STATE_CODE = 'jharkhand'; // Pilot state

let activeAdminRole = null;
let rejectionReasons = [];
let allQueueItems = [];

// ─── Utilities ──────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const err = new Error(`API request failed: ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return res;
}

function adminHeaders() {
  const key = document.getElementById('adminKey').value.trim();
  return {
    'Content-Type': 'application/json',
    'x-admin-key': key
  };
}

function downloadBlob(content, fileName, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setAlert(sectionId, message, type = 'info') {
  const el = document.getElementById(sectionId);
  if (!el) return;
  if (!message) {
    el.innerHTML = '';
    return;
  }
  el.innerHTML = `<div class="alert ${type}">${message}</div>`;
}

// ─── Auth & Role ─────────────────────────────────────────────────────────────

function setAuthBadge(authenticated, name = '') {
  const badge = document.getElementById('authBadge');
  const nameDisplay = document.getElementById('adminNameDisplay');
  if (!badge) return;
  if (authenticated) {
    badge.className = 'admin-status-badge authenticated';
    badge.textContent = activeAdminRole ? `${activeAdminRole}` : 'Authenticated';
    if (nameDisplay) nameDisplay.textContent = name ? `Logged in as: ${name}` : '';
  } else {
    badge.className = 'admin-status-badge';
    badge.textContent = 'Not Authenticated';
    if (nameDisplay) nameDisplay.textContent = '';
  }
}

function applyRoleAccess(role) {
  const queueButtons = [
    document.getElementById('refreshQueueBtn'),
    document.getElementById('applyQueueFilterBtn'),
    document.getElementById('downloadQueueCsvBtn'),
  ];
  const auditButtons = [
    document.getElementById('refreshAuditBtn'),
    document.getElementById('downloadAuditCsvBtn'),
  ];

  const canQueue = role === 'reviewer' || role === 'superadmin';
  const canAudit = role === 'auditor' || role === 'reviewer' || role === 'superadmin';

  queueButtons.forEach(btn => { if (btn) btn.disabled = !canQueue; });
  auditButtons.forEach(btn => { if (btn) btn.disabled = !canAudit; });
}

async function login() {
  const key = document.getElementById('adminKey').value.trim();
  if (!key) {
    setAlert('loginAlert', 'Please enter your admin key.', 'error');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/admin/me`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', 'x-admin-key': key }
    });

    if (res.status === 401 || res.status === 403) {
      setAlert('loginAlert', 'Invalid admin key. Please check and try again.', 'error');
      return;
    }
    if (!res.ok) throw new Error(`Auth failed: ${res.status}`);

    const data = await res.json();
    activeAdminRole = data?.admin?.role || null;
    const adminName = data?.admin?.name || '';

    setAuthBadge(true, adminName);
    applyRoleAccess(activeAdminRole);

    document.getElementById('loginSection').style.display = 'none';
    document.getElementById('adminConsole').style.display = 'block';

    // Auto-load data
    await loadRejectionReasons();
    await loadStats();
    if (activeAdminRole === 'reviewer' || activeAdminRole === 'superadmin') {
      await loadQueue();
    }
    if (activeAdminRole === 'auditor' || activeAdminRole === 'reviewer' || activeAdminRole === 'superadmin') {
      await loadAudit();
    }
  } catch (err) {
    setAlert('loginAlert', 'Could not connect to server. Make sure the backend is running.', 'error');
    console.error(err);
  }
}

function logout() {
  activeAdminRole = null;
  allQueueItems = [];
  document.getElementById('adminKey').value = '';
  document.getElementById('reviewerName').value = '';
  setAuthBadge(false);
  document.getElementById('loginSection').style.display = '';
  document.getElementById('adminConsole').style.display = 'none';
  setAlert('loginAlert', '', '');
}

// ─── Stats ───────────────────────────────────────────────────────────────────

async function loadStats() {
  try {
    const res = await apiFetch(`/api/admin/verification/queue?state=${STATE_CODE}`, {
      headers: adminHeaders()
    });
    const data = await res.json();
    const items = data.items || [];

    // Also get all schemes (including verified) by fetching full audit list
    const all = items;
    const pending = all.filter(i => i.status === 'pending').length;
    const rejected = all.filter(i => i.status === 'rejected').length;
    const verified = all.filter(i => i.status === 'verified').length;
    const total = all.length;

    document.getElementById('statTotal').textContent = total;
    document.getElementById('statVerified').textContent = verified;
    document.getElementById('statPending').textContent = pending;
    document.getElementById('statRejected').textContent = rejected;
  } catch (err) {
    console.error('Failed to load stats:', err);
  }
}

// ─── Rejection Reasons ───────────────────────────────────────────────────────

async function loadRejectionReasons() {
  try {
    const res = await apiFetch('/api/admin/rejection-reasons');
    const data = await res.json();
    rejectionReasons = data.reasons || [];
  } catch (_) {
    rejectionReasons = [];
  }
}

// ─── Queue ───────────────────────────────────────────────────────────────────

function buildDecisionForm(item) {
  const reasonOptions = rejectionReasons
    .map(r => `<option value="${r.code}">${r.label}</option>`)
    .join('');

  return `
    <div class="decision-form" id="form-${item.id}">
      <select id="decision-${item.id}">
        <option value="verified">verified</option>
        <option value="pending">pending</option>
        <option value="rejected">rejected</option>
      </select>
      <button type="button" class="submit-decision-btn" data-scheme-id="${item.id}"
        title="Submit decision">Submit</button>
    </div>
    <div class="reason-row" id="reason-row-${item.id}">
      <select id="reason-${item.id}">
        <option value="">Select rejection reason...</option>
        ${reasonOptions}
      </select>
    </div>
    <div class="notes-row">
      <input id="note-${item.id}" type="text" placeholder="Decision notes (optional)" />
    </div>
  `;
}

function renderQueueTable(items) {
  const wrap = document.getElementById('queueTableWrap');
  if (!items.length) {
    wrap.innerHTML = '<div class="empty-state">No schemes match the current filter.</div>';
    return;
  }

  const rows = items.map(item => `
    <tr>
      <td class="scheme-name-cell">${item.name}</td>
      <td><code style="font-size:11px;">${item.id}</code></td>
      <td><span class="scope-pill ${item.scope}">${item.scope}</span></td>
      <td><span class="status-pill ${item.status}">${item.status}</span></td>
      <td>
        <a href="${item.source_url}" target="_blank" rel="noreferrer"
          style="font-size:12px; color:#1d4ed8;">View ↗</a>
      </td>
      <td>${buildDecisionForm(item)}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Scheme Name</th>
          <th>ID</th>
          <th>Scope</th>
          <th>Status</th>
          <th>Source</th>
          <th style="min-width:280px;">Decision</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // Attach events
  wrap.querySelectorAll('select[id^="decision-"]').forEach(sel => {
    const id = sel.id.replace('decision-', '');
    sel.addEventListener('change', () => {
      const reasonRow = document.getElementById(`reason-row-${id}`);
      if (reasonRow) {
        reasonRow.classList.toggle('visible', sel.value === 'rejected');
      }
    });
  });

  wrap.querySelectorAll('.submit-decision-btn').forEach(btn => {
    btn.addEventListener('click', () => submitDecision(btn.dataset.schemeId));
  });
}

async function loadQueue() {
  setAlert('queueAlert', '', '');
  try {
    const res = await apiFetch(`/api/admin/verification/queue?state=${STATE_CODE}`, {
      headers: adminHeaders()
    });
    const data = await res.json();
    allQueueItems = data.items || [];
    applyQueueFilter();
    const adminLabel = data.admin ? `${data.admin.name} (${data.admin.role})` : 'admin';
    setAlert('queueAlert', `Queue loaded by ${adminLabel}: ${data.total || 0} items.`, 'info');
  } catch (err) {
    setAlert('queueAlert', 'Failed to load queue. Check your admin key and backend status.', 'error');
    console.error(err);
  }
}

function applyQueueFilter() {
  const statusFilter = document.getElementById('queueStatusFilter').value;
  const search = (document.getElementById('queueSearch').value || '').toLowerCase();

  let items = allQueueItems;
  if (statusFilter !== 'all') {
    items = items.filter(i => i.status === statusFilter);
  }
  if (search) {
    items = items.filter(i => i.name.toLowerCase().includes(search));
  }
  renderQueueTable(items);
}

async function submitDecision(schemeId) {
  const decision = document.getElementById(`decision-${schemeId}`).value;
  const reasonCode = (document.getElementById(`reason-${schemeId}`) || {}).value || '';
  const notes = document.getElementById(`note-${schemeId}`).value;
  const reviewer = document.getElementById('reviewerName').value.trim() || 'Admin';

  if (decision === 'rejected' && !reasonCode) {
    setAlert('queueAlert', 'Please select a rejection reason before submitting.', 'error');
    return;
  }

  try {
    const res = await apiFetch(
      `/api/admin/verification/${encodeURIComponent(schemeId)}/decision`,
      {
        method: 'POST',
        headers: adminHeaders(),
        body: JSON.stringify({ decision, reasonCode, notes, reviewer })
      }
    );
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Decision failed');

    setAlert('queueAlert', `Updated ${schemeId} to "${decision}" by ${data.admin.name} (${data.admin.role}).`, 'success');
    await loadStats();
    await loadQueue();
    await loadAudit();
  } catch (err) {
    setAlert('queueAlert', `Failed to submit decision for ${schemeId}.`, 'error');
    console.error(err);
  }
}

// ─── Audit ───────────────────────────────────────────────────────────────────

function renderAuditTable(items) {
  const wrap = document.getElementById('auditTableWrap');
  if (!items.length) {
    wrap.innerHTML = '<div class="empty-state">No audit events yet.</div>';
    return;
  }

  const rows = items.map(a => `
    <tr class="audit-row">
      <td><code style="font-size:11px;">${a.scheme_id}</code></td>
      <td>
        <span class="audit-change">
          <span class="status-pill ${a.before}">${a.before}</span>
          <span class="arrow">→</span>
          <span class="status-pill ${a.after}">${a.after}</span>
        </span>
      </td>
      <td>${a.reviewer || '—'}</td>
      <td>${a.reason_code || '—'}</td>
      <td>${a.notes || '—'}</td>
      <td class="timestamp">${a.ts ? new Date(a.ts).toLocaleString() : '—'}</td>
    </tr>
  `).join('');

  wrap.innerHTML = `
    <table class="admin-table">
      <thead>
        <tr>
          <th>Scheme ID</th>
          <th>Change</th>
          <th>Reviewer</th>
          <th>Reason Code</th>
          <th>Notes</th>
          <th>Timestamp</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function loadAudit() {
  setAlert('auditAlert', '', '');
  try {
    const res = await apiFetch(
      `/api/admin/audit?limit=100&state=${STATE_CODE}`,
      { headers: adminHeaders() }
    );
    const data = await res.json();
    renderAuditTable(data.items || []);
    const adminLabel = data.admin ? `${data.admin.name} (${data.admin.role})` : 'admin';
    setAlert('auditAlert', `Audit loaded by ${adminLabel}: ${(data.items || []).length} events.`, 'info');
  } catch (err) {
    setAlert('auditAlert', 'Failed to load audit log. Check your admin key and backend status.', 'error');
    console.error(err);
  }
}

// ─── CSV Exports ─────────────────────────────────────────────────────────────

async function downloadAdminCsv(path, fileName) {
  setAlert('exportAlert', '', '');
  try {
    const res = await apiFetch(path, { headers: adminHeaders() });
    const csv = await res.text();
    downloadBlob(csv, fileName, 'text/csv;charset=utf-8');
    setAlert('exportAlert', `Downloaded ${fileName}.`, 'success');
  } catch (err) {
    setAlert('exportAlert', `Failed to download ${fileName}.`, 'error');
    console.error(err);
  }
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

function switchTab(tabName) {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });
  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `tab-${tabName}`);
  });
}

// ─── Status pills (CSS colours via JS added styles) ──────────────────────────

(function injectStatusPillStyles() {
  const style = document.createElement('style');
  style.textContent = `
    .status-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .status-pill.verified { background: #dcfce7; color: #15803d; }
    .status-pill.pending  { background: #fef9c3; color: #854d0e; }
    .status-pill.rejected { background: #fef2f2; color: #b91c1c; }
  `;
  document.head.appendChild(style);
})();

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Login
  document.getElementById('loginBtn').addEventListener('click', login);
  document.getElementById('adminKey').addEventListener('keydown', e => {
    if (e.key === 'Enter') login();
  });

  // Queue actions
  document.getElementById('refreshQueueBtn').addEventListener('click', loadQueue);
  document.getElementById('applyQueueFilterBtn').addEventListener('click', applyQueueFilter);
  document.getElementById('queueSearch').addEventListener('keydown', e => {
    if (e.key === 'Enter') applyQueueFilter();
  });

  // Audit actions
  document.getElementById('refreshAuditBtn').addEventListener('click', loadAudit);

  // CSV downloads
  document.getElementById('downloadQueueCsvBtn').addEventListener('click', () => {
    downloadAdminCsv(
      `/api/admin/verification/queue.csv?state=${STATE_CODE}`,
      'verification-queue.csv'
    );
  });
  document.getElementById('downloadAuditCsvBtn').addEventListener('click', () => {
    downloadAdminCsv(
      `/api/admin/audit.csv?limit=100&state=${STATE_CODE}`,
      'verification-audit.csv'
    );
  });
});

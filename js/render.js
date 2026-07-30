// ─────────────────────────────────────────────────────────────
// Render — pure functions turning Store.state into HTML strings.
// No virtual DOM: App re-renders the relevant container on every
// state change and re-attaches delegated listeners once at boot.
// ─────────────────────────────────────────────────────────────
const esc = Format.escapeHtml;

const MODULES = [
  { n: 1, label: 'Dashboard', icon: 'dashboard', live: true, module: 'dashboard' },
  { n: 2, label: 'Department Requirement', icon: 'clipboard', live: true, module: 'requirement' },
  { n: 3, label: 'Purchase Requisition', icon: 'file', live: true, module: 'pr' },
  { n: 4, label: 'Approval Workflow', icon: 'gitBranch', live: true, module: 'approval' },
  { n: 5, label: 'Budget Verification', icon: 'wallet', live: true, module: 'budget' },
  { n: 6, label: 'Vendor Management', icon: 'building', live: true, module: 'vendor' },
  { n: 7, label: 'RFQ', icon: 'send', live: true, module: 'rfq' },
  { n: 8, label: 'Quotation Management', icon: 'fileSearch', live: true, module: 'quotation' },
  { n: 9, label: 'Quotation Comparison', icon: 'scale', live: true, module: 'comparison' },
  { n: 10, label: 'Vendor Selection', icon: 'award', live: true, module: 'selection' },
  { n: 11, label: 'Purchase Order', icon: 'cart', live: true, module: 'po' },
  { n: 12, label: 'Delivery Tracking', icon: 'truck', live: true, module: 'delivery' },
  { n: 13, label: 'Goods Receipt (GRN)', icon: 'packageCheck', live: true, module: 'grn' },
  { n: 14, label: 'Invoice Verification', icon: 'receipt', live: true, module: 'invoice' },
  { n: 15, label: 'Payment Processing', icon: 'landmark', live: true, module: 'payment' },
  { n: 16, label: 'Reports & Audit', icon: 'barChart', live: true, module: 'reports' },
];

const TABS = [
  { key: 'overview', label: 'Procurement Dashboard' },
  { key: 'approvals', label: 'Pending Approvals' },
  { key: 'today', label: "Today's Purchases" },
  { key: 'rfq', label: 'RFQ Status' },
  { key: 'po', label: 'PO Status' },
  { key: 'vendors', label: 'Vendor Performance' },
  { key: 'budget', label: 'Budget Usage' },
  { key: 'delivery', label: 'Delivery Status' },
  { key: 'activity', label: 'Recent Activities' },
  { key: 'notifications', label: 'Notifications' },
];

const REQ_TABS = [
  { key: 'list', label: 'All Requirements' },
  { key: 'create', label: 'Create Requirement' },
];

const PR_TABS = [
  { key: 'list', label: 'All Purchase Requisitions' },
  { key: 'create', label: 'Create PR' },
];

const APPROVAL_TABS = [
  { key: 'pending', label: 'Pending Requests' },
  { key: 'history', label: 'Approval History' },
];

const BUDGET_TABS = [
  { key: 'overview', label: 'Budget Overview' },
  { key: 'validate', label: 'Validate PR' },
];

const VENDOR_TABS = [
  { key: 'directory', label: 'Vendor Master' },
  { key: 'register', label: 'Vendor Registration' },
  { key: 'approvals', label: 'Pending Approvals' },
];

const RFQ_TABS = [
  { key: 'list', label: 'All RFQs' },
  { key: 'create', label: 'Create RFQ' },
];

const QUOTATION_TABS = [
  { key: 'inbox', label: 'Receive Quotations' },
  { key: 'byrfq', label: 'By RFQ' },
];

const PO_TABS = [
  { key: 'list', label: 'All Purchase Orders' },
  { key: 'create', label: 'Create PO' },
];

const DELIVERY_TABS = [
  { key: 'board', label: 'Delivery Board' },
  { key: 'create', label: 'Dispatch Entry' },
];

const GRN_TABS = [
  { key: 'list', label: 'All GRNs' },
  { key: 'create', label: 'Post GRN' },
];

const INVOICE_TABS = [
  { key: 'list', label: 'All Invoices' },
  { key: 'create', label: 'Submit Invoice' },
];

const PAYMENT_TABS = [
  { key: 'list', label: 'All Payments' },
  { key: 'create', label: 'Raise Payment' },
];

const Render = {};

// ── Shell ────────────────────────────────────────────────────
Render.sidebar = function (currentModule) {
  const items = MODULES.map((m) => {
    const isActive = m.live && m.module === currentModule;
    return `
    <button class="nav-item ${m.live ? 'live' : ''} ${isActive ? 'active-module' : ''}" ${m.live ? `data-action="goto-module" data-module="${m.module}"` : 'disabled'}>
      <span class="nav-num">${String(m.n).padStart(2, '0')}</span>
      ${Icon[m.icon](15)}
      <span class="nav-label">${m.label}</span>
      ${!m.live ? `<span class="nav-lock">${Icon.lock(11)}</span>` : ''}
    </button>`;
  }).join('');

  const liveCount = MODULES.filter((m) => m.live).length;

  return `
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="sidebar-logo"><span></span></div>
        <span class="sidebar-title">Procurement Simulator</span>
      </div>
      <nav class="nav">${items}</nav>
      <div class="sidebar-footer">
        <div class="sidebar-footer-label">Build status</div>
        <div class="sidebar-footer-sub">Module ${liveCount} of 16 live · ${16 - liveCount} queued</div>
        <div class="progress-track"><div class="progress-fill" style="width:${(liveCount / 16) * 100}%"></div></div>
      </div>
    </aside>`;
};

Render.loginScreen = function (authState) {
  const isRegister = authState.screen === 'register';
  const err = authState.error ? `<div class="auth-error">${Icon.alertOctagon(13)} ${esc(authState.error)}</div>` : '';

  return `
    <div class="auth-page">
      <div class="auth-card">
        <div class="auth-brand">
          <div class="auth-brand-mark">GP</div>
          <div>
            <div class="auth-brand-name">Global Procurement Group</div>
            <div class="auth-brand-sub">Procurement Simulator · Skelora Institute</div>
          </div>
        </div>

        <div class="auth-tabs">
          <button class="auth-tab ${!isRegister ? 'active' : ''}" data-action="auth-switch-screen" data-screen="login">Sign In</button>
          <button class="auth-tab ${isRegister ? 'active' : ''}" data-action="auth-switch-screen" data-screen="register">New Student</button>
        </div>

        ${err}

        <div class="field">
          <label>Student ID</label>
          <input id="auth-studentId" class="cell-input" placeholder="SKELORA-2026-014" autocomplete="username" value="${esc(authState.studentId || '')}" />
        </div>
        <div class="field">
          <label>Password</label>
          <input id="auth-password" type="password" class="cell-input" placeholder="••••••••" autocomplete="${isRegister ? 'new-password' : 'current-password'}" />
        </div>
        ${isRegister ? `
        <div class="field">
          <label>Confirm Password</label>
          <input id="auth-confirmPassword" type="password" class="cell-input" placeholder="••••••••" autocomplete="new-password" />
        </div>` : ''}

        <div class="field">
          <label>Security check</label>
          <div class="captcha-row">
            <div class="captcha-code">${authState.captchaCode.split('').map((ch, i) => `<span style="transform:rotate(${((i % 2 === 0 ? -1 : 1) * (6 + i * 3))}deg)">${esc(ch)}</span>`).join('')}</div>
            <button type="button" class="icon-btn" data-action="auth-refresh-captcha" title="Get a new code">${Icon.refreshCcw(14)}</button>
          </div>
          <input id="auth-captcha" class="cell-input" placeholder="Type the code above" autocomplete="off" style="margin-top:8px" />
        </div>

        <button type="button" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:6px" data-action="${isRegister ? 'auth-register' : 'auth-login'}">
          ${isRegister ? 'Create Account & Sign In' : 'Sign In'}
        </button>

        <div class="auth-footnote">Each Student ID must start with <strong>SKELORA</strong>. Your progress is saved on this computer under your own Student ID — sign out when you're done so the next student can sign in.</div>
      </div>
    </div>
    ${Render.watermark()}`;
};


Render.topbar = function (d) {
  const unread = Selectors.unreadNotifications(d).length;
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  const studentId = Store.activeStudentId;
  const idTail = (studentId || 'SKELORA').replace(/[^A-Z0-9]/gi, '').slice(-2).toUpperCase() || 'ST';

  return `
    <header class="topbar">
      <div class="live-dot"><span class="dot"></span>Live simulation</div>
      <div class="search-wrap">
        ${Icon.search(14)}
        <input placeholder="Search PR, RFQ, PO, vendor…" />
      </div>
      <div class="spacer"></div>
      <div class="toolbar-group">
        <button class="icon-btn" data-action="open-tour" title="Getting started tour">${Icon.helpCircle(15)}</button>
        <button class="icon-btn" data-action="export-snapshot" title="Export my work (JSON)">${Icon.download(15)}</button>
        <button class="icon-btn" data-action="trigger-import" title="Import a saved snapshot">${Icon.upload(15)}</button>
        <input type="file" id="import-file-input" accept="application/json" style="display:none" />
        <button class="icon-btn icon-btn-danger" data-action="open-reset-confirm" title="Reset everything">${Icon.refreshCcw(15)}</button>
        <button class="icon-btn" data-action="open-settings" title="Settings">${Icon.settings(15)}</button>
      </div>
      <div class="topbar-date">${dateStr}</div>
      <button class="bell-btn" data-action="goto-notifications">
        ${Icon.bell(16)}
        ${unread > 0 ? `<span class="bell-badge">${unread}</span>` : ''}
      </button>
      <div class="user-chip">
        <div class="user-avatar">${esc(idTail)}</div>
        <div>
          <div class="user-name">${esc(studentId || 'Student')}</div>
          <div class="user-role">Signed in</div>
        </div>
        <button class="icon-btn" style="margin-left:4px" data-action="logout" title="Log out">${Icon.logout(14)}</button>
      </div>
    </header>`;
};

Render.ticker = function (d) {
  const k = Selectors.kpis(d);
  const items = [
    { label: 'PR PENDING', value: k.prPending, tone: 'tone-amber' },
    { label: 'RFQ OPEN', value: k.rfqOpen, tone: 'tone-cyan' },
    { label: 'PO ISSUED', value: k.poIssued, tone: 'tone-teal' },
    { label: 'AWAITING GRN', value: k.awaitingGrn, tone: 'tone-violet' },
    { label: 'INVOICE PENDING', value: k.invoicePending, tone: 'tone-amber' },
    { label: 'OVERDUE DELIVERIES', value: k.overdueDeliveries, tone: 'tone-red' },
    { label: 'BUDGET BALANCE', value: Format.inr(k.budgetBalance, true), tone: 'tone-green' },
  ];
  const loop = items.concat(items);
  const html = loop.map((it) => `
    <span class="ticker-item">
      <span class="ticker-label">${it.label}</span>
      <span class="ticker-value ${it.tone.replace('tone-', 'text-')}" style="color:var(--${it.tone.replace('tone-', '')})">${it.value}</span>
    </span>`).join('');

  return `<div class="ticker"><div class="ticker-track">${html}</div></div>`;
};

Render.kpiStrip = function (d) {
  const k = Selectors.kpis(d);
  const cards = [
    { icon: 'clipboard', label: 'PR Pending', value: k.prPending, tone: 'tone-amber' },
    { icon: 'send', label: 'RFQ Open', value: k.rfqOpen, tone: 'tone-cyan' },
    { icon: 'cart', label: 'PO Issued', value: k.poIssued, tone: 'tone-teal' },
    { icon: 'packageCheck', label: 'Awaiting GRN', value: k.awaitingGrn, tone: 'tone-violet' },
    { icon: 'receipt', label: 'Invoice Pending', value: k.invoicePending, tone: 'tone-amber' },
    { icon: 'truck', label: 'Overdue Deliveries', value: k.overdueDeliveries, tone: 'tone-red' },
    { icon: 'wallet', label: 'Budget Balance', value: Format.inr(k.budgetBalance, true), tone: 'tone-green' },
  ];
  return `<div class="kpi-strip">${cards.map((c) => `
    <div class="kpi-card">
      <div class="kpi-icon ${c.tone}">${Icon[c.icon](15)}</div>
      <div>
        <div class="kpi-value tabular">${c.value}</div>
        <div class="kpi-label">${c.label}</div>
      </div>
    </div>`).join('')}</div>`;
};

Render.tabs = function (activeTab, d) {
  const approvalCount = Selectors.pendingApprovals(d).length;
  const unread = Selectors.unreadNotifications(d).length;
  const counts = { approvals: approvalCount, notifications: unread };

  return `<div class="tabs">${TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-tab" data-tab="${t.key}">
      ${t.label}
      ${counts[t.key] ? `<span class="tab-count">${counts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.reqTabs = function (activeReqTab, d) {
  const counts = Selectors.requirementCounts(d);
  const tabCounts = { list: counts.Submitted || 0 };
  return `<div class="tabs">${REQ_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeReqTab ? 'active' : ''}" data-action="goto-req-tab" data-req-tab="${t.key}">
      ${t.label}
      ${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.prTabs = function (activePrTab, d) {
  const counts = Selectors.prCounts(d);
  const tabCounts = { list: counts.Submitted || 0 };
  return `<div class="tabs">${PR_TABS.map((t) => `
    <button class="tab-btn ${t.key === activePrTab ? 'active' : ''}" data-action="goto-pr-tab" data-pr-tab="${t.key}">
      ${t.label}
      ${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.approvalTabs = function (activeTab, d) {
  const pending = Selectors.approvalQueue(d).length;
  const tabCounts = { pending };
  return `<div class="tabs">${APPROVAL_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-approval-tab" data-approval-tab="${t.key}">
      ${t.label}
      ${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.budgetTabs = function (activeTab, d) {
  const counts = Selectors.budgetCheckCounts(d);
  const tabCounts = { validate: counts.Insufficient || 0 };
  return `<div class="tabs">${BUDGET_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-budget-tab" data-budget-tab="${t.key}">
      ${t.label}
      ${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.vendorTabs = function (activeTab, d) {
  const counts = Selectors.vendorStatusCounts(d);
  const tabCounts = { approvals: counts.Pending || 0 };
  return `<div class="tabs">${VENDOR_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-vendor-tab" data-vendor-tab="${t.key}">
      ${t.label}
      ${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.rfqTabs = function (activeTab, d) {
  const counts = Selectors.rfqCounts(d);
  const tabCounts = { list: counts.Draft || 0 };
  return `<div class="tabs">${RFQ_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-rfq-tab" data-rfq-tab="${t.key}">
      ${t.label}
      ${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.quotationTabs = function (activeTab, d) {
  const counts = Selectors.quotationCounts(d);
  const tabCounts = { inbox: counts.Pending || 0 };
  return `<div class="tabs">${QUOTATION_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-quotation-tab" data-quotation-tab="${t.key}">
      ${t.label}
      ${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.poTabs = function (activeTab, d) {
  const tabCounts = { list: Selectors.poCounts(d).Open || 0 };
  return `<div class="tabs">${PO_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-po-tab" data-po-tab="${t.key}">
      ${t.label}${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.deliveryTabs = function (activeTab, d) {
  const tabCounts = { board: Selectors.deliveryCounts(d).Delayed || 0 };
  return `<div class="tabs">${DELIVERY_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-delivery-tab" data-delivery-tab="${t.key}">
      ${t.label}${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.grnTabs = function (activeTab) {
  return `<div class="tabs">${GRN_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-grn-tab" data-grn-tab="${t.key}">${t.label}</button>`).join('')}</div>`;
};

Render.invoiceTabs = function (activeTab, d) {
  const tabCounts = { list: (Selectors.invoiceCounts(d).Blocked || 0) + (Selectors.invoiceCounts(d).Pending || 0) };
  return `<div class="tabs">${INVOICE_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-invoice-tab" data-invoice-tab="${t.key}">
      ${t.label}${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

Render.paymentTabs = function (activeTab, d) {
  const tabCounts = { list: Selectors.paymentCounts(d).Pending || 0 };
  return `<div class="tabs">${PAYMENT_TABS.map((t) => `
    <button class="tab-btn ${t.key === activeTab ? 'active' : ''}" data-action="goto-payment-tab" data-payment-tab="${t.key}">
      ${t.label}${tabCounts[t.key] ? `<span class="tab-count">${tabCounts[t.key]}</span>` : ''}
    </button>`).join('')}</div>`;
};

// ── Panel helper ─────────────────────────────────────────────
function panel(title, bodyHtml, actionHtml, extraClass) {
  return `<div class="panel ${extraClass || ''}">
    ${title ? `<div class="panel-head"><span class="panel-title">${title}</span>${actionHtml || ''}</div>` : ''}
    <div class="panel-body">${bodyHtml}</div>
  </div>`;
}
function badge(tone, text) { return `<span class="badge tone-${tone}">${text}</span>`; }

// ── Tab: Overview ────────────────────────────────────────────
Render.overview = function (d) {
  const approvals = Selectors.pendingApprovals(d).slice(0, 5);
  const deliveries = Selectors.deliveryStatusBoard(d).filter((x) => x.status === 'Delayed').slice(0, 5);
  const poBreak = Selectors.poStatusBreakdown(d);
  const topVendors = Selectors.vendorLeaderboard(d).slice(0, 5);

  const FUNNEL_LABELS = ['Requirement', 'PR', 'RFQ', 'PO', 'GRN', 'Invoice', 'Payment'];
  const funnelCounts = [
    d.requirements.length || d.prs.length,
    d.prs.length, d.rfqs.length, d.pos.length, d.grns.length, d.invoices.length, d.payments.length,
  ];
  const max = funnelCounts[0] || 1;
  const funnelHtml = FUNNEL_LABELS.map((label, i) => {
    const h = Math.max(6, (funnelCounts[i] / max) * 100);
    return `<div class="funnel-col">
      <div class="funnel-val tabular">${funnelCounts[i]}</div>
      <div class="funnel-bar" style="height:${h}%;opacity:${1 - i * 0.06}"></div>
      <div class="funnel-label">${label}</div>
    </div>`;
  }).join('');

  const maxPo = Math.max(1, ...poBreak.map((b) => b.count));
  const poBarHtml = poBreak.map((b) => `
    <div class="hbar-row">
      <div class="hbar-label">${b.status}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(b.count / maxPo) * 100}%"></div></div>
      <div class="hbar-count tabular">${b.count}</div>
    </div>`).join('');

  const approvalsHtml = approvals.map((a) => `
    <li>
      <div style="min-width:0">
        <div class="list-title">${esc(a.pr.prNumber)}</div>
        <div class="list-sub">${esc(a.pr.department)} · waiting on ${esc(a.waitingOn)}</div>
      </div>
      <div class="list-value tabular" style="color:var(--ink-300)">${Format.inr(a.pr.estimatedValue, true)}</div>
    </li>`).join('') || emptyLi('No approvals waiting');

  const deliveriesHtml = deliveries.map((del) => `
    <li>
      <div style="min-width:0">
        <div class="list-title">${esc(del.po ? del.po.poNumber : del.poId)}</div>
        <div class="list-sub">${esc(del.vendor ? del.vendor.name : 'Unknown vendor')}</div>
      </div>
      <div class="list-value tabular" style="color:var(--red)">+${del.delayDays}d · ${Format.relativeDate(del.eta)}</div>
    </li>`).join('') || emptyLi('No delayed deliveries');

  const vendorsHtml = topVendors.map((v) => `
    <li>
      <div style="min-width:0">
        <div class="list-title">${esc(v.name)}</div>
        <div class="list-sub">${v.onTimeDeliveryPct}% on-time · ${esc(v.category)}</div>
      </div>
      <div class="list-value tabular" style="color:var(--green)">★ ${v.rating}</div>
    </li>`).join('');

  return `<div class="grid-3">
    ${panel('Procurement funnel', `<div class="funnel">${funnelHtml}</div>`, '', 'col-span-2')}
    ${panel('PO status split', `<div style="padding:10px 0">${poBarHtml}</div>`)}
  </div>
  <div class="grid-cols-1" style="display:grid;grid-template-columns:1fr;gap:12px;margin-top:12px">
    <div class="grid-2">
      ${panel('Top pending approvals', `<ul class="list">${approvalsHtml}</ul>`, badge('amber', Selectors.pendingApprovals(d).length + ' total'))}
      ${panel('Delayed deliveries', `<ul class="list">${deliveriesHtml}</ul>`, badge('red', Selectors.deliveryStatusBoard(d).filter((x) => x.status === 'Delayed').length + ' delayed'))}
    </div>
    ${panel('Top rated vendors', `<ul class="list">${vendorsHtml}</ul>`)}
  </div>`;
};

function emptyLi(text) { return `<li><div class="list-sub">${text}</div></li>`; }

// ── Tab: Pending Approvals ───────────────────────────────────
Render.pendingApprovals = function (d, justActed) {
  const rows = Selectors.pendingApprovals(d);
  const rowIds = new Set(rows.map((r) => r.pr.id));
  // Rows the user just acted on this session may have already fallen
  // out of the "Submitted" filter — keep them visible with their
  // outcome badge instead of having them vanish mid-interaction.
  const actedExtra = Object.keys(justActed)
    .filter((id) => !rowIds.has(id))
    .map((id) => d.prs.find((p) => p.id === id))
    .filter(Boolean)
    .map((pr) => ({ pr, waitingOn: '—' }));
  const allRows = rows.concat(actedExtra);

  const body = allRows.length ? allRows.map(({ pr, waitingOn }) => {
    const acted = justActed[pr.id];
    const actionCell = acted
      ? `<span class="badge tone-${acted === 'approved' ? 'green' : 'red'}">${acted === 'approved' ? 'Approved' : 'Rejected'}</span>`
      : `<div class="action-cell">
          <button class="icon-btn approve" data-action="approve-pr" data-id="${pr.id}" aria-label="Approve ${pr.prNumber}">${Icon.check(13)}</button>
          <button class="icon-btn reject" data-action="reject-pr" data-id="${pr.id}" aria-label="Reject ${pr.prNumber}">${Icon.x(13)}</button>
        </div>`;
    return `<tr>
      <td class="ink-100">${esc(pr.prNumber)}</td>
      <td class="ink-300">${esc(pr.department)}</td>
      <td class="ink-300">${esc(pr.requester)}</td>
      <td class="ink-500">${esc(waitingOn)}</td>
      <td class="right tabular ink-100">${Format.inr(pr.estimatedValue)}</td>
      <td class="right">${actionCell}</td>
    </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="6">No approvals waiting. Everything submitted has been actioned.</td></tr>`;

  return panel('Pending approvals', `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>PR Number</th><th>Department</th><th>Requester</th><th>Waiting on</th><th class="right">Est. Value</th><th class="right">Action</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`, badge('amber', rows.length + ' awaiting action'));
};

// ── Tab: Today's Purchases ───────────────────────────────────
Render.today = function (d) {
  const { pos, count, value } = Selectors.todaysPurchases(d);
  const STATUS_TONE = { Open: 'amber', Approved: 'cyan', Released: 'teal', Cancelled: 'red', Closed: 'green' };

  const rows = pos.length ? pos.map((po) => {
    const vendor = d.vendors.find((v) => v.id === po.vendorId);
    return `<tr>
      <td class="ink-100">${esc(po.poNumber)}</td>
      <td class="ink-300">${esc(vendor ? vendor.name : '—')}</td>
      <td class="ink-500">${esc(po.paymentTerms)}</td>
      <td>${badge(STATUS_TONE[po.status] || 'neutral', po.status)}</td>
      <td class="right tabular ink-100">${Format.inr(po.total)}</td>
    </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="5">No purchase orders have been raised yet today.</td></tr>`;

  return `<div class="stat-grid">
    <div class="stat-card"><div class="stat-value">${count}</div><div class="stat-label">POs raised today</div></div>
    <div class="stat-card"><div class="stat-value">${Format.inr(value, true)}</div><div class="stat-label">Value committed today</div></div>
  </div>
  <div style="margin-top:12px">${panel("Today's purchase orders", `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>PO Number</th><th>Vendor</th><th>Payment Terms</th><th>Status</th><th class="right">Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`)}</div>`;
};

// ── Tab: RFQ Status ──────────────────────────────────────────
Render.rfq = function (d) {
  const breakdown = Selectors.rfqStatusBreakdown(d);
  const TONE = { Draft: 'neutral', Issued: 'cyan', 'Closing Soon': 'amber', Closed: 'teal', Awarded: 'green', Cancelled: 'red' };
  const rows = [...d.rfqs].sort((a, b) => (a.closingDate < b.closingDate ? -1 : 1));
  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  const vbarHtml = breakdown.map((b) => `
    <div class="vbar-col">
      <div class="vbar-count">${b.count}</div>
      <div class="vbar" style="height:${(b.count / maxCount) * 100}%;background:var(--cyan)"></div>
      <div class="vbar-label">${b.status}</div>
    </div>`).join('');

  const rowsHtml = rows.length ? rows.map((r) => `<tr>
    <td class="ink-100">${esc(r.rfqNumber)}</td>
    <td class="ink-300 tabular">${r.vendorIds.length}</td>
    <td class="ink-300 tabular">${r.quotationsReceived}/${r.vendorIds.length}</td>
    <td class="ink-500">${Format.relativeDate(r.closingDate)}</td>
    <td class="right">${badge(TONE[r.status] || 'neutral', r.status)}</td>
  </tr>`).join('') : `<tr class="empty-row"><td colspan="5">No RFQs yet — Module 7 (Request for Quotation) isn't built yet, so this stays empty for now.</td></tr>`;

  return `<div class="grid-3 even">
    ${panel('RFQs by status', `<div class="vbar-wrap">${vbarHtml}</div>`)}
    ${panel('All RFQs', `<div class="scroll-max"><table class="data-table">
      <thead><tr><th>RFQ Number</th><th>Vendors</th><th>Quotes</th><th>Closing</th><th class="right">Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>`)}
  </div>`;
};

// ── Tab: PO Status ───────────────────────────────────────────
Render.po = function (d) {
  const breakdown = Selectors.poStatusBreakdown(d);
  const TONE = { Open: 'amber', Approved: 'cyan', Released: 'teal', Cancelled: 'red', Closed: 'green' };
  const rows = [...d.pos].sort((a, b) => (a.poDate < b.poDate ? 1 : -1));
  const maxCount = Math.max(1, ...breakdown.map((b) => b.count));

  const vbarHtml = breakdown.map((b) => `
    <div class="vbar-col">
      <div class="vbar-count">${b.count}</div>
      <div class="vbar" style="height:${(b.count / maxCount) * 100}%;background:var(--teal)"></div>
      <div class="vbar-label">${b.status}</div>
    </div>`).join('');

  const rowsHtml = rows.length ? rows.map((po) => {
    const vendor = d.vendors.find((v) => v.id === po.vendorId);
    return `<tr>
      <td class="ink-100">${esc(po.poNumber)}</td>
      <td class="ink-300">${esc(vendor ? vendor.name : '—')}</td>
      <td class="ink-500">${esc(po.grnStatus)}</td>
      <td class="right tabular ink-100">${Format.inr(po.total)}</td>
      <td class="right">${badge(TONE[po.status] || 'neutral', po.status)}</td>
    </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="5">No purchase orders yet — Module 11 (Purchase Order) isn't built yet, so this stays empty for now.</td></tr>`;

  return `<div class="grid-3 even">
    ${panel('POs by status', `<div class="vbar-wrap">${vbarHtml}</div>`)}
    ${panel('All purchase orders', `<div class="scroll-max"><table class="data-table">
      <thead><tr><th>PO Number</th><th>Vendor</th><th>GRN Status</th><th class="right">Total</th><th class="right">Status</th></tr></thead>
      <tbody>${rowsHtml}</tbody>
    </table></div>`)}
  </div>`;
};

// ── Tab: Vendor Performance ───────────────────────────────────
Render.vendors = function (d) {
  const vendors = Selectors.vendorLeaderboard(d);
  const rows = vendors.map((v) => `<tr>
    <td class="ink-100">${esc(v.name)}</td>
    <td class="ink-500">${esc(v.category)}</td>
    <td class="right tabular" style="color:var(--amber)">★ ${v.rating}</td>
    <td class="right">
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
        <div style="width:56px;height:6px;border-radius:3px;background:var(--base-700);overflow:hidden">
          <div style="height:100%;background:var(--teal);width:${v.onTimeDeliveryPct}%"></div>
        </div>
        <span class="tabular ink-300" style="width:32px;text-align:right">${v.onTimeDeliveryPct}%</span>
      </div>
    </td>
    <td class="right tabular ink-300">${v.qualityScore}</td>
    <td class="right tabular ink-300">${v.activePOs}</td>
    <td class="right tabular ink-100">${Format.inr(v.totalSpendYtd, true)}</td>
    <td class="right">${badge(v.approvalStatus === 'Approved' ? 'green' : v.approvalStatus === 'Pending' ? 'amber' : 'red', v.approvalStatus)}</td>
  </tr>`).join('');

  return panel('Vendor performance', `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>Vendor</th><th>Category</th><th class="right">Rating</th><th class="right">On-Time %</th><th class="right">Quality</th><th class="right">Active POs</th><th class="right">Spend YTD</th><th class="right">Status</th></tr></thead>
    <tbody>${rows}</tbody>
  </table></div>`);
};

// ── Tab: Budget Usage ─────────────────────────────────────────
Render.budget = function (d) {
  const rows = Selectors.budgetUsage(d).sort((a, b) => b.usedPct - a.usedPct);
  const body = rows.map((b) => {
    const overCommitted = b.usedPct + b.reservedPct > 100;
    const usedW = Math.min(b.usedPct, 100);
    const resW = Math.min(b.reservedPct, 100 - usedW);
    return `<div class="budget-row">
      <div class="budget-head">
        <div class="budget-dept">${esc(b.department)}</div>
        <div class="budget-nums">${Format.inr(b.used, true)} used · ${Format.inr(b.reserved, true)} reserved of ${Format.inr(b.allocated, true)}</div>
      </div>
      <div class="budget-track">
        <div class="budget-used" style="width:${usedW}%"></div>
        <div class="budget-reserved" style="width:${resW}%"></div>
      </div>
      ${overCommitted ? `<div class="budget-warn">Allocated + reserved exceeds budget — review before next PO</div>` : ''}
    </div>`;
  }).join('');

  return panel('Budget usage by department', `<div class="budget-container">${body}</div>`);
};

// ── Tab: Delivery Status ──────────────────────────────────────
Render.delivery = function (d) {
  const rows = Selectors.deliveryStatusBoard(d);
  const TONE = { 'On Time': 'teal', Delayed: 'red', Partial: 'amber', Complete: 'green' };
  const body = rows.length ? rows.map((del) => `<tr>
    <td class="ink-100">${esc(del.po ? del.po.poNumber : del.poId)}</td>
    <td class="ink-300">${esc(del.vendor ? del.vendor.name : '—')}</td>
    <td class="ink-500">${esc(del.courier || '')}</td>
    <td class="ink-500 tabular">${esc(del.trackingNumber || '')}</td>
    <td class="ink-500">${Format.relativeDate(del.eta)}</td>
    <td class="right">${badge(TONE[del.status] || 'neutral', del.status + (del.delayDays ? ` · +${del.delayDays}d` : ''))}</td>
  </tr>`).join('') : `<tr class="empty-row"><td colspan="6">No deliveries yet — Module 12 (Delivery Tracking) isn't built yet, so this stays empty for now.</td></tr>`;

  return panel('Delivery tracking', `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>PO Number</th><th>Vendor</th><th>Courier</th><th>Tracking No.</th><th>ETA</th><th class="right">Status</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`);
};

// ── Tab: Recent Activities ────────────────────────────────────
Render.activity = function (d) {
  const rows = Selectors.recentActivity(d, 30);
  const DOT = {
    'PR Submitted': 'var(--cyan)', 'PR Approved': 'var(--green)', 'PR Rejected': 'var(--red)',
    'RFQ Issued': 'var(--violet)', 'Quotation Received': 'var(--violet)',
    'PO Created': 'var(--teal)', 'PO Approved': 'var(--teal)',
    'GRN Posted': 'var(--amber)', 'Invoice Verified': 'var(--amber)', 'Payment Made': 'var(--green)',
    'Vendor Registered': 'var(--cyan)',
    'Requirement Drafted': 'var(--ink-500)', 'Requirement Submitted': 'var(--cyan)', 'Requirement Rejected': 'var(--red)',
  };
  const body = rows.length ? rows.map((a) => `<li class="activity-item">
    <span class="activity-dot" style="background:${DOT[a.type] || 'var(--ink-700)'}"></span>
    <div style="min-width:0;flex:1">
      <div class="activity-title">${esc(a.type)} <span>· ${esc(a.refNumber)}</span></div>
      <div class="activity-detail">${esc(a.detail)}</div>
    </div>
    <div class="activity-time">${Format.relativeDate(a.timestamp)}</div>
  </li>`).join('') : `<li class="list"><div class="list-sub" style="padding:24px 14px;text-align:center;width:100%">No activity yet — actions you take across any module show up here.</div></li>`;

  return panel('Recent activity', `<ul class="list scroll-max" style="max-height:28rem">${body}</ul>`);
};

// ── Tab: Notifications ────────────────────────────────────────
Render.notifications = function (d) {
  const rows = [...d.notifications].sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  const unreadCount = rows.filter((n) => !n.read).length;
  const ICON = { info: 'info', warning: 'alertTriangle', critical: 'alertOctagon' };
  const TONE = { info: 'cyan', warning: 'amber', critical: 'red' };

  const body = rows.map((n) => `<li class="notif-item ${!n.read ? 'unread' : ''}">
    <div class="notif-icon tone-${TONE[n.severity]}">${Icon[ICON[n.severity]](13)}</div>
    <div style="min-width:0;flex:1">
      <div class="notif-title-row">
        <span class="notif-title">${esc(n.title)}</span>
        ${!n.read ? badge(TONE[n.severity], 'New') : ''}
      </div>
      <div class="notif-detail">${esc(n.detail)}</div>
      <div class="notif-time">${Format.relativeDate(n.timestamp)}</div>
    </div>
    ${!n.read ? `<button class="notif-dismiss" data-action="dismiss-notif" data-id="${n.id}">Dismiss</button>` : ''}
  </li>`).join('');

  return panel('Notifications', `<ul class="list">${body}</ul>`,
    `<button class="link-btn" data-action="mark-all-read" ${unreadCount === 0 ? 'disabled' : ''}>Mark all read</button>`);
};

// ── Module 2: Department Requirement ─────────────────────────
const REQ_STATUS_TONE = { Draft: 'neutral', Submitted: 'amber', Converted: 'green', Rejected: 'red' };
const PRIORITY_TONE = { Low: 'neutral', Medium: 'cyan', High: 'amber', Urgent: 'red' };

Render.requirementList = function (d, listFilter) {
  const filters = ['All', 'Draft', 'Submitted', 'Converted', 'Rejected'];
  const counts = Selectors.requirementCounts(d);
  const rows = Selectors.requirementsList(d, listFilter);

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? d.requirements.length : (counts[f] || 0);
    return `<button class="filter-chip ${listFilter === f || (!listFilter && f === 'All') ? 'active' : ''}" data-action="filter-req-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((r) => {
    const value = r.items.reduce((s, it) => s + it.estimatedPrice * it.qty, 0);
    let actionCell = '';
    if (r.status === 'Draft') {
      actionCell = `<button class="link-btn" data-action="submit-draft-req" data-id="${r.id}">Submit</button>`;
    } else if (r.status === 'Submitted') {
      actionCell = `<div class="action-cell">
        <button class="icon-btn approve" data-action="convert-req-to-pr" data-id="${r.id}" aria-label="Convert ${r.requirementNo} to PR">${Icon.check(13)}</button>
        <button class="icon-btn reject" data-action="reject-req" data-id="${r.id}" aria-label="Reject ${r.requirementNo}">${Icon.x(13)}</button>
      </div>`;
    } else if (r.status === 'Converted') {
      actionCell = `<span class="tabular" style="color:var(--ink-500);font-size:11px">${esc(d.prs.find(p => p.id === r.convertedPrId) ? d.prs.find(p => p.id === r.convertedPrId).prNumber : r.convertedPrId)}</span>`;
    } else if (r.status === 'Rejected') {
      actionCell = `<span style="color:var(--ink-700);font-size:11px">${esc(r.rejectionReason || '—')}</span>`;
    }
    return `<tr>
      <td class="ink-100">${esc(r.requirementNo)}</td>
      <td class="ink-500">${Format.relativeDate(r.date)}</td>
      <td class="ink-300">${esc(r.department)}</td>
      <td class="ink-300">${esc(r.requestedBy)}</td>
      <td>${badge(PRIORITY_TONE[r.priority] || 'neutral', r.priority)}</td>
      <td class="right tabular ink-100">${Format.inr(value, true)}</td>
      <td>${badge(REQ_STATUS_TONE[r.status] || 'neutral', r.status)}</td>
      <td class="right">${actionCell}</td>
    </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="8">No requirements match this filter.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Department requirements', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>Requirement No</th><th>Date</th><th>Department</th><th>Requested By</th><th>Priority</th><th class="right">Est. Value</th><th>Status</th><th class="right">Action / Ref</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

Render.requirementCreate = function (items, attachments) {
  const deptOptions = ['Operations', 'Engineering', 'Warehouse', 'IT', 'Finance', 'Plant Maintenance', 'Quality'];
  const categoryOptions = ['Raw Materials', 'Packaging', 'MRO Spares', 'IT Hardware', 'Office Supplies', 'Capital Equipment'];
  const priorityOptions = ['Low', 'Medium', 'High', 'Urgent'];
  const warehouseOptions = ['Chennai Plant 1', 'Chennai Plant 2', 'Coimbatore Unit', 'Bengaluru Warehouse'];

  const itemRows = items.map((it, idx) => `
    <tr data-row-index="${idx}">
      <td><input class="cell-input" data-field="itemCode" value="${esc(it.itemCode)}" placeholder="MAT-0000" /></td>
      <td><input class="cell-input" data-field="description" value="${esc(it.description)}" placeholder="Item description" /></td>
      <td><input class="cell-input tabular" style="width:64px" type="number" min="0" data-field="qty" value="${it.qty}" /></td>
      <td><select class="cell-input" data-field="unit">${['Nos', 'Kg', 'Mtr', 'Box', 'Ltr'].map((u) => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
      <td><input class="cell-input tabular" style="width:96px" type="number" min="0" data-field="estimatedPrice" value="${it.estimatedPrice}" /></td>
      <td><select class="cell-input" data-field="warehouse">${warehouseOptions.map((w) => `<option ${it.warehouse === w ? 'selected' : ''}>${w}</option>`).join('')}</select></td>
      <td><input class="cell-input" data-field="notes" value="${esc(it.notes || '')}" placeholder="Notes" /></td>
      <td class="right"><button class="icon-btn reject" data-action="remove-req-item-row" data-index="${idx}" ${items.length === 1 ? 'disabled style="opacity:.3"' : ''}>${Icon.x(12)}</button></td>
    </tr>`).join('');

  const attachTypes = ['Technical Specification', 'Drawings', 'Images', 'Supporting Documents'];
  const attachHtml = attachTypes.map((t) => `
    <div class="attach-row">
      <span class="attach-label">${t}</span>
      <label class="attach-btn">
        ${Icon.file(12)} Choose file
        <input type="file" data-attach-type="${t}" style="display:none" />
      </label>
      <span class="attach-filename" data-attach-filename="${t}">${esc((attachments[t]) || 'No file selected')}</span>
    </div>`).join('');

  return `
    <form id="req-create-form">
      ${panel('Requirement details', `
        <div class="form-grid">
          <div class="field"><label>Requirement No</label><input value="Auto-generated on save" disabled class="cell-input" /></div>
          <div class="field"><label>Date</label><input type="date" id="f-date" class="cell-input" value="${new Date().toISOString().slice(0, 10)}" /></div>
          <div class="field"><label>Department</label><select id="f-department" class="cell-input">${deptOptions.map((o) => `<option>${o}</option>`).join('')}</select></div>
          <div class="field"><label>Requested By</label><input id="f-requestedBy" class="cell-input" placeholder="Full name" /></div>
          <div class="field"><label>Cost Center</label><input id="f-costCenter" class="cell-input" placeholder="BC-OPS-12" /></div>
          <div class="field"><label>Project <span style="color:var(--ink-700)">(optional)</span></label><input id="f-project" class="cell-input" placeholder="Phase 2 Expansion" /></div>
          <div class="field"><label>Priority</label><select id="f-priority" class="cell-input">${priorityOptions.map((o) => `<option>${o}</option>`).join('')}</select></div>
          <div class="field"><label>Required Date</label><input type="date" id="f-requiredDate" class="cell-input" /></div>
          <div class="field"><label>Item Category</label><select id="f-itemCategory" class="cell-input">${categoryOptions.map((o) => `<option>${o}</option>`).join('')}</select></div>
        </div>
        <div class="field" style="padding:0 14px 14px">
          <label>Justification</label>
          <textarea id="f-justification" class="cell-input" rows="2" placeholder="Why is this requirement needed?"></textarea>
        </div>
      `)}

      ${panel('Item grid', `
        <div style="overflow-x:auto">
          <table class="data-table" id="req-item-grid">
            <thead><tr><th>Item Code</th><th>Description</th><th>Qty</th><th>UOM</th><th>Est. Price</th><th>Warehouse</th><th>Notes</th><th class="right"></th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        <div style="padding:10px 14px"><button type="button" class="link-btn" data-action="add-req-item-row">+ Add item row</button></div>
      `)}

      ${panel('Documents', `<div class="attach-grid">${attachHtml}</div>`)}

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel-req-form">Cancel</button>
        <button type="button" class="btn btn-outline" data-action="save-req-draft">Save Draft</button>
        <button type="button" class="btn btn-primary" data-action="submit-req">Submit</button>
      </div>
    </form>`;
};

// ── Module 3: Purchase Requisition ───────────────────────────
const PR_STATUS_TONE = { Draft: 'neutral', Submitted: 'amber', Approved: 'green', Rejected: 'red', Closed: 'cyan' };

function prLineage(d, pr) {
  const parts = [];
  if (pr.sourceRequirementId) {
    const req = d.requirements.find((r) => r.id === pr.sourceRequirementId);
    if (req) parts.push('from ' + req.requirementNo);
  }
  if (pr.linkedRfqId) {
    const rfq = d.rfqs.find((r) => r.id === pr.linkedRfqId);
    if (rfq) parts.push('→ ' + rfq.rfqNumber);
  }
  return parts.join(' ');
}

Render.prList = function (d, listFilter) {
  const filters = ['All', 'Draft', 'Submitted', 'Approved', 'Rejected', 'Closed'];
  const counts = Selectors.prCounts(d);
  const rows = Selectors.prsList(d, listFilter);

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? d.prs.length : (counts[f] || 0);
    return `<button class="filter-chip ${listFilter === f || (!listFilter && f === 'All') ? 'active' : ''}" data-action="filter-pr-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((pr) => {
    const waitingOn = pr.status === 'Submitted' ? ((pr.approval.steps.find((s) => s.status === 'Pending') || {}).approver || '—') : '';
    let actionCell = '';
    if (pr.status === 'Draft') {
      actionCell = `<button class="link-btn" data-action="submit-draft-pr" data-id="${pr.id}">Submit</button>`;
    } else if (pr.status === 'Submitted') {
      actionCell = `<div class="action-cell">
        <button class="icon-btn approve" data-action="approve-pr" data-id="${pr.id}" aria-label="Approve ${pr.prNumber}">${Icon.check(13)}</button>
        <button class="icon-btn reject" data-action="reject-pr" data-id="${pr.id}" aria-label="Reject ${pr.prNumber}">${Icon.x(13)}</button>
      </div>`;
    } else if (pr.status === 'Approved') {
      actionCell = `<button class="link-btn" data-action="close-pr" data-id="${pr.id}">Close</button>`;
    } else {
      actionCell = `<span style="color:var(--ink-700);font-size:11px">—</span>`;
    }
    return `<tr>
      <td class="ink-100">${esc(pr.prNumber)}</td>
      <td class="ink-500">${Format.relativeDate(pr.prDate)}</td>
      <td class="ink-300">${esc(pr.department)}</td>
      <td class="ink-300">${esc(pr.requester)}</td>
      <td class="ink-500" style="font-size:11px">${esc(prLineage(d, pr)) || '—'}</td>
      <td class="right tabular ink-100">${Format.inr(pr.estimatedValue, true)}</td>
      <td>${badge(PR_STATUS_TONE[pr.status] || 'neutral', pr.status)}${waitingOn ? `<div style="font-size:10px;color:var(--ink-700);margin-top:2px">waiting: ${esc(waitingOn)}</div>` : ''}</td>
      <td class="right">
        <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
          ${actionCell}
          <button class="icon-btn" style="background:var(--base-700);color:var(--ink-300)" data-action="print-pr" data-id="${pr.id}" aria-label="Print / Export PDF ${pr.prNumber}">${Icon.receipt(12)}</button>
        </div>
      </td>
    </tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="8">No purchase requisitions match this filter.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Purchase requisitions', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>PR Number</th><th>Date</th><th>Department</th><th>Requester</th><th>Lineage</th><th class="right">Est. Value</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

Render.prCreate = function (items) {
  const deptOptions = ['Operations', 'Engineering', 'Warehouse', 'IT', 'Finance', 'Plant Maintenance', 'Quality'];
  const currencyOptions = ['INR', 'USD', 'EUR', 'GBP'];
  const locationOptions = ['Chennai Plant 1', 'Chennai Plant 2', 'Coimbatore Unit', 'Bengaluru Warehouse'];

  const itemRows = items.map((it, idx) => `
    <tr data-row-index="${idx}">
      <td><input class="cell-input" data-field="materialCode" value="${esc(it.materialCode)}" placeholder="MAT-0000" /></td>
      <td><input class="cell-input" data-field="description" value="${esc(it.description)}" placeholder="Item description" /></td>
      <td><input class="cell-input tabular" style="width:60px" type="number" min="0" data-field="qty" value="${it.qty}" /></td>
      <td><select class="cell-input" data-field="unit">${['Nos', 'Kg', 'Mtr', 'Box', 'Ltr'].map((u) => `<option ${it.unit === u ? 'selected' : ''}>${u}</option>`).join('')}</select></td>
      <td><input class="cell-input tabular" style="width:90px" type="number" min="0" data-field="price" value="${it.price}" /></td>
      <td><input class="cell-input" style="width:130px" type="date" data-field="requiredDate" value="${it.requiredDate}" /></td>
      <td><input class="cell-input tabular" style="width:80px" type="number" min="0" data-field="tax" value="${it.tax}" /></td>
      <td><input class="cell-input tabular" style="width:80px" type="number" min="0" data-field="discount" value="${it.discount}" /></td>
      <td class="right"><button class="icon-btn reject" data-action="remove-pr-item-row" data-index="${idx}" ${items.length === 1 ? 'disabled style="opacity:.3"' : ''}>${Icon.x(12)}</button></td>
    </tr>`).join('');

  return `
    <form id="pr-create-form">
      ${panel('PR details', `
        <div class="form-grid">
          <div class="field"><label>PR Number</label><input value="Auto-generated on save" disabled class="cell-input" /></div>
          <div class="field"><label>PR Date</label><input type="date" id="pf-date" class="cell-input" value="${new Date().toISOString().slice(0, 10)}" /></div>
          <div class="field"><label>Department</label><select id="pf-department" class="cell-input">${deptOptions.map((o) => `<option>${o}</option>`).join('')}</select></div>
          <div class="field"><label>Requester</label><input id="pf-requester" class="cell-input" placeholder="Full name" /></div>
          <div class="field"><label>Budget Code</label><input id="pf-budgetCode" class="cell-input" placeholder="BC-OPS-12" /></div>
          <div class="field"><label>Currency</label><select id="pf-currency" class="cell-input">${currencyOptions.map((o) => `<option>${o}</option>`).join('')}</select></div>
          <div class="field"><label>Delivery Location</label><select id="pf-deliveryLocation" class="cell-input">${locationOptions.map((o) => `<option>${o}</option>`).join('')}</select></div>
        </div>
      `)}

      ${panel('Items', `
        <div style="overflow-x:auto">
          <table class="data-table" id="pr-item-grid">
            <thead><tr><th>Material Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>Required Date</th><th>Tax</th><th>Discount</th><th class="right"></th></tr></thead>
            <tbody>${itemRows}</tbody>
          </table>
        </div>
        <div style="padding:10px 14px"><button type="button" class="link-btn" data-action="add-pr-item-row">+ Add item row</button></div>
      `)}

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel-pr-form">Cancel</button>
        <button type="button" class="btn btn-outline" data-action="save-pr-draft">Save Draft</button>
        <button type="button" class="btn btn-primary" data-action="submit-pr">Submit</button>
      </div>
    </form>`;
};

Render.buildPrintableHtml = function (d, pr) {
  const req = pr.sourceRequirementId ? d.requirements.find((r) => r.id === pr.sourceRequirementId) : null;
  const rfq = pr.linkedRfqId ? d.rfqs.find((r) => r.id === pr.linkedRfqId) : null;
  const itemRows = pr.items.map((it) => `<tr>
    <td>${esc(it.materialCode)}</td><td>${esc(it.description)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td>
    <td>${Format.inr(it.price)}</td><td>${esc(it.requiredDate)}</td><td>${Format.inr(it.tax)}</td><td>${Format.inr(it.discount)}</td>
  </tr>`).join('');
  const approvalRows = (pr.approval.steps || []).map((s) => `<tr><td>${esc(s.level)}</td><td>${esc(s.approver)}</td><td>${esc(s.status)}</td></tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(pr.prNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 4px; } h2 { font-size: 13px; color: #555; margin-top: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; text-align: left; }
      .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px; margin-top: 8px; }
      .meta div span { color: #777; display: block; font-size: 10px; text-transform: uppercase; }
    </style></head><body>
    <h1>Purchase Requisition — ${esc(pr.prNumber)}</h1>
    <div class="meta">
      <div><span>Date</span>${esc(pr.prDate)}</div>
      <div><span>Department</span>${esc(pr.department)}</div>
      <div><span>Requester</span>${esc(pr.requester)}</div>
      <div><span>Budget Code</span>${esc(pr.budgetCode)}</div>
      <div><span>Currency</span>${esc(pr.currency)}</div>
      <div><span>Delivery Location</span>${esc(pr.deliveryLocation)}</div>
      <div><span>Status</span>${esc(pr.status)}</div>
      <div><span>Estimated Value</span>${Format.inr(pr.estimatedValue)}</div>
      ${req ? `<div><span>Source Requirement</span>${esc(req.requirementNo)}</div>` : ''}
      ${rfq ? `<div><span>Linked RFQ</span>${esc(rfq.rfqNumber)}</div>` : ''}
    </div>
    <h2>Items</h2>
    <table><thead><tr><th>Material Code</th><th>Description</th><th>Qty</th><th>Unit</th><th>Price</th><th>Required Date</th><th>Tax</th><th>Discount</th></tr></thead><tbody>${itemRows}</tbody></table>
    ${approvalRows ? `<h2>Approval Trail</h2><table><thead><tr><th>Level</th><th>Approver</th><th>Status</th></tr></thead><tbody>${approvalRows}</tbody></table>` : ''}
  </body></html>`;
};

// ── Module 4: Approval Workflow ──────────────────────────────
Render.levelPipeline = function (d) {
  const counts = Selectors.approvalLevelCounts(d);
  const cols = APPROVAL_LEVELS.map((level, i) => `
    <div class="level-col">
      <div class="level-num">L${i + 1}</div>
      <div class="level-name">${level}</div>
      <div class="level-approver">${esc(APPROVAL_APPROVERS[level])}</div>
      <div class="level-count">${counts[level] || 0}<span>waiting</span></div>
    </div>
    ${i < APPROVAL_LEVELS.length - 1 ? `<div class="level-arrow">→</div>` : ''}`).join('');
  return panel('Approval levels', `<div class="level-pipeline">${cols}</div>`);
};

Render.approvalPending = function (d, openDrawerId) {
  const rows = Selectors.approvalQueue(d);
  const BC_TONE = { Sufficient: 'green', Insufficient: 'red', Overridden: 'amber' };
  const body = rows.length ? rows.map(({ pr, level, approver }) => {
    const isOpen = openDrawerId === pr.id;
    const levelIdx = APPROVAL_LEVELS.indexOf(level);
    const bc = pr.budgetCheck;
    const blocked = bc && bc.status === 'Insufficient';
    const budgetBanner = blocked ? `
      <div class="drawer-banner">
        ${Icon.alertTriangle(13)} Budget insufficient for ${esc(pr.department)} — short by ${Format.inr(bc.requested - bc.available)}.
        Validate or override this PR in <button type="button" class="link-btn" data-action="goto-module-budget">Budget Verification (Module 5)</button> before it can be approved.
      </div>` : '';

    const drawer = isOpen ? `
      <tr class="drawer-row">
        <td colspan="8">
          <div class="drawer">
            ${budgetBanner}
            <div class="drawer-grid">
              <div class="field"><label>Comment</label><textarea id="drawer-comment" class="cell-input" rows="2" placeholder="Reason / notes for this decision"></textarea></div>
              <div class="field"><label>Digital Signature</label><input id="drawer-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
              <div class="field"><label>Forward to</label><input id="drawer-forward-to" class="cell-input" placeholder="Name of the person to forward to" /></div>
            </div>
            <div class="drawer-actions">
              <button type="button" class="btn btn-ghost" data-action="close-drawer">Cancel</button>
              <button type="button" class="btn btn-outline" data-action="drawer-forward" data-id="${pr.id}">Forward</button>
              <button type="button" class="btn btn-outline" style="border-color:var(--amber);color:var(--amber)" data-action="drawer-return" data-id="${pr.id}">Return</button>
              <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="drawer-reject" data-id="${pr.id}">Reject</button>
              <button type="button" class="btn btn-primary" data-action="drawer-approve" data-id="${pr.id}" ${blocked ? 'disabled title="Blocked by insufficient budget"' : ''}>Approve</button>
            </div>
          </div>
        </td>
      </tr>` : '';

    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(pr.prNumber)}</td>
      <td class="ink-300">${esc(pr.department)}</td>
      <td class="ink-300">${esc(pr.requester)}</td>
      <td><span class="level-chip">L${levelIdx + 1} · ${esc(level)}</span></td>
      <td class="ink-500">${esc(approver)}</td>
      <td>${bc ? badge(BC_TONE[bc.status] || 'neutral', bc.status) : badge('neutral', '—')}</td>
      <td class="right tabular ink-100">${Format.inr(pr.estimatedValue, true)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-drawer" data-id="${pr.id}">${isOpen ? 'Close' : 'Take action'}</button></td>
    </tr>${drawer}`;
  }).join('') : `<tr class="empty-row"><td colspan="8">Nothing waiting on any approval level right now.</td></tr>`;

  return panel('Pending requests', `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>PR Number</th><th>Department</th><th>Requester</th><th>Current Level</th><th>Approver</th><th>Budget</th><th class="right">Est. Value</th><th class="right">Action</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`, badge('amber', rows.length + ' pending'));
};

Render.approvalPendingScreen = function (d, openDrawerId) {
  return `<div style="display:flex;flex-direction:column;gap:12px">
    ${Render.levelPipeline(d)}
    ${Render.approvalPending(d, openDrawerId)}
  </div>`;
};

Render.approvalHistoryScreen = function (d) {
  const rows = Selectors.approvalHistoryFlat(d, 60);
  const ACTION_TONE = { Approved: 'green', Rejected: 'red', Returned: 'amber', Forwarded: 'cyan' };
  const body = rows.length ? rows.map((h) => `<tr>
    <td class="ink-100">${esc(h.prNumber)}</td>
    <td class="ink-500">${esc(h.level)}</td>
    <td>${badge(ACTION_TONE[h.action] || 'neutral', h.action)}</td>
    <td class="ink-300">${esc(h.actor)}</td>
    <td class="ink-500" style="max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(h.comment || '—')}</td>
    <td class="right ink-500">${Format.relativeDate(h.timestamp)}</td>
  </tr>`).join('') : `<tr class="empty-row"><td colspan="6">No approval actions recorded yet.</td></tr>`;

  return panel('Approval history', `<div class="scroll-max"><table class="data-table">
    <thead><tr><th>PR Number</th><th>Level</th><th>Action</th><th>Actor</th><th>Comment</th><th class="right">When</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`);
};

// ── Module 5: Budget Verification ────────────────────────────
Render.budgetOverviewScreen = function (d) {
  const rows = Selectors.budgetOverview(d);
  const body = rows.map((b) => {
    const overCommitted = b.usedPct + b.reservedPct > 100;
    return `<tr>
      <td class="ink-100">${esc(b.department)}</td>
      <td class="ink-500 tabular">${esc(b.costCenter)}</td>
      <td class="ink-500 tabular">${esc(b.glAccount)}</td>
      <td class="ink-500 tabular">${esc(b.projectCode)}</td>
      <td class="right tabular ink-100">${Format.inr(b.allocated)}</td>
      <td class="right tabular" style="color:var(--amber)">${Format.inr(b.reserved)}</td>
      <td class="right tabular" style="color:var(--teal)">${Format.inr(b.used)}</td>
      <td class="right tabular" style="color:${overCommitted ? 'var(--red)' : 'var(--green)'}">${Format.inr(b.balance)}</td>
    </tr>`;
  }).join('');

  return panel('Budget overview — all departments', `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>Department</th><th>Cost Center</th><th>GL Account</th><th>Project Code</th><th class="right">Allocated</th><th class="right">Reserved</th><th class="right">Used</th><th class="right">Balance</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`);
};

Render.budgetValidateScreen = function (d, filter, openDrawerId) {
  const filters = ['All', 'Sufficient', 'Insufficient', 'Overridden'];
  const counts = Selectors.budgetCheckCounts(d);
  const rows = Selectors.budgetCheckQueue(d, filter);
  const BC_TONE = { Sufficient: 'green', Insufficient: 'red', Overridden: 'amber' };

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? Selectors.budgetCheckQueue(d, 'All').length : (counts[f] || 0);
    return `<button class="filter-chip ${filter === f || (!filter && f === 'All') ? 'active' : ''}" data-action="filter-budget-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((pr) => {
    const bc = pr.budgetCheck;
    const isOpen = openDrawerId === pr.id;
    const drawer = isOpen ? `
      <tr class="drawer-row">
        <td colspan="7">
          <div class="drawer">
            <div class="form-grid" style="padding:0 0 14px">
              <div class="field"><label>Cost Center</label><input class="cell-input" disabled value="${esc(bc.costCenter)}" /></div>
              <div class="field"><label>GL Account</label><input class="cell-input" disabled value="${esc(bc.glAccount)}" /></div>
              <div class="field"><label>Project Code</label><input class="cell-input" disabled value="${esc(bc.projectCode)}" /></div>
              <div class="field"><label>Budget Available</label><input class="cell-input tabular" disabled value="${Format.inr(bc.available)}" /></div>
              <div class="field"><label>Requested Amount</label><input class="cell-input tabular" disabled value="${Format.inr(bc.requested)}" /></div>
              <div class="field"><label>Budget Sufficient?</label><input class="cell-input" disabled value="${bc.status === 'Insufficient' ? 'NO' : 'YES'}" style="color:${bc.status === 'Insufficient' ? 'var(--red)' : 'var(--green)'};font-weight:600" /></div>
            </div>
            <div class="drawer-grid">
              <div class="field"><label>Comment</label><textarea id="drawer-comment" class="cell-input" rows="2" placeholder="Validation notes"></textarea></div>
              <div class="field"><label>Digital Signature</label><input id="drawer-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
            </div>
            <div class="drawer-actions">
              <button type="button" class="btn btn-ghost" data-action="close-budget-drawer">Cancel</button>
              ${bc.status === 'Insufficient' ? `
                <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="budget-reject" data-id="${pr.id}">NO — Reject PR</button>
                <button type="button" class="btn btn-primary" data-action="budget-override" data-id="${pr.id}">Override & Allow</button>
              ` : `
                <button type="button" class="btn btn-outline" data-action="budget-revalidate" data-id="${pr.id}">Re-validate</button>
                <button type="button" class="btn btn-primary" data-action="budget-continue" data-id="${pr.id}">YES — Continue</button>
              `}
            </div>
          </div>
        </td>
      </tr>` : '';

    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(pr.prNumber)}</td>
      <td class="ink-300">${esc(pr.department)}</td>
      <td class="ink-500 tabular">${esc(bc.costCenter)}</td>
      <td class="right tabular ink-100">${Format.inr(bc.requested)}</td>
      <td class="right tabular" style="color:${bc.status === 'Insufficient' ? 'var(--red)' : 'var(--ink-300)'}">${Format.inr(bc.available)}</td>
      <td>${badge(BC_TONE[bc.status] || 'neutral', bc.status)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-budget-drawer" data-id="${pr.id}">${isOpen ? 'Close' : 'Validate'}</button></td>
    </tr>${drawer}`;
  }).join('') : `<tr class="empty-row"><td colspan="7">No submitted PRs match this filter.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Validate purchase requisitions against budget', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>PR Number</th><th>Department</th><th>Cost Center</th><th class="right">Requested</th><th class="right">Available</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

// ── Module 6: Vendor Management ──────────────────────────────
const VENDOR_STATUS_TONE = { Draft: 'neutral', Pending: 'amber', Approved: 'green', Rejected: 'red', Blacklisted: 'red' };

Render.vendorProfile = function (v) {
  const contactRows = v.contacts.map((c) => `<tr>
    <td class="ink-100">${esc(c.name)}</td><td class="ink-500">${esc(c.designation)}</td>
    <td class="ink-500 tabular">${esc(c.phone)}</td><td class="ink-500">${esc(c.email)}</td>
  </tr>`).join('') || `<tr class="empty-row"><td colspan="4">No contact persons on file.</td></tr>`;

  const reviewRows = v.performanceReviews.map((r) => `<tr>
    <td class="ink-500">${Format.relativeDate(r.date)}</td>
    <td class="right tabular" style="color:var(--amber)">★ ${r.ratingGiven}</td>
    <td class="right tabular ink-300">${r.qualityScore}</td>
    <td class="right">${badge(r.onTime ? 'green' : 'red', r.onTime ? 'On Time' : 'Delayed')}</td>
    <td class="ink-500" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.notes || '—')}</td>
    <td class="ink-500">${esc(r.reviewer)}</td>
  </tr>`).join('') || `<tr class="empty-row"><td colspan="6">No performance reviews logged yet — add one below as POs are fulfilled.</td></tr>`;

  const activityRows = (v.activityLog || []).map((a) => `<tr>
    <td class="ink-500">${Format.relativeDate(a.timestamp)}</td>
    <td class="ink-100">${esc(a.action)}</td>
    <td class="ink-300">${esc(a.actor)}</td>
    <td class="ink-500">${esc(a.comment || '—')}</td>
  </tr>`).join('') || `<tr class="empty-row"><td colspan="4">No activity recorded yet.</td></tr>`;

  const canBlacklist = v.approvalStatus === 'Approved';
  const canReinstate = v.approvalStatus === 'Blacklisted';

  return `
    <div class="vendor-profile">
      <div class="vendor-profile-grid">
        <div class="vp-block">
          <div class="vp-block-title">Documents</div>
          <div class="vp-row"><span>GST</span><span class="tabular">${esc(v.gst)}</span></div>
          <div class="vp-row"><span>PAN</span><span class="tabular">${esc(v.pan || '—')}</span></div>
          <div class="vp-row"><span>Trade License</span><span class="tabular">${esc(v.tradeLicense || '—')}</span></div>
          <div class="vp-row"><span>Registered</span><span>${Format.relativeDate(v.registrationDate)}</span></div>
        </div>
        <div class="vp-block">
          <div class="vp-block-title">Bank Details</div>
          <div class="vp-row"><span>Account Holder</span><span>${esc(v.bankDetails.accountHolder)}</span></div>
          <div class="vp-row"><span>Account No.</span><span class="tabular">•••• ${esc(String(v.bankDetails.accountNumber).slice(-4))}</span></div>
          <div class="vp-row"><span>IFSC</span><span class="tabular">${esc(v.bankDetails.ifsc)}</span></div>
          <div class="vp-row"><span>Bank</span><span>${esc(v.bankDetails.bankName)}, ${esc(v.bankDetails.branch)}</span></div>
        </div>
        <div class="vp-block">
          <div class="vp-block-title">Performance snapshot</div>
          <div class="vp-row"><span>Rating</span><span class="tabular" style="color:var(--amber)">★ ${v.rating || '—'}</span></div>
          <div class="vp-row"><span>On-Time Delivery</span><span class="tabular">${v.onTimeDeliveryPct || 0}%</span></div>
          <div class="vp-row"><span>Quality Score</span><span class="tabular">${v.qualityScore || 0}</span></div>
          <div class="vp-row"><span>Active POs / Spend YTD</span><span class="tabular">${v.activePOs} / ${Format.inr(v.totalSpendYtd, true)}</span></div>
        </div>
      </div>

      <div class="vp-block" style="margin-top:12px">
        <div class="vp-block-title">Contact persons</div>
        <table class="data-table"><thead><tr><th>Name</th><th>Designation</th><th>Phone</th><th>Email</th></tr></thead><tbody>${contactRows}</tbody></table>
      </div>

      <div class="vp-block" style="margin-top:12px">
        <div class="vp-block-title">Performance reviews</div>
        <table class="data-table"><thead><tr><th>Date</th><th class="right">Rating</th><th class="right">Quality</th><th>Delivery</th><th>Notes</th><th>Reviewer</th></tr></thead><tbody>${reviewRows}</tbody></table>
        <div class="drawer-grid" style="padding:12px 14px 0">
          <div class="field"><label>Rating (1-5)</label><input id="review-rating" type="number" min="1" max="5" class="cell-input" placeholder="5" /></div>
          <div class="field"><label>Quality score (0-100)</label><input id="review-quality" type="number" min="0" max="100" class="cell-input" placeholder="90" /></div>
          <div class="field"><label>Delivery</label><select id="review-ontime" class="cell-input"><option value="true">On Time</option><option value="false">Delayed</option></select></div>
        </div>
        <div class="drawer-grid" style="padding:12px 14px">
          <div class="field" style="grid-column:1/-1"><label>Notes</label><input id="review-notes" class="cell-input" placeholder="What was delivered / observed" /></div>
        </div>
        <div class="drawer-actions" style="padding:0 14px 14px">
          <button type="button" class="btn btn-primary" data-action="add-vendor-review" data-id="${v.id}">Add Review</button>
        </div>
      </div>

      <div class="vp-block" style="margin-top:12px">
        <div class="vp-block-title">Vendor activity log</div>
        <table class="data-table"><thead><tr><th>When</th><th>Action</th><th>Actor</th><th>Comment</th></tr></thead><tbody>${activityRows}</tbody></table>
      </div>

      ${(canBlacklist || canReinstate) ? `
        <div class="vp-block" style="margin-top:12px">
          <div class="vp-block-title">${canBlacklist ? 'Blacklist this vendor' : 'Reinstate this vendor'}</div>
          ${v.blacklistReason ? `<div class="drawer-banner" style="margin:0 14px 12px">${Icon.alertTriangle(13)} Currently blacklisted: ${esc(v.blacklistReason)}</div>` : ''}
          <div class="drawer-grid" style="padding:0 14px 12px">
            <div class="field"><label>Comment / Reason</label><textarea id="vendor-action-comment" class="cell-input" rows="2" placeholder="${canBlacklist ? 'Why is this vendor being blacklisted?' : 'Why is this vendor being reinstated?'}"></textarea></div>
            <div class="field"><label>Digital Signature</label><input id="vendor-action-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
          </div>
          <div class="drawer-actions" style="padding:0 14px 14px">
            ${canBlacklist ? `<button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="blacklist-vendor" data-id="${v.id}">Blacklist Vendor</button>` : ''}
            ${canReinstate ? `<button type="button" class="btn btn-primary" data-action="reinstate-vendor" data-id="${v.id}">Reinstate Vendor</button>` : ''}
          </div>
        </div>` : ''}
    </div>`;
};

Render.vendorDirectoryScreen = function (d, categoryFilter, statusFilter, openDrawerId) {
  const categories = ['All', 'Domestic', 'International', 'Manufacturer', 'Distributor', 'Service Provider'];
  const statuses = ['All', 'Draft', 'Pending', 'Approved', 'Rejected', 'Blacklisted'];
  const rows = Selectors.vendorDirectory(d, categoryFilter, statusFilter);

  const catBar = categories.map((c) => `<button class="filter-chip ${(!categoryFilter && c === 'All') || categoryFilter === c ? 'active' : ''}" data-action="filter-vendor-category" data-filter="${c}">${c}</button>`).join('');
  const statusBar = statuses.map((s) => `<button class="filter-chip ${(!statusFilter && s === 'All') || statusFilter === s ? 'active' : ''}" data-action="filter-vendor-status" data-filter="${s}">${s}</button>`).join('');

  const body = rows.length ? rows.map((v) => {
    const isOpen = openDrawerId === v.id;
    return `<tr class="vendor-row ${isOpen ? 'row-open' : ''}" data-vendor-name="${esc(v.name.toLowerCase())}">
      <td class="ink-100">${esc(v.name)}</td>
      <td class="ink-500">${esc(v.category)}</td>
      <td class="ink-500">${esc(v.city || '—')}</td>
      <td class="right tabular" style="color:var(--amber)">${v.rating ? '★ ' + v.rating : '—'}</td>
      <td class="right tabular ink-300">${v.onTimeDeliveryPct || 0}%</td>
      <td class="right tabular ink-100">${Format.inr(v.totalSpendYtd, true)}</td>
      <td>${badge(VENDOR_STATUS_TONE[v.approvalStatus] || 'neutral', v.approvalStatus)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-vendor-drawer" data-id="${v.id}">${isOpen ? 'Close' : 'View profile'}</button></td>
    </tr>${isOpen ? `<tr class="drawer-row"><td colspan="8">${Render.vendorProfile(v)}</td></tr>` : ''}`;
  }).join('') : `<tr class="empty-row"><td colspan="8">No vendors match this filter.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:10px">
    <div class="search-wrap" style="max-width:320px">
      ${Icon.search(14)}
      <input id="vendor-search-input" placeholder="Search vendor by name…" autocomplete="off" />
    </div>
    <div class="filter-bar">${catBar}</div>
    <div class="filter-bar">${statusBar}</div>
    ${panel('Vendor master', `<div style="overflow-x:auto"><table class="data-table" id="vendor-directory-table">
      <thead><tr><th>Vendor</th><th>Category</th><th>City</th><th class="right">Rating</th><th class="right">On-Time</th><th class="right">Spend YTD</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`, badge('neutral', rows.length + ' vendors'))}
  </div>`;
};

Render.vendorRegisterScreen = function (contacts) {
  const categoryOptions = VENDOR_CATS;
  const cityOptions = ['Chennai', 'Coimbatore', 'Bengaluru', 'Mumbai', 'Pune', 'Hyderabad'];

  const contactRows = contacts.map((c, idx) => `
    <tr data-row-index="${idx}">
      <td><input class="cell-input" data-field="name" value="${esc(c.name)}" placeholder="Contact name" /></td>
      <td><input class="cell-input" data-field="designation" value="${esc(c.designation)}" placeholder="Designation" /></td>
      <td><input class="cell-input" data-field="phone" value="${esc(c.phone)}" placeholder="+91 90000 00000" /></td>
      <td><input class="cell-input" data-field="email" value="${esc(c.email)}" placeholder="name@example.com" /></td>
      <td class="right"><button class="icon-btn reject" data-action="remove-vendor-contact-row" data-index="${idx}" ${contacts.length === 1 ? 'disabled style="opacity:.3"' : ''}>${Icon.x(12)}</button></td>
    </tr>`).join('');

  return `
    <form id="vendor-register-form">
      ${panel('Basic information', `
        <div class="form-grid">
          <div class="field"><label>Vendor Name</label><input id="vf-name" class="cell-input" placeholder="Company name" /></div>
          <div class="field"><label>Category</label><select id="vf-category" class="cell-input">${categoryOptions.map((o) => `<option>${o}</option>`).join('')}</select></div>
          <div class="field"><label>City</label><select id="vf-city" class="cell-input">${cityOptions.map((o) => `<option>${o}</option>`).join('')}</select></div>
        </div>
      `)}

      ${panel('Documents', `
        <div class="form-grid">
          <div class="field"><label>GST Number</label><input id="vf-gst" class="cell-input" placeholder="29AAAAA0000A1Z5" /></div>
          <div class="field"><label>PAN Number</label><input id="vf-pan" class="cell-input" placeholder="AAAAA0000A" /></div>
          <div class="field"><label>Trade License No.</label><input id="vf-tradeLicense" class="cell-input" placeholder="TL-CHE-12345" /></div>
        </div>
      `)}

      ${panel('Bank details', `
        <div class="form-grid">
          <div class="field"><label>Account Holder</label><input id="vf-accountHolder" class="cell-input" placeholder="As per bank records" /></div>
          <div class="field"><label>Account Number</label><input id="vf-accountNumber" class="cell-input tabular" placeholder="000000000000" /></div>
          <div class="field"><label>IFSC Code</label><input id="vf-ifsc" class="cell-input tabular" placeholder="HDFC0000123" /></div>
          <div class="field"><label>Bank Name</label><input id="vf-bankName" class="cell-input" placeholder="HDFC Bank" /></div>
          <div class="field"><label>Branch</label><input id="vf-branch" class="cell-input" placeholder="Branch name" /></div>
        </div>
      `)}

      ${panel('Contact persons', `
        <div style="overflow-x:auto">
          <table class="data-table" id="vendor-contact-grid">
            <thead><tr><th>Name</th><th>Designation</th><th>Phone</th><th>Email</th><th class="right"></th></tr></thead>
            <tbody>${contactRows}</tbody>
          </table>
        </div>
        <div style="padding:10px 14px"><button type="button" class="link-btn" data-action="add-vendor-contact-row">+ Add contact person</button></div>
      `)}

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel-vendor-form">Cancel</button>
        <button type="button" class="btn btn-outline" data-action="save-vendor-draft">Save Draft</button>
        <button type="button" class="btn btn-primary" data-action="submit-vendor">Submit for Approval</button>
      </div>
    </form>`;
};

Render.vendorApprovalsScreen = function (d, openDrawerId) {
  const rows = Selectors.vendorApprovalQueue(d);
  const body = rows.length ? rows.map((v) => {
    const isOpen = openDrawerId === v.id;
    const drawer = isOpen ? `
      <tr class="drawer-row">
        <td colspan="5">
          <div class="drawer">
            <div class="drawer-grid">
              <div class="field"><label>Comment</label><textarea id="drawer-comment" class="cell-input" rows="2" placeholder="Notes for this decision"></textarea></div>
              <div class="field"><label>Digital Signature</label><input id="drawer-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
            </div>
            <div class="drawer-actions">
              <button type="button" class="btn btn-ghost" data-action="close-vendor-drawer">Cancel</button>
              <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="reject-vendor" data-id="${v.id}">Reject</button>
              <button type="button" class="btn btn-primary" data-action="approve-vendor" data-id="${v.id}">Approve</button>
            </div>
          </div>
        </td>
      </tr>` : '';
    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(v.name)}</td>
      <td class="ink-500">${esc(v.category)}</td>
      <td class="ink-500">${esc(v.city || '—')}</td>
      <td class="ink-500">${Format.relativeDate(v.registrationDate)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-vendor-approval-drawer" data-id="${v.id}">${isOpen ? 'Close' : 'Review'}</button></td>
    </tr>${drawer}`;
  }).join('') : `<tr class="empty-row"><td colspan="5">No vendor registrations waiting on approval.</td></tr>`;

  return panel('Pending vendor approvals', `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>Vendor</th><th>Category</th><th>City</th><th>Registered</th><th class="right">Action</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`, badge('amber', rows.length + ' pending'));
};

// ── Module 7: Request for Quotation ──────────────────────────
const RFQ_STATUS_TONE = { Draft: 'neutral', Issued: 'cyan', Closed: 'teal', Cancelled: 'red' };

Render.buildRfqPrintableHtml = function (d, rfq) {
  const pr = rfq.linkedPrId ? d.prs.find((p) => p.id === rfq.linkedPrId) : null;
  const vendors = rfq.vendorIds.map((id) => d.vendors.find((v) => v.id === id)).filter(Boolean);
  const itemRows = rfq.items.map((it) => `<tr><td>${esc(it.materialCode)}</td><td>${esc(it.description)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td></tr>`).join('');
  const vendorRows = vendors.map((v) => `<tr><td>${esc(v.name)}</td><td>${esc(v.category)}</td><td>${esc(v.contacts[0] ? v.contacts[0].email : '—')}</td></tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${esc(rfq.rfqNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 32px; color: #111; }
      h1 { font-size: 18px; margin-bottom: 4px; } h2 { font-size: 13px; color: #555; margin-top: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; text-align: left; }
      .meta { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; font-size: 12px; margin-top: 8px; }
      .meta div span { color: #777; display: block; font-size: 10px; text-transform: uppercase; }
    </style></head><body>
    <h1>Request for Quotation — ${esc(rfq.rfqNumber)}</h1>
    <div class="meta">
      <div><span>Issue Date</span>${esc(rfq.issueDate)}</div>
      <div><span>Closing Date</span>${esc(rfq.closingDate)}</div>
      <div><span>Buyer</span>${esc(rfq.buyer)}</div>
      <div><span>Delivery Terms</span>${esc(rfq.deliveryTerms)}</div>
      <div><span>Payment Terms</span>${esc(rfq.paymentTerms)}</div>
      <div><span>Incoterms</span>${esc(rfq.incoterms)}</div>
      ${pr ? `<div><span>Source PR</span>${esc(pr.prNumber)}</div>` : ''}
      <div><span>Status</span>${esc(rfq.status)}</div>
    </div>
    <h2>Items requested</h2>
    <table><thead><tr><th>Material Code</th><th>Description</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${itemRows}</tbody></table>
    <h2>Vendors invited</h2>
    <table><thead><tr><th>Vendor</th><th>Category</th><th>Contact Email</th></tr></thead><tbody>${vendorRows}</tbody></table>
  </body></html>`;
};

Render.rfqDetail = function (d, rfq) {
  const pr = rfq.linkedPrId ? d.prs.find((p) => p.id === rfq.linkedPrId) : null;
  const vendors = rfq.vendorIds.map((id) => d.vendors.find((v) => v.id === id)).filter(Boolean);
  const closingSoon = Selectors.isRfqClosingSoon(rfq);

  const vendorRows = vendors.map((v) => `<tr>
    <td class="ink-100">${esc(v.name)}</td><td class="ink-500">${esc(v.category)}</td>
    <td class="ink-500 tabular">${v.rating ? '★ ' + v.rating : '—'}</td>
    <td class="ink-500">${esc(v.contacts[0] ? v.contacts[0].email : '—')}</td>
  </tr>`).join('') || `<tr class="empty-row"><td colspan="4">No vendors selected.</td></tr>`;

  const itemRows = rfq.items.map((it) => `<tr>
    <td class="ink-100">${esc(it.materialCode)}</td><td class="ink-500">${esc(it.description)}</td>
    <td class="right tabular ink-300">${it.qty}</td><td class="ink-500">${esc(it.unit)}</td>
  </tr>`).join('');

  const actions = [];
  if (rfq.status === 'Draft') {
    actions.push(`<button type="button" class="btn btn-primary" data-action="issue-rfq" data-id="${rfq.id}">Issue RFQ</button>`);
    actions.push(`<button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="cancel-rfq" data-id="${rfq.id}">Cancel RFQ</button>`);
  } else if (rfq.status === 'Issued') {
    actions.push(`<button type="button" class="btn btn-outline" data-action="email-rfq" data-id="${rfq.id}">Email RFQ</button>`);
    actions.push(`<button type="button" class="btn btn-outline" data-action="print-rfq" data-id="${rfq.id}">Print / Download PDF</button>`);
    actions.push(`<button type="button" class="btn btn-outline" data-action="close-rfq" data-id="${rfq.id}">Close RFQ</button>`);
    actions.push(`<button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="cancel-rfq" data-id="${rfq.id}">Cancel RFQ</button>`);
  } else {
    actions.push(`<button type="button" class="btn btn-outline" data-action="print-rfq" data-id="${rfq.id}">Print / Download PDF</button>`);
  }
  actions.push(`<button type="button" class="btn btn-outline" data-action="duplicate-rfq" data-id="${rfq.id}">Duplicate RFQ</button>`);

  return `
    <div class="vendor-profile">
      ${closingSoon ? `<div class="drawer-banner" style="background:rgba(180,83,9,.08);border-color:rgba(180,83,9,.3);color:var(--amber)">${Icon.alertTriangle(13)} Closing within 3 days (${esc(rfq.closingDate)}) — ${rfq.quotationsReceived}/${vendors.length} quotations received so far.</div>` : ''}
      <div class="vendor-profile-grid">
        <div class="vp-block">
          <div class="vp-block-title">Terms</div>
          <div class="vp-row"><span>Issue Date</span><span>${esc(rfq.issueDate)}</span></div>
          <div class="vp-row"><span>Closing Date</span><span>${esc(rfq.closingDate)}</span></div>
          <div class="vp-row"><span>Buyer</span><span>${esc(rfq.buyer)}</span></div>
          <div class="vp-row"><span>Delivery Terms</span><span>${esc(rfq.deliveryTerms)}</span></div>
          <div class="vp-row"><span>Payment Terms</span><span>${esc(rfq.paymentTerms)}</span></div>
          <div class="vp-row"><span>Incoterms</span><span>${esc(rfq.incoterms)}</span></div>
        </div>
        <div class="vp-block">
          <div class="vp-block-title">Source</div>
          ${pr ? `
            <div class="vp-row"><span>Purchase Requisition</span><span>${esc(pr.prNumber)}</span></div>
            <div class="vp-row"><span>Department</span><span>${esc(pr.department)}</span></div>
            <div class="vp-row"><span>PR Value</span><span class="tabular">${Format.inr(pr.estimatedValue)}</span></div>
          ` : `<div class="vp-row"><span>Purchase Requisition</span><span>— (duplicated, not linked)</span></div>`}
        </div>
        <div class="vp-block">
          <div class="vp-block-title">Response status</div>
          <div class="vp-row"><span>Vendors invited</span><span class="tabular">${vendors.length}</span></div>
          <div class="vp-row"><span>Quotations received</span><span class="tabular">${rfq.quotationsReceived}</span></div>
          <div class="vp-row"><span>Status</span><span>${rfq.status}</span></div>
        </div>
      </div>

      <div class="vp-block" style="margin-top:12px">
        <div class="vp-block-title">Items requested</div>
        <table class="data-table"><thead><tr><th>Material Code</th><th>Description</th><th class="right">Qty</th><th>Unit</th></tr></thead><tbody>${itemRows}</tbody></table>
      </div>

      <div class="vp-block" style="margin-top:12px">
        <div class="vp-block-title">Vendors invited</div>
        <table class="data-table"><thead><tr><th>Vendor</th><th>Category</th><th class="right">Rating</th><th>Contact Email</th></tr></thead><tbody>${vendorRows}</tbody></table>
      </div>

      <div class="drawer-actions" style="padding:14px 0 0">${actions.join('')}</div>
    </div>`;
};

Render.rfqListScreen = function (d, filter, openDrawerId) {
  const filters = ['All', 'Draft', 'Issued', 'Closed', 'Cancelled'];
  const counts = Selectors.rfqCounts(d);
  const rows = Selectors.rfqList(d, filter);

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? d.rfqs.length : (counts[f] || 0);
    return `<button class="filter-chip ${filter === f || (!filter && f === 'All') ? 'active' : ''}" data-action="filter-rfq-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((rfq) => {
    const isOpen = openDrawerId === rfq.id;
    const pr = rfq.linkedPrId ? d.prs.find((p) => p.id === rfq.linkedPrId) : null;
    const closingSoon = Selectors.isRfqClosingSoon(rfq);
    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(rfq.rfqNumber)}</td>
      <td class="ink-500">${esc(pr ? pr.prNumber : '—')}</td>
      <td class="ink-500">${esc(rfq.buyer)}</td>
      <td class="ink-300 tabular">${rfq.vendorIds.length}</td>
      <td class="ink-500">${Format.relativeDate(rfq.closingDate)}${closingSoon ? ` ${badge('amber', 'Closing soon')}` : ''}</td>
      <td>${badge(RFQ_STATUS_TONE[rfq.status] || 'neutral', rfq.status)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-rfq-drawer" data-id="${rfq.id}">${isOpen ? 'Close' : 'View'}</button></td>
    </tr>${isOpen ? `<tr class="drawer-row"><td colspan="7">${Render.rfqDetail(d, rfq)}</td></tr>` : ''}`;
  }).join('') : `<tr class="empty-row"><td colspan="7">No RFQs match this filter.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:10px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Requests for Quotation', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>RFQ Number</th><th>Source PR</th><th>Buyer</th><th>Vendors</th><th>Closing</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

Render.rfqCreateScreen = function (d, form) {
  const eligiblePrs = Selectors.eligiblePRsForRFQ(d);
  const eligibleVendors = Selectors.eligibleVendorsForRFQ(d);

  if (eligiblePrs.length === 0) {
    return panel('Create RFQ', `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">
      No Approved Purchase Requisitions are available to raise an RFQ against.<br/>
      Get a PR fully approved in <button class="link-btn" data-action="goto-module-pr">Purchase Requisition (Module 3)</button> first.
    </div>`);
  }

  const prOptions = eligiblePrs.map((pr) => `<option value="${pr.id}" ${form.prId === pr.id ? 'selected' : ''}>${esc(pr.prNumber)} — ${esc(pr.department)} — ${Format.inr(pr.estimatedValue, true)}</option>`).join('');
  const selectedPr = eligiblePrs.find((pr) => pr.id === form.prId) || eligiblePrs[0];

  const vendorChecks = eligibleVendors.map((v) => `
    <label class="vendor-check">
      <input type="checkbox" value="${v.id}" data-vendor-checkbox ${form.vendorIds.includes(v.id) ? 'checked' : ''} />
      <span>${esc(v.name)}</span>
      <span class="vendor-check-meta">${esc(v.category)} · ★ ${v.rating || '—'}</span>
    </label>`).join('') || `<div style="padding:12px;color:var(--ink-500);font-size:12px">No Approved vendors available — approve one in Module 6 first.</div>`;

  const itemRows = selectedPr ? selectedPr.items.map((it) => `<tr>
    <td class="ink-100">${esc(it.materialCode)}</td><td class="ink-500">${esc(it.description)}</td>
    <td class="right tabular ink-300">${it.qty}</td><td class="ink-500">${esc(it.unit)}</td>
  </tr>`).join('') : '';

  return `
    <form id="rfq-create-form">
      ${panel('Source purchase requisition', `
        <div class="form-grid">
          <div class="field" style="grid-column:1/-1"><label>Approved PR</label><select id="rf-prId" class="cell-input">${prOptions}</select></div>
        </div>
        <div style="padding:0 14px 14px">
          <table class="data-table"><thead><tr><th>Material Code</th><th>Description</th><th class="right">Qty</th><th>Unit</th></tr></thead><tbody>${itemRows}</tbody></table>
        </div>
      `)}

      ${panel('RFQ terms', `
        <div class="form-grid">
          <div class="field"><label>Issue Date</label><input type="date" id="rf-issueDate" class="cell-input" value="${new Date().toISOString().slice(0, 10)}" /></div>
          <div class="field"><label>Closing Date</label><input type="date" id="rf-closingDate" class="cell-input" /></div>
          <div class="field"><label>Buyer</label><input id="rf-buyer" class="cell-input" value="Priya Nair" /></div>
          <div class="field"><label>Delivery Terms</label><select id="rf-deliveryTerms" class="cell-input">${['Ex-Works', 'Door Delivery', 'FOB Port', 'CIF Destination'].map((o) => `<option>${o}</option>`).join('')}</select></div>
          <div class="field"><label>Payment Terms</label><select id="rf-paymentTerms" class="cell-input">${['Net 30', 'Net 45', 'Net 60', 'Advance 20%'].map((o) => `<option>${o}</option>`).join('')}</select></div>
          <div class="field"><label>Incoterms</label><select id="rf-incoterms" class="cell-input">${['EXW', 'FOB', 'CIF', 'DAP'].map((o) => `<option>${o}</option>`).join('')}</select></div>
        </div>
      `)}

      ${panel('Vendor list', `<div class="vendor-check-grid">${vendorChecks}</div>`, `<span class="badge tone-neutral" id="vendor-selected-count">${form.vendorIds.length} selected</span>`)}

      <div class="form-actions">
        <button type="button" class="btn btn-ghost" data-action="cancel-rfq-form">Cancel</button>
        <button type="button" class="btn btn-outline" data-action="save-rfq-draft">Save Draft</button>
        <button type="button" class="btn btn-primary" data-action="issue-rfq-form">Issue RFQ</button>
      </div>
    </form>`;
};

// ── Module 8: Quotation Management ───────────────────────────
const QUOTATION_STATUS_TONE = { Pending: 'neutral', Received: 'cyan', Rejected: 'red', Accepted: 'green' };

Render.quotationDrawer = function (row) {
  const { q, rfq, vendor } = row;
  const isNew = q.status === 'Pending';
  const actions = [];
  if (q.status === 'Pending' || q.status === 'Received') {
    actions.push(`<button type="button" class="btn btn-primary" data-action="submit-quotation" data-id="${q.id}">${isNew ? 'Submit Quotation' : 'Update Quotation'}</button>`);
  }
  if (q.status === 'Received') {
    actions.push(`<button type="button" class="btn btn-outline" style="border-color:var(--green);color:var(--green)" data-action="accept-quotation" data-id="${q.id}">Accept</button>`);
  }
  if (q.status !== 'Rejected') {
    actions.push(`<button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="reject-quotation" data-id="${q.id}">Reject</button>`);
  }

  return `
    <div class="vendor-profile">
      <div class="vendor-profile-grid">
        <div class="vp-block">
          <div class="vp-block-title">Vendor & RFQ</div>
          <div class="vp-row"><span>Vendor</span><span>${esc(vendor ? vendor.name : '—')}</span></div>
          <div class="vp-row"><span>RFQ</span><span>${esc(rfq ? rfq.rfqNumber : '—')}</span></div>
          <div class="vp-row"><span>Closing Date</span><span>${esc(rfq ? rfq.closingDate : '—')}</span></div>
          <div class="vp-row"><span>Status</span><span>${q.status}</span></div>
        </div>
        <div class="vp-block">
          <div class="vp-block-title">Upload</div>
          <label class="attach-btn">${Icon.file(12)} Choose file<input type="file" data-quotation-attach style="display:none" /></label>
          <div class="attach-filename" style="margin-top:8px" data-quotation-filename>${esc(q.attachmentName || 'No file selected')}</div>
        </div>
        <div class="vp-block">
          <div class="vp-block-title">Validity</div>
          <div class="field"><label>Validity Date</label><input id="q-validityDate" type="date" class="cell-input" value="${esc(q.validityDate || '')}" /></div>
          <div class="field" style="margin-top:8px"><label>Warranty (months)</label><input id="q-warrantyMonths" type="number" min="0" class="cell-input" value="${q.warrantyMonths || 0}" /></div>
        </div>
      </div>

      <div class="vp-block" style="margin-top:12px">
        <div class="vp-block-title">Commercial terms</div>
        <div class="form-grid">
          <div class="field"><label>Price</label><input id="q-price" type="number" min="0" class="cell-input tabular" value="${q.price || ''}" placeholder="0" /></div>
          <div class="field"><label>Lead Time (days)</label><input id="q-leadTimeDays" type="number" min="0" class="cell-input tabular" value="${q.leadTimeDays || ''}" placeholder="0" /></div>
          <div class="field"><label>Tax</label><input id="q-tax" type="number" min="0" class="cell-input tabular" value="${q.tax || ''}" placeholder="0" /></div>
          <div class="field"><label>Discount</label><input id="q-discount" type="number" min="0" class="cell-input tabular" value="${q.discount || ''}" placeholder="0" /></div>
        </div>
      </div>

      <div class="vp-block" style="margin-top:12px">
        <div class="vp-block-title">Offers</div>
        <div class="drawer-grid">
          <div class="field"><label>Technical Offer</label><textarea id="q-technicalOffer" class="cell-input" rows="3" placeholder="Specs, compliance, technical notes">${esc(q.technicalOffer || '')}</textarea></div>
          <div class="field"><label>Commercial Offer</label><textarea id="q-commercialOffer" class="cell-input" rows="3" placeholder="Pricing basis, terms, notes">${esc(q.commercialOffer || '')}</textarea></div>
        </div>
      </div>

      <div class="drawer-actions" style="padding:14px 0 0">${actions.join('')}</div>
    </div>`;
};

Render.quotationInboxScreen = function (d, filter, openDrawerId) {
  const filters = ['All', 'Pending', 'Received', 'Rejected', 'Accepted'];
  const counts = Selectors.quotationCounts(d);
  const rows = Selectors.quotationInbox(d, filter);

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? Selectors.quotationInbox(d, 'All').length : (counts[f] || 0);
    return `<button class="filter-chip ${filter === f || (!filter && f === 'All') ? 'active' : ''}" data-action="filter-quotation-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((row) => {
    const { q, rfq, vendor } = row;
    const isOpen = openDrawerId === q.id;
    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(rfq ? rfq.rfqNumber : '—')}</td>
      <td class="ink-300">${esc(vendor ? vendor.name : '—')}</td>
      <td class="right tabular ink-100">${q.price ? Format.inr(q.price) : '—'}</td>
      <td class="right tabular ink-500">${q.leadTimeDays || '—'}</td>
      <td>${badge(QUOTATION_STATUS_TONE[q.status] || 'neutral', q.status)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-quotation-drawer" data-id="${q.id}">${isOpen ? 'Close' : (q.status === 'Pending' ? 'Enter Quotation' : 'View / Edit')}</button></td>
    </tr>${isOpen ? `<tr class="drawer-row"><td colspan="6">${Render.quotationDrawer(row)}</td></tr>` : ''}`;
  }).join('') : `<tr class="empty-row"><td colspan="6">No quotations to show for this filter. Issue an RFQ in Module 7 first.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:10px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Receive quotations', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>RFQ Number</th><th>Vendor</th><th class="right">Price</th><th class="right">Lead Time</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

Render.quotationByRfqScreen = function (d) {
  const rows = Selectors.rfqQuotationSummary(d);
  const body = rows.length ? rows.map((r) => `<tr>
    <td class="ink-100">${esc(r.rfq.rfqNumber)}</td>
    <td>${badge(RFQ_STATUS_TONE[r.rfq.status] || 'neutral', r.rfq.status)}</td>
    <td class="right tabular ink-300">${r.invited}</td>
    <td class="right tabular ink-100">${r.received}</td>
    <td class="right tabular" style="color:var(--green)">${r.lowestPrice !== null ? Format.inr(r.lowestPrice) : '—'}</td>
    <td class="right tabular ink-500">${r.avgLeadTime !== null ? r.avgLeadTime + 'd' : '—'}</td>
  </tr>`).join('') : `<tr class="empty-row"><td colspan="6">No issued RFQs yet.</td></tr>`;

  return panel('Quotation summary by RFQ', `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>RFQ Number</th><th>Status</th><th class="right">Invited</th><th class="right">Received</th><th class="right">Lowest Price</th><th class="right">Avg Lead Time</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`);
};

// ── Module 9: Quotation Comparison ───────────────────────────
Render.comparisonScreen = function (d, selectedRfqId) {
  const eligibleRfqs = Selectors.comparableRFQs(d);

  if (eligibleRfqs.length === 0) {
    return panel('Comparison matrix', `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">
      No RFQs have any Received or Accepted quotations yet.<br/>
      Enter at least one quotation in <button class="link-btn" data-action="goto-module-quotation">Quotation Management (Module 8)</button> first.
    </div>`);
  }

  let rfqId = selectedRfqId || eligibleRfqs[0].id;
  let matrix = Selectors.comparisonMatrix(d, rfqId);
  if (matrix.rows.length === 0) {
    rfqId = eligibleRfqs[0].id;
    matrix = Selectors.comparisonMatrix(d, rfqId);
  }
  const { rfq, rows } = matrix;
  const rec = Selectors.recommendationEngine(rows);

  const rfqOptions = eligibleRfqs.map((r) => `<option value="${r.id}" ${r.id === rfqId ? 'selected' : ''}>${esc(r.rfqNumber)} (${d.quotations.filter((q) => q.rfqId === r.id && (q.status === 'Received' || q.status === 'Accepted')).length} quotes)</option>`).join('');

  const criteriaLabel = (label) => `<td class="ink-500" style="white-space:nowrap;font-size:11px;text-transform:uppercase;letter-spacing:.03em">${label}</td>`;

  const vendorHeaders = rows.map((r) => `<th style="min-width:150px">${esc(r.vendor.name)}</th>`).join('');
  const priceRow = rows.map((r) => `<td class="right tabular ink-100">${Format.inr(r.q.price)}</td>`).join('');
  const taxRow = rows.map((r) => `<td class="right tabular ink-500">${Format.inr(r.q.tax)}</td>`).join('');
  const discountRow = rows.map((r) => `<td class="right tabular ink-500">-${Format.inr(r.q.discount)}</td>`).join('');
  const netPriceRow = rows.map((r) => `<td class="right tabular" style="color:var(--teal);font-weight:600">${Format.inr(r.netPrice)}</td>`).join('');
  const deliveryRow = rows.map((r) => `<td class="right tabular ink-300">${r.q.leadTimeDays} days</td>`).join('');
  const warrantyRow = rows.map((r) => `<td class="right tabular ink-300">${r.q.warrantyMonths} mo</td>`).join('');
  const paymentRow = rows.map(() => `<td class="right ink-500">${esc(rfq.paymentTerms)}</td>`).join('');
  const ratingRow = rows.map((r) => `<td class="right tabular" style="color:var(--amber)">★ ${r.vendor.rating || '—'}</td>`).join('');
  const performanceRow = rows.map((r) => `<td class="right tabular ink-300">${r.vendor.onTimeDeliveryPct || 0}% on-time</td>`).join('');
  const qualifiedRow = rows.map((r) => {
    const tq = r.q.technicallyQualified;
    return `<td class="right">
      <div style="display:flex;gap:4px;justify-content:flex-end">
        <button class="filter-chip ${tq === true ? 'active' : ''}" style="padding:3px 8px;font-size:11px" data-action="set-tech-qualified" data-id="${r.q.id}" data-value="true">Yes</button>
        <button class="filter-chip ${tq === false ? 'active' : ''}" style="padding:3px 8px;font-size:11px" data-action="set-tech-qualified" data-id="${r.q.id}" data-value="false">No</button>
      </div>
    </td>`;
  }).join('');
  const scoreRow = rows.map((r) => `<td class="right tabular" style="font-size:15px;font-weight:700;color:${r === rec.bestValue ? 'var(--teal)' : 'var(--ink-100)'}">${r.overallScore}</td>`).join('');
  const recommendRow = rows.map((r) => `<td class="right">
    <button class="btn ${r.q.recommended ? 'btn-primary' : 'btn-outline'}" style="padding:4px 10px;font-size:11px" data-action="toggle-recommended" data-id="${r.q.id}">${r.q.recommended ? '★ Recommended' : 'Recommend'}</button>
  </td>`).join('');

  return `<div style="display:flex;flex-direction:column;gap:12px">
    ${panel('Select RFQ to compare', `<div class="form-grid" style="grid-template-columns:1fr"><div class="field"><select id="cmp-rfqId" class="cell-input">${rfqOptions}</select></div></div>`)}

    ${panel('Comparison matrix', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><td></td>${vendorHeaders}</tr></thead>
      <tbody>
        <tr>${criteriaLabel('Price')}${priceRow}</tr>
        <tr>${criteriaLabel('Tax')}${taxRow}</tr>
        <tr>${criteriaLabel('Discount')}${discountRow}</tr>
        <tr style="border-top:2px solid var(--line)">${criteriaLabel('Net Price')}${netPriceRow}</tr>
        <tr>${criteriaLabel('Delivery')}${deliveryRow}</tr>
        <tr>${criteriaLabel('Warranty')}${warrantyRow}</tr>
        <tr>${criteriaLabel('Payment Terms')}${paymentRow}</tr>
        <tr>${criteriaLabel('Rating')}${ratingRow}</tr>
        <tr>${criteriaLabel('Past Performance')}${performanceRow}</tr>
        <tr>${criteriaLabel('Technically Qualified?')}${qualifiedRow}</tr>
        <tr style="border-top:2px solid var(--line)">${criteriaLabel('Overall Score')}${scoreRow}</tr>
        <tr>${criteriaLabel('')}${recommendRow}</tr>
      </tbody>
    </table></div>`)}

    ${panel('Recommendation engine', `
      <div class="vendor-profile-grid" style="padding:14px">
        <div class="vp-block">
          <div class="vp-block-title">Lowest Cost</div>
          <div style="font-size:15px;color:var(--ink-100)">${esc(rec.lowestCost.vendor.name)}</div>
          <div style="font-size:12px;color:var(--ink-500);margin-top:4px">${Format.inr(rec.lowestCost.netPrice)} net</div>
        </div>
        <div class="vp-block">
          <div class="vp-block-title">Best Value (highest score)</div>
          <div style="font-size:15px;color:var(--teal)">${esc(rec.bestValue.vendor.name)}</div>
          <div style="font-size:12px;color:var(--ink-500);margin-top:4px">Score ${rec.bestValue.overallScore}/100</div>
        </div>
        <div class="vp-block">
          <div class="vp-block-title">Technically Qualified</div>
          ${rec.technicallyQualified.length
            ? rec.technicallyQualified.map((r) => `<div style="font-size:13px;color:var(--ink-100)">${esc(r.vendor.name)}</div>`).join('')
            : `<div style="font-size:12px;color:var(--ink-700)">None marked yet — use the Yes/No toggles above</div>`}
        </div>
      </div>
    `)}
  </div>`;
};

// ── Module 10: Vendor Selection ──────────────────────────────
const SELECTION_STATUS_TONE = { 'Not Started': 'neutral', 'Under Review': 'amber', Approved: 'cyan', Awarded: 'green' };

Render.buildAwardLetterHtml = function (d, rfq) {
  const vendor = d.vendors.find((v) => v.id === rfq.selection.finalVendorId);
  const pr = rfq.linkedPrId ? d.prs.find((p) => p.id === rfq.linkedPrId) : null;
  const itemRows = rfq.items.map((it) => `<tr><td>${esc(it.materialCode)}</td><td>${esc(it.description)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td></tr>`).join('');

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Award Letter — ${esc(rfq.rfqNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
      h1 { font-size: 18px; margin-bottom: 2px; } .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; text-align: left; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin: 16px 0; }
      .meta div span { color: #777; display: block; font-size: 10px; text-transform: uppercase; }
      .sign { margin-top: 48px; font-size: 12px; }
    </style></head><body>
    <h1>Letter of Award</h1>
    <div class="sub">Reference: ${esc(rfq.rfqNumber)}${pr ? ' · Sourced from ' + esc(pr.prNumber) : ''}</div>
    <p>Dear ${esc(vendor ? vendor.name : 'Vendor')},</p>
    <p>We are pleased to inform you that your quotation has been selected for award following our evaluation process. Please find the award details below.</p>
    <div class="meta">
      <div><span>Awarded Vendor</span>${esc(vendor ? vendor.name : '—')}</div>
      <div><span>Award Date</span>${esc(rfq.selection.awardedDate)}</div>
      <div><span>Final Price</span>${Format.inr(rfq.selection.finalPrice)}</div>
      <div><span>Approved By</span>${esc(rfq.selection.approvedBy)}</div>
      <div><span>Delivery Terms</span>${esc(rfq.deliveryTerms)}</div>
      <div><span>Payment Terms</span>${esc(rfq.paymentTerms)}</div>
    </div>
    <h2 style="font-size:13px">Items awarded</h2>
    <table><thead><tr><th>Material Code</th><th>Description</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${itemRows}</tbody></table>
    <p class="sign">Authorized signatory: ______________________<br/>${esc(rfq.selection.approvedBy)}, Procurement Department</p>
  </body></html>`;
};

Render.selectionScreen = function (d, selectedRfqId) {
  const eligibleRfqs = Selectors.selectableRFQs(d);

  if (eligibleRfqs.length === 0) {
    return panel('Vendor selection', `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">
      No RFQs have any Received or Accepted quotations to select from yet.<br/>
      Enter at least one quotation in <button class="link-btn" data-action="goto-module-quotation">Quotation Management (Module 8)</button> first.
    </div>`);
  }

  let rfqId = selectedRfqId || eligibleRfqs[0].id;
  let matrix = Selectors.comparisonMatrix(d, rfqId);
  if (matrix.rows.length === 0) { rfqId = eligibleRfqs[0].id; matrix = Selectors.comparisonMatrix(d, rfqId); }
  const { rfq, rows } = matrix;
  const rec = Selectors.recommendationEngine(rows);
  const sel = rfq.selection;
  const tally = Selectors.committeeVoteTally(rfq, rows);
  const negotiations = Selectors.negotiationHistory(rfq);

  const rfqOptions = eligibleRfqs.map((r) => `<option value="${r.id}" ${r.id === rfqId ? 'selected' : ''}>${esc(r.rfqNumber)} — ${esc(r.selection.status)}</option>`).join('');

  const vendorOptions = rows.map((r) => `<option value="${r.vendor.id}">${esc(r.vendor.name)} (Score ${r.overallScore})</option>`).join('');

  const reviewRows = sel.committeeReviews.map((rev) => {
    const v = d.vendors.find((x) => x.id === rev.vendorId);
    return `<tr>
      <td class="ink-100">${esc(rev.reviewer)}</td><td class="ink-500">${esc(rev.role)}</td>
      <td class="ink-300">${esc(v ? v.name : '—')}</td>
      <td class="ink-500" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(rev.comment || '—')}</td>
      <td class="right ink-500">${Format.relativeDate(rev.date)}</td>
    </tr>`;
  }).join('') || `<tr class="empty-row"><td colspan="5">No committee reviews submitted yet.</td></tr>`;

  const tallyHtml = tally.map((t) => `
    <div class="hbar-row">
      <div class="hbar-label">${esc(t.vendor.name)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${tally[0].votes ? (t.votes / tally[0].votes) * 100 : 0}%"></div></div>
      <div class="hbar-count">${t.votes}</div>
    </div>`).join('');

  const negoRows = negotiations.map((n) => {
    const v = d.vendors.find((x) => x.id === n.vendorId);
    return `<tr>
      <td class="ink-100">${esc(v ? v.name : '—')}</td>
      <td class="right tabular ink-500">${Format.inr(n.fromPrice)}</td>
      <td class="right tabular" style="color:var(--teal)">${Format.inr(n.toPrice)}</td>
      <td class="ink-500">${esc(n.notes || '—')}</td>
      <td class="ink-500">${esc(n.by)}</td>
      <td class="right ink-500">${Format.relativeDate(n.date)}</td>
    </tr>`;
  }).join('') || `<tr class="empty-row"><td colspan="6">No negotiation rounds logged yet.</td></tr>`;

  const negoVendorOptions = rows.map((r) => `<option value="${r.vendor.id}">${esc(r.vendor.name)} (current: ${Format.inr((d.quotations.find(q => q.rfqId === rfq.id && q.vendorId === r.vendor.id).negotiatedPrice) || r.q.price)})</option>`).join('');

  let awardPanel;
  if (sel.status === 'Awarded') {
    const finalVendor = d.vendors.find((v) => v.id === sel.finalVendorId);
    awardPanel = `
      <div class="drawer-banner" style="background:rgba(22,163,74,.08);border-color:rgba(22,163,74,.3);color:var(--green)">
        ${Icon.check(13)} Awarded to <strong>${esc(finalVendor ? finalVendor.name : '—')}</strong> at ${Format.inr(sel.finalPrice)} on ${esc(sel.awardedDate)}.
      </div>
      <div class="drawer-actions" style="padding:0">
        <button type="button" class="btn btn-primary" data-action="generate-award-letter" data-id="${rfq.id}">Generate Award Letter</button>
      </div>`;
  } else if (sel.status === 'Approved') {
    const approvedVendor = d.vendors.find((v) => v.id === sel.approvedVendorId);
    awardPanel = `
      <div class="drawer-banner" style="background:rgba(2,132,199,.08);border-color:rgba(2,132,199,.3);color:var(--cyan)">
        ${Icon.info(13)} Selection approved for <strong>${esc(approvedVendor ? approvedVendor.name : '—')}</strong> by ${esc(sel.approvedBy)} on ${esc(sel.approvedDate)}.
      </div>
      <div class="drawer-actions" style="padding:0">
        <button type="button" class="btn btn-primary" data-action="award-vendor" data-id="${rfq.id}">Award Final Vendor</button>
      </div>`;
  } else {
    awardPanel = `
      <div class="drawer-grid">
        <div class="field"><label>Vendor to approve</label><select id="award-vendorId" class="cell-input">${vendorOptions}</select></div>
        <div class="field"><label>Comment</label><input id="award-comment" class="cell-input" placeholder="Basis for this decision" /></div>
        <div class="field"><label>Digital Signature</label><input id="award-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
      </div>
      <div class="drawer-actions" style="padding:12px 0 0">
        <button type="button" class="btn btn-primary" data-action="approve-selection" data-id="${rfq.id}" ${sel.committeeReviews.length === 0 ? 'disabled title="Needs at least one committee review first"' : ''}>Approve Selection</button>
      </div>
      ${sel.committeeReviews.length === 0 ? `<div style="font-size:11px;color:var(--ink-700);padding-top:6px">Add at least one Evaluation Committee review below before approving.</div>` : ''}`;
  }

  return `<div style="display:flex;flex-direction:column;gap:12px">
    ${panel('Select RFQ', `<div class="form-grid" style="grid-template-columns:1fr"><div class="field"><select id="sel-rfqId" class="cell-input">${rfqOptions}</select></div></div>`, badge(SELECTION_STATUS_TONE[sel.status] || 'neutral', sel.status))}

    ${panel('Recommendation snapshot (from Module 9)', `
      <div class="vendor-profile-grid" style="padding:14px">
        <div class="vp-block"><div class="vp-block-title">Lowest Cost</div><div style="font-size:14px;color:var(--ink-100)">${esc(rec.lowestCost.vendor.name)}</div><div style="font-size:11px;color:var(--ink-500)">${Format.inr(rec.lowestCost.netPrice)}</div></div>
        <div class="vp-block"><div class="vp-block-title">Best Value</div><div style="font-size:14px;color:var(--teal)">${esc(rec.bestValue.vendor.name)}</div><div style="font-size:11px;color:var(--ink-500)">Score ${rec.bestValue.overallScore}/100</div></div>
        <div class="vp-block"><div class="vp-block-title">Recommended (Module 9)</div>${rows.filter(r => r.q.recommended).map(r => `<div style="font-size:13px;color:var(--ink-100)">${esc(r.vendor.name)}</div>`).join('') || `<div style="font-size:12px;color:var(--ink-700)">None marked</div>`}</div>
      </div>
    `)}

    ${panel('Evaluation committee', `
      <table class="data-table"><thead><tr><th>Reviewer</th><th>Role</th><th>Vendor Picked</th><th>Comment</th><th class="right">Date</th></tr></thead><tbody>${reviewRows}</tbody></table>
      <div style="padding:12px 14px 0"><div class="vp-block-title" style="border:none;padding:0">Vote tally</div>${tallyHtml || '<div style="font-size:12px;color:var(--ink-700);padding:8px 0">No votes yet.</div>'}</div>
      <div class="drawer-grid" style="padding:14px">
        <div class="field"><label>Reviewer Name</label><input id="rev-reviewer" class="cell-input" placeholder="Full name" /></div>
        <div class="field"><label>Role</label><select id="rev-role" class="cell-input">${['Procurement Officer', 'Procurement Manager', 'Finance Manager', 'Department Head', 'Technical Evaluator'].map((o) => `<option>${o}</option>`).join('')}</select></div>
        <div class="field"><label>Vendor Pick</label><select id="rev-vendorId" class="cell-input">${vendorOptions}</select></div>
      </div>
      <div class="drawer-grid" style="padding:0 14px 14px">
        <div class="field" style="grid-column:1/-1"><label>Comment</label><input id="rev-comment" class="cell-input" placeholder="Reasoning for this pick" /></div>
      </div>
      <div class="drawer-actions" style="padding:0 14px 14px"><button type="button" class="btn btn-primary" data-action="add-committee-review" data-id="${rfq.id}">Submit Review</button></div>
    `)}

    ${panel('Negotiation', `
      <table class="data-table"><thead><tr><th>Vendor</th><th class="right">From</th><th class="right">To</th><th>Notes</th><th>By</th><th class="right">Date</th></tr></thead><tbody>${negoRows}</tbody></table>
      <div class="drawer-grid" style="padding:14px">
        <div class="field"><label>Vendor</label><select id="neg-vendorId" class="cell-input">${negoVendorOptions}</select></div>
        <div class="field"><label>New Price</label><input id="neg-toPrice" type="number" min="0" class="cell-input tabular" placeholder="0" /></div>
        <div class="field"><label>Negotiated By</label><input id="neg-by" class="cell-input" placeholder="Your name" /></div>
      </div>
      <div class="drawer-grid" style="padding:0 14px 14px">
        <div class="field" style="grid-column:1/-1"><label>Notes</label><input id="neg-notes" class="cell-input" placeholder="What was agreed" /></div>
      </div>
      <div class="drawer-actions" style="padding:0 14px 14px"><button type="button" class="btn btn-outline" data-action="record-negotiation" data-id="${rfq.id}">Log Negotiation Round</button></div>
    `)}

    ${panel('Award decision', awardPanel)}
  </div>`;
};

// ── Module 11: Purchase Order ─────────────────────────────────
const PO_STATUS_TONE = { Open: 'amber', Approved: 'cyan', Released: 'teal', Cancelled: 'red', Closed: 'green' };
const GRN_STATUS_TONE = { Pending: 'neutral', Partial: 'amber', Complete: 'green' };

Render.buildPoPrintableHtml = function (d, po) {
  const vendor = d.vendors.find((v) => v.id === po.vendorId);
  const itemRows = po.items.map((it) => `<tr><td>${esc(it.materialCode)}</td><td>${esc(it.description)}</td><td>${it.qty}</td><td>${esc(it.unit)}</td></tr>`).join('');
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Purchase Order — ${esc(po.poNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
      h1 { font-size: 18px; margin-bottom: 2px; } .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
      table { width: 100%; border-collapse: collapse; margin-top: 8px; }
      th, td { border: 1px solid #ccc; padding: 6px 8px; font-size: 12px; text-align: left; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin: 16px 0; }
      .meta div span { color: #777; display: block; font-size: 10px; text-transform: uppercase; }
      .totals { margin-top: 12px; width: 260px; margin-left: auto; font-size: 12px; }
      .totals div { display: flex; justify-content: space-between; padding: 2px 0; }
      .totals .grand { border-top: 1px solid #333; font-weight: bold; margin-top: 4px; padding-top: 4px; }
      .sign { margin-top: 48px; font-size: 12px; }
    </style></head><body>
    <h1>Purchase Order</h1>
    <div class="sub">${esc(po.poNumber)} · Global Procurement Group</div>
    <div class="meta">
      <div><span>Vendor</span>${esc(vendor ? vendor.name : '—')}</div>
      <div><span>PO Date</span>${esc(po.poDate)}</div>
      <div><span>Department</span>${esc(po.department)}</div>
      <div><span>Delivery Location</span>${esc(po.deliveryLocation)}</div>
      <div><span>Payment Terms</span>${esc(po.paymentTerms)}</div>
      <div><span>Incoterms</span>${esc(po.incoterms || '—')}</div>
    </div>
    <table><thead><tr><th>Material Code</th><th>Description</th><th>Qty</th><th>Unit</th></tr></thead><tbody>${itemRows}</tbody></table>
    <div class="totals">
      <div><span>Subtotal</span><span>${Format.inr(po.subtotal)}</span></div>
      <div><span>Tax</span><span>${Format.inr(po.taxTotal)}</span></div>
      <div><span>Discount</span><span>-${Format.inr(po.discountTotal)}</span></div>
      <div class="grand"><span>Total</span><span>${Format.inr(po.total)}</span></div>
    </div>
    <div class="sign">Authorized by: ${esc(po.approval.approver)}<br/>Status: ${esc(po.status)}</div>
  </body></html>`;
};

Render.poDetail = function (d, po) {
  const vendor = d.vendors.find((v) => v.id === po.vendorId);
  const itemRows = po.items.map((it) => `<tr>
    <td class="ink-100">${esc(it.materialCode)}</td><td class="ink-300">${esc(it.description)}</td>
    <td class="right tabular ink-500">${it.qty} ${esc(it.unit)}</td>
  </tr>`).join('');

  let actionsHtml = '';
  if (po.status === 'Open') {
    actionsHtml = `
      <div class="drawer-grid">
        <div class="field"><label>Comment</label><input id="drawer-comment" class="cell-input" placeholder="Approval notes" /></div>
        <div class="field"><label>Digital Signature</label><input id="drawer-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
      </div>
      <div class="drawer-actions">
        <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="reject-po" data-id="${po.id}">Reject / Cancel</button>
        <button type="button" class="btn btn-primary" data-action="approve-po" data-id="${po.id}">Approve PO</button>
      </div>`;
  } else if (po.status === 'Approved') {
    actionsHtml = `
      <div class="drawer-banner" style="background:rgba(2,132,199,.08);border-color:rgba(2,132,199,.3);color:var(--cyan)">${Icon.info(13)} Approved by ${esc(po.approval.approver)} on ${esc(po.approval.actedAt)}. Release it to notify the vendor.</div>
      <div class="drawer-actions">
        <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="cancel-po" data-id="${po.id}">Cancel PO</button>
        <button type="button" class="btn btn-primary" data-action="release-po" data-id="${po.id}">Release to Vendor</button>
      </div>`;
  } else if (po.status === 'Released' || po.status === 'Closed') {
    const va = po.vendorAcceptance;
    actionsHtml = `
      <div class="vp-block">
        <div class="vp-block-title">Vendor acceptance</div>
        ${va.status === 'Pending' ? `
          <div class="drawer-grid" style="grid-template-columns:1fr 1fr">
            <div class="field"><label>Vendor response note</label><input id="va-note" class="cell-input" placeholder="Optional note from vendor" /></div>
          </div>
          <div class="drawer-actions" style="padding-top:8px">
            <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="vendor-decline-po" data-id="${po.id}">Vendor Declines</button>
            <button type="button" class="btn btn-primary" data-action="vendor-accept-po" data-id="${po.id}">Vendor Accepts</button>
          </div>` : `<div class="vp-row"><span>Status</span><span style="color:${va.status === 'Accepted' ? 'var(--green)' : 'var(--red)'}">${esc(va.status)} on ${esc(va.date)}</span></div>`}
      </div>
      <div class="drawer-actions" style="padding-top:12px">
        <button type="button" class="btn btn-outline" data-action="print-po" data-id="${po.id}">Print / Export PDF</button>
        <button type="button" class="link-btn" data-action="goto-module-delivery">Track shipment in Module 12 →</button>
      </div>`;
  } else {
    actionsHtml = `<div class="drawer-banner">${Icon.alertTriangle(13)} This PO was cancelled.</div>`;
  }

  const activityRows = po.activityLog.slice(0, 8).map((a) => `<tr><td class="ink-500">${Format.relativeDate(a.timestamp)}</td><td class="ink-100">${esc(a.action)}</td><td class="ink-500">${esc(a.actor)}</td><td class="ink-500">${esc(a.comment || '—')}</td></tr>`).join('');

  return `<div style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="vendor-profile-grid">
      <div class="vp-block"><div class="vp-block-title">Vendor</div><div class="vp-row"><span>Name</span><span>${esc(vendor ? vendor.name : '—')}</span></div><div class="vp-row"><span>GST</span><span class="tabular">${esc(vendor ? vendor.gst : '—')}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Terms</div><div class="vp-row"><span>Payment</span><span>${esc(po.paymentTerms)}</span></div><div class="vp-row"><span>Delivery</span><span>${esc(po.deliveryTerms)}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Value</div><div class="vp-row"><span>Total</span><span class="tabular" style="color:var(--teal)">${Format.inr(po.total)}</span></div><div class="vp-row"><span>GRN Status</span><span>${badge(GRN_STATUS_TONE[po.grnStatus], po.grnStatus)}</span></div></div>
    </div>
    <table class="data-table"><thead><tr><th>Material Code</th><th>Description</th><th class="right">Qty</th></tr></thead><tbody>${itemRows}</tbody></table>
    ${actionsHtml}
    <div class="vp-block"><div class="vp-block-title">PO activity</div><table class="data-table"><thead><tr><th>When</th><th>Action</th><th>By</th><th>Comment</th></tr></thead><tbody>${activityRows}</tbody></table></div>
  </div>`;
};

Render.poListScreen = function (d, filter, openDrawerId) {
  const filters = ['All', 'Open', 'Approved', 'Released', 'Cancelled', 'Closed'];
  const counts = Selectors.poCounts(d);
  const rows = Selectors.poList(d, filter);

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? d.pos.length : (counts[f] || 0);
    return `<button class="filter-chip ${filter === f || (!filter && f === 'All') ? 'active' : ''}" data-action="filter-po-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((po) => {
    const vendor = d.vendors.find((v) => v.id === po.vendorId);
    const isOpen = openDrawerId === po.id;
    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(po.poNumber)}</td>
      <td class="ink-500">${Format.relativeDate(po.poDate)}</td>
      <td class="ink-300">${esc(vendor ? vendor.name : '—')}</td>
      <td class="ink-300">${esc(po.department)}</td>
      <td class="right tabular ink-100">${Format.inr(po.total)}</td>
      <td>${badge(GRN_STATUS_TONE[po.grnStatus], po.grnStatus)}</td>
      <td>${badge(PO_STATUS_TONE[po.status] || 'neutral', po.status)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-po-drawer" data-id="${po.id}">${isOpen ? 'Close' : 'Open'}</button></td>
    </tr>${isOpen ? `<tr class="drawer-row"><td colspan="8">${Render.poDetail(d, po)}</td></tr>` : ''}`;
  }).join('') : `<tr class="empty-row"><td colspan="8">No purchase orders match this filter.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Purchase orders', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>PO Number</th><th>Date</th><th>Vendor</th><th>Department</th><th class="right">Total</th><th>GRN Status</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

Render.poCreateScreen = function (d, form) {
  const eligible = Selectors.eligibleRfqsForPO(d);
  if (eligible.length === 0) {
    return panel('Create purchase order', `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">
      No awarded RFQs are ready for a PO yet.<br/>
      Award a vendor in <button class="link-btn" data-action="goto-module" data-module="selection">Vendor Selection (Module 10)</button> first.
    </div>`);
  }
  const rfqId = form.rfqId && eligible.some((r) => r.id === form.rfqId) ? form.rfqId : eligible[0].id;
  const rfq = eligible.find((r) => r.id === rfqId);
  const vendor = d.vendors.find((v) => v.id === rfq.selection.finalVendorId);
  const q = d.quotations.find((x) => x.rfqId === rfqId && x.vendorId === rfq.selection.finalVendorId);
  const subtotal = q.negotiatedPrice || q.price;
  const total = subtotal + q.tax - q.discount;

  const rfqOptions = eligible.map((r) => `<option value="${r.id}" ${r.id === rfqId ? 'selected' : ''}>${esc(r.rfqNumber)}</option>`).join('');
  const itemRows = rfq.items.map((it) => `<tr><td class="ink-100">${esc(it.materialCode)}</td><td class="ink-300">${esc(it.description)}</td><td class="right tabular ink-500">${it.qty} ${esc(it.unit)}</td></tr>`).join('');

  return `
    ${panel('Awarded RFQ', `<div class="form-grid" style="grid-template-columns:1fr"><div class="field"><label>Select awarded RFQ</label><select id="po-rfqId" class="cell-input">${rfqOptions}</select></div></div>`)}
    ${panel('Vendor & pricing (from Module 10 award)', `
      <div class="vendor-profile-grid" style="padding:14px">
        <div class="vp-block"><div class="vp-block-title">Vendor</div><div style="font-size:14px;color:var(--ink-100)">${esc(vendor.name)}</div></div>
        <div class="vp-block"><div class="vp-block-title">Negotiated Total</div><div style="font-size:15px;color:var(--teal)">${Format.inr(total)}</div></div>
        <div class="vp-block"><div class="vp-block-title">Payment Terms</div><div style="font-size:13px;color:var(--ink-100)">${esc(rfq.paymentTerms)}</div></div>
      </div>
      <table class="data-table"><thead><tr><th>Material Code</th><th>Description</th><th class="right">Qty</th></tr></thead><tbody>${itemRows}</tbody></table>
    `)}
    ${panel('PO terms', `
      <div class="form-grid">
        <div class="field"><label>Delivery Location</label><select id="po-deliveryLocation" class="cell-input">${['Chennai Plant 1', 'Chennai Plant 2', 'Coimbatore Unit', 'Bengaluru Warehouse'].map((o) => `<option>${o}</option>`).join('')}</select></div>
        <div class="field"><label>Payment Terms</label><input id="po-paymentTerms" class="cell-input" value="${esc(rfq.paymentTerms)}" /></div>
      </div>
    `)}
    <div class="form-actions">
      <button type="button" class="btn btn-primary" data-action="create-po" data-rfq-id="${rfqId}">Create Purchase Order</button>
    </div>`;
};

// ── Module 12: Delivery Tracking ──────────────────────────────
const DELIVERY_STATUS_TONE = { 'On Time': 'teal', Delayed: 'red', Partial: 'amber', Complete: 'green' };

Render.deliveryDetail = function (d, del) {
  const po = d.pos.find((p) => p.id === del.poId);
  let actionsHtml = '';
  if (del.status !== 'Complete') {
    actionsHtml = `
      <div class="drawer-grid">
        <div class="field"><label>Delay days</label><input id="del-days" type="number" min="1" class="cell-input tabular" placeholder="2" /></div>
        <div class="field" style="grid-column:1/-1"><label>Remarks</label><input id="del-remarks" class="cell-input" placeholder="Reason / notes" /></div>
      </div>
      <div class="drawer-actions">
        <button type="button" class="btn btn-outline" style="border-color:var(--amber);color:var(--amber)" data-action="report-delay" data-id="${del.id}">Report Delay</button>
        <button type="button" class="btn btn-outline" data-action="mark-delivery-partial" data-id="${del.id}">Mark Partial</button>
        <button type="button" class="btn btn-primary" data-action="mark-delivery-complete" data-id="${del.id}">Mark Delivered</button>
      </div>`;
  } else {
    actionsHtml = `<div class="drawer-banner" style="background:rgba(22,163,74,.08);border-color:rgba(22,163,74,.3);color:var(--green)">${Icon.check(13)} Delivered. Post a GRN in Module 13.</div>
      <div class="drawer-actions"><button type="button" class="link-btn" data-action="goto-module-grn">Go to GRN →</button></div>`;
  }
  const activityRows = del.activityLog.map((a) => `<tr><td class="ink-500">${Format.relativeDate(a.timestamp)}</td><td class="ink-100">${esc(a.action)}</td><td class="ink-500">${esc(a.comment || '—')}</td></tr>`).join('');

  return `<div style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="vendor-profile-grid">
      <div class="vp-block"><div class="vp-block-title">PO</div><div class="vp-row"><span>Number</span><span>${esc(po ? po.poNumber : del.poId)}</span></div><div class="vp-row"><span>Value</span><span class="tabular">${Format.inr(po ? po.total : 0)}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Courier</div><div class="vp-row"><span>Name</span><span>${esc(del.courier)}</span></div><div class="vp-row"><span>Tracking No.</span><span class="tabular">${esc(del.trackingNumber)}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Timeline</div><div class="vp-row"><span>Dispatched</span><span>${esc(del.dispatchDate)}</span></div><div class="vp-row"><span>ETA</span><span>${esc(del.eta)}</span></div></div>
    </div>
    ${actionsHtml}
    <table class="data-table"><thead><tr><th>When</th><th>Event</th><th>Notes</th></tr></thead><tbody>${activityRows}</tbody></table>
  </div>`;
};

Render.deliveryBoardScreen = function (d, filter, openDrawerId) {
  const filters = ['All', 'On Time', 'Delayed', 'Partial', 'Complete'];
  const counts = Selectors.deliveryCounts(d);
  const rows = Selectors.deliveryList(d, filter);

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? d.deliveries.length : (counts[f] || 0);
    return `<button class="filter-chip ${filter === f || (!filter && f === 'All') ? 'active' : ''}" data-action="filter-delivery-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((del) => {
    const isOpen = openDrawerId === del.id;
    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(del.po ? del.po.poNumber : del.poId)}</td>
      <td class="ink-300">${esc(del.vendor ? del.vendor.name : '—')}</td>
      <td class="ink-500">${esc(del.courier)}</td>
      <td class="ink-500 tabular">${esc(del.trackingNumber)}</td>
      <td class="ink-500">${Format.relativeDate(del.eta)}</td>
      <td>${badge(DELIVERY_STATUS_TONE[del.status] || 'neutral', del.status + (del.delayDays ? ` · +${del.delayDays}d` : ''))}</td>
      <td class="right"><button class="link-btn" data-action="toggle-delivery-drawer" data-id="${del.id}">${isOpen ? 'Close' : 'Track'}</button></td>
    </tr>${isOpen ? `<tr class="drawer-row"><td colspan="7">${Render.deliveryDetail(d, del)}</td></tr>` : ''}`;
  }).join('') : `<tr class="empty-row"><td colspan="7">No shipments dispatched yet.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Delivery tracking board', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>PO Number</th><th>Vendor</th><th>Courier</th><th>Tracking No.</th><th>ETA</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

Render.deliveryCreateScreen = function (d, form) {
  const eligible = Selectors.eligiblePOsForDelivery(d);
  if (eligible.length === 0) {
    return panel('Dispatch entry', `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">
      No Released purchase orders are waiting on dispatch.<br/>
      Release a PO in <button class="link-btn" data-action="goto-module-po">Purchase Order (Module 11)</button> first.
    </div>`);
  }
  const poId = form.poId && eligible.some((p) => p.id === form.poId) ? form.poId : eligible[0].id;
  const po = eligible.find((p) => p.id === poId);
  const vendor = d.vendors.find((v) => v.id === po.vendorId);
  const poOptions = eligible.map((p) => `<option value="${p.id}" ${p.id === poId ? 'selected' : ''}>${esc(p.poNumber)} — ${Format.inr(p.total, true)}</option>`).join('');

  return `
    ${panel('Released PO', `<div class="form-grid" style="grid-template-columns:1fr"><div class="field"><label>Select PO to dispatch</label><select id="del-poId" class="cell-input">${poOptions}</select></div></div>`)}
    ${panel('Dispatch details', `
      <div class="form-grid">
        <div class="field"><label>Vendor</label><input class="cell-input" disabled value="${esc(vendor ? vendor.name : '—')}" /></div>
        <div class="field"><label>Courier</label><select id="del-courier" class="cell-input">${['Trident Logistics', 'Bluedart Express', 'Delhivery', 'DTDC', 'Vendor Own Fleet'].map((c) => `<option>${c}</option>`).join('')}</select></div>
        <div class="field"><label>Tracking Number</label><input id="del-trackingNumber" class="cell-input" placeholder="TRK000000" /></div>
        <div class="field"><label>Dispatch Date</label><input id="del-dispatchDate" type="date" class="cell-input" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="field"><label>Expected Delivery (ETA)</label><input id="del-eta" type="date" class="cell-input" /></div>
      </div>
    `)}
    <div class="form-actions">
      <button type="button" class="btn btn-primary" data-action="create-delivery" data-po-id="${poId}">Dispatch Shipment</button>
    </div>`;
};

// ── Module 13: Goods Receipt (GRN) ────────────────────────────
const GRN_RESULT_TONE = { Accepted: 'green', Partial: 'amber', Rejected: 'red' };

Render.grnDetail = function (d, grn) {
  const po = d.pos.find((p) => p.id === grn.poId);
  const rows = grn.items.map((it) => `<tr>
    <td class="ink-100">${esc(it.materialCode)}</td><td class="ink-300">${esc(it.description)}</td>
    <td class="right tabular ink-500">${it.orderedQty}</td><td class="right tabular ink-500">${it.receivedQty}</td>
    <td class="right tabular" style="color:var(--green)">${it.acceptedQty}</td>
    <td class="right tabular" style="color:${it.rejectedQty ? 'var(--red)' : 'var(--ink-700)'}">${it.rejectedQty}</td>
    <td class="ink-500">${esc(it.remarks || '—')}</td>
  </tr>`).join('');
  return `<div style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="vendor-profile-grid">
      <div class="vp-block"><div class="vp-block-title">PO</div><div class="vp-row"><span>Number</span><span>${esc(po ? po.poNumber : grn.poId)}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Inspection</div><div class="vp-row"><span>Warehouse</span><span>${esc(grn.warehouse)}</span></div><div class="vp-row"><span>Inspector</span><span>${esc(grn.inspector)}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Result</div><div style="padding-top:4px">${badge(GRN_RESULT_TONE[grn.overallResult] || 'neutral', grn.overallResult)}</div></div>
    </div>
    <table class="data-table"><thead><tr><th>Material Code</th><th>Description</th><th class="right">Ordered</th><th class="right">Received</th><th class="right">Accepted</th><th class="right">Rejected</th><th>Remarks</th></tr></thead><tbody>${rows}</tbody></table>
    <div class="link-btn" style="padding:0"><button class="link-btn" data-action="goto-module-invoice">Continue to Invoice Verification →</button></div>
  </div>`;
};

Render.grnListScreen = function (d, openDrawerId) {
  const rows = Selectors.grnList(d);
  const body = rows.length ? rows.map((grn) => {
    const po = d.pos.find((p) => p.id === grn.poId);
    const vendor = d.vendors.find((v) => v.id === grn.vendorId);
    const isOpen = openDrawerId === grn.id;
    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(grn.grnNumber)}</td>
      <td class="ink-500">${Format.relativeDate(grn.grnDate)}</td>
      <td class="ink-300">${esc(po ? po.poNumber : grn.poId)}</td>
      <td class="ink-300">${esc(vendor ? vendor.name : '—')}</td>
      <td class="ink-500">${esc(grn.warehouse)}</td>
      <td>${badge(GRN_RESULT_TONE[grn.overallResult] || 'neutral', grn.overallResult)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-grn-drawer" data-id="${grn.id}">${isOpen ? 'Close' : 'View'}</button></td>
    </tr>${isOpen ? `<tr class="drawer-row"><td colspan="7">${Render.grnDetail(d, grn)}</td></tr>` : ''}`;
  }).join('') : `<tr class="empty-row"><td colspan="7">No goods receipts posted yet.</td></tr>`;

  return panel('Goods receipt notes', `<div style="overflow-x:auto"><table class="data-table">
    <thead><tr><th>GRN Number</th><th>Date</th><th>PO Number</th><th>Vendor</th><th>Warehouse</th><th>Result</th><th class="right">Action</th></tr></thead>
    <tbody>${body}</tbody>
  </table></div>`);
};

Render.grnCreateScreen = function (d, form) {
  const eligible = Selectors.eligiblePOsForGRN(d);
  if (eligible.length === 0) {
    return panel('Post goods receipt', `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">
      No dispatched purchase orders are waiting on receipt.<br/>
      Dispatch a shipment in <button class="link-btn" data-action="goto-module-delivery">Delivery Tracking (Module 12)</button> first.
    </div>`);
  }
  const poId = form.poId && eligible.some((p) => p.id === form.poId) ? form.poId : eligible[0].id;
  const po = eligible.find((p) => p.id === poId);
  const poOptions = eligible.map((p) => `<option value="${p.id}" ${p.id === poId ? 'selected' : ''}>${esc(p.poNumber)}</option>`).join('');

  const itemRows = po.items.map((it, idx) => `
    <tr data-row-index="${idx}">
      <td class="ink-100">${esc(it.materialCode)}</td>
      <td class="ink-300">${esc(it.description)}</td>
      <td class="right tabular ink-500">${it.qty} ${esc(it.unit)}</td>
      <td><input class="cell-input tabular" style="width:80px" type="number" min="0" max="${it.qty}" data-field="receivedQty" value="${it.qty}" /></td>
      <td><input class="cell-input tabular" style="width:80px" type="number" min="0" max="${it.qty}" data-field="acceptedQty" value="${it.qty}" /></td>
      <td><input class="cell-input" data-field="remarks" placeholder="Remarks" /></td>
    </tr>`).join('');

  return `
    ${panel('Released PO', `<div class="form-grid" style="grid-template-columns:1fr"><div class="field"><label>Select PO to receive against</label><select id="grn-poId" class="cell-input">${poOptions}</select></div></div>`)}
    ${panel('Receipt details', `
      <div class="form-grid">
        <div class="field"><label>GRN Date</label><input id="grn-date" type="date" class="cell-input" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="field"><label>Warehouse</label><input id="grn-warehouse" class="cell-input" value="${esc(po.deliveryLocation)}" /></div>
        <div class="field"><label>Inspector</label><input id="grn-inspector" class="cell-input" placeholder="Full name" value="Suresh Pillai" /></div>
      </div>
    `)}
    ${panel('Item-wise inspection', `
      <div style="overflow-x:auto"><table class="data-table" id="grn-item-grid">
        <thead><tr><th>Material Code</th><th>Description</th><th class="right">Ordered</th><th>Received Qty</th><th>Accepted Qty</th><th>Remarks</th></tr></thead>
        <tbody>${itemRows}</tbody>
      </table></div>
    `)}
    <div class="form-actions">
      <button type="button" class="btn btn-primary" data-action="post-grn" data-po-id="${poId}">Post GRN</button>
    </div>`;
};

// ── Module 14: Invoice Verification ───────────────────────────
const INVOICE_STATUS_TONE = { Pending: 'amber', Matched: 'cyan', Blocked: 'red', Verified: 'green', Rejected: 'red', Paid: 'teal' };

Render.invoiceDetail = function (d, inv) {
  const po = d.pos.find((p) => p.id === inv.poId);
  const vendor = d.vendors.find((v) => v.id === inv.vendorId);
  const mr = inv.matchResult;
  let actionsHtml = '';
  if (inv.status === 'Blocked') {
    actionsHtml = `
      <div class="drawer-banner">${Icon.alertOctagon(13)} ${esc(mr.note)}</div>
      <div class="drawer-grid">
        <div class="field" style="grid-column:1/-1"><label>Override comment</label><input id="drawer-comment" class="cell-input" placeholder="Why is this being released?" /></div>
        <div class="field"><label>Digital Signature</label><input id="drawer-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
      </div>
      <div class="drawer-actions">
        <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="reject-invoice" data-id="${inv.id}">Reject Invoice</button>
        <button type="button" class="btn btn-primary" data-action="override-invoice-block" data-id="${inv.id}">Override Block</button>
      </div>`;
  } else if (inv.status === 'Pending' || inv.status === 'Matched') {
    actionsHtml = `
      <div class="drawer-banner" style="background:rgba(2,132,199,.08);border-color:rgba(2,132,199,.3);color:var(--cyan)">${Icon.info(13)} ${esc(mr.note)}</div>
      <div class="drawer-grid">
        <div class="field" style="grid-column:1/-1"><label>Verification comment</label><input id="drawer-comment" class="cell-input" placeholder="Notes" /></div>
        <div class="field"><label>Digital Signature</label><input id="drawer-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
      </div>
      <div class="drawer-actions">
        <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="reject-invoice" data-id="${inv.id}">Reject</button>
        <button type="button" class="btn btn-primary" data-action="verify-invoice" data-id="${inv.id}">Verify Invoice</button>
      </div>`;
  } else if (inv.status === 'Verified') {
    actionsHtml = `<div class="drawer-banner" style="background:rgba(22,163,74,.08);border-color:rgba(22,163,74,.3);color:var(--green)">${Icon.check(13)} Verified — cleared for payment.</div>
      <div class="drawer-actions"><button type="button" class="link-btn" data-action="goto-module-payment">Raise payment in Module 15 →</button></div>`;
  } else if (inv.status === 'Paid') {
    actionsHtml = `<div class="drawer-banner" style="background:rgba(45,212,191,.08);border-color:rgba(45,212,191,.3);color:var(--teal)">${Icon.check(13)} Paid in full.</div>`;
  } else {
    actionsHtml = `<div class="drawer-banner">${Icon.x(13)} This invoice was rejected.</div>`;
  }

  return `<div style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="vendor-profile-grid">
      <div class="vp-block"><div class="vp-block-title">Reference</div><div class="vp-row"><span>PO</span><span>${esc(po ? po.poNumber : inv.poId)}</span></div><div class="vp-row"><span>Vendor Invoice #</span><span class="tabular">${esc(inv.vendorInvoiceNumber)}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Amount</div><div class="vp-row"><span>Subtotal</span><span class="tabular">${Format.inr(inv.subtotal)}</span></div><div class="vp-row"><span>Total</span><span class="tabular" style="color:var(--teal)">${Format.inr(inv.total)}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">3-Way Match</div>
        <div class="vp-row"><span>PO ↔ Invoice</span><span style="color:${mr.priceMatch ? 'var(--green)' : 'var(--red)'}">${mr.priceMatch ? 'Match' : 'Mismatch'}</span></div>
        <div class="vp-row"><span>GRN posted</span><span style="color:${mr.grnMatch ? 'var(--green)' : 'var(--red)'}">${mr.grnMatch ? 'Yes' : 'No'}</span></div>
        <div class="vp-row"><span>Qty match</span><span style="color:${mr.qtyMatch ? 'var(--green)' : 'var(--red)'}">${mr.qtyMatch ? 'Yes' : 'No'}</span></div>
      </div>
    </div>
    ${actionsHtml}
  </div>`;
};

Render.invoiceListScreen = function (d, filter, openDrawerId) {
  const filters = ['All', 'Pending', 'Matched', 'Blocked', 'Verified', 'Rejected', 'Paid'];
  const counts = Selectors.invoiceCounts(d);
  const rows = Selectors.invoiceList(d, filter);

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? d.invoices.length : (counts[f] || 0);
    return `<button class="filter-chip ${filter === f || (!filter && f === 'All') ? 'active' : ''}" data-action="filter-invoice-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((inv) => {
    const po = d.pos.find((p) => p.id === inv.poId);
    const vendor = d.vendors.find((v) => v.id === inv.vendorId);
    const isOpen = openDrawerId === inv.id;
    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(inv.internalRefNumber)}</td>
      <td class="ink-500">${Format.relativeDate(inv.invoiceDate)}</td>
      <td class="ink-300">${esc(po ? po.poNumber : inv.poId)}</td>
      <td class="ink-300">${esc(vendor ? vendor.name : '—')}</td>
      <td class="right tabular ink-100">${Format.inr(inv.total)}</td>
      <td>${badge(INVOICE_STATUS_TONE[inv.status] || 'neutral', inv.status)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-invoice-drawer" data-id="${inv.id}">${isOpen ? 'Close' : 'Review'}</button></td>
    </tr>${isOpen ? `<tr class="drawer-row"><td colspan="7">${Render.invoiceDetail(d, inv)}</td></tr>` : ''}`;
  }).join('') : `<tr class="empty-row"><td colspan="7">No invoices submitted yet.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Invoices', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>Ref Number</th><th>Date</th><th>PO Number</th><th>Vendor</th><th class="right">Total</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

Render.invoiceCreateScreen = function (d, form) {
  const eligible = Selectors.eligiblePOsForInvoice(d);
  if (eligible.length === 0) {
    return panel('Submit invoice', `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">
      No released purchase orders yet.<br/>
      Release a PO in <button class="link-btn" data-action="goto-module-po">Purchase Order (Module 11)</button> first.
    </div>`);
  }
  const poId = form.poId && eligible.some((p) => p.id === form.poId) ? form.poId : eligible[0].id;
  const po = eligible.find((p) => p.id === poId);
  const vendor = d.vendors.find((v) => v.id === po.vendorId);
  const poOptions = eligible.map((p) => `<option value="${p.id}" ${p.id === poId ? 'selected' : ''}>${esc(p.poNumber)} — ${Format.inr(p.total, true)}</option>`).join('');
  const grnCount = d.grns.filter((g) => g.poId === poId).length;

  return `
    ${panel('Purchase order', `<div class="form-grid" style="grid-template-columns:1fr"><div class="field"><label>Select PO</label><select id="inv-poId" class="cell-input">${poOptions}</select></div></div>`,
    badge(grnCount ? 'green' : 'amber', grnCount ? grnCount + ' GRN posted' : 'No GRN yet'))}
    ${panel('Invoice details', `
      <div class="form-grid">
        <div class="field"><label>Vendor</label><input class="cell-input" disabled value="${esc(vendor ? vendor.name : '—')}" /></div>
        <div class="field"><label>Vendor Invoice Number</label><input id="inv-vendorInvoiceNumber" class="cell-input" placeholder="VI-00000" /></div>
        <div class="field"><label>Invoice Date</label><input id="inv-invoiceDate" type="date" class="cell-input" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="field"><label>Subtotal</label><input id="inv-subtotal" type="number" class="cell-input tabular" value="${po.subtotal}" /></div>
        <div class="field"><label>Tax</label><input id="inv-taxTotal" type="number" class="cell-input tabular" value="${po.taxTotal}" /></div>
        <div class="field"><label>Discount</label><input id="inv-discountTotal" type="number" class="cell-input tabular" value="${po.discountTotal}" /></div>
      </div>
      <div style="padding:0 14px 14px;font-size:11px;color:var(--ink-700)">PO value for reference: ${Format.inr(po.total)}. The engine runs a 3-way match against PO and posted GRN quantities on submit.</div>
    `)}
    <div class="form-actions">
      <button type="button" class="btn btn-primary" data-action="submit-invoice" data-po-id="${poId}">Submit Invoice</button>
    </div>`;
};

// ── Module 15: Payment Processing ─────────────────────────────
const PAYMENT_STATUS_TONE = { Pending: 'amber', Processed: 'green', Failed: 'red' };

Render.buildPaymentVoucherHtml = function (d, payment) {
  const vendor = d.vendors.find((v) => v.id === payment.vendorId);
  const inv = d.invoices.find((i) => i.id === payment.invoiceId);
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Payment Voucher — ${esc(payment.paymentNumber)}</title>
    <style>
      body { font-family: Arial, sans-serif; padding: 40px; color: #111; line-height: 1.6; }
      h1 { font-size: 18px; margin-bottom: 2px; } .sub { color: #666; font-size: 12px; margin-bottom: 24px; }
      .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; font-size: 12px; margin: 16px 0; }
      .meta div span { color: #777; display: block; font-size: 10px; text-transform: uppercase; }
      .amount { font-size: 24px; font-weight: bold; margin: 24px 0; }
      .sign { margin-top: 48px; font-size: 12px; }
    </style></head><body>
    <h1>Payment Voucher</h1>
    <div class="sub">${esc(payment.paymentNumber)} · Global Procurement Group</div>
    <div class="meta">
      <div><span>Paid To</span>${esc(vendor ? vendor.name : '—')}</div>
      <div><span>Invoice Ref</span>${esc(inv ? inv.internalRefNumber : '—')}</div>
      <div><span>Payment Date</span>${esc(payment.paymentDate)}</div>
      <div><span>Mode</span>${esc(payment.mode)}</div>
      <div><span>Bank Reference</span>${esc(payment.bankRef)}</div>
      <div><span>Status</span>${esc(payment.status)}</div>
    </div>
    <div class="amount">${Format.inr(payment.amount)}</div>
    <div class="sign">Approved by: ${esc(payment.approvedBy || 'Pending')}</div>
  </body></html>`;
};

Render.paymentDetail = function (d, payment) {
  const vendor = d.vendors.find((v) => v.id === payment.vendorId);
  const inv = d.invoices.find((i) => i.id === payment.invoiceId);
  let actionsHtml = '';
  if (payment.status === 'Pending') {
    actionsHtml = `
      <div class="drawer-grid">
        <div class="field"><label>Digital Signature</label><input id="drawer-signature" class="cell-input" placeholder="Type your full name to sign" /></div>
      </div>
      <div class="drawer-actions">
        <button type="button" class="btn btn-outline" style="border-color:var(--red);color:var(--red)" data-action="mark-payment-failed" data-id="${payment.id}">Mark Failed</button>
        <button type="button" class="btn btn-primary" data-action="process-payment" data-id="${payment.id}">Process Payment</button>
      </div>`;
  } else if (payment.status === 'Processed') {
    actionsHtml = `<div class="drawer-banner" style="background:rgba(22,163,74,.08);border-color:rgba(22,163,74,.3);color:var(--green)">${Icon.check(13)} Processed by ${esc(payment.approvedBy)} — ${esc(payment.mode)} ref ${esc(payment.bankRef)}.</div>
      <div class="drawer-actions"><button type="button" class="btn btn-outline" data-action="print-payment" data-id="${payment.id}">Print Voucher</button></div>`;
  } else {
    actionsHtml = `<div class="drawer-banner">${Icon.alertTriangle(13)} Payment failed — raise a new voucher once the issue is resolved.</div>`;
  }
  return `<div style="padding:14px;display:flex;flex-direction:column;gap:12px">
    <div class="vendor-profile-grid">
      <div class="vp-block"><div class="vp-block-title">Vendor</div><div class="vp-row"><span>Name</span><span>${esc(vendor ? vendor.name : '—')}</span></div><div class="vp-row"><span>Invoice</span><span>${esc(inv ? inv.internalRefNumber : '—')}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Amount</div><div class="vp-row"><span>Total</span><span class="tabular" style="color:var(--teal)">${Format.inr(payment.amount)}</span></div></div>
      <div class="vp-block"><div class="vp-block-title">Bank</div><div class="vp-row"><span>Mode</span><span>${esc(payment.mode)}</span></div><div class="vp-row"><span>Reference</span><span class="tabular">${esc(payment.bankRef)}</span></div></div>
    </div>
    ${actionsHtml}
  </div>`;
};

Render.paymentListScreen = function (d, filter, openDrawerId) {
  const filters = ['All', 'Pending', 'Processed', 'Failed'];
  const counts = Selectors.paymentCounts(d);
  const rows = Selectors.paymentList(d, filter);

  const filterBar = filters.map((f) => {
    const n = f === 'All' ? d.payments.length : (counts[f] || 0);
    return `<button class="filter-chip ${filter === f || (!filter && f === 'All') ? 'active' : ''}" data-action="filter-payment-list" data-filter="${f}">${f} <span class="filter-chip-count">${n}</span></button>`;
  }).join('');

  const body = rows.length ? rows.map((payment) => {
    const vendor = d.vendors.find((v) => v.id === payment.vendorId);
    const isOpen = openDrawerId === payment.id;
    return `<tr class="${isOpen ? 'row-open' : ''}">
      <td class="ink-100">${esc(payment.paymentNumber)}</td>
      <td class="ink-500">${Format.relativeDate(payment.paymentDate)}</td>
      <td class="ink-300">${esc(vendor ? vendor.name : '—')}</td>
      <td class="ink-500">${esc(payment.mode)}</td>
      <td class="right tabular ink-100">${Format.inr(payment.amount)}</td>
      <td>${badge(PAYMENT_STATUS_TONE[payment.status] || 'neutral', payment.status)}</td>
      <td class="right"><button class="link-btn" data-action="toggle-payment-drawer" data-id="${payment.id}">${isOpen ? 'Close' : 'Open'}</button></td>
    </tr>${isOpen ? `<tr class="drawer-row"><td colspan="7">${Render.paymentDetail(d, payment)}</td></tr>` : ''}`;
  }).join('') : `<tr class="empty-row"><td colspan="7">No payment vouchers raised yet.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:12px">
    <div class="filter-bar">${filterBar}</div>
    ${panel('Payments', `<div style="overflow-x:auto"><table class="data-table">
      <thead><tr><th>Voucher Number</th><th>Date</th><th>Vendor</th><th>Mode</th><th class="right">Amount</th><th>Status</th><th class="right">Action</th></tr></thead>
      <tbody>${body}</tbody>
    </table></div>`)}
  </div>`;
};

Render.paymentCreateScreen = function (d, form) {
  const eligible = Selectors.eligibleInvoicesForPayment(d);
  if (eligible.length === 0) {
    return panel('Raise payment', `<div style="padding:32px;text-align:center;color:var(--ink-500);font-size:13px">
      No verified invoices are ready for payment.<br/>
      Verify an invoice in <button class="link-btn" data-action="goto-module-invoice">Invoice Verification (Module 14)</button> first.
    </div>`);
  }
  const invId = form.invoiceId && eligible.some((i) => i.id === form.invoiceId) ? form.invoiceId : eligible[0].id;
  const inv = eligible.find((i) => i.id === invId);
  const vendor = d.vendors.find((v) => v.id === inv.vendorId);
  const invOptions = eligible.map((i) => `<option value="${i.id}" ${i.id === invId ? 'selected' : ''}>${esc(i.internalRefNumber)} — ${Format.inr(i.total, true)}</option>`).join('');

  return `
    ${panel('Verified invoice', `<div class="form-grid" style="grid-template-columns:1fr"><div class="field"><label>Select invoice</label><select id="pay-invoiceId" class="cell-input">${invOptions}</select></div></div>`)}
    ${panel('Payment details', `
      <div class="form-grid">
        <div class="field"><label>Vendor</label><input class="cell-input" disabled value="${esc(vendor ? vendor.name : '—')}" /></div>
        <div class="field"><label>Amount</label><input class="cell-input tabular" disabled value="${Format.inr(inv.total)}" /></div>
        <div class="field"><label>Payment Date</label><input id="pay-paymentDate" type="date" class="cell-input" value="${new Date().toISOString().slice(0, 10)}" /></div>
        <div class="field"><label>Mode</label><select id="pay-mode" class="cell-input">${['NEFT', 'RTGS', 'Cheque', 'UPI'].map((m) => `<option>${m}</option>`).join('')}</select></div>
        <div class="field"><label>Bank Reference</label><input id="pay-bankRef" class="cell-input" placeholder="Auto-generated if left blank" /></div>
      </div>
    `)}
    <div class="form-actions">
      <button type="button" class="btn btn-primary" data-action="create-payment" data-invoice-id="${invId}">Raise Payment Voucher</button>
    </div>`;
};

// ── Module 16: Reports & Audit ─────────────────────────────────
Render.reportsScreen = function (d, ephemeral) {
  const summary = Selectors.procurementSummary(d);
  const spend = Selectors.monthlySpend(d);
  const deptSpend = Selectors.departmentSpend(d);
  const vendors = Selectors.vendorLeaderboard(d).slice(0, 8);
  const openPOs = Selectors.openPOReport(d);
  const budget = Selectors.budgetOverview(d);
  const types = ['All'].concat(Selectors.auditActivityTypes(d));
  const auditFilter = ephemeral.reportsAuditFilter || 'All';
  const auditQuery = ephemeral.reportsAuditQuery || '';
  const auditRows = Selectors.fullAuditLog(d, auditFilter, auditQuery).slice(0, 80);

  const maxSpend = Math.max(1, ...spend.map((s) => s.total));
  const spendBars = spend.length ? spend.map((s) => `
    <div class="vbar-col">
      <div class="vbar-count">${Format.inr(s.total, true)}</div>
      <div class="vbar" style="height:${(s.total / maxSpend) * 100}%;background:var(--teal)"></div>
      <div class="vbar-label">${esc(s.month)}</div>
    </div>`).join('') : '';

  const maxDept = Math.max(1, ...deptSpend.map((s) => s.total));
  const deptBars = deptSpend.map((s) => `
    <div class="hbar-row">
      <div class="hbar-label">${esc(s.department)}</div>
      <div class="hbar-track"><div class="hbar-fill" style="width:${(s.total / maxDept) * 100}%"></div></div>
      <div class="hbar-count tabular wide">${Format.inr(s.total, true)}</div>
    </div>`).join('');

  const vendorRows = vendors.map((v) => `<tr>
    <td class="ink-100">${esc(v.name)}</td><td class="right tabular" style="color:var(--amber)">★ ${v.rating}</td>
    <td class="right tabular ink-300">${v.onTimeDeliveryPct}%</td><td class="right tabular ink-100">${Format.inr(v.totalSpendYtd, true)}</td>
  </tr>`).join('') || `<tr class="empty-row"><td colspan="4">No vendor activity yet.</td></tr>`;

  const openPoRows = openPOs.length ? openPOs.map((po) => {
    const vendor = d.vendors.find((v) => v.id === po.vendorId);
    return `<tr><td class="ink-100">${esc(po.poNumber)}</td><td class="ink-300">${esc(vendor ? vendor.name : '—')}</td><td class="ink-500">${esc(po.department)}</td><td class="right tabular ink-100">${Format.inr(po.total)}</td><td>${badge(PO_STATUS_TONE[po.status] || 'neutral', po.status)}</td></tr>`;
  }).join('') : `<tr class="empty-row"><td colspan="5">No open purchase orders.</td></tr>`;

  const budgetRows = budget.map((b) => `<tr><td class="ink-100">${esc(b.department)}</td><td class="right tabular ink-500">${Format.inr(b.allocated, true)}</td><td class="right tabular ink-300">${Format.inr(b.used, true)}</td><td class="right tabular" style="color:${b.balance < 0 ? 'var(--red)' : 'var(--green)'}">${Format.inr(b.balance, true)}</td></tr>`).join('');

  const typeChips = types.map((t) => `<button class="filter-chip ${auditFilter === t ? 'active' : ''}" data-action="filter-audit-log" data-filter="${esc(t)}">${esc(t)}</button>`).join('');

  const auditRowsHtml = auditRows.length ? auditRows.map((a) => `<tr class="audit-row" data-audit-text="${esc(((a.refNumber || '') + ' ' + (a.actor || '') + ' ' + (a.detail || '')).toLowerCase())}">
    <td class="ink-500">${Format.relativeDate(a.timestamp)}</td><td class="ink-100">${esc(a.type)}</td>
    <td class="ink-300">${esc(a.refNumber)}</td><td class="ink-300">${esc(a.actor)}</td><td class="ink-500">${esc(a.detail)}</td>
  </tr>`).join('') : `<tr class="empty-row"><td colspan="5">No activity matches this filter.</td></tr>`;

  return `<div style="display:flex;flex-direction:column;gap:12px">
    ${panel('Procurement summary', `<div class="stat-grid" style="grid-template-columns:repeat(4,1fr);padding:14px">
      <div class="stat-card"><div class="stat-value">${summary.pos}</div><div class="stat-label">Total POs</div></div>
      <div class="stat-card"><div class="stat-value">${Format.inr(summary.totalSpend, true)}</div><div class="stat-label">Total Spend</div></div>
      <div class="stat-card"><div class="stat-value">${summary.openPOs}</div><div class="stat-label">Open POs</div></div>
      <div class="stat-card"><div class="stat-value">${summary.paidInvoices}</div><div class="stat-label">Invoices Paid</div></div>
    </div>`, `<button class="btn btn-outline" style="padding:4px 10px;font-size:11px" data-action="print-report">Print Report</button>`)}

    <div class="grid-2">
      ${panel('Monthly spend', spend.length ? `<div class="vbar-wrap">${spendBars}</div>` : `<div style="padding:32px;text-align:center;color:var(--ink-700);font-size:12px">No POs raised yet.</div>`)}
      ${panel('Department spend', `<div style="padding:12px 0">${deptBars || '<div style="padding:20px;text-align:center;color:var(--ink-700);font-size:12px">No spend yet.</div>'}</div>`)}
    </div>

    <div class="grid-2">
      ${panel('Vendor performance (top 8)', `<table class="data-table"><thead><tr><th>Vendor</th><th class="right">Rating</th><th class="right">On-Time</th><th class="right">Spend YTD</th></tr></thead><tbody>${vendorRows}</tbody></table>`)}
      ${panel('Budget report', `<table class="data-table"><thead><tr><th>Department</th><th class="right">Allocated</th><th class="right">Used</th><th class="right">Balance</th></tr></thead><tbody>${budgetRows}</tbody></table>`)}
    </div>

    ${panel('Open PO report', `<div class="scroll-max"><table class="data-table"><thead><tr><th>PO Number</th><th>Vendor</th><th>Department</th><th class="right">Total</th><th>Status</th></tr></thead><tbody>${openPoRows}</tbody></table></div>`)}

    ${panel('Audit log', `
      <div style="padding:12px 14px 0"><div class="filter-bar">${typeChips}</div></div>
      <div style="padding:10px 14px"><div class="search-wrap" style="max-width:320px">${Icon.search(14)}<input id="audit-search-input" placeholder="Search ref, actor, detail…" value="${esc(auditQuery)}" autocomplete="off" /></div></div>
      <div class="scroll-max"><table class="data-table" id="audit-log-table"><thead><tr><th>When</th><th>Type</th><th>Reference</th><th>Actor</th><th>Detail</th></tr></thead><tbody>${auditRowsHtml}</tbody></table></div>
    `, badge('neutral', auditRows.length + ' shown'))}
  </div>`;
};

// ── Full page ─────────────────────────────────────────────────
Render.tabContent = function (tab, d, ephemeral) {
  switch (tab) {
    case 'overview': return Render.overview(d);
    case 'approvals': return Render.pendingApprovals(d, ephemeral.justActed);
    case 'today': return Render.today(d);
    case 'rfq': return Render.rfq(d);
    case 'po': return Render.po(d);
    case 'vendors': return Render.vendors(d);
    case 'budget': return Render.budget(d);
    case 'delivery': return Render.delivery(d);
    case 'activity': return Render.activity(d);
    case 'notifications': return Render.notifications(d);
    default: return '';
  }
};

Render.reqTabContent = function (reqTab, d, ephemeral) {
  switch (reqTab) {
    case 'list': return Render.requirementList(d, ephemeral.reqListFilter);
    case 'create': return Render.requirementCreate(ephemeral.reqForm.items, ephemeral.reqForm.attachments);
    default: return '';
  }
};

Render.prTabContent = function (prTab, d, ephemeral) {
  switch (prTab) {
    case 'list': return Render.prList(d, ephemeral.prListFilter);
    case 'create': return Render.prCreate(ephemeral.prForm.items);
    default: return '';
  }
};

Render.approvalTabContent = function (approvalTab, d, ephemeral) {
  switch (approvalTab) {
    case 'pending': return Render.approvalPendingScreen(d, ephemeral.approvalDrawerOpenId);
    case 'history': return Render.approvalHistoryScreen(d);
    default: return '';
  }
};

Render.budgetTabContent = function (budgetTab, d, ephemeral) {
  switch (budgetTab) {
    case 'overview': return Render.budgetOverviewScreen(d);
    case 'validate': return Render.budgetValidateScreen(d, ephemeral.budgetListFilter, ephemeral.budgetDrawerOpenId);
    default: return '';
  }
};

Render.vendorTabContent = function (vendorTab, d, ephemeral) {
  switch (vendorTab) {
    case 'directory': return Render.vendorDirectoryScreen(d, ephemeral.vendorCategoryFilter, ephemeral.vendorStatusFilter, ephemeral.vendorDrawerOpenId);
    case 'register': return Render.vendorRegisterScreen(ephemeral.vendorForm.contacts);
    case 'approvals': return Render.vendorApprovalsScreen(d, ephemeral.vendorApprovalDrawerOpenId);
    default: return '';
  }
};

Render.rfqTabContent = function (rfqTab, d, ephemeral) {
  switch (rfqTab) {
    case 'list': return Render.rfqListScreen(d, ephemeral.rfqListFilter, ephemeral.rfqDrawerOpenId);
    case 'create': return Render.rfqCreateScreen(d, ephemeral.rfqForm);
    default: return '';
  }
};

Render.quotationTabContent = function (quotationTab, d, ephemeral) {
  switch (quotationTab) {
    case 'inbox': return Render.quotationInboxScreen(d, ephemeral.quotationListFilter, ephemeral.quotationDrawerOpenId);
    case 'byrfq': return Render.quotationByRfqScreen(d);
    default: return '';
  }
};

Render.poTabContent = function (poTab, d, ephemeral) {
  switch (poTab) {
    case 'list': return Render.poListScreen(d, ephemeral.poListFilter, ephemeral.poDrawerOpenId);
    case 'create': return Render.poCreateScreen(d, ephemeral.poForm);
    default: return '';
  }
};

Render.deliveryTabContent = function (deliveryTab, d, ephemeral) {
  switch (deliveryTab) {
    case 'board': return Render.deliveryBoardScreen(d, ephemeral.deliveryListFilter, ephemeral.deliveryDrawerOpenId);
    case 'create': return Render.deliveryCreateScreen(d, ephemeral.deliveryForm);
    default: return '';
  }
};

Render.grnTabContent = function (grnTab, d, ephemeral) {
  switch (grnTab) {
    case 'list': return Render.grnListScreen(d, ephemeral.grnDrawerOpenId);
    case 'create': return Render.grnCreateScreen(d, ephemeral.grnForm);
    default: return '';
  }
};

Render.invoiceTabContent = function (invoiceTab, d, ephemeral) {
  switch (invoiceTab) {
    case 'list': return Render.invoiceListScreen(d, ephemeral.invoiceListFilter, ephemeral.invoiceDrawerOpenId);
    case 'create': return Render.invoiceCreateScreen(d, ephemeral.invoiceForm);
    default: return '';
  }
};

Render.paymentTabContent = function (paymentTab, d, ephemeral) {
  switch (paymentTab) {
    case 'list': return Render.paymentListScreen(d, ephemeral.paymentListFilter, ephemeral.paymentDrawerOpenId);
    case 'create': return Render.paymentCreateScreen(d, ephemeral.paymentForm);
    default: return '';
  }
};

const MODULE_META = {
  dashboard: { title: 'Procurement Dashboard', sub: 'Module 1 · live view across Requirement, PR, RFQ, PO, GRN, Invoice and Payment' },
  requirement: { title: 'Department Requirement', sub: 'Module 2 · raise a requirement, then convert it straight into a live Purchase Requisition' },
  pr: { title: 'Purchase Requisition', sub: 'Module 3 · raise, approve and track PRs — feeds Pending Approvals on the Dashboard in real time' },
  approval: { title: 'Approval Workflow', sub: 'Module 4 · four-level approval pipeline shared by every module — Approve, Reject, Return or Forward with comments and a digital signature' },
  budget: { title: 'Budget Verification', sub: "Module 5 · every PR is checked against its department's budget on submit — insufficient budget blocks approval until validated or overridden here" },
  vendor: { title: 'Vendor Management', sub: 'Module 6 · vendor master, registration & approval workflow, documents, bank details, contacts, performance reviews and blacklist control' },
  rfq: { title: 'Request for Quotation', sub: 'Module 7 · raise an RFQ straight from an Approved PR, invite Approved vendors, then Email / Print / Duplicate / Cancel it' },
  quotation: { title: 'Quotation Management', sub: 'Module 8 · every invited vendor gets a quotation slot the moment an RFQ is issued — fill it in, then Accept or Reject' },
  comparison: { title: 'Quotation Comparison', sub: 'Module 9 · side-by-side comparison matrix, weighted scoring and a recommendation engine over real received quotations' },
  selection: { title: 'Vendor Selection', sub: 'Module 10 · evaluation committee voting, negotiation rounds, a formal approval gate, and a generated Letter of Award' },
  po: { title: 'Purchase Order', sub: 'Module 11 · generate a PO straight from an awarded RFQ, route it through internal approval, then release it to the vendor' },
  delivery: { title: 'Delivery Tracking', sub: 'Module 12 · dispatch a released PO, track its courier and ETA, and flag delays or partial shipments' },
  grn: { title: 'Goods Receipt (GRN)', sub: 'Module 13 · post item-wise receipt and inspection against a delivered PO — feeds the 3-way match in Invoice Verification' },
  invoice: { title: 'Invoice Verification', sub: 'Module 14 · submit a vendor invoice and run a 3-way match against the PO and posted GRN, with duplicate detection' },
  payment: { title: 'Payment Processing', sub: 'Module 15 · raise a payment voucher against a verified invoice and process it to close the procurement cycle' },
  reports: { title: 'Reports & Audit', sub: 'Module 16 · procurement summary, spend analysis, vendor performance, budget report and a searchable audit trail' },
};

Render.app = function (state) {
  const { currentModule, tab, reqTab, prTab, approvalTab, budgetTab, vendorTab, rfqTab, quotationTab, comparisonRfqId, selectionRfqId, ephemeral } = state;
  const d = Store.state;
  const meta = MODULE_META[currentModule];

  let tabsHtml, contentHtml;
  if (currentModule === 'dashboard') {
    tabsHtml = Render.tabs(tab, d);
    contentHtml = Render.tabContent(tab, d, ephemeral);
  } else if (currentModule === 'requirement') {
    tabsHtml = Render.reqTabs(reqTab, d);
    contentHtml = Render.reqTabContent(reqTab, d, ephemeral);
  } else if (currentModule === 'pr') {
    tabsHtml = Render.prTabs(prTab, d);
    contentHtml = Render.prTabContent(prTab, d, ephemeral);
  } else if (currentModule === 'approval') {
    tabsHtml = Render.approvalTabs(approvalTab, d);
    contentHtml = Render.approvalTabContent(approvalTab, d, ephemeral);
  } else if (currentModule === 'budget') {
    tabsHtml = Render.budgetTabs(budgetTab, d);
    contentHtml = Render.budgetTabContent(budgetTab, d, ephemeral);
  } else if (currentModule === 'vendor') {
    tabsHtml = Render.vendorTabs(vendorTab, d);
    contentHtml = Render.vendorTabContent(vendorTab, d, ephemeral);
  } else if (currentModule === 'rfq') {
    tabsHtml = Render.rfqTabs(rfqTab, d);
    contentHtml = Render.rfqTabContent(rfqTab, d, ephemeral);
  } else if (currentModule === 'quotation') {
    tabsHtml = Render.quotationTabs(quotationTab, d);
    contentHtml = Render.quotationTabContent(quotationTab, d, ephemeral);
  } else if (currentModule === 'comparison') {
    tabsHtml = '';
    contentHtml = Render.comparisonScreen(d, comparisonRfqId);
  } else if (currentModule === 'selection') {
    tabsHtml = '';
    contentHtml = Render.selectionScreen(d, selectionRfqId);
  } else if (currentModule === 'po') {
    tabsHtml = Render.poTabs(state.poTab, d);
    contentHtml = Render.poTabContent(state.poTab, d, ephemeral);
  } else if (currentModule === 'delivery') {
    tabsHtml = Render.deliveryTabs(state.deliveryTab, d);
    contentHtml = Render.deliveryTabContent(state.deliveryTab, d, ephemeral);
  } else if (currentModule === 'grn') {
    tabsHtml = Render.grnTabs(state.grnTab);
    contentHtml = Render.grnTabContent(state.grnTab, d, ephemeral);
  } else if (currentModule === 'invoice') {
    tabsHtml = Render.invoiceTabs(state.invoiceTab, d);
    contentHtml = Render.invoiceTabContent(state.invoiceTab, d, ephemeral);
  } else if (currentModule === 'payment') {
    tabsHtml = Render.paymentTabs(state.paymentTab, d);
    contentHtml = Render.paymentTabContent(state.paymentTab, d, ephemeral);
  } else if (currentModule === 'reports') {
    tabsHtml = '';
    contentHtml = Render.reportsScreen(d, ephemeral);
  }

  return `
    <div class="shell">
      ${Render.sidebar(currentModule)}
      <div class="main">
        <div id="topbar-slot">${Render.topbar(d)}</div>
        <div id="ticker-slot">${Render.ticker(d)}</div>
        <div class="content">
          <div id="title-slot"><div class="page-title">${meta.title}</div><div class="page-sub">${meta.sub}</div></div>
          ${currentModule === 'dashboard' ? `<div id="kpi-slot">${Render.kpiStrip(d)}</div>` : ''}
          <div id="tabs-slot">${tabsHtml}</div>
          <div id="tab-content-slot" style="padding-bottom:16px">${contentHtml}</div>
        </div>
      </div>
    </div>
    <div id="modal-slot">${Render.modals(state)}</div>
    ${Render.watermark()}`;
};

// ── Onboarding tour / Reset confirm / Import toast ──────────────
const TOUR_STEPS = [
  { title: 'Welcome to the Procurement Simulator', body: 'This is a training sandbox for the full source-to-pay cycle — 16 modules, nothing pre-filled except company setup (departments, budgets, and the people who approve things). You build every requirement, vendor, order, and payment yourself.' },
  { title: '1 · Start with a Requirement or a PR', body: 'Raise a Department Requirement (Module 2) or go straight to a Purchase Requisition (Module 3). Every downstream module traces back to a PR.' },
  { title: '2 · Approval + Budget', body: 'A submitted PR moves through a 4-level approval chain (Module 4). It also reserves money against its department\'s budget (Module 5) — an Insufficient PR gets blocked from approval until it clears budget review.' },
  { title: '3 · Vendors first, then RFQ', body: 'Nothing is pre-loaded here either — register and approve at least one vendor in Module 6 before you can issue an RFQ (Module 7) against them.' },
  { title: '4 · Quotations → Comparison → Selection', body: 'Vendors respond with quotations (Module 8), you compare them side-by-side (Module 9), then run it through a committee vote and formal award (Module 10).' },
  { title: '5 · PO through to Payment', body: 'An awarded RFQ becomes a Purchase Order (11), which you dispatch (12), receive against with a GRN (13), invoice-match (14), and finally pay (15). Reports & Audit (16) rolls all of it up.' },
  { title: 'Your progress is saved automatically', body: 'Everything you do is saved to this browser as you go — close the tab and come back, it\'s still there. Use the download icon in the toolbar any time to export your work as a file (to submit or back up), and the reset icon to wipe everything and start over.' },
];

Render.tourModal = function (step) {
  const idx = Math.min(Math.max(step || 0, 0), TOUR_STEPS.length - 1);
  const s = TOUR_STEPS[idx];
  const dots = TOUR_STEPS.map((_, i) => `<span class="tour-dot ${i === idx ? 'active' : ''}"></span>`).join('');
  return `
    <div class="modal-overlay" data-action="noop">
      <div class="modal-card tour-card">
        <div class="modal-header">
          <span class="tour-step-label">Step ${idx + 1} of ${TOUR_STEPS.length}</span>
          <button class="icon-btn" data-action="close-tour" title="Skip tour">${Icon.x(14)}</button>
        </div>
        <h2 class="modal-title">${esc(s.title)}</h2>
        <p class="modal-body">${esc(s.body)}</p>
        <div class="tour-dots">${dots}</div>
        <div class="modal-actions">
          <button class="btn btn-outline" data-action="close-tour">Skip</button>
          <div style="flex:1"></div>
          ${idx > 0 ? `<button class="btn btn-outline" data-action="tour-prev">Back</button>` : ''}
          ${idx < TOUR_STEPS.length - 1
            ? `<button class="btn btn-primary" data-action="tour-next">Next ${Icon.arrowRight(13)}</button>`
            : `<button class="btn btn-primary" data-action="close-tour">Start building →</button>`}
        </div>
      </div>
    </div>`;
};

Render.resetConfirmModal = function () {
  return `
    <div class="modal-overlay" data-action="noop">
      <div class="modal-card">
        <div class="modal-header">
          <span class="tour-step-label" style="color:var(--red)">${Icon.alertTriangle(13)} This can't be undone</span>
          <button class="icon-btn" data-action="cancel-reset" title="Cancel">${Icon.x(14)}</button>
        </div>
        <h2 class="modal-title">Reset everything?</h2>
        <p class="modal-body">Every requirement, PR, RFQ, vendor, PO, delivery, GRN, invoice and payment you've built will be permanently deleted from this browser. Export your work first with the download icon if you want to keep a copy.</p>
        <div class="modal-actions">
          <button class="btn btn-outline" data-action="cancel-reset">Cancel</button>
          <div style="flex:1"></div>
          <button class="btn btn-primary" style="background:var(--red);border-color:var(--red)" data-action="confirm-reset">Yes, reset everything</button>
        </div>
      </div>
    </div>`;
};

Render.toast = function (message) {
  if (!message) return '';
  return `<div class="toast toast-${message.type}">${message.type === 'error' ? Icon.alertOctagon(14) : Icon.check(14)}<span>${esc(message.text)}</span></div>`;
};

Render.watermark = function () {
  return `<div class="app-watermark">Developed by Ananthu Shaji</div>`;
};

Render.settingsModal = function () {
  return `
    <div class="modal-overlay" data-action="noop">
      <div class="modal-card about-card">
        <div class="modal-header">
          <span class="tour-step-label">${Icon.settings(13)} Settings</span>
          <button class="icon-btn" data-action="close-settings" title="Close">${Icon.x(14)}</button>
        </div>
        <div class="about-scroll">

          <div class="about-section-label">About</div>

          <section class="about-section">
            <h3>About the Developer</h3>
            <p>Ananthu Shaji is an independent software developer, technology entrepreneur, logistics educator, and published author dedicated to building modern digital solutions for education, enterprise management, business operations, logistics, productivity, and artificial intelligence.</p>
            <p>Driven by a passion for innovation and practical problem-solving, he develops software that combines professional design, realistic workflows, intelligent automation, and scalable architecture. His mission is to bridge the gap between learning and real-world industry practices by creating applications that are intuitive, reliable, and future-ready.</p>
            <p>Every product is designed with a strong focus on performance, security, usability, and long-term sustainability.</p>
          </section>

          <section class="about-section">
            <h3>About the Dot Ecosystem</h3>
            <p>Dot Ecosystem is a unified technology platform consisting of interconnected software products, enterprise applications, educational simulators, AI-powered tools, and cloud infrastructure.</p>
            <p>Rather than developing isolated applications, the Dot Ecosystem follows a shared architecture where products can work independently while seamlessly integrating with one another.</p>
            <div class="about-pill-list">
              ${['Enterprise-grade Security', 'Modern User Experience', 'Scalable Architecture', 'Cloud-Ready Infrastructure', 'Artificial Intelligence Integration', 'Cross-Platform Compatibility', 'Performance & Reliability', 'Real-World Business Workflows'].map((p) => `<span class="about-pill">${p}</span>`).join('')}
            </div>
            <p>The long-term vision of the Dot Ecosystem is to build a comprehensive suite of digital solutions that simplify business operations, enhance education, improve productivity, and support organizations across multiple industries.</p>
          </section>

          <section class="about-section">
            <h3>Dot Ecosystem Products</h3>
            <div class="about-product-grid">
              ${[
                ['Stratix One', 'Integrated CRM, HR, Finance, Inventory, Projects, Analytics and Workflow Automation platform.'],
                ['Stratix Lite', 'A lightweight business management solution for startups and growing organizations.'],
                ['Stratix Pro', 'Enterprise-grade platform with extensive modules for medium and large organizations.'],
                ['BuildBoss', 'Construction and project management software for contractors and infrastructure companies.'],
                ['Connect Flow', 'A workflow automation platform for approvals, tasks, and organizational operations.'],
                ['Connect', 'A collaboration platform for secure communication and operational coordination.'],
                ['Paisa+', 'A personal finance app for expenses, budgets, savings, and planning.'],
                ['Paisa Pro+', 'Advanced financial management for professionals, accountants, and businesses.'],
                ['Fund Circle', 'A financial collaboration platform for shared funds and group management.'],
                ['LAM ERP', 'A comprehensive ERP for logistics, warehousing, procurement, and supply chain.'],
                ['Filio', 'A secure document and digital asset management system.'],
                ['StorySoul', 'A creative writing workspace for ideas, characters, timelines, and manuscripts.'],
                ['NovelForge AI', 'An AI-assisted platform for novel planning, drafting, editing, and publishing.'],
                ['Kshetra', 'A platform for structured organizational and administrative operations.'],
                ['Saathi', 'A productivity app for task management, communication, and team coordination.'],
              ].map(([name, desc]) => `<div class="about-product"><strong>${name}</strong><span>${desc}</span></div>`).join('')}
            </div>
          </section>

          <section class="about-section">
            <h3>Dot Infrastructure</h3>
            <p>The core technology foundation powering every application within the Dot Ecosystem — shared services, development standards, cloud technologies, security systems, and intelligent infrastructure that ensure consistency, scalability, and reliability across all products.</p>
            <div class="about-product-grid">
              ${[
                ['Ghost Backend (GB)', 'Authentication, API routing, business logic, and centralized service management.'],
                ['DotBase', 'The centralized data platform managing databases, storage, and synchronization.'],
                ['DotPulse', 'Monitoring and observability — health, logs, diagnostics, and performance metrics.'],
                ['Dotploy', 'Deployment automation — packaging, version management, and release pipelines.'],
                ['DotMesh', 'A secure communication framework between apps, APIs, and distributed components.'],
                ['DotX Runway', 'A unified platform standardizing development, testing, and continuous delivery.'],
                ['DotX1 Apache', 'A high-performance web server optimized for enterprise application delivery.'],
                ['DotAIL', 'Asynchronous infrastructure — background jobs, notifications, and event handling.'],
                ['DotSQL', 'A structured enterprise data platform for storage, indexing, and querying.'],
                ['DotIntent OS', 'An orchestration layer coordinating workflows and AI-assisted decisions.'],
                ['Dot Neural Net Fabric (NNF)', 'The AI foundation — automation, predictive analytics, and NLP.'],
              ].map(([name, desc]) => `<div class="about-product"><strong>${name}</strong><span>${desc}</span></div>`).join('')}
            </div>
          </section>

          <section class="about-section">
            <h3>Vision</h3>
            <p>To build a world-class ecosystem of software solutions that empowers individuals, educational institutions, businesses, and enterprises through innovation, intelligent technology, and practical digital transformation.</p>
          </section>

          <section class="about-section about-copyright">
            <p>© 2026 Ananthu Shaji. All Rights Reserved.</p>
            <p>Dot Ecosystem™, its applications, infrastructure components, trademarks, software architecture, user interface designs, documentation, and associated technologies are proprietary intellectual property. Unauthorized copying, modification, redistribution, reverse engineering, commercial resale, or reproduction of any part of this software without prior written permission is strictly prohibited.</p>
            <p class="about-contact">Developer: Ananthu Shaji &nbsp;·&nbsp; Platform: Dot Ecosystem &nbsp;·&nbsp; Version: 1.0 &nbsp;·&nbsp; Status: Under Continuous Development</p>
          </section>

        </div>
      </div>
    </div>`;
};

Render.modals = function (state) {
  let html = '';
  if (state.tourOpen) html += Render.tourModal(state.tourStep);
  if (state.resetConfirmOpen) html += Render.resetConfirmModal();
  if (state.settingsOpen) html += Render.settingsModal();
  html += Render.toast(state.toast);
  return html;
};

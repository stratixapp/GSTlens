/**
 * gst_health_ui.js
 * GST Lens — GST Health Report Card UI
 * Renders audit results as a polished Health Report Card
 * Matches existing GST Lens design system (Syne + DM Sans, accent vars)
 */

'use strict';

const GSTHealthUI = (() => {

  // ── CSS injected once ──────────────────────────────────────────────────
  const CSS = `
    /* GST Health UI — injected styles */
    .gst-health-card {
      background: var(--white, #fff);
      border-radius: 16px;
      border: 1px solid var(--border, #e0ddd5);
      overflow: hidden;
      margin-bottom: 20px;
      box-shadow: 0 2px 16px rgba(10,10,15,0.07);
      animation: healthCardIn 0.4s ease;
    }
    @keyframes healthCardIn {
      from { opacity: 0; transform: translateY(16px); }
      to   { opacity: 1; transform: translateY(0); }
    }

    /* Header */
    .ghc-header {
      background: var(--ink2, #13131f);
      padding: 20px 24px 0;
      position: relative;
      overflow: hidden;
    }
    .ghc-header::before {
      content: '';
      position: absolute; top: -40px; right: -40px;
      width: 180px; height: 180px; border-radius: 50%;
      background: radial-gradient(circle, rgba(232,76,46,0.15) 0%, transparent 70%);
    }
    .ghc-title-row {
      display: flex; align-items: center; justify-content: space-between;
      position: relative; z-index: 1;
    }
    .ghc-title {
      font-family: 'Syne', sans-serif;
      font-size: 11px; font-weight: 800;
      letter-spacing: 2.5px; text-transform: uppercase;
      color: rgba(255,255,255,0.45);
      margin-bottom: 2px;
    }
    .ghc-inv-num {
      font-family: 'Syne', sans-serif;
      font-size: 17px; font-weight: 800; color: #fff;
    }
    .ghc-tx-badge {
      padding: 4px 12px; border-radius: 20px;
      font-size: 10px; font-weight: 800; letter-spacing: 0.8px;
      text-transform: uppercase;
    }
    .ghc-tx-badge.intrastate { background: rgba(26,127,90,0.2); color: #22a373; }
    .ghc-tx-badge.interstate { background: rgba(59,91,219,0.2); color: #748ffc; }
    .ghc-tx-badge.unknown    { background: rgba(255,255,255,0.08); color: rgba(255,255,255,0.5); }

    /* Score meter */
    .ghc-meter-wrap {
      padding: 20px 0 0;
      position: relative; z-index: 1;
    }
    .ghc-meter-row {
      display: flex; align-items: flex-end; justify-content: space-between;
      margin-bottom: 10px;
    }
    .ghc-score-big {
      font-family: 'Syne', sans-serif;
      line-height: 1;
    }
    .ghc-score-num {
      font-size: 52px; font-weight: 800;
      display: inline;
    }
    @media (max-width: 380px) {
      .ghc-score-num { font-size: 38px; }
      .ghc-rating-pill { font-size: 11px; padding: 6px 12px; }
      .ghc-header { padding: 16px 16px 0; }
      .ghc-body { padding: 16px; }
      .ghc-summary-row { padding: 12px 16px; }
      .ghc-meta { padding: 8px 16px 12px; font-size: 10px; }
    }
    .ghc-score-denom {
      font-size: 20px; font-weight: 600; color: rgba(255,255,255,0.3);
      display: inline; margin-left: 4px;
    }
    .ghc-score-label {
      font-size: 11px; font-weight: 700; letter-spacing: 1.5px;
      text-transform: uppercase; color: rgba(255,255,255,0.4);
      margin-top: 2px;
    }
    .ghc-rating-pill {
      padding: 8px 18px; border-radius: 30px;
      font-size: 13px; font-weight: 800;
      letter-spacing: 0.5px; text-transform: uppercase;
      margin-bottom: 4px;
    }
    .ghc-rating-pill.excellent { background: rgba(26,127,90,0.25); color: #22a373; }
    .ghc-rating-pill.good      { background: rgba(34,163,115,0.2); color: #3fba90; }
    .ghc-rating-pill.fair      { background: rgba(201,168,76,0.2); color: #c9a84c; }
    .ghc-rating-pill.poor      { background: rgba(232,76,46,0.2); color: #e84c2e; }
    .ghc-rating-pill.critical  { background: rgba(200,0,0,0.25); color: #ff4545; }

    /* Progress bar */
    .ghc-bar-track {
      height: 8px; border-radius: 8px;
      background: rgba(255,255,255,0.08);
      overflow: hidden; margin-bottom: 0;
    }
    .ghc-bar-fill {
      height: 100%; border-radius: 8px;
      transition: width 1.2s cubic-bezier(.22,1,.36,1);
      width: 0;
    }
    .ghc-bar-fill.excellent { background: linear-gradient(90deg, #1a7f5a, #22a373); }
    .ghc-bar-fill.good      { background: linear-gradient(90deg, #22a373, #3fba90); }
    .ghc-bar-fill.fair      { background: linear-gradient(90deg, #c9a84c, #f0cc6e); }
    .ghc-bar-fill.poor      { background: linear-gradient(90deg, #e84c2e, #ff6b47); }
    .ghc-bar-fill.critical  { background: linear-gradient(90deg, #c80000, #ff4545); }

    /* Tabs area below header */
    .ghc-tabs-strip {
      display: flex; gap: 0;
      background: rgba(255,255,255,0.04);
      margin-top: 16px;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
    }
    .ghc-tab {
      flex: 1; min-width: 80px; padding: 12px 8px; text-align: center;
      font-size: 11px; font-weight: 700; letter-spacing: 0.5px;
      color: rgba(255,255,255,0.35); cursor: pointer;
      border-bottom: 2px solid transparent; transition: all 0.2s;
      white-space: nowrap;
    }
    .ghc-tab.active { color: #fff; border-bottom-color: var(--accent, #e84c2e); }
    .ghc-tab:hover { color: rgba(255,255,255,0.7); }

    /* Body */
    .ghc-body { padding: 20px 24px; }
    .ghc-section { display: none; }
    .ghc-section.active { display: block; }

    /* Issue list */
    .ghc-issue-list { display: flex; flex-direction: column; gap: 8px; margin-bottom: 4px; }
    .ghc-issue-item {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 11px 14px; border-radius: 10px;
      font-size: 13px; line-height: 1.5;
    }
    .ghc-issue-item.error   { background: rgba(232,76,46,0.07); border: 1px solid rgba(232,76,46,0.18); color: var(--ink, #0d0d14); }
    .ghc-issue-item.warning { background: rgba(201,168,76,0.07); border: 1px solid rgba(201,168,76,0.2);  color: var(--ink, #0d0d14); }
    .ghc-issue-item.suggestion { background: rgba(26,127,90,0.06); border: 1px solid rgba(26,127,90,0.15); color: var(--ink, #0d0d14); }
    .ghc-issue-icon { font-size: 15px; flex-shrink: 0; margin-top: 1px; }
    .ghc-issue-text { flex: 1; }
    .ghc-empty {
      text-align: center; padding: 28px 16px;
      color: var(--muted, #6b6b7a); font-size: 13px;
    }
    .ghc-empty-icon { font-size: 32px; display: block; margin-bottom: 8px; }

    /* Summary badges row */
    .ghc-summary-row {
      display: flex; gap: 10px; padding: 16px 24px;
      border-top: 1px solid var(--border, #e0ddd5);
      background: var(--surface, #f4f3ef);
      flex-wrap: wrap;
    }
    .ghc-sum-badge {
      display: flex; align-items: center; gap: 6px;
      padding: 6px 13px; border-radius: 20px;
      font-size: 12px; font-weight: 700;
    }
    .ghc-sum-badge.error   { background: rgba(232,76,46,0.1); color: var(--accent, #e84c2e); }
    .ghc-sum-badge.warning { background: rgba(201,168,76,0.12); color: #7a5900; }
    .ghc-sum-badge.ok      { background: rgba(26,127,90,0.1); color: var(--green, #1a7f5a); }

    /* Audit meta */
    .ghc-meta {
      font-size: 11px; color: var(--muted, #6b6b7a);
      padding: 10px 24px 14px; border-top: 1px solid var(--border, #e0ddd5);
      display: flex; align-items: center; justify-content: space-between;
    }

    /* Dark mode compatibility */
    [data-theme="dark"] .gst-health-card { background: #1a1a28; border-color: rgba(255,255,255,0.07); }
    [data-theme="dark"] .ghc-body { background: #1a1a28; }
    [data-theme="dark"] .ghc-summary-row { background: rgba(255,255,255,0.03); border-color: rgba(255,255,255,0.07); }
    [data-theme="dark"] .ghc-meta { border-color: rgba(255,255,255,0.07); }
    [data-theme="dark"] .ghc-issue-item.error   { color: #f0f0f6; }
    [data-theme="dark"] .ghc-issue-item.warning { color: #f0f0f6; }
    [data-theme="dark"] .ghc-issue-item.suggestion { color: #f0f0f6; }
  `;

  let _cssInjected = false;
  function _injectCSS() {
    if (_cssInjected) return;
    const style = document.createElement('style');
    style.id = 'gst-health-ui-styles';
    style.textContent = CSS;
    document.head.appendChild(style);
    _cssInjected = true;
  }

  // ── Score → rating ─────────────────────────────────────────────────────
  function _getRating(score) {
    if (score >= 90) return { label: '✦ Excellent',  cls: 'excellent', emoji: '🟢' };
    if (score >= 75) return { label: '◈ Good',       cls: 'good',      emoji: '🟢' };
    if (score >= 55) return { label: '⚡ Fair',       cls: 'fair',      emoji: '🟡' };
    if (score >= 35) return { label: '⚠ Poor',       cls: 'poor',      emoji: '🔴' };
    return             { label: '✕ Critical',  cls: 'critical',  emoji: '🔴' };
  }

  // ── Score color ────────────────────────────────────────────────────────
  function _scoreColor(score) {
    if (score >= 90) return '#22a373';
    if (score >= 75) return '#3fba90';
    if (score >= 55) return '#c9a84c';
    if (score >= 35) return '#e84c2e';
    return '#ff4545';
  }

  // ── Build HTML for a report ────────────────────────────────────────────
  function buildHTML(report, invoiceNumber) {
    const { score, errors, warnings, suggestions, txType } = report;
    const rating = _getRating(score);
    const scoreColor = _scoreColor(score);
    const invLabel = invoiceNumber || 'Invoice';

    const txBadge = txType === 'intrastate'
      ? '<span class="ghc-tx-badge intrastate">Intrastate</span>'
      : txType === 'interstate'
        ? '<span class="ghc-tx-badge interstate">Interstate</span>'
        : '<span class="ghc-tx-badge unknown">Type Unknown</span>';

    // Issue rows
    function issueRows(items, type, icon) {
      if (!items.length) return `<div class="ghc-empty"><span class="ghc-empty-icon">${type === 'suggestion' ? '💡' : '✅'}</span>${type === 'suggestion' ? 'No suggestions needed.' : 'None detected.'}</div>`;
      return `<div class="ghc-issue-list">${items.map(msg => `
        <div class="ghc-issue-item ${type}">
          <span class="ghc-issue-icon">${icon}</span>
          <span class="ghc-issue-text">${_escapeHTML(msg)}</span>
        </div>`).join('')}</div>`;
    }

    const uid = 'ghc_' + Math.random().toString(36).slice(2, 8);

    return `
    <div class="gst-health-card" id="${uid}">
      <div class="ghc-header">
        <div class="ghc-title-row">
          <div>
            <div class="ghc-title">GST Health Report</div>
            <div class="ghc-inv-num">${_escapeHTML(invLabel)}</div>
          </div>
          ${txBadge}
        </div>

        <div class="ghc-meter-wrap">
          <div class="ghc-meter-row">
            <div class="ghc-score-big">
              <span class="ghc-score-num" style="color:${scoreColor}">${score}</span>
              <span class="ghc-score-denom">/ 100</span>
              <div class="ghc-score-label">Health Score</div>
            </div>
            <div class="ghc-rating-pill ${rating.cls}">${rating.label}</div>
          </div>
          <div class="ghc-bar-track">
            <div class="ghc-bar-fill ${rating.cls}" data-width="${score}" style="width:0%"></div>
          </div>
        </div>

        <div class="ghc-tabs-strip">
          <div class="ghc-tab active" data-tab="errors" onclick="GSTHealthUI._switchTab(this,'${uid}')">
            ❌ Errors <span style="opacity:.6">(${errors.length})</span>
          </div>
          <div class="ghc-tab" data-tab="warnings" onclick="GSTHealthUI._switchTab(this,'${uid}')">
            ⚠ Warnings <span style="opacity:.6">(${warnings.length})</span>
          </div>
          <div class="ghc-tab" data-tab="suggestions" onclick="GSTHealthUI._switchTab(this,'${uid}')">
            ✔ Suggestions <span style="opacity:.6">(${suggestions.length})</span>
          </div>
        </div>
      </div>

      <div class="ghc-body">
        <div class="ghc-section active" data-section="errors">
          ${issueRows(errors, 'error', '❌')}
        </div>
        <div class="ghc-section" data-section="warnings">
          ${issueRows(warnings, 'warning', '⚠️')}
        </div>
        <div class="ghc-section" data-section="suggestions">
          ${issueRows(suggestions, 'suggestion', '✔️')}
        </div>
      </div>

      <div class="ghc-summary-row">
        <span class="ghc-sum-badge error">❌ ${errors.length} Error${errors.length !== 1 ? 's' : ''}</span>
        <span class="ghc-sum-badge warning">⚠ ${warnings.length} Warning${warnings.length !== 1 ? 's' : ''}</span>
        <span class="ghc-sum-badge ok">✔ ${suggestions.length} Tip${suggestions.length !== 1 ? 's' : ''}</span>
      </div>

      <div class="ghc-meta">
        <span>GST Lens Audit Engine v2.0</span>
        <span>${new Date().toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' })}</span>
      </div>
    </div>`;
  }

  // ── Tab switcher ───────────────────────────────────────────────────────
  function _switchTab(tabEl, cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const tabName = tabEl.dataset.tab;
    card.querySelectorAll('.ghc-tab').forEach(t => t.classList.remove('active'));
    tabEl.classList.add('active');
    card.querySelectorAll('.ghc-section').forEach(s => {
      s.classList.toggle('active', s.dataset.section === tabName);
    });
  }

  // ── Animate bar after render ───────────────────────────────────────────
  function _animateBar(cardEl) {
    const fill = cardEl.querySelector('.ghc-bar-fill');
    if (!fill) return;
    const w = fill.dataset.width || 0;
    requestAnimationFrame(() => {
      setTimeout(() => { fill.style.width = w + '%'; }, 80);
    });
  }

  // ── Render into a DOM container ────────────────────────────────────────
  function render(containerId, report, invoiceNumber) {
    _injectCSS();
    const container = document.getElementById(containerId);
    if (!container) {
      console.warn(`[GSTHealthUI] Container "${containerId}" not found`);
      return;
    }
    container.innerHTML = buildHTML(report, invoiceNumber);
    const card = container.querySelector('.gst-health-card');
    if (card) _animateBar(card);
  }

  // ── Append (don't replace) — for batch view ────────────────────────────
  function append(containerId, report, invoiceNumber) {
    _injectCSS();
    const container = document.getElementById(containerId);
    if (!container) return;
    const div = document.createElement('div');
    div.innerHTML = buildHTML(report, invoiceNumber);
    const card = div.firstElementChild;
    container.appendChild(card);
    _animateBar(card);
  }

  // ── Inline badge: compact score chip (for bill list rows) ─────────────
  function scoreBadge(score) {
    const color = score >= 75 ? 'var(--green2,#22a373)' : score >= 50 ? '#c9a84c' : 'var(--accent,#e84c2e)';
    return `<span style="
      display:inline-flex;align-items:center;gap:4px;
      padding:3px 9px;border-radius:20px;
      background:${color}18;color:${color};
      font-size:10px;font-weight:800;letter-spacing:0.3px;
      font-family:'Syne',sans-serif;
    ">⬡ ${score}</span>`;
  }

  // ── HTML escape ────────────────────────────────────────────────────────
  function _escapeHTML(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Expose _switchTab globally for inline onclick handlers
  return { render, append, buildHTML, scoreBadge, _switchTab, _injectCSS };

})();

// Make _switchTab reachable from inline onclick
window.GSTHealthUI = GSTHealthUI;

// CommonJS + browser dual export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GSTHealthUI;
}

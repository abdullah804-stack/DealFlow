// ============================================================
// VENTURESCOUT — Application logic
// ============================================================

const API_BASE = 'http://localhost:8000';
const SESSION_ID = 'session_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

let currentView = 'dashboard';
let apiOnline = false;

// ============================================================
// MOCK DATA (used automatically whenever the API is unreachable,
// so the interface is always demo-able)
// ============================================================

const MOCK_COMPANIES = [
  'Halide Robotics', 'Nimbus Ledger', 'Kestrel Bio', 'Fathom Analytics',
  'Origami Compute', 'Verdant Grid', 'Cascade ML', 'Ember Materials',
  'Loom Protocol', 'Solace Health', 'Anchorpoint', 'Tessellate AI',
  'Driftwood Labs', 'Northstar Fusion', 'Quietroom', 'Palisade Security'
];

function seededRandom(seed){
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildMockFunnel(days){
  const rnd = seededRandom(days * 17);
  const discovered = Math.round(40 + rnd() * (days * 3));
  const validated = Math.round(discovered * (0.32 + rnd() * 0.1));
  const escalated = Math.round(validated * (0.28 + rnd() * 0.1));
  const invested = Math.round(escalated * (0.18 + rnd() * 0.12));
  return {
    discovered, validated, escalated, invested,
    conversion_rates: {
      discovered_to_validated: validated / Math.max(discovered, 1),
      validated_to_escalated: escalated / Math.max(validated, 1),
      escalated_to_invested: invested / Math.max(escalated, 1),
    }
  };
}

function buildMockReports(days){
  const rnd = seededRandom(days * 31);
  const count = Math.min(Math.round(days / 2) + 3, 14);
  const reports = [];
  for (let i = 0; i < count; i++){
    const score = +(3 + rnd() * 6.9).toFixed(1);
    const decision = score >= 6.4 ? 'INVEST' : 'PASS';
    const daysAgo = Math.floor(rnd() * days);
    const company = MOCK_COMPANIES[Math.floor(rnd() * MOCK_COMPANIES.length)] + (rnd() > 0.7 ? ' ' + (Math.floor(rnd()*90)+10) : '');
    reports.push({
      company,
      timestamp: new Date(Date.now() - daysAgo * 86400000).toISOString(),
      decision,
      weighted_score: score,
      fast_path: rnd() > 0.55,
      summary: mockSummary(company, decision, rnd),
      debate_summary: mockDebate(company, decision)
    });
  }
  return reports.sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
}

function mockSummary(company, decision, rnd){
  const angles = [
    'a defensible data moat and a founding team that has shipped this exact category before',
    'early usage growth that outpaces its cohort, though the market window may be narrower than the deck suggests',
    'a crowded wedge with thin technical differentiation relative to two better-funded incumbents',
    'strong retention signals from design partners, offset by a sales cycle that looks longer than the model assumes',
    'a capital-light path to default alive, with the main risk sitting in regulatory timing rather than product'
  ];
  const pick = angles[Math.floor(rnd() * angles.length)];
  return `${company} was evaluated on team, market timing, and defensibility. The case for ${decision === 'INVEST' ? 'investing' : 'passing'} centers on ${pick}.`;
}

function mockDebate(company, decision){
  return `BULL CASE\nThe team has relevant domain depth and the earliest usage data is ahead of comparable seed-stage benchmarks. Distribution looks organic rather than paid, which is a good early signal.\n\nBEAR CASE\nMarket sizing in the deck leans on a top-down TAM that hasn't been validated bottom-up. Competitive response from adjacent incumbents is a real risk within 12-18 months.\n\nRESOLUTION\nWeighing team execution against market risk, the debate concluded in favor of a ${decision} decision for ${company}, with a recommendation to revisit after the next usage-data checkpoint.`;
}

function buildMockBacktest(){
  const rnd = seededRandom(99);
  const startups = MOCK_COMPANIES.slice(0, 9).map((name, i) => {
    const predicted = rnd() > 0.4 ? 'INVEST' : 'PASS';
    const aligned = rnd() > 0.28;
    const actual = aligned ? predicted : (predicted === 'INVEST' ? 'PASS' : 'INVEST');
    return {
      name,
      predicted,
      actual,
      aligned,
      note: aligned
        ? 'Outcome tracked the model\'s original call'
        : 'Outcome diverged — reviewed in the retro log'
    };
  });
  const alignedCount = startups.filter(s => s.aligned).length;
  return {
    accuracy: alignedCount / startups.length,
    total_evaluated: startups.length,
    avg_lead_time_days: 11,
    startups
  };
}

const MOCK_CHAT_ANSWERS = [
  {
    match: /recent|latest|evaluat/i,
    text: 'In the last stretch, the system ran full evaluations on 9 companies, escalating 3 for deeper debate. Two were infrastructure plays, one was a vertical health-tech application.'
  },
  {
    match: /ai|artificial intelligence/i,
    text: 'AI-adjacent startups make up roughly a third of what gets discovered, but a smaller share clear the validation stage — the model tends to discount companies whose defensibility is "we use an LLM" without a proprietary data loop.'
  },
  {
    match: /best|good|top|invest/i,
    text: 'The strongest calls so far share a pattern: founder-market fit that predates the company, and usage data collected before the round even opened. The weaker ones leaned too heavily on TAM slides.'
  },
  {
    match: /trend/i,
    text: 'Over the last 30 days, discovery volume is up but the validation rate has tightened slightly — the bar for what counts as a defensible moat has been raised after two reviewed misses.'
  }
];

function mockChatAnswer(question){
  const hit = MOCK_CHAT_ANSWERS.find(a => a.match.test(question));
  return hit ? hit.text : 'I don\'t have a strong memory of that yet — try asking about recent evaluations, sector patterns, or investment trends and I\'ll pull what the system has logged.';
}

// ============================================================
// API
// ============================================================

async function apiCall(endpoint, options = {}) {
  const url = API_BASE + endpoint;
  const defaultOptions = { headers: { 'Content-Type': 'application/json' } };
  const response = await fetch(url, { ...defaultOptions, ...options });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API Error (${response.status}): ${text}`);
  }
  return await response.json();
}

// ============================================================
// DOM HELPERS
// ============================================================

const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function showView(viewId) {
  $$('.view').forEach(v => v.classList.remove('active'));
  const view = document.getElementById('view-' + viewId);
  if (view) view.classList.add('active');

  $$('.nav-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.view === viewId));

  currentView = viewId;

  switch (viewId) {
    case 'reports': loadReports(); break;
    case 'funnel': loadFunnel(); break;
    case 'backtest': loadBacktest(); break;
  }
}

function setLoading(containerId, label = 'Loading…') {
  const el = document.getElementById(containerId);
  if (el) el.innerHTML = `<div class="loading-state">${label}</div>`;
}

function setEmpty(containerId, message, code = null) {
  const el = document.getElementById(containerId);
  if (!el) return;
  let html = `<div class="empty-state"><div class="empty-icon">◌</div><h3>${message}</h3></div>`;
  if (code) html += `<div class="empty-state" style="margin-top:8px;"><code class="code-block">${code}</code></div>`;
  el.innerHTML = html;
}

function fmtDate(iso){
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// count-up animation for stat numbers
function countUp(el, target, duration = 900){
  const start = 0;
  const startTime = performance.now();
  function tick(now){
    const p = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ============================================================
// CLOCK
// ============================================================

function tickClock(){
  const el = document.getElementById('currentTime');
  if (el) el.textContent = new Date().toLocaleTimeString(undefined, { hour12: false });
}

// ============================================================
// HEALTH CHECK
// ============================================================

async function checkHealth() {
  const statusEl = document.getElementById('apiStatus');
  const dotEl = document.getElementById('statusDot');
  try {
    await apiCall('/health');
    apiOnline = true;
    statusEl.textContent = 'live';
    statusEl.className = 'status-ok';
    dotEl.className = 'status-dot ok';
  } catch (error) {
    apiOnline = false;
    statusEl.textContent = 'demo data';
    statusEl.className = 'status-checking';
    dotEl.className = 'status-dot err';
  }
}

// ============================================================
// TICKER
// ============================================================

function renderTicker(reports){
  const track = document.getElementById('tickerTrack');
  if (!track) return;
  const items = reports.length ? reports : buildMockReports(14);
  const build = (r) => {
    const cls = r.decision === 'INVEST' ? 'tk-up' : 'tk-down';
    const symbol = r.decision === 'INVEST' ? '▲' : '▼';
    return `<span><span class="tk-name">${r.company || r.title}</span> · <span class="${cls}">${symbol} ${r.decision}</span> · ${r.weighted_score.toFixed(1)}/10</span>`;
  };
  const html = items.map(build).join('<span style="color:var(--border);">|</span>');
  track.innerHTML = html + '<span style="color:var(--border);">|</span>' + html; // duplicate for seamless loop
}

// ============================================================
// PULSE CHART (signature signal on dashboard hero)
// ============================================================

function renderPulse(){
  const line = document.getElementById('pulseLine');
  if (!line) return;
  const rnd = seededRandom(7);
  const points = [];
  const w = 320, h = 90, n = 28;
  for (let i = 0; i <= n; i++){
    const x = (i / n) * w;
    const base = h * 0.55;
    const wobble = Math.sin(i * 0.7) * 14 + (rnd() - 0.5) * 22;
    const spike = (i % 9 === 0) ? -18 : 0;
    const y = Math.min(Math.max(base + wobble + spike, 8), h - 8);
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  }
  line.setAttribute('points', points.join(' '));
}

// ============================================================
// DASHBOARD
// ============================================================

async function loadDashboard() {
  let data;
  try {
    data = await apiCall('/funnel?days=7');
  } catch (error) {
    data = buildMockFunnel(7);
  }
  countUp(document.getElementById('statDiscovered'), data.discovered || 0);
  countUp(document.getElementById('statValidated'), data.validated || 0);
  countUp(document.getElementById('statEscalated'), data.escalated || 0);
  countUp(document.getElementById('statInvested'), data.invested || 0);

  let reports;
  try {
    const rd = await apiCall('/reports?days=14');
    reports = rd.reports || [];
  } catch (error) {
    reports = buildMockReports(14);
  }
  renderTicker(reports);
}

// ============================================================
// REPORTS
// ============================================================

async function loadReports() {
  const container = document.getElementById('reportsContent');
  const days = document.getElementById('reportsDays')?.value || 7;
  setLoading('reportsContent', 'Loading reports…');

  let reports;
  try {
    const data = await apiCall(`/reports?days=${days}`);
    reports = data.reports || [];
  } catch (error) {
    reports = buildMockReports(Number(days));
  }

  if (reports.length === 0) {
    setEmpty('reportsContent', `No reports found in the last ${days} days.`);
    return;
  }

  let html = '<div class="reports-list">';
  for (const report of reports) {
    const decisionClass = report.decision === 'INVEST' ? 'invest' : 'pass';
    const filled = Math.min(Math.round(report.weighted_score / 2), 5);
    const stars = '●'.repeat(filled) + '○'.repeat(Math.max(0, 5 - filled));
    html += `
      <div class="report-item">
        <div class="report-header">
          <div>
            <div class="report-title">${report.company || report.title}</div>
            <div class="report-meta">${fmtDate(report.timestamp)} · ${report.fast_path ? 'FAST-PATH' : 'FULL DEBATE'}</div>
          </div>
          <div>
            <span class="report-decision ${decisionClass}">${report.decision}</span>
            <div class="report-score">${stars} <b>${report.weighted_score.toFixed(1)}</b>/10</div>
          </div>
        </div>
        <div class="report-body">
          <div class="report-summary">${report.summary || 'No summary available.'}</div>
          ${report.debate_summary ? `
            <details class="report-details">
              <summary>View full debate</summary>
              <div class="report-details-content">${report.debate_summary}</div>
            </details>
          ` : ''}
        </div>
      </div>
    `;
  }
  html += '</div>';
  container.innerHTML = html;
}

// ============================================================
// FUNNEL
// ============================================================

async function loadFunnel() {
  const container = document.getElementById('funnelContent');
  const days = document.getElementById('funnelDays')?.value || 30;
  setLoading('funnelContent', 'Loading funnel data…');

  let data;
  try {
    data = await apiCall(`/funnel?days=${days}`);
  } catch (error) {
    data = buildMockFunnel(Number(days));
  }

  if (!data || (data.discovered === 0 && data.validated === 0)) {
    setEmpty('funnelContent', `No funnel data available for the last ${days} days.`);
    return;
  }

  const discovered = data.discovered || 0;
  const validated = data.validated || 0;
  const escalated = data.escalated || 0;
  const invested = data.invested || 0;
  const rates = data.conversion_rates || {};

  const stages = [
    { id: 'discovered', label: 'Discovered', value: discovered, cls: 'fs-discovered' },
    { id: 'validated', label: 'Validated', value: validated, cls: 'fs-validated' },
    { id: 'escalated', label: 'Escalated', value: escalated, cls: 'fs-escalated' },
    { id: 'invested', label: 'Invested', value: invested, cls: 'fs-invested' },
  ];

  let rowHtml = '<div class="funnel-stage-row">';
  stages.forEach((s, i) => {
    rowHtml += `
      <div class="funnel-stage ${s.cls}">
        <div class="funnel-shape">
          <div class="funnel-value">${s.value}</div>
          <div class="funnel-name">${s.label}</div>
        </div>
      </div>`;
    if (i < stages.length - 1) rowHtml += `<div class="funnel-connector">→</div>`;
  });
  rowHtml += '</div>';

  const pct = (x) => x ? Math.round(x * 100) + '%' : '—';

  const html = `
    <div class="funnel-wrap">
      <h3>Stage volume</h3>
      ${rowHtml}
    </div>
    <div class="conversion-grid">
      <div class="conversion-item c-blue">
        <div class="conversion-number">${pct(rates.discovered_to_validated ?? (discovered ? validated/discovered : 0))}</div>
        <div class="conversion-label">Discovered → Validated</div>
      </div>
      <div class="conversion-item c-amber">
        <div class="conversion-number">${pct(rates.validated_to_escalated ?? (validated ? escalated/validated : 0))}</div>
        <div class="conversion-label">Validated → Escalated</div>
      </div>
      <div class="conversion-item c-teal">
        <div class="conversion-number">${pct(rates.escalated_to_invested ?? (escalated ? invested/escalated : 0))}</div>
        <div class="conversion-label">Escalated → Invested</div>
      </div>
    </div>
  `;
  container.innerHTML = html;
}

// ============================================================
// BACKTEST
// ============================================================

async function loadBacktest() {
  const container = document.getElementById('backtestContent');
  setLoading('backtestContent', 'Loading backtest results…');

  let data;
  try {
    data = await apiCall('/backtest');
  } catch (error) {
    data = buildMockBacktest();
  }

  const startups = data.startups || [];
  if (startups.length === 0) {
    setEmpty('backtestContent', 'No backtest data available yet.');
    return;
  }

  const accuracyPct = Math.round((data.accuracy || 0) * 100);

  let listHtml = '<div class="startup-list">';
  for (const s of startups) {
    listHtml += `
      <div class="startup-item">
        <div>
          <div class="startup-name">${s.name}</div>
          <div class="startup-details">predicted ${s.predicted} · actual ${s.actual}${s.note ? ' · ' + s.note : ''}</div>
        </div>
        <div class="startup-status ${s.aligned ? 'aligned' : 'misaligned'}">${s.aligned ? 'ALIGNED' : 'DIVERGED'}</div>
      </div>
    `;
  }
  listHtml += '</div>';

  container.innerHTML = `
    <div class="note-box">Backtest scores reflect model calls checked against later outcomes — not live trading performance.</div>
    <div class="backtest-summary">
      <div class="backtest-card green"><div class="number">${accuracyPct}%</div><div class="label">Directional accuracy</div></div>
      <div class="backtest-card blue"><div class="number">${data.total_evaluated ?? startups.length}</div><div class="label">Companies backtested</div></div>
      <div class="backtest-card purple"><div class="number">${data.avg_lead_time_days ?? '—'}d</div><div class="label">Avg. lead time to signal</div></div>
    </div>
    ${listHtml}
  `;
}

// ============================================================
// CHAT
// ============================================================

function appendChatMessage(role, text){
  const messages = document.getElementById('chatMessages');
  const empty = messages.querySelector('.chat-empty');
  if (empty) empty.remove();

  const wrap = document.createElement('div');
  wrap.className = `chat-message ${role}`;
  const bubble = document.createElement('div');
  bubble.className = 'chat-bubble';
  bubble.textContent = text;
  wrap.appendChild(bubble);
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
  return bubble;
}

function appendTyping(){
  const messages = document.getElementById('chatMessages');
  const wrap = document.createElement('div');
  wrap.className = 'chat-message assistant';
  wrap.id = 'typingIndicator';
  wrap.innerHTML = `<div class="chat-bubble"><span class="typing-dots"><span></span><span></span><span></span></span></div>`;
  messages.appendChild(wrap);
  messages.scrollTop = messages.scrollHeight;
}

function removeTyping(){
  document.getElementById('typingIndicator')?.remove();
}

async function sendChatMessage(text){
  if (!text.trim()) return;
  appendChatMessage('user', text);
  appendTyping();

  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  try {
    let answer;
    try {
      const data = await apiCall('/chat', {
        method: 'POST',
        body: JSON.stringify({ message: text, session_id: SESSION_ID }),
      });
      answer = data.response || data.answer || 'No response received.';
    } catch (error) {
      await new Promise(r => setTimeout(r, 500 + Math.random() * 500));
      answer = mockChatAnswer(text);
    }
    removeTyping();
    appendChatMessage('assistant', answer);
  } catch (e) {
    removeTyping();
    appendChatMessage('assistant', 'Something went wrong reaching memory. Try again in a moment.');
  } finally {
    sendBtn.disabled = false;
  }
}

function askSuggested(el){
  const input = document.getElementById('chatInput');
  input.value = el.textContent;
  sendChatMessage(el.textContent);
  input.value = '';
}

// ============================================================
// EVENT WIRING
// ============================================================

function wireEvents(){
  $$('.nav-btn').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
  $$('.nav-card').forEach(card => card.addEventListener('click', (e) => {
    e.preventDefault();
    showView(card.dataset.view);
  }));

  document.getElementById('reportsDays')?.addEventListener('change', loadReports);
  document.getElementById('funnelDays')?.addEventListener('change', loadFunnel);

  const sendBtn = document.getElementById('sendBtn');
  const chatInput = document.getElementById('chatInput');
  sendBtn?.addEventListener('click', () => {
    const text = chatInput.value;
    chatInput.value = '';
    sendChatMessage(text);
  });
  chatInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey){
      e.preventDefault();
      const text = chatInput.value;
      chatInput.value = '';
      sendChatMessage(text);
    }
  });

  document.getElementById('clearChatBtn')?.addEventListener('click', () => {
    document.getElementById('chatMessages').innerHTML = `
      <div class="chat-empty">
        <div class="chat-empty-icon">◇</div>
        <p>Try asking</p>
        <ul class="chat-suggestions">
          <li onclick="askSuggested(this)">What startups have we evaluated recently?</li>
          <li onclick="askSuggested(this)">Tell me about AI startups in the portfolio</li>
          <li onclick="askSuggested(this)">What were the best investment decisions?</li>
          <li onclick="askSuggested(this)">Show me trends in the last 30 days</li>
        </ul>
      </div>`;
  });
}

// ============================================================
// INIT
// ============================================================

async function init(){
  wireEvents();
  tickClock();
  setInterval(tickClock, 1000);
  renderPulse();
  await checkHealth();
  await loadDashboard();
}

document.addEventListener('DOMContentLoaded', init);
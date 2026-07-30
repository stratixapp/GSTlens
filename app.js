/* ==========================================================================
   Skelora Procurement Simulator
   Vanilla HTML/CSS/JS. No frameworks, no build step, no external services.
   All data lives in this browser's localStorage. Students perform every
   step of the procure-to-pay cycle themselves; nothing procurement-related
   is pre-filled for them.
   ========================================================================== */

const DB_KEY = "skelora_proc_db_v1";
const SESSION_KEY = "skelora_proc_session_v1";

const STAGES = [
  { key:"need",        num:1,  name:"Department Needs Item" },
  { key:"pr",           num:2,  name:"Purchase Requisition" },
  { key:"approval",     num:3,  name:"Manager Approval" },
  { key:"rfq",          num:4,  name:"Request for Quotation" },
  { key:"quotations",   num:5,  name:"Receive Quotations" },
  { key:"comparison",   num:6,  name:"Quotation Comparison" },
  { key:"selection",    num:7,  name:"Select Vendor" },
  { key:"po",           num:8,  name:"Create Purchase Order" },
  { key:"delivery",     num:9,  name:"Vendor Delivery" },
  { key:"grn",          num:10, name:"Goods Receipt Note" },
  { key:"invoice",      num:11, name:"Invoice Verification" },
  { key:"payment",      num:12, name:"Payment Request" },
  { key:"closed",       num:13, name:"Purchase Closed" }
];

/* ============================== utilities =============================== */

function $(sel, root){ return (root||document).querySelector(sel); }
function $$(sel, root){ return Array.from((root||document).querySelectorAll(sel)); }

function escapeHtml(str){
  if (str === undefined || str === null) return "";
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

function todayISO(){ return new Date().toISOString().slice(0,10); }

function fmtDate(iso){
  if (!iso) return "—";
  const d = new Date(iso + (iso.length===10 ? "T00:00:00" : ""));
  if (isNaN(d)) return iso;
  return d.toLocaleDateString("en-IN", { day:"2-digit", month:"short", year:"numeric" });
}

function fmtDateTime(iso){
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d)) return iso;
  return d.toLocaleString("en-IN", { day:"2-digit", month:"short", year:"numeric", hour:"2-digit", minute:"2-digit" });
}

function fmtMoney(n){
  const v = Number(n);
  if (isNaN(v)) return "₹0.00";
  return "₹" + v.toLocaleString("en-IN", { minimumFractionDigits:2, maximumFractionDigits:2 });
}

function gstBreakdown(qty, unitPrice, gstRate){
  const taxable = (Number(qty)||0) * (Number(unitPrice)||0);
  const gst = taxable * (Number(gstRate)||0) / 100;
  return { taxable, gst, grand: taxable + gst };
}

/* Multi-line-item aggregation. Lines carry {description, qty, uom, unitPrice, gstRate}.
   Downstream stages (PO, delivery, GRN, invoice) hold PARALLEL arrays indexed the
   same way as pr.lineItems — line 0 in the PR is line 0 everywhere downstream. */
function linesTotals(lines){
  return (lines||[]).reduce((acc, li)=>{
    const b = gstBreakdown(li.qty, li.unitPrice, li.gstRate);
    acc.taxable += b.taxable; acc.gst += b.gst; acc.grand += b.grand;
    return acc;
  }, { taxable:0, gst:0, grand:0 });
}
const MAX_LINE_ITEMS = 8;
function blankLineItem(){ return { description:"", qty:"", uom:"", unitPrice:"", gstRate: DEFAULT_GST_RATE }; }

/* Sums a per-line quantity array across several shipment/GRN records —
   e.g. cumulativeQty(c.stages.deliveries, n, 'qtyDelivered') gives, for each
   PO line, the total delivered across every shipment recorded so far. */
function cumulativeQty(records, lineCount, field){
  const totals = new Array(lineCount).fill(0);
  (records||[]).forEach(r=> (r[field]||[]).forEach((q,i)=> totals[i] += Number(q)||0));
  return totals;
}

function uid(prefix){
  return prefix + Math.random().toString(36).slice(2,8).toUpperCase();
}

function toast(msg, type){
  const root = $("#toast-root");
  const t = document.createElement("div");
  t.className = "toast" + (type ? " " + type : "");
  t.textContent = msg;
  root.appendChild(t);
  setTimeout(()=>{ t.style.opacity="0"; t.style.transition="opacity .25s"; setTimeout(()=>t.remove(),250); }, 3200);
}

/* ================================ storage ================================ */

function loadDB(){
  try{
    const raw = localStorage.getItem(DB_KEY);
    const db = raw ? JSON.parse(raw) : {};
    db.students = db.students || {};
    db.cases = db.cases || {};
    db.counters = db.counters || {};
    if (!db.vendors) db.vendors = JSON.parse(JSON.stringify(VENDOR_DIRECTORY));
    if (!db.budgetCodes) db.budgetCodes = JSON.parse(JSON.stringify(BUDGET_CODES));
    return db;
  }catch(e){
    console.error("DB load failed", e);
    return { students:{}, cases:{}, counters:{}, vendors: JSON.parse(JSON.stringify(VENDOR_DIRECTORY)), budgetCodes: JSON.parse(JSON.stringify(BUDGET_CODES)) };
  }
}
function saveDB(db){ localStorage.setItem(DB_KEY, JSON.stringify(db)); }

function getVendors(db){ return db.vendors; }
function getBudgetCodes(db){ return db.budgetCodes; }

/* ---- session: {id, expiresAt} JSON, absolute expiry set at login ---- */
function getSession(){
  try{
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.expiresAt || Date.now() > s.expiresAt){ localStorage.removeItem(SESSION_KEY); return null; }
    return s.id;
  }catch(e){ return null; }
}
function setSession(studentId, rememberMe){
  const hours = rememberMe ? 24*30 : 8;
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: studentId, expiresAt: Date.now() + hours*3600*1000 }));
}
function clearSession(){ localStorage.removeItem(SESSION_KEY); }

function nextNumber(db, type){
  const year = new Date().getFullYear();
  const ck = type + "-" + year;
  db.counters[ck] = (db.counters[ck] || 0) + 1;
  const seq = String(db.counters[ck]).padStart(4,"0");
  return `${type}-${year}-${seq}`;
}

/* ============================ password hashing ============================
   SHA-256 via the Web Crypto API when available (requires a secure context —
   https, localhost, or a local file:// page in most browsers, which is how
   this app is normally opened). A non-cryptographic fallback keeps the app
   usable if SubtleCrypto is unavailable, so a login system is never bricked —
   though this is still a fully client-side app with no server, so treat this
   as professional hygiene, not the same guarantee as server-side auth. */

function randomSalt(){
  const bytes = new Uint8Array(16);
  (window.crypto || {}).getRandomValues ? crypto.getRandomValues(bytes) : bytes.forEach((_,i)=>bytes[i]=Math.floor(Math.random()*256));
  return Array.from(bytes).map(b=>b.toString(16).padStart(2,"0")).join("");
}

function fallbackHash(str){
  let h = 5381;
  for (let i=0;i<str.length;i++){ h = ((h*33) ^ str.charCodeAt(i)) >>> 0; }
  return "fb" + h.toString(16);
}

async function sha256Hex(str){
  if (window.crypto && window.crypto.subtle && window.crypto.subtle.digest){
    try{
      const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
      return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,"0")).join("");
    }catch(e){ /* fall through to fallback */ }
  }
  return fallbackHash(str);
}

async function hashSecret(secret, salt){ return sha256Hex(salt + ":" + secret); }
async function verifySecret(secret, salt, hash){ return (await hashSecret(secret, salt)) === hash; }

function passwordStrength(pw){
  let score = 0;
  if (!pw) return { score:0, label:"Too short" };
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const labels = ["Too short","Weak","Fair","Good","Strong","Very Strong"];
  return { score, label: labels[Math.min(score,5)] };
}

/* =============================== app state =============================== */

let STATE = {
  view: "login",        // login | dashboard | newcase | case | settings | vendors | budgets | reports
  authTab: "signin",    // signin | register | forgot
  forgotStep: 1,
  forgotStudent: null,
  signinIdPrefill: "",
  loginLockRemaining: null,
  studentId: null,
  caseId: null,
  viewingStage: null,   // which stage index is being displayed within a case
  notifOpen: false,
  accountMenuOpen: false,
  helpOpen: false,
  dashSearch: "",
  dashFilter: "all",
  instructorTab: "overview",
  negotiatingVendorId: null,
  negotiationSent: null,
  amendingPO: false,
  amendingPOCaseId: null,
  instructorViewStudentId: null,
  reviewCaseId: null,
  sessionWarning: false,
  lastActivity: Date.now()
};

/* ================================ students ================================ */

const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15*60*1000;

function studentList(db){
  return Object.values(db.students).sort((a,b)=> a.name.localeCompare(b.name));
}

async function registerStudent(db, {name, rollNo, batch, email, role, password, securityQuestion, securityAnswer}){
  const id = rollNo.trim().toUpperCase();
  const salt = randomSalt();
  const secSalt = randomSalt();
  db.students[id] = {
    id, name:name.trim(), batch:(batch||"").trim(), email:(email||"").trim(),
    role: role === "instructor" ? "instructor" : "student",
    salt, passwordHash: await hashSecret(password, salt),
    securityQuestion, secSalt, securityAnswerHash: await hashSecret(securityAnswer.trim().toLowerCase(), secSalt),
    failedAttempts: 0, lockUntil: null,
    loginHistory: [],
    createdAt: new Date().toISOString()
  };
  saveDB(db);
  return db.students[id];
}

/* Returns { ok:true, student } | { ok:false, reason, lockRemainingMs } */
async function attemptLogin(db, rollNo, password){
  const id = (rollNo||"").trim().toUpperCase();
  const s = db.students[id];
  if (!s) return { ok:false, reason:"No profile found for that Student ID." };

  if (s.lockUntil && Date.now() < s.lockUntil){
    return { ok:false, reason:"locked", lockRemainingMs: s.lockUntil - Date.now() };
  }

  const valid = await verifySecret(password, s.salt, s.passwordHash);
  if (!valid){
    s.failedAttempts = (s.failedAttempts||0) + 1;
    if (s.failedAttempts >= LOCKOUT_MAX_ATTEMPTS){
      s.lockUntil = Date.now() + LOCKOUT_MS;
      s.failedAttempts = 0;
      saveDB(db);
      return { ok:false, reason:"locked", lockRemainingMs: LOCKOUT_MS };
    }
    saveDB(db);
    return { ok:false, reason:`Incorrect password. ${LOCKOUT_MAX_ATTEMPTS - s.failedAttempts} attempt(s) remaining before lockout.` };
  }

  s.failedAttempts = 0; s.lockUntil = null;
  s.loginHistory = s.loginHistory || [];
  s.loginHistory.unshift(new Date().toISOString());
  s.loginHistory = s.loginHistory.slice(0,10);
  saveDB(db);
  return { ok:true, student: s };
}

/* ================================= cases ================================= */

function createCase(db, student, scenario){
  const seq = (db.counters["CASE"] = (db.counters["CASE"]||0)+1);
  const id = `CASE-${new Date().getFullYear()}-${String(seq).padStart(3,"0")}`;
  const c = {
    id, studentId: student.id, studentName: student.name,
    scenario: JSON.parse(JSON.stringify(scenario)),
    createdAt: new Date().toISOString(),
    currentStage: 1,
    rejected: false,
    terminated: false,
    terminatedReason: "",
    completed: {},
    stages: { quotations: [] },
    history: []
  };
  db.cases[id] = c;
  saveDB(db);
  addHistory(db, c, `Case opened for ${scenario.department} — ${scenario.itemName}.`);
  return c;
}

function addHistory(db, c, text){
  c.history.push({ ts: new Date().toISOString(), text });
  saveDB(db);
}

function getCasesForStudent(db, studentId){
  return Object.values(db.cases).filter(c=>c.studentId===studentId)
    .sort((a,b)=> new Date(b.createdAt) - new Date(a.createdAt));
}

/* ================================ rendering =============================== */

function render(){
  const app = $("#app");
  const db = loadDB();

  if (STATE.view === "login") { app.innerHTML = viewLogin(db); bindLogin(db); return; }

  const student = db.students[STATE.studentId];
  if (!student){ STATE.view="login"; return render(); }

  if (STATE.view === "dashboard") {
    if (student.role === "instructor"){
      app.innerHTML = shell(db, student, viewInstructorConsole(db, student));
      bindInstructorConsole(db, student);
    } else {
      app.innerHTML = shell(db, student, viewDashboard(db, student));
      bindDashboard(db, student);
    }
    bindShellCommon(db, student); return;
  }
  if (STATE.view === "newcase")   { app.innerHTML = shell(db, student, viewNewCase());              bindNewCase(db, student);   bindShellCommon(db, student); return; }
  if (STATE.view === "case")      {
    const c = db.cases[STATE.caseId];
    if (!c){ STATE.view="dashboard"; return render(); }
    app.innerHTML = shell(db, student, viewCase(db, c));
    bindCase(db, c);
    bindShellCommon(db, student); return;
  }
  if (STATE.view === "settings")  { app.innerHTML = shell(db, student, viewSettings(db, student));  bindSettings(db, student); bindShellCommon(db, student); return; }
  if (STATE.view === "vendors")   { app.innerHTML = shell(db, student, viewVendors(db, student));    bindVendors(db, student);  bindShellCommon(db, student); return; }
  if (STATE.view === "budgets")   { app.innerHTML = shell(db, student, viewBudgets(db, student));    bindBudgets(db, student);  bindShellCommon(db, student); return; }
  if (STATE.view === "reports")   { app.innerHTML = shell(db, student, viewReports(db, student));    bindReports(db, student);  bindShellCommon(db, student); return; }
  if (STATE.view === "instructorCaseReview") {
    const c = db.cases[STATE.reviewCaseId];
    if (!c){ STATE.view="dashboard"; return render(); }
    app.innerHTML = shell(db, student, viewInstructorCaseReview(db, c));
    bindInstructorCaseReview(db, c);
    bindShellCommon(db, student); return;
  }
}

function bindShellCommon(db, student){
  $$("[data-act='dashboard']").forEach(b=> b.addEventListener("click", ()=>{ STATE.view="dashboard"; STATE.viewingStage=null; render(); }));
  $$("[data-act='vendors']").forEach(b=> b.addEventListener("click", ()=>{ STATE.view="vendors"; render(); }));
  $$("[data-act='budgets']").forEach(b=> b.addEventListener("click", ()=>{ STATE.view="budgets"; render(); }));
  $$("[data-act='reports']").forEach(b=> b.addEventListener("click", ()=>{ STATE.view="reports"; render(); }));
  $$("[data-act='settings']").forEach(b=> b.addEventListener("click", ()=>{ STATE.view="settings"; STATE.accountMenuOpen=false; render(); }));
  $$("[data-act='logout']").forEach(b=> b.addEventListener("click", ()=>{ clearSession(); STATE.studentId=null; STATE.view="login"; STATE.accountMenuOpen=false; render(); }));
  $$("[data-act='notif']").forEach(b=> b.addEventListener("click", (e)=>{ e.stopPropagation(); STATE.notifOpen=!STATE.notifOpen; STATE.accountMenuOpen=false; render(); }));
  $$("[data-act='account']").forEach(b=> b.addEventListener("click", (e)=>{ e.stopPropagation(); STATE.accountMenuOpen=!STATE.accountMenuOpen; STATE.notifOpen=false; render(); }));
  $$("[data-act='help']").forEach(b=> b.addEventListener("click", ()=>{ STATE.helpOpen = true; render(); }));
  $$("[data-act='help-close']").forEach(b=> b.addEventListener("click", ()=>{ STATE.helpOpen = false; render(); }));
  $$("[data-open-case]").forEach(b=> b.addEventListener("click", ()=>{ STATE.caseId=b.dataset.openCase; STATE.viewingStage=null; STATE.view="case"; STATE.notifOpen=false; render(); }));
  const stay = $("#stayLoggedIn");
  if (stay) stay.addEventListener("click", ()=>{ STATE.sessionWarning=false; STATE.lastActivity=Date.now(); render(); });

  if (STATE.notifOpen || STATE.accountMenuOpen){
    document.addEventListener("click", function outsideClose(e){
      if (e.target.closest(".bell-wrap") || e.target.closest(".account-wrap")) return;
      STATE.notifOpen = false; STATE.accountMenuOpen = false;
      document.removeEventListener("click", outsideClose);
      render();
    });
  }
}

function shell(db, student, innerHtml){
  const notifs = student.role === "instructor" ? [] : computeNotifications(db, student);
  const isInstructor = student.role === "instructor";
  return `
    <div class="topbar no-print">
      <div class="brand">
        <div class="mark">SK</div>
        <div class="brand-text">
          <div class="name">Skelora Procurement Simulator</div>
          <div class="tag">PROCURE-TO-PAY TRAINING CONSOLE${isInstructor ? " · INSTRUCTOR" : ""}</div>
        </div>
      </div>
      <div class="who">
        ${!isInstructor ? `
          <button class="btn-ghost-dark" data-act="dashboard">Dashboard</button>
          <button class="btn-ghost-dark" data-act="vendors">Vendors</button>
          <button class="btn-ghost-dark" data-act="budgets">Budgets</button>
          <button class="btn-ghost-dark" data-act="reports">Reports</button>
        ` : `
          <button class="btn-ghost-dark" data-act="dashboard">Console</button>
        `}
        <button class="btn-ghost-dark" data-act="help" aria-label="Open glossary of procurement terms">? Help</button>
        <div class="bell-wrap">
          <button class="btn-ghost-dark bell-btn" data-act="notif" aria-label="Notifications">🔔${notifs.length?`<span class="bell-dot">${notifs.length}</span>`:""}</button>
          ${STATE.notifOpen ? `
            <div class="dropdown-panel">
              <div class="dropdown-title">Needs Attention</div>
              ${notifs.length ? notifs.map(n=>`<div class="dropdown-item" data-open-case="${n.caseId}">${escapeHtml(n.text)}</div>`).join("") : `<div class="dropdown-empty">Nothing needs attention right now.</div>`}
            </div>
          ` : ""}
        </div>
        <div class="account-wrap">
          <button class="btn-ghost-dark" data-act="account" aria-label="Account menu">${escapeHtml(student.name)} <span class="muted">▾</span></button>
          ${STATE.accountMenuOpen ? `
            <div class="dropdown-panel">
              <div class="dropdown-item" data-act="settings">Settings</div>
              <div class="dropdown-item" data-act="logout">Log out</div>
            </div>
          ` : ""}
        </div>
      </div>
    </div>
    <div class="shell">${innerHtml}</div>
    ${STATE.sessionWarning ? sessionWarningModal() : ""}
    ${STATE.helpOpen ? helpDrawerHtml() : ""}
  `;
}

function sessionWarningModal(){
  return `
  <div class="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="Session about to expire">
    <div class="modal-card">
      <h3>Still there?</h3>
      <p class="small muted">You've been inactive for a while. For security, you'll be logged out shortly.</p>
      <div class="btn-row"><button class="btn btn-primary btn-block" id="stayLoggedIn">Stay Logged In</button></div>
    </div>
  </div>`;
}

/* --------------------------------- login --------------------------------- */

const RECENT_IDS_KEY = "skelora_proc_recent_ids_v1";
function recentIds(){ try{ return JSON.parse(localStorage.getItem(RECENT_IDS_KEY)||"[]"); }catch(e){ return []; } }
function pushRecentId(id){
  let r = recentIds().filter(x=>x!==id);
  r.unshift(id);
  localStorage.setItem(RECENT_IDS_KEY, JSON.stringify(r.slice(0,5)));
}

function viewLogin(db){
  const tab = STATE.authTab;

  return `
  <div class="center-shell">
    <div class="auth-card">
      <div class="auth-brand">
        <div class="mark">SK</div>
        <h1>Skelora Procurement Simulator</h1>
        <p>PROCURE-TO-PAY TRAINING CONSOLE</p>
      </div>
      <div class="tabs">
        <button data-tab="signin" class="${tab==="signin"?"active":""}">Sign In</button>
        <button data-tab="register" class="${tab==="register"?"active":""}">New Profile</button>
      </div>

      ${tab==="signin" ? viewSignIn() : tab==="forgot" ? viewForgotPassword(db) : viewRegister()}

      <p class="small muted" style="margin-top:16px;text-align:center;">
        Profiles and case data are stored locally in this browser only — nothing leaves this device.
      </p>
    </div>
  </div>`;
}

function viewSignIn(){
  const recents = recentIds();
  const locked = STATE.loginLockRemaining;
  return `
    ${recents.length ? `
      <div class="chip-row" style="margin-bottom:12px;">
        ${recents.map(id=>`<button type="button" class="chip-btn" data-recent="${escapeHtml(id)}">${escapeHtml(id)}</button>`).join("")}
      </div>
    ` : ""}
    <form id="signinForm">
      <div class="field">
        <label>Student ID <span class="req">*</span></label>
        <input type="text" name="rollNo" id="signinId" required placeholder="e.g. SKP2026-014" class="mono-input" value="${escapeHtml(STATE.signinIdPrefill||"")}">
      </div>
      <div class="field">
        <label>Password <span class="req">*</span></label>
        <div class="pw-wrap">
          <input type="password" name="password" required id="signinPw" placeholder="Enter your password">
          <button type="button" class="pw-toggle" data-toggle="signinPw">Show</button>
        </div>
      </div>
      <label class="check-item" style="margin-bottom:14px;">
        <input type="checkbox" name="remember"><div><div class="cv-name">Remember me on this device</div><div class="cv-meta">Keeps you signed in for 30 days instead of 8 hours</div></div>
      </label>
      ${locked ? `<div class="callout callout-bad" id="lockNotice">Account temporarily locked after repeated failed attempts. Try again in <span id="lockCountdown">${Math.ceil(locked/60000)} min</span>.</div>` : ""}
      <div class="btn-row"><button type="submit" class="btn btn-primary btn-block" ${locked?"disabled":""}>Sign In</button></div>
      <div class="btn-row"><button type="button" class="btn btn-outline btn-block btn-sm" data-tab="forgot">Forgot password?</button></div>
    </form>
  `;
}

function viewForgotPassword(db){
  const step = STATE.forgotStep;
  if (step === 1){
    return `
      <form id="forgotStep1">
        <p class="small muted">Enter your Student ID to retrieve your security question.</p>
        <div class="field"><label>Student ID <span class="req">*</span></label><input type="text" name="rollNo" required class="mono-input" placeholder="e.g. SKP2026-014"></div>
        <div class="btn-row"><button type="submit" class="btn btn-primary btn-block">Continue</button></div>
        <div class="btn-row"><button type="button" class="btn btn-outline btn-block btn-sm" data-tab="signin">Back to Sign In</button></div>
      </form>`;
  }
  const s = STATE.forgotStudent;
  return `
    <form id="forgotStep2">
      <p class="small muted">Answer your security question to reset your password.</p>
      <div class="field"><label>${escapeHtml(s.securityQuestion)}</label><input type="text" name="answer" required placeholder="Your answer"></div>
      <div class="field"><label>New Password <span class="req">*</span></label><input type="password" name="newPassword" id="newPw" required minlength="8" placeholder="At least 8 characters"></div>
      <div id="pwStrengthBar" class="pw-strength"></div>
      <div class="field"><label>Confirm New Password <span class="req">*</span></label><input type="password" name="confirmPassword" required minlength="8" placeholder="Re-enter new password"></div>
      <div class="btn-row"><button type="submit" class="btn btn-primary btn-block">Reset Password</button></div>
      <div class="btn-row"><button type="button" class="btn btn-outline btn-block btn-sm" data-tab="signin">Cancel</button></div>
    </form>`;
}

function viewRegister(){
  return `
    <form id="registerForm">
      <div class="row2">
        <div class="field"><label>Full Name <span class="req">*</span></label><input type="text" name="name" required placeholder="e.g. Anjali Suresh"></div>
        <div class="field"><label>Student ID / Roll No <span class="req">*</span></label><input type="text" name="rollNo" required placeholder="e.g. SKP2026-014" class="mono-input"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Email</label><input type="email" name="email" placeholder="optional"></div>
        <div class="field"><label>Batch / Class</label><input type="text" name="batch" placeholder="optional"></div>
      </div>
      <div class="field">
        <label>I am a… <span class="req">*</span></label>
        <div class="radio-list">
          <label class="radio-card"><input type="radio" name="role" value="student" checked> Student</label>
          <label class="radio-card"><input type="radio" name="role" value="instructor"> Instructor / Admin</label>
        </div>
      </div>
      <div class="field" id="accessCodeField" style="display:none;">
        <label>Instructor Access Code <span class="req">*</span></label>
        <input type="text" name="accessCode" placeholder="Provided by your programme coordinator">
      </div>
      <div class="field">
        <label>Password <span class="req">*</span></label>
        <div class="pw-wrap">
          <input type="password" name="password" id="regPw" required minlength="8" placeholder="At least 8 characters">
          <button type="button" class="pw-toggle" data-toggle="regPw">Show</button>
        </div>
        <div id="pwStrengthBar" class="pw-strength"></div>
      </div>
      <div class="field"><label>Confirm Password <span class="req">*</span></label><input type="password" name="confirmPassword" required minlength="8" placeholder="Re-enter password"></div>
      <div class="field">
        <label>Security Question <span class="req">*</span> <span class="hint">(used to reset your password)</span></label>
        <select name="securityQuestion" required>
          <option value="" disabled selected>Choose a question</option>
          ${SECURITY_QUESTIONS.map(q=>`<option>${escapeHtml(q)}</option>`).join("")}
        </select>
      </div>
      <div class="field"><label>Security Answer <span class="req">*</span></label><input type="text" name="securityAnswer" required></div>
      <div class="btn-row"><button type="submit" class="btn btn-primary btn-block">Create Profile &amp; Start</button></div>
    </form>
  `;
}

function bindLogin(db){
  $$("[data-tab]").forEach(b=> b.addEventListener("click", ()=>{
    STATE.authTab = b.dataset.tab; STATE.forgotStep = 1; STATE.loginLockRemaining = null; render();
  }));
  $$("[data-recent]").forEach(b=> b.addEventListener("click", ()=>{ STATE.signinIdPrefill = b.dataset.recent; render(); $("#signinPw") && $("#signinPw").focus(); }));
  $$("[data-toggle]").forEach(b=> b.addEventListener("click", ()=>{
    const input = document.getElementById(b.dataset.toggle);
    input.type = input.type === "password" ? "text" : "password";
    b.textContent = input.type === "password" ? "Show" : "Hide";
  }));

  const roleRadios = $$('input[name="role"]');
  const accessField = $("#accessCodeField");
  if (roleRadios.length && accessField){
    roleRadios.forEach(r=> r.addEventListener("change", ()=>{
      accessField.style.display = $('input[name="role"]:checked').value === "instructor" ? "block" : "none";
    }));
  }

  const pwLive = $("#regPw") || $("#newPw");
  const strengthBar = $("#pwStrengthBar");
  if (pwLive && strengthBar){
    pwLive.addEventListener("input", ()=>{
      const { score, label } = passwordStrength(pwLive.value);
      strengthBar.innerHTML = `<div class="pw-strength-track"><div class="pw-strength-fill s${score}"></div></div><span class="pw-strength-label">${label}</span>`;
    });
  }

  const signinForm = $("#signinForm");
  if (signinForm) signinForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (!signinForm.checkValidity()){ signinForm.reportValidity(); return; }
    const fd = new FormData(signinForm);
    const rollNo = fd.get("rollNo");
    const result = await attemptLogin(db, rollNo, fd.get("password"));
    if (!result.ok){
      if (result.reason === "locked"){ STATE.loginLockRemaining = result.lockRemainingMs; toast("Too many failed attempts — account locked temporarily.", "err"); render(); }
      else { toast(result.reason, "err"); }
      return;
    }
    pushRecentId(result.student.id);
    setSession(result.student.id, !!fd.get("remember"));
    STATE.studentId = result.student.id; STATE.view = "dashboard"; STATE.lastActivity = Date.now();
    render();
    toast(`Welcome back, ${result.student.name}.`, "ok");
  });

  const forgot1 = $("#forgotStep1");
  if (forgot1) forgot1.addEventListener("submit", (e)=>{
    e.preventDefault();
    const rollNo = new FormData(forgot1).get("rollNo").trim().toUpperCase();
    const s = db.students[rollNo];
    if (!s){ toast("No profile found for that Student ID.", "err"); return; }
    STATE.forgotStudent = s; STATE.forgotStep = 2; render();
  });

  const forgot2 = $("#forgotStep2");
  if (forgot2) forgot2.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (!forgot2.checkValidity()){ forgot2.reportValidity(); return; }
    const fd = new FormData(forgot2);
    const s = STATE.forgotStudent;
    const answerOk = await verifySecret(fd.get("answer").trim().toLowerCase(), s.secSalt, s.securityAnswerHash);
    if (!answerOk){ toast("That answer doesn't match our records.", "err"); return; }
    if (fd.get("newPassword") !== fd.get("confirmPassword")){ toast("New passwords don't match.", "err"); return; }
    s.salt = randomSalt();
    s.passwordHash = await hashSecret(fd.get("newPassword"), s.salt);
    s.failedAttempts = 0; s.lockUntil = null;
    saveDB(db);
    toast("Password reset. Please sign in.", "ok");
    STATE.authTab = "signin"; STATE.forgotStep = 1; STATE.signinIdPrefill = s.id; render();
  });

  const regForm = $("#registerForm");
  if (regForm) regForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (!regForm.checkValidity()){ regForm.reportValidity(); return; }
    const fd = new FormData(regForm);
    const rollNo = fd.get("rollNo").trim().toUpperCase();
    if (db.students[rollNo]){ toast("That Student ID is already registered. Use Sign In instead.", "err"); return; }
    if (fd.get("password") !== fd.get("confirmPassword")){ toast("Passwords don't match.", "err"); return; }
    if (passwordStrength(fd.get("password")).score < 2){ toast("Please choose a stronger password.", "err"); return; }
    const role = fd.get("role");
    if (role === "instructor" && fd.get("accessCode") !== INSTRUCTOR_ACCESS_CODE){ toast("Invalid instructor access code.", "err"); return; }
    const s = await registerStudent(db, {
      name: fd.get("name"), rollNo, batch: fd.get("batch"), email: fd.get("email"), role,
      password: fd.get("password"), securityQuestion: fd.get("securityQuestion"), securityAnswer: fd.get("securityAnswer")
    });
    pushRecentId(s.id);
    setSession(s.id, false);
    STATE.studentId = s.id; STATE.view = "dashboard"; STATE.lastActivity = Date.now();
    render();
    toast(`Welcome, ${s.name}.`, "ok");
  });
}

/* -------------------------------- dashboard ------------------------------- */

function statusOf(c){
  if (c.terminated) return { label:"Rejected", cls:"chip-bad" };
  if (c.completed.closed) return { label:"Closed", cls:"chip-neutral" };
  return { label: STAGES[c.currentStage-1].name, cls:"chip-warn" };
}

function caseListHtml(cases){
  if (!cases.length) return `<div class="empty-note">No cases match. Try a different search or filter.</div>`;
  return `
    <div class="case-list">
      ${cases.map(c=>{
        const st = statusOf(c);
        const pct = c.completed.closed ? 100 : c.terminated ? Math.round((c.currentStage/13)*100) : Math.round(((c.currentStage-1)/13)*100);
        return `
        <div class="case-row" data-open="${c.id}">
          <div class="cl">
            <div class="cid">${c.id}</div>
            <div class="cname">${escapeHtml(c.scenario.itemName)}</div>
            <div class="cdept">${escapeHtml(c.scenario.department)}</div>
          </div>
          <div class="cr">
            <div class="progress-mini"><div style="width:${pct}%"></div></div>
            <span class="chip ${st.cls}">${st.label}</span>
          </div>
        </div>`;
      }).join("")}
    </div>`;
}

function viewDashboard(db, student){
  const allCases = getCasesForStudent(db, student.id);
  const closed = allCases.filter(c=>c.completed.closed).length;
  const rejected = allCases.filter(c=>c.terminated).length;
  const active = allCases.length - closed - rejected;
  const filtered = getFilteredCases(db, student);

  return `
    <div class="dash-head">
      <div>
        <span class="eyebrow">Training Console</span>
        <h1 style="font-size:24px;margin:0;">Procurement Case Dashboard</h1>
      </div>
      <button class="btn btn-brass" data-act="newcase">+ Start New Procurement Case</button>
    </div>

    <div class="stat-row">
      <div class="stat-card"><div class="num">${allCases.length}</div><div class="lbl">Total Cases</div></div>
      <div class="stat-card"><div class="num">${active}</div><div class="lbl">In Progress</div></div>
      <div class="stat-card"><div class="num">${closed}</div><div class="lbl">Closed</div></div>
      <div class="stat-card"><div class="num">${rejected}</div><div class="lbl">Rejected</div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Your Cases</h2></div>
      <div class="search-row no-print">
        <input type="text" id="dashSearch" placeholder="Search by department, item, or case ID…" value="${escapeHtml(STATE.dashSearch)}">
        <div class="filter-chips">
          ${["all","active","closed","rejected"].map(f=>`<button class="chip-btn ${STATE.dashFilter===f?'active':''}" data-filter="${f}">${f[0].toUpperCase()+f.slice(1)}</button>`).join("")}
        </div>
      </div>
      <div id="caseListHost">${caseListHtml(filtered)}</div>
    </div>
  `;
}

function bindDashboard(db, student){
  $$("[data-act='newcase']").forEach(b=> b.addEventListener("click", ()=>{ STATE.view="newcase"; render(); }));
  $$("[data-open]").forEach(row=> row.addEventListener("click", ()=>{
    STATE.caseId = row.dataset.open; STATE.viewingStage = null; STATE.view="case"; render();
  }));
  const search = $("#dashSearch");
  if (search) search.addEventListener("input", ()=>{ STATE.dashSearch = search.value; renderCaseListOnly(db, student); });
  $$("[data-filter]").forEach(b=> b.addEventListener("click", ()=>{ STATE.dashFilter = b.dataset.filter; render(); }));
}

function renderCaseListOnly(db, student){
  const host = $("#caseListHost");
  if (host) host.innerHTML = caseListHtml(getFilteredCases(db, student));
  $$("[data-open]", host).forEach(row=> row.addEventListener("click", ()=>{
    STATE.caseId = row.dataset.open; STATE.viewingStage = null; STATE.view="case"; render();
  }));
}

function getFilteredCases(db, student){
  let cases = getCasesForStudent(db, student.id);
  if (STATE.dashFilter === "active") cases = cases.filter(c=>!c.completed.closed && !c.terminated);
  if (STATE.dashFilter === "closed") cases = cases.filter(c=>c.completed.closed);
  if (STATE.dashFilter === "rejected") cases = cases.filter(c=>c.terminated);
  const q = (STATE.dashSearch||"").trim().toLowerCase();
  if (q) cases = cases.filter(c=> c.scenario.itemName.toLowerCase().includes(q) || c.scenario.department.toLowerCase().includes(q) || c.id.toLowerCase().includes(q));
  return cases;
}

/* -------------------------------- new case -------------------------------- */

function viewNewCase(){
  return `
    <button class="btn btn-outline btn-sm no-print" data-act="dashboard" style="margin-bottom:16px;">&larr; Back to Dashboard</button>
    <span class="eyebrow">Step 1 · Department Needs Item</span>
    <h1 style="font-size:22px;">Choose a Procurement Scenario</h1>
    <p class="muted" style="margin-top:-6px;max-width:640px;">
      Each scenario is a department stating a genuine business need. From here, you will personally
      draft and process every document — the Purchase Requisition, RFQ, quotations, Purchase Order,
      GRN, invoice verification and payment request — exactly as a procurement team would.
    </p>
    <div class="scenario-grid" style="margin-top:18px;">
      ${SCENARIO_BANK.map(s=>`
        <div class="scenario-card">
          <div class="sdept">${escapeHtml(s.department)}</div>
          <h3>${escapeHtml(s.itemName)}</h3>
          <p>${escapeHtml(s.note)}</p>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="chip ${s.urgency==='Urgent'?'chip-bad':s.urgency==='High'?'chip-warn':'chip-neutral'}">${s.urgency} priority</span>
            <button class="btn btn-primary btn-sm" data-start="${s.id}">Start This Case</button>
          </div>
        </div>
      `).join("")}
    </div>
  `;
}

function bindNewCase(db, student){
  $$("[data-start]").forEach(b=> b.addEventListener("click", ()=>{
    const scenario = SCENARIO_BANK.find(s=>s.id===b.dataset.start);
    const c = createCase(db, student, scenario);
    STATE.caseId = c.id; STATE.viewingStage = 1; STATE.view="case"; render();
  }));
}

/* ---------------------------------- case ----------------------------------- */

function viewCase(db, c){
  if (STATE.viewingStage === null) STATE.viewingStage = c.terminated ? 3 : c.currentStage;
  const idx = STATE.viewingStage;

  return `
    <button class="btn btn-outline btn-sm no-print" data-act="dashboard" style="margin-bottom:16px;">&larr; Back to Dashboard</button>

    <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:10px;margin-bottom:6px;">
      <div>
        <span class="eyebrow">${c.id}</span>
        <h1 style="font-size:21px;margin:0;">${escapeHtml(c.scenario.itemName)}</h1>
        <p class="muted small" style="margin:2px 0 0;">${escapeHtml(c.scenario.department)} · Opened ${fmtDate(c.createdAt.slice(0,10))}</p>
      </div>
      <span class="chip ${statusOf(c).cls}">${statusOf(c).label}</span>
    </div>

    ${renderStepper(c)}

    ${c.terminated ? `<div class="callout callout-bad no-print"><strong>Case halted.</strong> ${escapeHtml(c.terminatedReason)}</div>` : ""}

    <div id="stageHost">${renderStageHost(db, c, idx)}</div>
  `;
}

function renderStepper(c){
  return `
    <div class="stepper no-print">
      ${STAGES.map((s,i)=>{
        const n = i+1;
        let cls = "locked";
        if (c.terminated && n===3) cls = "halted";
        else if (c.completed[s.key]) cls = "done";
        else if (n === c.currentStage) cls = "current";
        const clickable = c.completed[s.key] || n === c.currentStage || (c.terminated && n<=3);
        return `${i>0 ? '<div class="step-connector"></div>':""}
          <button class="step-node ${cls}" ${clickable ? `data-stage="${n}"` : "disabled"}>
            <div class="dot">${c.completed[s.key] ? "✓" : n}</div>
            <div class="lbl">${s.name}</div>
          </button>`;
      }).join("")}
    </div>
  `;
}

function renderStageHost(db, c, idx){
  const s = STAGES[idx-1];
  switch(s.key){
    case "need":        return stageNeed(db, c, idx);
    case "pr":           return stagePR(db, c, idx);
    case "approval":     return stageApproval(db, c, idx);
    case "rfq":          return stageRFQ(db, c, idx);
    case "quotations":   return stageQuotations(db, c, idx);
    case "comparison":   return stageComparison(db, c, idx);
    case "selection":    return stageSelection(db, c, idx);
    case "po":           return stagePO(db, c, idx);
    case "delivery":     return stageDelivery(db, c, idx);
    case "grn":          return stageGRN(db, c, idx);
    case "invoice":      return stageInvoice(db, c, idx);
    case "payment":      return stagePayment(db, c, idx);
    case "closed":       return stageClosed(db, c, idx);
  }
}

function bindCase(db, c){
  $$("[data-stage]").forEach(b=> b.addEventListener("click", ()=>{ STATE.viewingStage = Number(b.dataset.stage); render(); }));
  bindStageEvents(db, c, STATE.viewingStage);
}

function bindStageEvents(db, c, idx){
  const key = STAGES[idx-1].key;
  const fn = STAGE_BINDERS[key];
  if (fn) fn(db, c, idx);
}

function goToStage(n){ STATE.viewingStage = n; render(); }

function refBox(title, rows){
  return `<div class="ref-box"><div class="ref-title">${escapeHtml(title)}</div><div class="ref-grid">
    ${rows.map(([k,v])=>`<div><div class="k">${escapeHtml(k)}</div><div class="v">${v}</div></div>`).join("")}
  </div></div>`;
}

function roleBanner(tag, text){
  return `<div class="role-banner no-print"><span class="tagchip">${escapeHtml(tag)}</span> ${escapeHtml(text)}</div>`;
}

const STAGE_BINDERS = {};

/* ============================================================================
   STAGE 1 — Department Needs Item
   ========================================================================== */

function stageNeed(db, c, idx){
  const sc = c.scenario;
  const done = c.completed.need;
  return `
  <div class="panel">
    <div class="panel-head"><h2>Department Requisition Note</h2>${done ? `<span class="chip chip-ok">Acknowledged</span>` : ""}</div>
    <div class="doc">
      <div class="doc-head">
        <div><div class="doc-title">${escapeHtml(sc.department)}</div><div class="doc-num">Raised by: ${escapeHtml(sc.requestedByRole)}</div></div>
        <span class="chip ${sc.urgency==='Urgent'?'chip-bad':sc.urgency==='High'?'chip-warn':'chip-neutral'}">${sc.urgency} priority</span>
      </div>
      <div class="doc-grid">
        <div><div class="k">Item / Requirement</div><div class="v">${escapeHtml(sc.itemName)}</div></div>
        <div><div class="k">Case Reference</div><div class="v">${c.id}</div></div>
        <div><div class="k">Date Raised</div><div class="v">${fmtDate(c.createdAt.slice(0,10))}</div></div>
      </div>
      <div class="doc-note"><div class="k">Statement of Need</div>${escapeHtml(sc.note)}</div>
    </div>

    ${done ? `
      <div class="callout callout-ok">Acknowledged by ${escapeHtml(c.stages.need.by)} on ${fmtDate(c.stages.need.at)}. You may now proceed to raise the Purchase Requisition.</div>
      <div class="btn-row"><button class="btn btn-primary" data-next>Continue to Purchase Requisition &rarr;</button></div>
    ` : `
      <p class="small muted">As the Purchasing Officer, acknowledge this requisition note to begin processing it through the procurement cycle.</p>
      <div class="btn-row"><button class="btn btn-primary" id="ackBtn">Acknowledge &amp; Begin Purchase Requisition</button></div>
    `}
  </div>`;
}
STAGE_BINDERS.need = function(db, c, idx){
  const ack = $("#ackBtn");
  if (ack) ack.addEventListener("click", ()=>{
    const student = db.students[c.studentId];
    c.stages.need = { by: student.name, at: todayISO() };
    c.completed.need = true;
    c.currentStage = 2;
    addHistory(db, c, `Department requisition note acknowledged by ${student.name}.`);
    saveDB(db);
    goToStage(2);
  });
  const next = $("[data-next]");
  if (next) next.addEventListener("click", ()=> goToStage(c.currentStage>2 ? 2 : c.currentStage));
};

/* ============================================================================
   STAGE 2 — Purchase Requisition
   ========================================================================== */

function ensurePrNumber(db, c){
  if (!c.stages.pr) c.stages.pr = {};
  if (!c.stages.pr.prNumber){ c.stages.pr.prNumber = nextNumber(db, "PR"); saveDB(db); }
  return c.stages.pr.prNumber;
}

function stagePR(db, c, idx){
  const student = db.students[c.studentId];
  const prNum = ensurePrNumber(db, c);
  const done = c.completed.pr && c.currentStage > 2;
  const data = c.stages.pr || {};

  if (done){
    return `
    <div class="panel">
      <div class="panel-head"><h2>Purchase Requisition</h2><span class="chip chip-ok">Submitted</span></div>
      ${prDocCard(data, prNum)}
      <div class="btn-row no-print"><button class="btn btn-outline btn-sm" onclick="window.print()">Print PR</button>
      <button class="btn btn-primary btn-sm" data-next>Continue &rarr;</button></div>
    </div>`;
  }

  if (!STATE.prDraftLines || STATE.prDraftLinesCaseId !== c.id){
    STATE.prDraftLines = (data.lineItems && data.lineItems.length) ? JSON.parse(JSON.stringify(data.lineItems)) : [blankLineItem()];
    STATE.prDraftLinesCaseId = c.id;
  }
  const lines = STATE.prDraftLines;
  const totals = linesTotals(lines);

  return `
  <div class="panel">
    ${roleBanner("Purchasing Officer","Draft the formal Purchase Requisition for this need.")}
    <div class="panel-head"><h2>Purchase Requisition</h2><span class="chip chip-neutral">Draft</span></div>
    ${refBox("From Department Note", [
      ["Department", escapeHtml(c.scenario.department)],
      ["Stated Need", escapeHtml(c.scenario.itemName)],
      ["Urgency", c.scenario.urgency]
    ])}
    <form id="prForm">
      <div class="row2">
        <div class="field"><label>PR Number</label><input class="mono-input" type="text" value="${prNum}" readonly></div>
        <div class="field"><label>Date Raised <span class="req">*</span></label><input type="date" name="date" required value="${data.date || todayISO()}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Requesting Department <span class="req">*</span></label><input type="text" name="department" required value="${escapeHtml(data.department || c.scenario.department)}"></div>
        <div class="field"><label>Requested By</label><input type="text" value="${escapeHtml(student.name)}" readonly></div>
      </div>

      <div class="field">
        <label>Line Items <span class="req">*</span> <span class="hint">(one row per distinct item being requisitioned)</span></label>
        ${renderLineItemsEditor(lines, "pr")}
      </div>
      <div class="ref-box" style="margin-top:-6px;">
        <div class="ref-grid">
          <div><div class="k">Taxable Value</div><div class="v" id="prSubtotalDisplay">${fmtMoney(totals.taxable)}</div></div>
          <div><div class="k">GST</div><div class="v" id="prGstDisplay">${fmtMoney(totals.gst)}</div></div>
          <div><div class="k">Grand Total</div><div class="v" id="prGrandDisplay">${fmtMoney(totals.grand)}</div></div>
        </div>
      </div>

      <div class="row2">
        <div class="field"><label>Budget Code <span class="req">*</span></label>
          <select name="budgetCode" required>
            <option value="" ${!data.budgetCode?"selected":""} disabled>Select budget code</option>
            ${getBudgetCodes(db).map(b=>`<option value="${b.code}" ${data.budgetCode===b.code?"selected":""}>${b.label}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Priority <span class="req">*</span></label>
          <select name="priority" required>
            <option value="" ${!data.priority?"selected":""} disabled>Select priority</option>
            ${PRIORITY_LEVELS.map(p=>`<option value="${p}" ${(data.priority||c.scenario.urgency)===p?"selected":""}>${p}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field"><label>Required By Date <span class="req">*</span></label><input type="date" name="requiredBy" required value="${data.requiredBy||""}"></div>
      <div class="field">
        <label>Business Justification <span class="req">*</span></label>
        <textarea name="justification" required minlength="15" placeholder="Explain why this purchase is necessary now.">${escapeHtml(data.justification||"")}</textarea>
      </div>
      <div class="btn-row">
        <button type="submit" class="btn btn-primary">Submit for Manager Approval</button>
      </div>
    </form>
  </div>`;
}

function renderLineItemsEditor(lines, prefix){
  return `
  <div class="line-items-editor" data-prefix="${prefix}">
    <table class="dtable line-items-table">
      <thead><tr><th>Description</th><th>Qty</th><th>UOM</th><th>Unit Price (₹)</th><th>GST</th><th>Line Total</th><th></th></tr></thead>
      <tbody>
        ${lines.map((li,i)=>`
          <tr>
            <td><input type="text" class="li-input" data-li-field="description" data-li-idx="${i}" value="${escapeHtml(li.description)}" placeholder="e.g. Business laptop, i5/16GB/512GB" required></td>
            <td><input type="number" min="1" step="1" class="li-input li-num" data-li-field="qty" data-li-idx="${i}" value="${li.qty}" required style="width:70px;"></td>
            <td><select class="li-input" data-li-field="uom" data-li-idx="${i}" required style="width:90px;">
              <option value="" ${!li.uom?"selected":""} disabled>Unit</option>
              ${UOM_LIST.map(u=>`<option value="${u}" ${li.uom===u?"selected":""}>${u}</option>`).join("")}
            </select></td>
            <td><input type="number" min="0" step="0.01" class="li-input li-num" data-li-field="unitPrice" data-li-idx="${i}" value="${li.unitPrice}" required style="width:100px;"></td>
            <td><select class="li-input li-num" data-li-field="gstRate" data-li-idx="${i}" required style="width:75px;">
              ${GST_RATES.map(r=>`<option value="${r}" ${(li.gstRate??DEFAULT_GST_RATE)===r?"selected":""}>${r}%</option>`).join("")}
            </select></td>
            <td class="mono li-line-total" data-li-total="${i}">${fmtMoney(gstBreakdown(li.qty,li.unitPrice,li.gstRate).grand)}</td>
            <td>${lines.length>1 ? `<button type="button" class="btn btn-outline btn-sm" data-li-remove="${i}">✕</button>` : ""}</td>
          </tr>`).join("")}
      </tbody>
    </table>
    ${lines.length < MAX_LINE_ITEMS ? `<button type="button" class="btn btn-outline btn-sm" data-li-add style="margin-top:8px;">+ Add Line Item</button>` : `<p class="small muted" style="margin-top:8px;">Maximum ${MAX_LINE_ITEMS} line items per requisition.</p>`}
  </div>`;
}

function prDocCard(data, prNum){
  const totals = linesTotals(data.lineItems);
  return `
  <div class="doc">
    <div class="doc-head"><div><div class="doc-title">Purchase Requisition</div><div class="doc-num">${prNum}</div></div></div>
    <div class="doc-grid">
      <div><div class="k">Department</div><div class="v">${escapeHtml(data.department)}</div></div>
      <div><div class="k">Date Raised</div><div class="v">${fmtDate(data.date)}</div></div>
      <div><div class="k">Requested By</div><div class="v">${escapeHtml(data.requestedBy||"")}</div></div>
      <div><div class="k">Budget Code</div><div class="v">${escapeHtml(data.budgetCode)}</div></div>
      <div><div class="k">Priority</div><div class="v">${escapeHtml(data.priority)}</div></div>
      <div><div class="k">Required By</div><div class="v">${fmtDate(data.requiredBy)}</div></div>
    </div>
    <table class="dtable" style="margin-top:12px;">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>GST</th><th>Line Total</th></tr></thead>
      <tbody>
        ${(data.lineItems||[]).map(li=>{
          const b = gstBreakdown(li.qty, li.unitPrice, li.gstRate);
          return `<tr><td>${escapeHtml(li.description)}</td><td class="mono">${li.qty} ${escapeHtml(li.uom)}</td><td class="mono">${fmtMoney(li.unitPrice)}</td><td class="mono">${li.gstRate}%</td><td class="mono">${fmtMoney(b.grand)}</td></tr>`;
        }).join("")}
      </tbody>
    </table>
    <div class="doc-grid" style="margin-top:12px;">
      <div><div class="k">Taxable Value</div><div class="v">${fmtMoney(totals.taxable)}</div></div>
      <div><div class="k">GST</div><div class="v">${fmtMoney(totals.gst)}</div></div>
      <div><div class="k">Grand Total</div><div class="v">${fmtMoney(totals.grand)}</div></div>
    </div>
    <div class="doc-note"><div class="k">Business Justification</div>${escapeHtml(data.justification)}</div>
  </div>`;
}

function readLineItemsFromDOM(prefix){
  const rows = $$(`.line-items-editor[data-prefix="${prefix}"] .li-input[data-li-field="description"]`);
  return rows.map((_, i)=>{
    const get = (field)=> document.querySelector(`.line-items-editor[data-prefix="${prefix}"] [data-li-field="${field}"][data-li-idx="${i}"]`);
    return {
      description: get("description").value,
      qty: get("qty").value,
      uom: get("uom").value,
      unitPrice: get("unitPrice").value,
      gstRate: Number(get("gstRate").value)
    };
  });
}

function bindLineItemsEditor(prefix, draftRef, onChange){
  const editor = document.querySelector(`.line-items-editor[data-prefix="${prefix}"]`);
  if (!editor) return;

  function recalcRow(i){
    const li = readLineItemsFromDOM(prefix)[i];
    const cell = editor.querySelector(`[data-li-total="${i}"]`);
    if (cell) cell.textContent = fmtMoney(gstBreakdown(li.qty, li.unitPrice, li.gstRate).grand);
    if (onChange) onChange(readLineItemsFromDOM(prefix));
  }

  $$(".li-input", editor).forEach(el=>{
    el.addEventListener("input", ()=> recalcRow(Number(el.dataset.liIdx)));
    el.addEventListener("change", ()=> recalcRow(Number(el.dataset.liIdx)));
  });

  $$("[data-li-add]", editor).forEach(b=> b.addEventListener("click", ()=>{
    draftRef.prDraftLines = readLineItemsFromDOM(prefix);
    draftRef.prDraftLines.push(blankLineItem());
    render();
  }));
  $$("[data-li-remove]", editor).forEach(b=> b.addEventListener("click", ()=>{
    draftRef.prDraftLines = readLineItemsFromDOM(prefix);
    draftRef.prDraftLines.splice(Number(b.dataset.liRemove), 1);
    render();
  }));
}

STAGE_BINDERS.pr = function(db, c, idx){
  const form = $("#prForm");
  if (form){
    const subDisp = $("#prSubtotalDisplay"), gstDisp = $("#prGstDisplay"), grandDisp = $("#prGrandDisplay");
    bindLineItemsEditor("pr", STATE, (lines)=>{
      STATE.prDraftLines = lines;
      const t = linesTotals(lines);
      subDisp.textContent = fmtMoney(t.taxable); gstDisp.textContent = fmtMoney(t.gst); grandDisp.textContent = fmtMoney(t.grand);
    });

    form.addEventListener("submit", (e)=>{
      e.preventDefault();
      if (!form.checkValidity()){ form.reportValidity(); return; }
      const lineItems = readLineItemsFromDOM("pr").map(li=>({ ...li, qty:Number(li.qty), unitPrice:Number(li.unitPrice) }));
      if (lineItems.some(li=> !li.description || !li.qty || !li.uom)){ toast("Please complete every line item.", "err"); return; }
      const student = db.students[c.studentId];
      const fd = new FormData(form);
      c.stages.pr = {
        ...c.stages.pr,
        date: fd.get("date"), department: fd.get("department"),
        lineItems,
        budgetCode: fd.get("budgetCode"), priority: fd.get("priority"),
        requiredBy: fd.get("requiredBy"), justification: fd.get("justification"),
        requestedBy: student.name, submittedAt: new Date().toISOString()
      };
      c.completed.pr = true;
      c.currentStage = 3;
      c.rejected = false;
      STATE.prDraftLines = null; STATE.prDraftLinesCaseId = null;
      addHistory(db, c, `PR ${c.stages.pr.prNumber} submitted for approval by ${student.name} (${lineItems.length} line item(s)).`);
      saveDB(db);
      toast("Purchase Requisition submitted.", "ok");
      goToStage(3);
    });
  }
  const nextBtn = $("[data-next]");
  if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(3));
};

/* ============================================================================
   STAGE 3 — Manager Approval
   ========================================================================== */

function stageApproval(db, c, idx){
  const student = db.students[c.studentId];
  const pr = c.stages.pr;
  const appr = c.stages.approval || {};
  const decided = c.completed.approval || c.terminated;
  const prTotal = linesTotals(pr.lineItems).taxable;
  const needsSenior = prTotal > SENIOR_APPROVAL_THRESHOLD;

  if (c.terminated){
    return `
    <div class="panel">
      <div class="panel-head"><h2>Manager Approval</h2><span class="chip chip-bad">Rejected</span></div>
      ${prDocCard(pr, pr.prNumber)}
      <div class="callout callout-bad"><strong>Rejected by ${escapeHtml(appr.approvedBy)}</strong> on ${fmtDate(appr.date)}.<br>${escapeHtml(appr.comments)}</div>
      <p class="small muted">This case has been closed out as rejected and cannot continue. Return to the dashboard to start a new case.</p>
      <div class="btn-row no-print"><button class="btn btn-outline" data-act="dashboard">Back to Dashboard</button></div>
    </div>`;
  }

  if (decided && appr.decision === "Approve"){
    return `
    <div class="panel">
      <div class="panel-head"><h2>Manager Approval</h2><span class="chip chip-ok">Approved</span></div>
      ${prDocCard(pr, pr.prNumber)}
      <div class="doc" style="position:relative;">
        <span class="stamp ok">APPROVED</span>
        <div class="doc-grid">
          <div><div class="k">Approved By</div><div class="v">${escapeHtml(appr.approvedBy)}</div></div>
          <div><div class="k">Date</div><div class="v">${fmtDate(appr.date)}</div></div>
        </div>
        ${appr.comments ? `<div class="doc-note"><div class="k">Comments</div>${escapeHtml(appr.comments)}</div>` : ""}
        ${signatureImgIfPresent(appr.signature)}
      </div>
      ${appr.seniorApprover ? `
        <div class="doc" style="position:relative;">
          <span class="stamp ok">SENIOR SIGN-OFF</span>
          <div class="doc-grid"><div><div class="k">Senior Management Approver</div><div class="v">${escapeHtml(appr.seniorApprover)}</div></div></div>
          ${signatureImgIfPresent(appr.seniorSignature)}
        </div>` : ""}
      <div class="btn-row no-print"><button class="btn btn-primary btn-sm" data-next>Continue to RFQ &rarr;</button></div>
    </div>`;
  }

  return `
  <div class="panel">
    ${roleBanner("Purchasing Manager","Review this requisition and decide whether it proceeds.")}
    <div class="panel-head"><h2>Manager Approval</h2><span class="chip chip-warn">Pending Review</span></div>
    ${prDocCard(pr, pr.prNumber)}
    ${needsSenior ? `<div class="callout callout-warn">This PR's value (${fmtMoney(prTotal)}) exceeds ${fmtMoney(SENIOR_APPROVAL_THRESHOLD)} — Senior Management sign-off is required in addition to Manager approval before it can proceed.</div>` : ""}
    <form id="approvalForm">
      <div class="row2">
        <div class="field"><label>Reviewed By <span class="req">*</span></label><input type="text" name="approvedBy" required value="${escapeHtml(student.name)} (Manager)"></div>
        <div class="field"><label>Date <span class="req">*</span></label><input type="date" name="date" required value="${todayISO()}"></div>
      </div>
      <div class="field">
        <label>Decision <span class="req">*</span></label>
        <div class="radio-list">
          <label class="radio-card"><input type="radio" name="decision" value="Approve" required> Approve — proceed to RFQ</label>
          <label class="radio-card"><input type="radio" name="decision" value="Request Revision"> Request Revision — send back for changes</label>
          <label class="radio-card"><input type="radio" name="decision" value="Reject"> Reject — close this case</label>
        </div>
      </div>
      <div class="field">
        <label>Comments</label>
        <textarea name="comments" placeholder="Required if requesting revision or rejecting."></textarea>
      </div>
      ${signaturePadHtml("signature","Manager's Signature")}
      ${needsSenior ? `
        <div class="field" id="seniorBlock">
          <label>Senior Management Approver <span class="req" id="seniorReqMark">*</span></label>
          <input type="text" name="seniorApprover" id="seniorApproverInput" placeholder="Full name of the senior manager/director signing off">
        </div>
        ${signaturePadHtml("seniorSignature","Senior Management Signature")}
      ` : ""}
      <div class="btn-row"><button type="submit" class="btn btn-primary">Record Decision</button></div>
    </form>
  </div>`;
}

STAGE_BINDERS.approval = function(db, c, idx){
  const nextBtn = $("[data-next]");
  if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(4));

  const form = $("#approvalForm");
  if (!form) return;
  bindSignaturePad("signature");
  bindSignaturePad("seniorSignature");

  const needsSenior = linesTotals(c.stages.pr.lineItems).taxable > SENIOR_APPROVAL_THRESHOLD;
  const seniorInput = $("#seniorApproverInput");
  if (needsSenior && seniorInput){
    const decisionRadios = $$('input[name="decision"]', form);
    const refreshSeniorReq = ()=>{
      const decision = form.querySelector('input[name="decision"]:checked');
      seniorInput.required = !!decision && decision.value === "Approve";
    };
    decisionRadios.forEach(r=> r.addEventListener("change", refreshSeniorReq));
    refreshSeniorReq();
  }

  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    const decision = fd.get("decision");
    const comments = (fd.get("comments")||"").trim();
    if (decision !== "Approve" && !comments){ toast("Comments are required when not approving.", "err"); return; }

    c.stages.approval = {
      approvedBy: fd.get("approvedBy"), date: fd.get("date"), decision, comments, signature: fd.get("signature")||"",
      seniorApprover: decision==="Approve" ? (fd.get("seniorApprover")||"") : "",
      seniorSignature: decision==="Approve" ? (fd.get("seniorSignature")||"") : ""
    };
    const student = db.students[c.studentId];

    if (decision === "Approve"){
      c.completed.approval = true; c.currentStage = 4;
      addHistory(db, c, `PR ${c.stages.pr.prNumber} approved by ${fd.get("approvedBy")}${c.stages.approval.seniorApprover?` with senior sign-off from ${c.stages.approval.seniorApprover}`:""}.`);
      saveDB(db); toast("PR approved.", "ok"); goToStage(4);
    } else if (decision === "Request Revision"){
      c.completed.pr = false; c.completed.approval = false; c.currentStage = 2;
      addHistory(db, c, `PR ${c.stages.pr.prNumber} sent back for revision: ${comments}`);
      saveDB(db); toast("Sent back for revision.", "err"); goToStage(2);
    } else {
      c.terminated = true; c.terminatedReason = `Purchase Requisition rejected by ${fd.get("approvedBy")}.`;
      addHistory(db, c, `PR ${c.stages.pr.prNumber} rejected by ${fd.get("approvedBy")}: ${comments}`);
      saveDB(db); toast("Case rejected.", "err"); goToStage(3);
    }
  });
};

/* ============================================================================
   STAGE 4 — Request for Quotation
   ========================================================================== */

function ensureRfqNumber(db, c){
  if (!c.stages.rfq) c.stages.rfq = {};
  if (!c.stages.rfq.rfqNumber){ c.stages.rfq.rfqNumber = nextNumber(db,"RFQ"); saveDB(db); }
  return c.stages.rfq.rfqNumber;
}

function stageRFQ(db, c, idx){
  const student = db.students[c.studentId];
  const pr = c.stages.pr;
  const rfqNum = ensureRfqNumber(db, c);
  const done = c.completed.rfq;
  const data = c.stages.rfq || {};

  if (done){
    const vendors = (data.vendorsInvited||[]).map(id=> getVendors(db).find(v=>v.id===id));
    return `
    <div class="panel">
      <div class="panel-head"><h2>Request for Quotation</h2><span class="chip chip-ok">Issued</span></div>
      ${rfqDocCard(data, vendors)}
      <div class="btn-row no-print"><button class="btn btn-outline btn-sm" onclick="window.print()">Print RFQ</button>
      <button class="btn btn-primary btn-sm" data-next>Continue to Quotations &rarr;</button></div>
    </div>`;
  }

  return `
  <div class="panel">
    ${roleBanner("Purchasing Officer","Prepare the RFQ and select vendors for competitive bidding.")}
    <div class="panel-head"><h2>Request for Quotation</h2><span class="chip chip-neutral">Draft</span></div>
    ${refBox("Approved Requisition", [
      ["PR Number", pr.prNumber], ["Line Items", pr.lineItems.length + " item(s): " + escapeHtml(pr.lineItems.map(li=>li.description).join(", ")).slice(0,80)],
      ["Approved By", escapeHtml(c.stages.approval.approvedBy)]
    ])}
    <form id="rfqForm">
      <div class="row2">
        <div class="field"><label>RFQ Number</label><input class="mono-input" type="text" value="${rfqNum}" readonly></div>
        <div class="field"><label>Created By</label><input type="text" value="${escapeHtml(student.name)}" readonly></div>
      </div>
      <div class="row2">
        <div class="field"><label>Delivery Location <span class="req">*</span></label><input type="text" name="deliveryLocation" required placeholder="e.g. Main Warehouse, Kochi" value="${escapeHtml(data.deliveryLocation||"")}"></div>
        <div class="field"><label>Required Delivery Date <span class="req">*</span></label><input type="date" name="deliveryDate" required value="${data.deliveryDate||""}"></div>
      </div>
      <div class="field"><label>Quotation Submission Deadline <span class="req">*</span></label><input type="date" name="quoteDeadline" required value="${data.quoteDeadline||""}"></div>
      <div class="field">
        <label>Terms &amp; Conditions <span class="req">*</span></label>
        <textarea name="terms" required placeholder="Payment terms expected, warranty requirements, inspection rights, penalty clauses, etc.">${escapeHtml(data.terms||"")}</textarea>
      </div>
      <div class="field">
        <label>Invite Vendors — select at least 3 for competitive bidding <span class="req">*</span></label>
        <div class="checkbox-grid">
          ${getVendors(db).map(v=>`
            <label class="check-item">
              <input type="checkbox" name="vendor" value="${v.id}" ${(data.vendorsInvited||[]).includes(v.id)?"checked":""}>
              <div><div class="cv-name">${escapeHtml(v.name)}</div><div class="cv-meta">${escapeHtml(v.category)} · ${escapeHtml(v.city)}</div></div>
            </label>`).join("")}
        </div>
      </div>
      <div class="btn-row"><button type="submit" class="btn btn-primary">Issue RFQ to Selected Vendors</button></div>
    </form>
  </div>`;
}

function rfqDocCard(data, vendors){
  return `
  <div class="doc">
    <div class="doc-head"><div><div class="doc-title">Request for Quotation</div><div class="doc-num">${data.rfqNumber}</div></div></div>
    <div class="doc-grid">
      <div><div class="k">Delivery Location</div><div class="v">${escapeHtml(data.deliveryLocation)}</div></div>
      <div><div class="k">Required Delivery Date</div><div class="v">${fmtDate(data.deliveryDate)}</div></div>
      <div><div class="k">Quotation Deadline</div><div class="v">${fmtDate(data.quoteDeadline)}</div></div>
    </div>
    <div class="doc-note"><div class="k">Terms &amp; Conditions</div>${escapeHtml(data.terms)}</div>
    <div class="doc-note"><div class="k">Vendors Invited (${vendors.length})</div>${vendors.map(v=>escapeHtml(v.name)).join(", ")}</div>
  </div>`;
}

STAGE_BINDERS.rfq = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(5));
  const form = $("#rfqForm");
  if (!form) return;
  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    const vendorIds = $$("input[name=vendor]:checked", form).map(i=>i.value);
    if (vendorIds.length < 3){ toast("Select at least 3 vendors for a competitive RFQ.", "err"); return; }
    const student = db.students[c.studentId];
    c.stages.rfq = {
      ...c.stages.rfq,
      deliveryLocation: fd.get("deliveryLocation"), deliveryDate: fd.get("deliveryDate"),
      quoteDeadline: fd.get("quoteDeadline"), terms: fd.get("terms"),
      vendorsInvited: vendorIds, createdBy: student.name, issuedAt: new Date().toISOString()
    };
    c.completed.rfq = true; c.currentStage = 5;
    addHistory(db, c, `RFQ ${c.stages.rfq.rfqNumber} issued to ${vendorIds.length} vendors.`);
    saveDB(db); toast("RFQ issued.", "ok"); goToStage(5);
  });
};

/* ============================================================================
   STAGE 5 — Receive Quotations
   ========================================================================== */

function quoteLineTotal(pr, quote){
  return pr.lineItems.reduce((sum,li,i)=> sum + li.qty * (Number(quote.lineQuotes[i])||0), 0);
}

function stageQuotations(db, c, idx){
  const done = c.completed.quotations;
  const vendorIds = c.stages.rfq.vendorsInvited;
  const lineItems = c.stages.pr.lineItems;
  const existing = {};
  (c.stages.quotations||[]).forEach(q=> existing[q.vendorId]=q);

  if (done){
    return `
    <div class="panel">
      <div class="panel-head"><h2>Vendor Quotations Received</h2><span class="chip chip-ok">Recorded</span></div>
      ${quotationsTable(db, c.stages.quotations, lineItems)}
      <div class="btn-row no-print"><button class="btn btn-primary btn-sm" data-next>Continue to Comparison &rarr;</button></div>
    </div>`;
  }

  return `
  <div class="panel">
    ${roleBanner("Purchasing Officer","Record each vendor's quotation exactly as received.")}
    <div class="panel-head"><h2>Receive Quotations</h2><span class="chip chip-warn">${vendorIds.length} vendors invited</span></div>
    <p class="small muted">Enter the figures quoted by each vendor for every line item. In practice these would arrive by email or a vendor portal — for this exercise, decide realistic competitive figures for each vendor yourself and record them below.</p>
    <form id="quoteForm">
      ${vendorIds.map(vid=>{
        const v = getVendors(db).find(x=>x.id===vid);
        const d = existing[vid] || {};
        const lq = d.lineQuotes || [];
        return `
        <div class="doc" style="margin-bottom:14px;">
          <div class="doc-head"><div><div class="doc-title">${escapeHtml(v.name)}</div><div class="doc-num">${escapeHtml(v.contact)} · ${escapeHtml(v.city)}</div></div></div>
          <table class="dtable" style="margin-bottom:12px;">
            <thead><tr><th>Line Item</th><th>Qty</th><th>Quoted Unit Price (₹)</th></tr></thead>
            <tbody>
              ${lineItems.map((li,i)=>`
                <tr><td>${escapeHtml(li.description)}</td><td class="mono">${li.qty} ${escapeHtml(li.uom)}</td>
                <td><input type="number" min="0" step="0.01" required name="price_${vid}_${i}" value="${lq[i]||""}" style="width:120px;"></td></tr>
              `).join("")}
            </tbody>
          </table>
          <div class="row3">
            <div class="field"><label>Delivery Lead Time (days) <span class="req">*</span></label><input type="number" min="0" step="1" required name="lead_${vid}" value="${d.leadDays||""}"></div>
            <div class="field"><label>Payment Terms <span class="req">*</span></label>
              <select name="terms_${vid}" required>
                <option value="" ${!d.paymentTerms?"selected":""} disabled>Select terms</option>
                ${PAYMENT_TERMS.map(t=>`<option ${d.paymentTerms===t?"selected":""}>${t}</option>`).join("")}
              </select>
            </div>
            <div class="field"><label>Quote Valid Until <span class="req">*</span></label><input type="date" required name="valid_${vid}" value="${d.validUntil||""}"></div>
          </div>
          <div class="field"><label>Notes</label><textarea name="notes_${vid}" rows="2">${escapeHtml(d.notes||"")}</textarea></div>
        </div>`;
      }).join("")}
      <div class="btn-row"><button type="submit" class="btn btn-primary">Save All Quotations &amp; Proceed to Comparison</button></div>
    </form>
  </div>`;
}

function quotationsTable(db, quotations, lineItems){
  const rows = quotations.map(q=>{
    const v = getVendors(db).find(x=>x.id===q.vendorId);
    return `<tr><td>${escapeHtml(v.name)}</td><td class="mono">${fmtMoney(quoteLineTotal({lineItems}, q))}</td><td>${q.leadDays} days</td><td>${escapeHtml(q.paymentTerms)}</td><td>${fmtDate(q.validUntil)}</td></tr>`;
  }).join("");
  return `<table class="dtable"><thead><tr><th>Vendor</th><th>Total Quoted (all lines)</th><th>Lead Time</th><th>Payment Terms</th><th>Valid Until</th></tr></thead><tbody>${rows}</tbody></table>`;
}

STAGE_BINDERS.quotations = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(6));
  const form = $("#quoteForm");
  if (!form) return;
  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    const lineItems = c.stages.pr.lineItems;
    const quotations = c.stages.rfq.vendorsInvited.map(vid=>({
      vendorId: vid,
      lineQuotes: lineItems.map((li,i)=> Number(fd.get(`price_${vid}_${i}`))),
      leadDays: Number(fd.get(`lead_${vid}`)),
      paymentTerms: fd.get(`terms_${vid}`),
      validUntil: fd.get(`valid_${vid}`),
      notes: fd.get(`notes_${vid}`) || ""
    }));
    c.stages.quotations = quotations;
    c.completed.quotations = true; c.currentStage = 6;
    addHistory(db, c, `Recorded quotations from ${quotations.length} vendors.`);
    saveDB(db); toast("Quotations recorded.", "ok"); goToStage(6);
  });
};

/* ============================================================================
   STAGE 6 — Quotation Comparison
   ========================================================================== */

function comparisonTable(db, c, highlightBest){
  const quotations = c.stages.quotations;
  const pr = c.stages.pr;
  const totals = quotations.map(q=> quoteLineTotal(pr, q));
  const bestTotal = Math.min(...totals);
  const bestLead = Math.min(...quotations.map(q=>q.leadDays));
  const rows = quotations.map((q,i)=>{
    const v = getVendors(db).find(x=>x.id===q.vendorId);
    const total = totals[i];
    const isBest = highlightBest && total===bestTotal;
    return `<tr class="${isBest?'best':''}"><td>${escapeHtml(v.name)}${isBest?' <span class="chip chip-ok" style="margin-left:6px;">Lowest Cost</span>':''}${q.leadDays===bestLead?' <span class="chip chip-neutral">Fastest</span>':''}</td>
      <td class="mono">${fmtMoney(total)}</td><td>${q.leadDays} days</td><td>${escapeHtml(q.paymentTerms)}</td></tr>`;
  }).join("");
  return `<table class="dtable"><thead><tr><th>Vendor</th><th>Total Quoted (${pr.lineItems.length} line item(s))</th><th>Lead Time</th><th>Payment Terms</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/* ============================================================================
   Vendor Negotiation — one optional counter-offer round per vendor, available
   while the Comparison stage is still open (before it's finalized).
   ========================================================================== */

function negotiationPanel(db, c){
  const negotiated = {};
  (c.stages.negotiations||[]).forEach(n=> negotiated[n.vendorId] = n);
  const pr = c.stages.pr;

  let html = `<div class="panel-head" style="margin-top:20px;"><h2 style="font-size:15px;">Negotiate with a Vendor <span class="hint">(optional — one counter-offer round per vendor)</span></h2></div>`;

  html += `<div class="case-list" style="margin-bottom:14px;">` + c.stages.quotations.map(q=>{
    const v = getVendors(db).find(x=>x.id===q.vendorId);
    const neg = negotiated[q.vendorId];
    const total = quoteLineTotal(pr, q);
    return `<div class="case-row" style="cursor:default;">
      <div class="cl"><div class="cid">${escapeHtml(v.name)}</div><div class="cname">${fmtMoney(total)}${neg?' <span class="chip chip-neutral">Negotiated</span>':''}</div></div>
      <div class="cr">
        ${neg ? `<span class="chip ${neg.vendorResponse==='Accepted'?'chip-ok':neg.vendorResponse==='Countered'?'chip-warn':'chip-bad'}">${neg.vendorResponse}</span>` :
          `<button type="button" class="btn btn-outline btn-sm" data-negotiate="${q.vendorId}">Negotiate</button>`}
      </div>
    </div>`;
  }).join("") + `</div>`;

  if (STATE.negotiatingVendorId && !negotiated[STATE.negotiatingVendorId] && !STATE.negotiationSent){
    const q = c.stages.quotations.find(x=>x.vendorId===STATE.negotiatingVendorId);
    const v = getVendors(db).find(x=>x.id===STATE.negotiatingVendorId);
    html += `
    <div class="doc">
      <div class="doc-head"><div><div class="doc-title">Counter-Offer to ${escapeHtml(v.name)}</div></div></div>
      <form id="counterForm">
        <table class="dtable line-items-table">
          <thead><tr><th>Line Item</th><th>Current Quote (₹)</th><th>Your Counter Price (₹)</th></tr></thead>
          <tbody>${pr.lineItems.map((li,i)=>`
            <tr><td>${escapeHtml(li.description)}</td><td class="mono">${fmtMoney(q.lineQuotes[i])}</td>
            <td><input type="number" min="0" step="0.01" required name="counter_${i}" value="${q.lineQuotes[i]}" style="width:110px;"></td></tr>
          `).join("")}</tbody>
        </table>
        <div class="field"><label>Message to Vendor</label><textarea name="message" rows="2" placeholder="e.g. We have a lower competing quote — can you match ₹X per unit?"></textarea></div>
        <div class="btn-row">
          <button type="submit" class="btn btn-primary btn-sm">Send Counter-Offer</button>
          <button type="button" class="btn btn-outline btn-sm" data-cancel-negotiate>Cancel</button>
        </div>
      </form>
    </div>`;
  }

  if (STATE.negotiationSent && STATE.negotiationSent.vendorId === STATE.negotiatingVendorId){
    const sent = STATE.negotiationSent;
    const v = getVendors(db).find(x=>x.id===sent.vendorId);
    html += `
    <div class="doc">
      <div class="doc-head"><div><div class="doc-title">${escapeHtml(v.name)}'s Response</div></div></div>
      <p class="small muted">Decide how the vendor responds to your counter-offer.</p>
      <form id="responseForm">
        <div class="field">
          <label>Vendor Response <span class="req">*</span></label>
          <div class="radio-list">
            <label class="radio-card"><input type="radio" name="response" value="Accepted" required> Accepted — matches your counter price</label>
            <label class="radio-card"><input type="radio" name="response" value="Countered"> Countered — offers a different price</label>
            <label class="radio-card"><input type="radio" name="response" value="Rejected"> Rejected — keeps original price</label>
          </div>
        </div>
        <div id="counterBackFields" style="display:none;">
          <table class="dtable line-items-table">
            <thead><tr><th>Line Item</th><th>Vendor's Revised Price (₹)</th></tr></thead>
            <tbody>${pr.lineItems.map((li,i)=>`
              <tr><td>${escapeHtml(li.description)}</td>
              <td><input type="number" min="0" step="0.01" name="revised_${i}" value="${sent.counterLines[i]}" style="width:110px;"></td></tr>
            `).join("")}</tbody>
          </table>
        </div>
        <div class="btn-row"><button type="submit" class="btn btn-primary btn-sm">Record Vendor Response</button></div>
      </form>
    </div>`;
  }

  return html;
}

function negotiationHistoryHtml(db, c){
  return `<div class="doc-note" style="margin-top:16px;"><div class="k">Negotiation Rounds</div>
    ${c.stages.negotiations.map(n=>{
      const v = getVendors(db).find(x=>x.id===n.vendorId);
      return `<div style="margin-bottom:6px;">${escapeHtml(v.name)}: ${n.vendorResponse} ${n.message?`— "${escapeHtml(n.message)}"`:""}</div>`;
    }).join("")}
  </div>`;
}

function bindNegotiationPanel(db, c){
  $$("[data-negotiate]").forEach(b=> b.addEventListener("click", ()=>{
    STATE.negotiatingVendorId = b.dataset.negotiate; STATE.negotiationSent = null; render();
  }));
  $$("[data-cancel-negotiate]").forEach(b=> b.addEventListener("click", ()=>{
    STATE.negotiatingVendorId = null; STATE.negotiationSent = null; render();
  }));

  const counterForm = $("#counterForm");
  if (counterForm) counterForm.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!counterForm.checkValidity()){ counterForm.reportValidity(); return; }
    const fd = new FormData(counterForm);
    const counterLines = c.stages.pr.lineItems.map((li,i)=> Number(fd.get(`counter_${i}`)));
    STATE.negotiationSent = { vendorId: STATE.negotiatingVendorId, counterLines, message: fd.get("message")||"" };
    render();
  });

  const responseForm = $("#responseForm");
  if (responseForm){
    const responseRadios = $$('input[name="response"]', responseForm);
    const counterBackFields = $("#counterBackFields");
    responseRadios.forEach(r=> r.addEventListener("change", ()=>{
      counterBackFields.style.display = r.value === "Countered" && r.checked ? "block" : counterBackFields.style.display;
      const checked = responseForm.querySelector('input[name="response"]:checked');
      counterBackFields.style.display = checked && checked.value === "Countered" ? "block" : "none";
    }));

    responseForm.addEventListener("submit",(e)=>{
      e.preventDefault();
      if (!responseForm.checkValidity()){ responseForm.reportValidity(); return; }
      const fd = new FormData(responseForm);
      const sent = STATE.negotiationSent;
      const q = c.stages.quotations.find(x=>x.vendorId===sent.vendorId);
      const response = fd.get("response");
      let finalLines;
      if (response === "Accepted") finalLines = sent.counterLines;
      else if (response === "Countered") finalLines = c.stages.pr.lineItems.map((li,i)=> Number(fd.get(`revised_${i}`)));
      else finalLines = q.lineQuotes.slice();

      if (!q.originalLineQuotes) q.originalLineQuotes = q.lineQuotes.slice();
      q.lineQuotes = finalLines;

      if (!c.stages.negotiations) c.stages.negotiations = [];
      c.stages.negotiations.push({
        vendorId: sent.vendorId, counterLines: sent.counterLines, message: sent.message,
        vendorResponse: response, finalLines, respondedAt: new Date().toISOString()
      });

      const v = getVendors(db).find(x=>x.id===sent.vendorId);
      addHistory(db, c, `Negotiated with ${v.name}: ${response.toLowerCase()}.`);
      saveDB(db);
      STATE.negotiatingVendorId = null; STATE.negotiationSent = null;
      toast(`${v.name} ${response.toLowerCase()} the counter-offer.`, "ok");
      render();
    });
  }
}

function stageComparison(db, c, idx){
  const done = c.completed.comparison;
  const data = c.stages.comparison || {};
  const defaultWeights = data.weights || { price:50, delivery:30, terms:20 };
  return `
  <div class="panel">
    ${roleBanner("Purchasing Officer","Build the comparative statement and justify a recommendation.")}
    <div class="panel-head"><h2>Quotation Comparison</h2>${done?'<span class="chip chip-ok">Complete</span>':""}</div>
    ${comparisonTable(db, c, true)}
    ${done ? `
      <div class="small muted" style="margin-top:10px;">Weighting used: Price ${data.weights.price}% · Delivery ${data.weights.delivery}% · Payment Terms ${data.weights.terms}%</div>
      ${weightedScoreTableHtml(db, data.scores)}
      ${(c.stages.negotiations && c.stages.negotiations.length) ? negotiationHistoryHtml(db, c) : ""}
      <div class="doc-note" style="margin-top:16px;"><div class="k">Comparison Analysis</div>${escapeHtml(data.notes)}</div>
      <div class="btn-row no-print"><button class="btn btn-primary btn-sm" data-next>Continue to Vendor Selection &rarr;</button></div>
    ` : `
      ${negotiationPanel(db, c)}
      <form id="compForm" style="margin-top:18px;">
        ${weightFormHtml(defaultWeights)}
        <div class="field">
          <label>Comparison Analysis <span class="req">*</span></label>
          <textarea name="notes" required minlength="20" placeholder="Compare the vendors on price, delivery time and terms, and note any trade-offs.">${escapeHtml(data.notes||"")}</textarea>
        </div>
        <div class="btn-row"><button type="submit" class="btn btn-primary">Save Comparison &amp; Proceed</button></div>
      </form>
    `}
  </div>`;
}
STAGE_BINDERS.comparison = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(7));
  bindNegotiationPanel(db, c);
  const form = $("#compForm");
  if (!form) return;
  let currentWeights = null, currentSum = 0;
  bindWeightForm(db, c, (weights, sum)=>{ currentWeights = weights; currentSum = sum; });
  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    if (currentSum !== 100){ toast("Weights must add up to exactly 100%.", "err"); return; }
    c.stages.comparison = {
      notes: new FormData(form).get("notes"), decidedAt: new Date().toISOString(),
      weights: currentWeights, scores: computeWeightedScores(db, c, currentWeights)
    };
    c.completed.comparison = true; c.currentStage = 7;
    STATE.negotiatingVendorId = null; STATE.negotiationSent = null;
    addHistory(db, c, "Comparative statement completed.");
    saveDB(db); toast("Comparison saved.", "ok"); goToStage(7);
  });
};

/* ============================================================================
   STAGE 7 — Select Vendor
   ========================================================================== */

function stageSelection(db, c, idx){
  const student = db.students[c.studentId];
  const done = c.completed.selection;
  const data = c.stages.selection || {};

  if (done){
    const v = getVendors(db).find(x=>x.id===data.vendorId);
    return `
    <div class="panel">
      <div class="panel-head"><h2>Vendor Selection</h2><span class="chip chip-ok">Confirmed</span></div>
      <div class="doc">
        <div class="doc-head"><div><div class="doc-title">Selected Vendor</div><div class="doc-num">${escapeHtml(v.name)}</div></div></div>
        <div class="doc-note"><div class="k">Justification</div>${escapeHtml(data.justification)}</div>
        <div class="doc-grid" style="margin-top:12px;"><div><div class="k">Selected By</div><div class="v">${escapeHtml(data.selectedBy)}</div></div><div><div class="k">Date</div><div class="v">${fmtDate(data.date)}</div></div></div>
      </div>
      <div class="btn-row no-print"><button class="btn btn-primary btn-sm" data-next>Continue to Purchase Order &rarr;</button></div>
    </div>`;
  }

  return `
  <div class="panel">
    ${roleBanner("Purchasing Manager","Confirm the winning vendor based on the comparison.")}
    <div class="panel-head"><h2>Select Vendor</h2></div>
    ${comparisonTable(db, c, true)}
    <form id="selForm" style="margin-top:18px;">
      <div class="field">
        <label>Select Winning Vendor <span class="req">*</span></label>
        <div class="radio-list">
          ${c.stages.quotations.map(q=>{
            const v = getVendors(db).find(x=>x.id===q.vendorId);
            return `<label class="radio-card"><input type="radio" name="vendorId" value="${q.vendorId}" required> ${escapeHtml(v.name)} — ${fmtMoney(quoteLineTotal(c.stages.pr, q))} total, ${q.leadDays} days${(c.stages.negotiations||[]).some(n=>n.vendorId===q.vendorId)?' <span class="chip chip-neutral">Negotiated</span>':''}</label>`;
          }).join("")}
        </div>
      </div>
      <div class="field"><label>Selection Justification <span class="req">*</span></label><textarea name="justification" required minlength="15" placeholder="Why this vendor over the others?"></textarea></div>
      <div class="row2">
        <div class="field"><label>Selected By</label><input type="text" value="${escapeHtml(student.name)} (Manager)" readonly></div>
        <div class="field"><label>Date</label><input type="date" value="${todayISO()}" readonly></div>
      </div>
      <div class="btn-row"><button type="submit" class="btn btn-primary">Confirm Vendor Selection</button></div>
    </form>
  </div>`;
}
STAGE_BINDERS.selection = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(8));
  const form = $("#selForm");
  if (!form) return;
  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    const vendorId = fd.get("vendorId");
    const quote = c.stages.quotations.find(q=>q.vendorId===vendorId);
    const student = db.students[c.studentId];
    c.stages.selection = { vendorId, justification: fd.get("justification"), selectedBy: `${student.name} (Manager)`, date: todayISO(), quoteSnapshot: quote };
    c.completed.selection = true; c.currentStage = 8;
    addHistory(db, c, `Vendor selected: ${getVendors(db).find(v=>v.id===vendorId).name}.`);
    saveDB(db); toast("Vendor confirmed.", "ok"); goToStage(8);
  });
};

/* ============================================================================
   STAGE 8 — Create Purchase Order
   ========================================================================== */

function ensurePoNumber(db, c){
  if (!c.stages.po) c.stages.po = {};
  if (!c.stages.po.poNumber){ c.stages.po.poNumber = nextNumber(db,"PO"); saveDB(db); }
  return c.stages.po.poNumber;
}

function stagePO(db, c, idx){
  const student = db.students[c.studentId];
  const poNum = ensurePoNumber(db, c);
  const done = c.completed.po;
  const data = c.stages.po || {};
  const vendor = getVendors(db).find(v=>v.id===c.stages.selection.vendorId);
  const quote = c.stages.selection.quoteSnapshot;
  const prLines = c.stages.pr.lineItems;
  const poLines = data.lineItems || prLines.map((li,i)=>({ description: li.description, qty: li.qty, uom: li.uom, unitPrice: quote.lineQuotes[i], gstRate: li.gstRate }));
  const totals = linesTotals(poLines);

  if (done){
    const canAmend = !c.completed.invoice && !c.completed.closed;
    return `
    <div class="panel">
      <div class="panel-head"><h2>Purchase Order</h2><span class="chip chip-ok">Issued</span>${(data.amendments&&data.amendments.length)?`<span class="chip chip-warn">${data.amendments.length} Amendment(s)</span>`:""}</div>
      ${poDocCard(data, vendor)}
      ${(data.amendments||[]).map((a,i)=> poAmendmentCard(a,i)).join("")}
      <div class="btn-row no-print">
        <button class="btn btn-outline btn-sm" onclick="window.print()">Print PO</button>
        ${canAmend ? `<button class="btn btn-outline btn-sm" id="openAmendBtn">Amend Purchase Order</button>` : ""}
        <button class="btn btn-primary btn-sm" data-next>Continue to Delivery &rarr;</button>
      </div>
      ${canAmend && STATE.amendingPO && STATE.amendingPOCaseId === c.id ? poAmendmentForm(db, c, student) : ""}
    </div>`;
  }

  return `
  <div class="panel">
    ${roleBanner("Purchasing Officer","Issue the formal Purchase Order to the selected vendor.")}
    <div class="panel-head"><h2>Create Purchase Order</h2></div>
    ${refBox("References", [
      ["PR Number", c.stages.pr.prNumber], ["RFQ Number", c.stages.rfq.rfqNumber],
      ["Vendor", escapeHtml(vendor.name)], ["Line Items", prLines.length]
    ])}
    <form id="poForm">
      <div class="row2">
        <div class="field"><label>PO Number</label><input class="mono-input" type="text" value="${poNum}" readonly></div>
        <div class="field"><label>Vendor</label><input type="text" value="${escapeHtml(vendor.name)}" readonly></div>
      </div>

      <div class="field">
        <label>Line Items <span class="hint">(unit price defaults to the vendor's quote — adjust here if a final price was negotiated)</span></label>
        <table class="dtable line-items-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Price (₹)</th><th>GST</th><th>Line Total</th></tr></thead>
          <tbody>
            ${poLines.map((li,i)=>`
              <tr>
                <td>${escapeHtml(li.description)}</td>
                <td class="mono">${li.qty} ${escapeHtml(li.uom)}</td>
                <td><input type="number" min="0" step="0.01" class="li-input li-num" data-po-field="unitPrice" data-po-idx="${i}" value="${li.unitPrice}" required style="width:110px;"></td>
                <td><select class="li-input li-num" data-po-field="gstRate" data-po-idx="${i}" required style="width:75px;">
                  ${GST_RATES.map(r=>`<option value="${r}" ${(li.gstRate??DEFAULT_GST_RATE)===r?"selected":""}>${r}%</option>`).join("")}
                </select></td>
                <td class="mono" data-po-total="${i}">${fmtMoney(gstBreakdown(li.qty,li.unitPrice,li.gstRate).grand)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div class="ref-box" style="margin-top:-6px;">
        <div class="ref-grid">
          <div><div class="k">Taxable Value</div><div class="v" id="poSubtotalDisplay">${fmtMoney(totals.taxable)}</div></div>
          <div><div class="k">GST</div><div class="v" id="poGstDisplay">${fmtMoney(totals.gst)}</div></div>
          <div><div class="k">Grand Total</div><div class="v" id="poGrandDisplay">${fmtMoney(totals.grand)}</div></div>
        </div>
      </div>

      <div class="row2">
        <div class="field"><label>Delivery Terms <span class="req">*</span></label>
          <select name="deliveryTerms" required>
            <option value="" ${!data.deliveryTerms?"selected":""} disabled>Select terms</option>
            ${DELIVERY_TERMS.map(t=>`<option ${data.deliveryTerms===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
        <div class="field"><label>Payment Terms <span class="req">*</span></label>
          <select name="paymentTerms" required>
            <option value="" disabled>Select terms</option>
            ${PAYMENT_TERMS.map(t=>`<option ${(data.paymentTerms||quote.paymentTerms)===t?"selected":""}>${t}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field"><label>Expected Delivery Date <span class="req">*</span></label><input type="date" name="deliveryDate" required value="${data.deliveryDate||""}"></div>
      <div class="field"><label>Authorized By (type full name to digitally sign) <span class="req">*</span></label><input type="text" name="authorizedBy" required placeholder="${escapeHtml(student.name)}"></div>
      ${signaturePadHtml("signature","Authorizer's Signature")}
      <div class="btn-row"><button type="submit" class="btn btn-primary">Issue Purchase Order</button></div>
    </form>
  </div>`;
}

function poDocCard(data, vendor){
  const totals = linesTotals(data.lineItems);
  return `
  <div class="doc" style="position:relative;">
    <span class="stamp ok">ISSUED</span>
    <div class="doc-head"><div><div class="doc-title">Purchase Order</div><div class="doc-num">${data.poNumber}</div></div></div>
    <div class="doc-grid">
      <div><div class="k">Vendor</div><div class="v">${escapeHtml(vendor.name)}</div></div>
      <div><div class="k">Delivery Terms</div><div class="v">${escapeHtml(data.deliveryTerms)}</div></div>
      <div><div class="k">Payment Terms</div><div class="v">${escapeHtml(data.paymentTerms)}</div></div>
      <div><div class="k">Expected Delivery</div><div class="v">${fmtDate(data.deliveryDate)}</div></div>
      <div><div class="k">Authorized By</div><div class="v">${escapeHtml(data.authorizedBy)}</div></div>
    </div>
    <table class="dtable" style="margin-top:12px;">
      <thead><tr><th>Description</th><th>Qty</th><th>Unit Price</th><th>GST</th><th>Line Total</th></tr></thead>
      <tbody>
        ${data.lineItems.map(li=>{
          const b = gstBreakdown(li.qty, li.unitPrice, li.gstRate);
          return `<tr><td>${escapeHtml(li.description)}</td><td class="mono">${li.qty} ${escapeHtml(li.uom)}</td><td class="mono">${fmtMoney(li.unitPrice)}</td><td class="mono">${li.gstRate}%</td><td class="mono">${fmtMoney(b.grand)}</td></tr>`;
        }).join("")}
      </tbody>
    </table>
    <div class="doc-grid" style="margin-top:12px;">
      <div><div class="k">Taxable Value</div><div class="v">${fmtMoney(totals.taxable)}</div></div>
      <div><div class="k">GST</div><div class="v">${fmtMoney(totals.gst)}</div></div>
      <div><div class="k">Grand Total</div><div class="v">${fmtMoney(totals.grand)}</div></div>
    </div>
    ${signatureImgIfPresent(data.signature)}
  </div>`;
}

function poAmendmentCard(a, i){
  return `
  <div class="doc" style="position:relative;">
    <span class="stamp warn">AMENDMENT #${i+1}</span>
    <div class="doc-head"><div><div class="doc-title">Change Order</div><div class="doc-num">${fmtDate(a.date)}</div></div></div>
    <div class="doc-note"><div class="k">Reason</div>${escapeHtml(a.reason)}</div>
    <div class="doc-note"><div class="k">Fields Changed</div>${a.fieldsChanged.map(escapeHtml).join(", ")}</div>
    <div class="doc-grid" style="margin-top:10px;"><div><div class="k">Authorized By</div><div class="v">${escapeHtml(a.authorizedBy)}</div></div></div>
    ${signatureImgIfPresent(a.signature)}
  </div>`;
}

function poAmendmentForm(db, c, student){
  const data = c.stages.po;
  const poLines = data.lineItems;
  return `
  <div class="doc" style="margin-top:16px;">
    <div class="doc-head"><div><div class="doc-title">New Amendment — #${(data.amendments||[]).length+1}</div></div></div>
    <form id="amendForm">
      <div class="field">
        <label>What's Changing? <span class="req">*</span></label>
        <div class="checkbox-grid">
          <label class="check-item"><input type="checkbox" name="field" value="lines"><div><div class="cv-name">Line Item Prices / Quantities</div></div></label>
          <label class="check-item"><input type="checkbox" name="field" value="deliveryDate"><div><div class="cv-name">Expected Delivery Date</div></div></label>
          <label class="check-item"><input type="checkbox" name="field" value="deliveryTerms"><div><div class="cv-name">Delivery Terms</div></div></label>
          <label class="check-item"><input type="checkbox" name="field" value="paymentTerms"><div><div class="cv-name">Payment Terms</div></div></label>
        </div>
      </div>
      <div id="amendLinesBlock" style="display:none;">
        <table class="dtable line-items-table">
          <thead><tr><th>Description</th><th>Qty</th><th>Unit Price (₹)</th></tr></thead>
          <tbody>
            ${poLines.map((li,i)=>`
              <tr><td>${escapeHtml(li.description)}</td>
              <td><input type="number" min="0" step="1" class="amend-input" data-amend-field="qty" data-amend-idx="${i}" value="${li.qty}" style="width:80px;"></td>
              <td><input type="number" min="0" step="0.01" class="amend-input" data-amend-field="unitPrice" data-amend-idx="${i}" value="${li.unitPrice}" style="width:110px;"></td></tr>
            `).join("")}
          </tbody>
        </table>
      </div>
      <div id="amendDateBlock" style="display:none;" class="field">
        <label>New Expected Delivery Date</label><input type="date" name="newDeliveryDate" value="${data.deliveryDate}">
      </div>
      <div id="amendDeliveryTermsBlock" style="display:none;" class="field">
        <label>New Delivery Terms</label>
        <select name="newDeliveryTerms">${DELIVERY_TERMS.map(t=>`<option ${data.deliveryTerms===t?"selected":""}>${t}</option>`).join("")}</select>
      </div>
      <div id="amendPaymentTermsBlock" style="display:none;" class="field">
        <label>New Payment Terms</label>
        <select name="newPaymentTerms">${PAYMENT_TERMS.map(t=>`<option ${data.paymentTerms===t?"selected":""}>${t}</option>`).join("")}</select>
      </div>
      <div class="field"><label>Reason for Amendment <span class="req">*</span></label><textarea name="reason" required minlength="10" placeholder="Explain why this Purchase Order is being changed."></textarea></div>
      <div class="field"><label>Authorized By <span class="req">*</span></label><input type="text" name="authorizedBy" required placeholder="${escapeHtml(student.name)}"></div>
      ${signaturePadHtml("amendSignature","Authorizer's Signature")}
      <div class="btn-row">
        <button type="submit" class="btn btn-primary btn-sm">Issue Amendment</button>
        <button type="button" class="btn btn-outline btn-sm" id="cancelAmendBtn">Cancel</button>
      </div>
    </form>
  </div>`;
}

function readPOLineItemsFromDOM(prLines){
  return prLines.map((li,i)=>{
    const priceEl = document.querySelector(`[data-po-field="unitPrice"][data-po-idx="${i}"]`);
    const gstEl = document.querySelector(`[data-po-field="gstRate"][data-po-idx="${i}"]`);
    return { description: li.description, qty: li.qty, uom: li.uom, unitPrice: Number(priceEl.value)||0, gstRate: Number(gstEl.value) };
  });
}

function readAmendLinesFromDOM(poLines){
  return poLines.map((li,i)=>({
    description: li.description, uom: li.uom, gstRate: li.gstRate,
    qty: Number(document.querySelector(`[data-amend-field="qty"][data-amend-idx="${i}"]`).value)||0,
    unitPrice: Number(document.querySelector(`[data-amend-field="unitPrice"][data-amend-idx="${i}"]`).value)||0
  }));
}

STAGE_BINDERS.po = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(9));

  const openAmendBtn = $("#openAmendBtn");
  if (openAmendBtn) openAmendBtn.addEventListener("click", ()=>{ STATE.amendingPO = true; STATE.amendingPOCaseId = c.id; render(); });
  const cancelAmendBtn = $("#cancelAmendBtn");
  if (cancelAmendBtn) cancelAmendBtn.addEventListener("click", ()=>{ STATE.amendingPO = false; render(); });

  const amendForm = $("#amendForm");
  if (amendForm){
    bindSignaturePad("amendSignature");
    const blocks = { lines:"#amendLinesBlock", deliveryDate:"#amendDateBlock", deliveryTerms:"#amendDeliveryTermsBlock", paymentTerms:"#amendPaymentTermsBlock" };
    $$('input[name="field"]', amendForm).forEach(cb=> cb.addEventListener("change", ()=>{
      const el = $(blocks[cb.value]);
      if (el) el.style.display = cb.checked ? "block" : "none";
    }));

    amendForm.addEventListener("submit",(e)=>{
      e.preventDefault();
      if (!amendForm.checkValidity()){ amendForm.reportValidity(); return; }
      const fd = new FormData(amendForm);
      const fieldsChanged = $$('input[name="field"]:checked', amendForm).map(cb=>cb.value);
      if (!fieldsChanged.length){ toast("Select at least one field to amend.", "err"); return; }

      const po = c.stages.po;
      const previous = {};
      if (fieldsChanged.includes("lines")){ previous.lineItems = JSON.parse(JSON.stringify(po.lineItems)); po.lineItems = readAmendLinesFromDOM(po.lineItems); }
      if (fieldsChanged.includes("deliveryDate")){ previous.deliveryDate = po.deliveryDate; po.deliveryDate = fd.get("newDeliveryDate"); }
      if (fieldsChanged.includes("deliveryTerms")){ previous.deliveryTerms = po.deliveryTerms; po.deliveryTerms = fd.get("newDeliveryTerms"); }
      if (fieldsChanged.includes("paymentTerms")){ previous.paymentTerms = po.paymentTerms; po.paymentTerms = fd.get("newPaymentTerms"); }

      const fieldLabels = { lines:"Line Item Prices/Quantities", deliveryDate:"Expected Delivery Date", deliveryTerms:"Delivery Terms", paymentTerms:"Payment Terms" };
      if (!po.amendments) po.amendments = [];
      po.amendments.push({
        date: todayISO(), reason: fd.get("reason"), fieldsChanged: fieldsChanged.map(f=>fieldLabels[f]),
        previous, authorizedBy: fd.get("authorizedBy"), signature: fd.get("amendSignature")||""
      });

      addHistory(db, c, `PO ${po.poNumber} amended (#${po.amendments.length}): ${fieldsChanged.map(f=>fieldLabels[f]).join(", ")}. Reason: ${fd.get("reason")}`);
      STATE.amendingPO = false;
      saveDB(db); toast("Amendment issued.", "ok"); render();
    });
  }

  const form = $("#poForm");
  if (!form) return;
  bindSignaturePad("signature");
  const prLines = c.stages.pr.lineItems;
  const subDisp = $("#poSubtotalDisplay"), gstDisp = $("#poGstDisplay"), grandDisp = $("#poGrandDisplay");

  function recalcRow(i){
    const lines = readPOLineItemsFromDOM(prLines);
    const cell = document.querySelector(`[data-po-total="${i}"]`);
    if (cell) cell.textContent = fmtMoney(gstBreakdown(lines[i].qty, lines[i].unitPrice, lines[i].gstRate).grand);
    const t = linesTotals(lines);
    subDisp.textContent = fmtMoney(t.taxable); gstDisp.textContent = fmtMoney(t.gst); grandDisp.textContent = fmtMoney(t.grand);
  }
  $$(".li-input", form).forEach(el=>{
    el.addEventListener("input", ()=> recalcRow(Number(el.dataset.poIdx)));
    el.addEventListener("change", ()=> recalcRow(Number(el.dataset.poIdx)));
  });

  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    c.stages.po = {
      ...c.stages.po,
      lineItems: readPOLineItemsFromDOM(prLines),
      deliveryTerms: fd.get("deliveryTerms"),
      paymentTerms: fd.get("paymentTerms"), deliveryDate: fd.get("deliveryDate"),
      authorizedBy: fd.get("authorizedBy"), signature: fd.get("signature")||"", issuedAt: new Date().toISOString()
    };
    c.completed.po = true; c.currentStage = 9;
    addHistory(db, c, `PO ${c.stages.po.poNumber} issued to ${getVendors(db).find(v=>v.id===c.stages.selection.vendorId).name} for ${fmtMoney(linesTotals(c.stages.po.lineItems).grand)}.`);
    saveDB(db); toast("Purchase Order issued.", "ok"); goToStage(9);
  });
};

/* ============================================================================
   STAGE 9 — Vendor Delivery
   ========================================================================== */

function deliverySummaryTable(poLines, deliveredSoFar){
  return `<table class="dtable" style="margin-bottom:14px;">
    <thead><tr><th>Line Item</th><th>Ordered</th><th>Delivered So Far</th><th>Remaining</th></tr></thead>
    <tbody>${poLines.map((li,i)=>{
      const rem = li.qty - deliveredSoFar[i];
      return `<tr><td>${escapeHtml(li.description)}</td><td class="mono">${li.qty} ${escapeHtml(li.uom)}</td><td class="mono">${deliveredSoFar[i]}</td><td class="mono">${Math.max(rem,0)}${rem<=0?' <span class="chip chip-ok">Complete</span>':''}</td></tr>`;
    }).join("")}</tbody>
  </table>`;
}

function shipmentCard(d, i, poLines){
  return `
  <div class="doc" style="margin-bottom:10px;">
    <div class="doc-head"><div><div class="doc-title">Shipment #${i+1}</div><div class="doc-num">${escapeHtml(d.noteNumber)} · ${fmtDate(d.date)}</div></div><span class="chip chip-neutral">${escapeHtml(d.condition)}</span></div>
    <table class="dtable"><thead><tr><th>Line Item</th><th>Qty in Shipment</th></tr></thead>
      <tbody>${poLines.map((li,i2)=> d.qtyDelivered[i2]>0 ? `<tr><td>${escapeHtml(li.description)}</td><td class="mono">${d.qtyDelivered[i2]}</td></tr>` : "").join("")}</tbody>
    </table>
    ${d.remarks?`<div class="doc-note"><div class="k">Remarks</div>${escapeHtml(d.remarks)}</div>`:""}
  </div>`;
}

function stageDelivery(db, c, idx){
  const student = db.students[c.studentId];
  const done = c.completed.delivery;
  const po = c.stages.po;
  const poLines = po.lineItems;
  const deliveries = c.stages.deliveries || [];
  const deliveredSoFar = cumulativeQty(deliveries, poLines.length, "qtyDelivered");

  if (done){
    return `
    <div class="panel">
      <div class="panel-head"><h2>Vendor Delivery</h2><span class="chip chip-ok">${deliveries.length} shipment(s) recorded</span></div>
      ${deliverySummaryTable(poLines, deliveredSoFar)}
      ${deliveries.map((d,i)=> shipmentCard(d,i,poLines)).join("")}
      <div class="btn-row no-print"><button class="btn btn-primary btn-sm" data-next>Continue to Goods Receipt Note &rarr;</button></div>
    </div>`;
  }

  const allComplete = deliveredSoFar.every((q,i)=> q >= poLines[i].qty);

  return `
  <div class="panel">
    ${roleBanner("Warehouse / Stores","Log each shipment exactly as it arrives — split across multiple deliveries if the vendor ships in batches.")}
    <div class="panel-head"><h2>Vendor Delivery</h2></div>
    ${refBox("Purchase Order", [["PO Number", po.poNumber], ["Line Items", poLines.length], ["Expected Delivery", fmtDate(po.deliveryDate)]])}
    ${deliverySummaryTable(poLines, deliveredSoFar)}
    ${deliveries.length ? deliveries.map((d,i)=> shipmentCard(d,i,poLines)).join("") : ""}

    <div class="panel-head" style="margin-top:6px;"><h2 style="font-size:14px;">Record New Shipment</h2></div>
    <form id="delForm">
      <div class="row2">
        <div class="field"><label>Actual Delivery Date <span class="req">*</span></label><input type="date" name="date" required value="${todayISO()}"></div>
        <div class="field"><label>Delivery Note / Challan Number <span class="req">*</span></label><input class="mono-input" type="text" name="noteNumber" required placeholder="e.g. DC-45213"></div>
      </div>
      <div class="field">
        <label>Quantity in This Shipment, per Line Item <span class="req">*</span></label>
        <table class="dtable line-items-table">
          <thead><tr><th>Line Item</th><th>Remaining</th><th>In This Shipment</th></tr></thead>
          <tbody>
            ${poLines.map((li,i)=>{
              const remaining = Math.max(li.qty - deliveredSoFar[i], 0);
              return `<tr><td>${escapeHtml(li.description)}</td><td class="mono">${remaining}</td>
                <td><input type="number" min="0" max="${remaining}" step="1" name="qtyDelivered_${i}" value="${remaining}" style="width:90px;" ${remaining<=0?"disabled":""}></td></tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>
      <div class="field"><label>Condition on Arrival <span class="req">*</span></label>
        <select name="condition" required>
          <option value="" selected disabled>Select condition</option>
          <option>Good</option><option>Minor Damage</option><option>Major Damage</option><option>Partial Delivery</option>
        </select>
      </div>
      <div class="field"><label>Received By</label><input type="text" name="receivedBy" value="${escapeHtml(student.name)}"></div>
      <div class="field"><label>Remarks</label><textarea name="remarks" rows="2"></textarea></div>
      <div class="btn-row"><button type="submit" class="btn btn-primary">Record This Shipment</button></div>
    </form>

    ${deliveries.length ? `
      <div class="divider"></div>
      ${allComplete ? `<div class="callout callout-ok">All line items fully delivered.</div>` : `<div class="callout callout-warn">Some line items are still outstanding. Record another shipment above, or proceed now if the remainder is backordered or cancelled.</div>`}
      <div class="btn-row no-print"><button class="btn btn-brass" id="finishDeliveryBtn">Delivery Phase Complete &rarr; Proceed to Goods Receipt</button></div>
    ` : ""}
  </div>`;
}

STAGE_BINDERS.delivery = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(10));
  const finishBtn = $("#finishDeliveryBtn");
  if (finishBtn) finishBtn.addEventListener("click", ()=>{
    c.completed.delivery = true; c.currentStage = 10;
    addHistory(db, c, `Delivery phase completed after ${c.stages.deliveries.length} shipment(s).`);
    saveDB(db); toast("Delivery phase complete.", "ok"); goToStage(10);
  });
  const form = $("#delForm");
  if (!form) return;
  const poLines = c.stages.po.lineItems;
  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    const qtyDelivered = poLines.map((li,i)=> Number(fd.get(`qtyDelivered_${i}`))||0);
    if (qtyDelivered.every(q=>q===0)){ toast("Enter a quantity for at least one line item.", "err"); return; }
    if (!c.stages.deliveries) c.stages.deliveries = [];
    c.stages.deliveries.push({
      date: fd.get("date"), noteNumber: fd.get("noteNumber"), condition: fd.get("condition"),
      receivedBy: fd.get("receivedBy"), remarks: fd.get("remarks")||"", qtyDelivered
    });
    addHistory(db, c, `Shipment #${c.stages.deliveries.length} recorded: ${qtyDelivered.reduce((a,b)=>a+b,0)} unit(s), condition ${fd.get("condition")}.`);
    saveDB(db); toast("Shipment recorded.", "ok"); render();
  });
};

/* ============================================================================
   STAGE 10 — Goods Receipt Note
   ========================================================================== */

function ensureGrnNumberFor(db, c, shipmentIdx){
  if (!c.pendingGrnNumbers) c.pendingGrnNumbers = {};
  if (!c.pendingGrnNumbers[shipmentIdx]){ c.pendingGrnNumbers[shipmentIdx] = nextNumber(db,"GRN"); saveDB(db); }
  return c.pendingGrnNumbers[shipmentIdx];
}

function grnSummaryTable(poLines, deliveredSoFar, acceptedSoFar){
  return `<table class="dtable" style="margin-bottom:14px;">
    <thead><tr><th>Line Item</th><th>Delivered</th><th>Accepted</th><th>Rejected</th></tr></thead>
    <tbody>${poLines.map((li,i)=>`<tr><td>${escapeHtml(li.description)}</td><td class="mono">${deliveredSoFar[i]}</td><td class="mono">${acceptedSoFar[i]}</td><td class="mono">${deliveredSoFar[i]-acceptedSoFar[i]}</td></tr>`).join("")}</tbody>
  </table>`;
}

function grnCard(g, i, poLines){
  const cls = g.qualityResult==="Passed" ? "chip-ok" : g.qualityResult==="Failed" ? "chip-bad" : "chip-warn";
  return `<div class="doc" style="margin-bottom:10px;">
    <div class="doc-head"><div><div class="doc-title">GRN — Shipment #${i+1}</div><div class="doc-num">${g.grnNumber}</div></div><span class="chip ${cls}">${escapeHtml(g.qualityResult)}</span></div>
    <table class="dtable"><thead><tr><th>Line Item</th><th>Accepted</th></tr></thead>
      <tbody>${poLines.map((li,li_i)=> g.qtyAccepted[li_i]>0 ? `<tr><td>${escapeHtml(li.description)}</td><td class="mono">${g.qtyAccepted[li_i]}</td></tr>`:"").join("")}</tbody>
    </table>
    ${g.notes?`<div class="doc-note"><div class="k">Notes</div>${escapeHtml(g.notes)}</div>`:""}
  </div>`;
}

function stageGRN(db, c, idx){
  const student = db.students[c.studentId];
  const done = c.completed.grn;
  const po = c.stages.po;
  const poLines = po.lineItems;
  const deliveries = c.stages.deliveries;
  const grns = c.stages.grns || [];
  const deliveredSoFar = cumulativeQty(deliveries, poLines.length, "qtyDelivered");
  const acceptedSoFar = cumulativeQty(grns, poLines.length, "qtyAccepted");

  if (done){
    return `
    <div class="panel">
      <div class="panel-head"><h2>Goods Receipt Note</h2><span class="chip chip-ok">${grns.length} GRN(s) filed</span></div>
      ${grnSummaryTable(poLines, deliveredSoFar, acceptedSoFar)}
      ${grns.map((g,i)=> grnCard(g,i,poLines)).join("")}
      <div class="btn-row no-print"><button class="btn btn-primary btn-sm" data-next>Continue to Invoice Verification &rarr;</button></div>
    </div>`;
  }

  const pendingIdx = deliveries.findIndex((d,i)=> !grns[i]);

  if (pendingIdx === -1){
    return `
    <div class="panel">
      ${roleBanner("Warehouse / Stores","All received shipments have been inspected.")}
      <div class="panel-head"><h2>Goods Receipt Note</h2></div>
      ${grnSummaryTable(poLines, deliveredSoFar, acceptedSoFar)}
      ${grns.map((g,i)=> grnCard(g,i,poLines)).join("")}
      <div class="callout callout-ok">All ${grns.length} recorded shipment(s) have been inspected.</div>
      <div class="btn-row no-print"><button class="btn btn-brass" id="finishGrnBtn">Mark GRN Phase Complete &rarr; Proceed to Invoice Verification</button></div>
    </div>`;
  }

  const shipment = deliveries[pendingIdx];
  const grnNum = ensureGrnNumberFor(db, c, pendingIdx);

  return `
  <div class="panel">
    ${roleBanner("Warehouse / Stores","Inspect the delivered goods and file the formal receipt for this shipment.")}
    <div class="panel-head"><h2>Goods Receipt Note — Shipment #${pendingIdx+1} of ${deliveries.length}</h2></div>
    ${grns.length ? grnSummaryTable(poLines, deliveredSoFar, acceptedSoFar) : ""}
    ${refBox("This Shipment", [["Delivery Note", shipment.noteNumber], ["Date", fmtDate(shipment.date)], ["Arrival Condition", shipment.condition]])}
    <form id="grnForm">
      <div class="row2">
        <div class="field"><label>GRN Number</label><input class="mono-input" type="text" value="${grnNum}" readonly></div>
        <div class="field"><label>Date</label><input type="date" name="date" value="${todayISO()}"></div>
      </div>
      <div class="field">
        <label>Quantity Accepted from This Shipment <span class="req">*</span></label>
        <table class="dtable line-items-table">
          <thead><tr><th>Line Item</th><th>In Shipment</th><th>Accepted</th><th>Rejected</th></tr></thead>
          <tbody>
            ${poLines.map((li,i)=> shipment.qtyDelivered[i] > 0 ? `
              <tr><td>${escapeHtml(li.description)}</td><td class="mono">${shipment.qtyDelivered[i]}</td>
              <td><input type="number" min="0" max="${shipment.qtyDelivered[i]}" step="1" required class="grn-accept" data-grn-idx="${i}" name="qtyAccepted_${i}" value="${shipment.qtyDelivered[i]}" style="width:90px;"></td>
              <td class="mono" data-grn-reject="${i}">0</td></tr>
            ` : "").join("")}
          </tbody>
        </table>
      </div>
      <div class="field"><label>Quality Inspection Result <span class="req">*</span></label>
        <select name="qualityResult" required id="grnQuality">
          <option value="" selected disabled>Select result</option>
          <option>Passed</option>
          <option>Passed with Remarks</option>
          <option>Failed</option>
        </select>
      </div>
      <div class="field"><label>Inspected By</label><input type="text" name="inspectedBy" value="${escapeHtml(student.name)}"></div>
      <div class="field"><label>Discrepancy / Inspection Notes <span id="notesReqMark" class="req" style="display:none;">*</span></label><textarea name="notes" id="grnNotes" rows="2" placeholder="Required if any quantity was rejected or quality did not fully pass."></textarea></div>
      <div class="btn-row"><button type="submit" class="btn btn-primary">File GRN for This Shipment</button></div>
    </form>
  </div>`;
}

STAGE_BINDERS.grn = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(11));
  const finishBtn = $("#finishGrnBtn");
  if (finishBtn) finishBtn.addEventListener("click", ()=>{
    c.completed.grn = true; c.currentStage = 11;
    addHistory(db, c, `GRN phase completed after ${c.stages.grns.length} inspection(s).`);
    saveDB(db); toast("GRN phase complete.", "ok"); goToStage(11);
  });

  const form = $("#grnForm");
  if (!form) return;
  const poLines = c.stages.po.lineItems;
  const deliveries = c.stages.deliveries;
  const pendingIdx = deliveries.findIndex((d,i)=> !(c.stages.grns||[])[i]);
  const shipment = deliveries[pendingIdx];
  const qual = $("#grnQuality"), mark = $("#notesReqMark"), notesEl = $("#grnNotes");

  function refresh(){
    let anyRejected = false;
    $$(".grn-accept", form).forEach(el=>{
      const i = Number(el.dataset.grnIdx);
      const rv = shipment.qtyDelivered[i] - Number(el.value||0);
      if (rv !== 0) anyRejected = true;
      const cell = form.querySelector(`[data-grn-reject="${i}"]`);
      if (cell) cell.textContent = rv;
    });
    const needNotes = anyRejected || (qual.value && qual.value !== "Passed");
    mark.style.display = needNotes ? "inline" : "none";
    notesEl.required = needNotes;
  }
  $$(".grn-accept", form).forEach(el=> el.addEventListener("input", refresh));
  qual.addEventListener("change", refresh); refresh();

  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    const qtyAccepted = poLines.map((li,i)=> Number(fd.get(`qtyAccepted_${i}`))||0);
    if (qtyAccepted.some((q,i)=> q > shipment.qtyDelivered[i])){ toast("Accepted quantity cannot exceed quantity in this shipment.", "err"); return; }
    if (!c.stages.grns) c.stages.grns = [];
    c.stages.grns[pendingIdx] = {
      grnNumber: c.pendingGrnNumbers[pendingIdx],
      date: fd.get("date")||todayISO(), qtyAccepted,
      qualityResult: fd.get("qualityResult"), inspectedBy: fd.get("inspectedBy"), notes: fd.get("notes")||""
    };
    addHistory(db, c, `GRN ${c.stages.grns[pendingIdx].grnNumber} filed for Shipment #${pendingIdx+1}, quality ${c.stages.grns[pendingIdx].qualityResult}.`);
    saveDB(db); toast("GRN filed for shipment.", "ok"); render();
  });
};

/* ============================================================================
   STAGE 11 — Invoice Verification (3-way match)
   ========================================================================== */

function stageInvoice(db, c, idx){
  const student = db.students[c.studentId];
  const done = c.completed.invoice;
  const data = c.stages.invoice || {};
  const po = c.stages.po, grns = c.stages.grns;
  const poLines = po.lineItems;
  const acceptedQty = cumulativeQty(grns, poLines.length, "qtyAccepted");
  const invLines = data.lineItems || poLines.map((li,i)=>({ qty: acceptedQty[i], unitPrice: li.unitPrice, gstRate: li.gstRate }));

  if (done){
    const totals = linesTotals(invLines);
    return `
    <div class="panel">
      <div class="panel-head"><h2>Invoice Verification</h2><span class="chip chip-ok">Approved for Payment</span></div>
      ${invoiceMatchBlock(poLines, acceptedQty, invLines)}
      <div class="doc-note"><div class="k">Invoice Total incl. GST</div>${fmtMoney(totals.grand)}</div>
      <div class="doc-note"><div class="k">Verification Notes</div>${escapeHtml(data.notes)}</div>
      <div class="btn-row no-print"><button class="btn btn-primary btn-sm" data-next>Continue to Payment Request &rarr;</button></div>
    </div>`;
  }

  const onHold = data.decision && data.decision !== "Approve for Payment";

  return `
  <div class="panel">
    ${roleBanner("Accounts","Match the vendor invoice against the PO and cumulative GRN receipts, line by line, before payment.")}
    <div class="panel-head"><h2>Invoice Verification</h2>${onHold?'<span class="chip chip-warn">On Hold</span>':""}</div>
    ${onHold ? `<div class="callout callout-warn">Previous decision: <strong>${escapeHtml(data.decision)}</strong> — ${escapeHtml(data.notes)}. Correct the figures below or re-confirm once resolved.</div>` : ""}
    ${refBox("Purchase Order & Receipt", [["PO Number", po.poNumber], ["Line Items", poLines.length], ["GRNs Filed", grns.length]])}
    <form id="invForm">
      <div class="row2">
        <div class="field"><label>Invoice Number <span class="req">*</span></label><input class="mono-input" type="text" name="invoiceNumber" required value="${escapeHtml(data.invoiceNumber||"")}"></div>
        <div class="field"><label>Invoice Date <span class="req">*</span></label><input type="date" name="invoiceDate" required value="${data.invoiceDate||""}"></div>
      </div>
      <div class="field">
        <label>Invoice Line Items <span class="req">*</span></label>
        <table class="dtable line-items-table">
          <thead><tr><th>Line Item</th><th>Qty</th><th>Unit Price (₹)</th><th>GST</th><th>Line Total</th></tr></thead>
          <tbody>
            ${poLines.map((li,i)=>`
              <tr>
                <td>${escapeHtml(li.description)}</td>
                <td><input type="number" min="0" step="1" required class="inv-input" data-inv-idx="${i}" data-inv-field="qty" name="invQty_${i}" value="${invLines[i].qty}" style="width:80px;"></td>
                <td><input type="number" min="0" step="0.01" required class="inv-input" data-inv-idx="${i}" data-inv-field="unitPrice" name="invPrice_${i}" value="${invLines[i].unitPrice}" style="width:110px;"></td>
                <td><select class="inv-input" data-inv-idx="${i}" data-inv-field="gstRate" name="invGst_${i}" required style="width:75px;">
                  ${GST_RATES.map(r=>`<option value="${r}" ${(invLines[i].gstRate??DEFAULT_GST_RATE)===r?"selected":""}>${r}%</option>`).join("")}
                </select></td>
                <td class="mono" data-inv-total="${i}">${fmtMoney(gstBreakdown(invLines[i].qty,invLines[i].unitPrice,invLines[i].gstRate).grand)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
      <div id="matchPreview">${invoiceMatchBlock(poLines, acceptedQty, invLines)}</div>
      <div class="field" style="margin-top:14px;"><label>Verification Decision <span class="req">*</span></label>
        <select name="decision" required id="invDecision">
          <option value="" disabled selected>Select decision</option>
          <option>Approve for Payment</option>
          <option>Hold – Discrepancy</option>
          <option>Dispute with Vendor</option>
        </select>
      </div>
      <div class="field"><label>Verification Notes <span class="req">*</span></label><textarea name="notes" required minlength="10" placeholder="Note any mismatch and how it is being resolved.">${escapeHtml(data.notes||"")}</textarea></div>
      <div class="field"><label>Verified By</label><input type="text" name="verifiedBy" value="${escapeHtml(student.name)} (Accounts)"></div>
      <div class="btn-row"><button type="submit" class="btn btn-primary">Record Verification</button></div>
    </form>
  </div>`;
}

function invoiceMatchBlock(poLines, acceptedQty, invLines){
  let allMatch = true;
  const rows = poLines.map((li,i)=>{
    const qtyMatch = Number(invLines[i].qty) === Number(acceptedQty[i]);
    const priceMatch = Number(invLines[i].unitPrice) === Number(li.unitPrice);
    if (!qtyMatch || !priceMatch) allMatch = false;
    return `<tr><td>${escapeHtml(li.description)}</td><td class="mono">${acceptedQty[i]}</td><td class="mono">${invLines[i].qty}</td><td>${qtyMatch?'<span class="chip chip-ok">✓</span>':'<span class="chip chip-bad">✗</span>'}</td>
      <td class="mono">${fmtMoney(li.unitPrice)}</td><td class="mono">${fmtMoney(invLines[i].unitPrice)}</td><td>${priceMatch?'<span class="chip chip-ok">✓</span>':'<span class="chip chip-bad">✗</span>'}</td></tr>`;
  }).join("");
  return `
  <table class="dtable match-table" style="margin-bottom:14px;">
    <thead><tr><th>Line Item</th><th>GRN Accepted (cum.)</th><th>Invoice Qty</th><th>Qty</th><th>PO Price</th><th>Invoice Price</th><th>Price</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="callout ${allMatch?'callout-ok':'callout-warn'}">${allMatch? "Three-way match clean on every line — Invoice agrees with PO and cumulative GRN receipts." : "Discrepancy detected on at least one line — see decision below."}</div>
  `;
}

STAGE_BINDERS.invoice = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(12));
  const form = $("#invForm");
  if (!form) return;
  const poLines = c.stages.po.lineItems, acceptedQty = cumulativeQty(c.stages.grns, poLines.length, "qtyAccepted");
  const preview = $("#matchPreview");

  function readInvLines(){
    return poLines.map((li,i)=>({
      qty: Number(form.querySelector(`[name="invQty_${i}"]`).value)||0,
      unitPrice: Number(form.querySelector(`[name="invPrice_${i}"]`).value)||0,
      gstRate: Number(form.querySelector(`[name="invGst_${i}"]`).value)
    }));
  }
  function refresh(){
    const lines = readInvLines();
    lines.forEach((li,i)=>{
      const cell = form.querySelector(`[data-inv-total="${i}"]`);
      if (cell) cell.textContent = fmtMoney(gstBreakdown(li.qty, li.unitPrice, li.gstRate).grand);
    });
    preview.innerHTML = invoiceMatchBlock(poLines, acceptedQty, lines);
  }
  $$(".inv-input", form).forEach(el=>{ el.addEventListener("input", refresh); el.addEventListener("change", refresh); });

  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    const rec = {
      invoiceNumber: fd.get("invoiceNumber"), invoiceDate: fd.get("invoiceDate"),
      lineItems: readInvLines(),
      decision: fd.get("decision"), notes: fd.get("notes"), verifiedBy: fd.get("verifiedBy")
    };
    c.stages.invoice = rec;
    if (rec.decision === "Approve for Payment"){
      c.completed.invoice = true; c.currentStage = 12;
      addHistory(db, c, `Invoice ${rec.invoiceNumber} verified and approved for payment.`);
      saveDB(db); toast("Invoice approved for payment.", "ok"); goToStage(12);
    } else {
      saveDB(db);
      addHistory(db, c, `Invoice ${rec.invoiceNumber} placed on hold: ${rec.decision}.`);
      toast("Invoice held — resolve and re-submit.", "err");
      goToStage(11);
    }
  });
};

/* ============================================================================
   STAGE 12 — Payment Request
   ========================================================================== */

function ensurePayNumber(db, c){
  if (!c.stages.payment) c.stages.payment = {};
  if (!c.stages.payment.payNumber){ c.stages.payment.payNumber = nextNumber(db,"PAY"); saveDB(db); }
  return c.stages.payment.payNumber;
}

function stagePayment(db, c, idx){
  const student = db.students[c.studentId];
  const payNum = ensurePayNumber(db, c);
  const done = c.completed.payment;
  const data = c.stages.payment || {};
  const inv = c.stages.invoice;
  const amount = linesTotals(inv.lineItems).grand;

  if (done){
    return `
    <div class="panel">
      <div class="panel-head"><h2>Payment Request</h2><span class="chip chip-ok">Submitted</span></div>
      <div class="doc" style="position:relative;">
        <span class="stamp ok">SUBMITTED</span>
        <div class="doc-head"><div><div class="doc-title">Payment Request</div><div class="doc-num">${payNum}</div></div></div>
        <div class="doc-grid">
          <div><div class="k">Amount</div><div class="v">${fmtMoney(amount)}</div></div>
          <div><div class="k">Payment Method</div><div class="v">${escapeHtml(data.method)}</div></div>
          <div><div class="k">Due Date</div><div class="v">${fmtDate(data.dueDate)}</div></div>
          <div><div class="k">Approved By</div><div class="v">${escapeHtml(data.approvedBy)}</div></div>
          <div><div class="k">Submitted To</div><div class="v">${escapeHtml(data.submittedTo)}</div></div>
        </div>
        ${signatureImgIfPresent(data.signature)}
      </div>
      <div class="btn-row no-print"><button class="btn btn-primary btn-sm" data-next>Continue to Case Closure &rarr;</button></div>
    </div>`;
  }

  return `
  <div class="panel">
    ${roleBanner("Finance","Raise the payment request against the verified invoice.")}
    <div class="panel-head"><h2>Payment Request</h2></div>
    ${refBox("Verified Invoice", [["Invoice Number", inv.invoiceNumber], ["Approved Amount (incl. GST)", fmtMoney(amount)], ["PO Number", c.stages.po.poNumber]])}
    <form id="payForm">
      <div class="row2">
        <div class="field"><label>Payment Request Number</label><input class="mono-input" type="text" value="${payNum}" readonly></div>
        <div class="field"><label>Amount (₹)</label><input class="mono-input" type="text" value="${fmtMoney(amount)}" readonly></div>
      </div>
      <div class="row2">
        <div class="field"><label>Payment Method <span class="req">*</span></label>
          <select name="method" required>
            <option value="" disabled selected>Select method</option>
            <option>Bank Transfer (NEFT/RTGS)</option><option>Cheque</option><option>Online Payment</option>
          </select>
        </div>
        <div class="field"><label>Due Date <span class="req">*</span></label><input type="date" name="dueDate" required value="${data.dueDate||""}"></div>
      </div>
      <div class="row2">
        <div class="field"><label>Approved By</label><input type="text" name="approvedBy" value="${escapeHtml(student.name)} (Finance)"></div>
        <div class="field"><label>Submitted To</label><input type="text" name="submittedTo" value="Finance Department"></div>
      </div>
      <div class="field"><label>Remarks</label><textarea name="remarks" rows="2">${escapeHtml(data.remarks||"")}</textarea></div>
      ${signaturePadHtml("signature","Finance Approver's Signature")}
      <div class="btn-row"><button type="submit" class="btn btn-primary">Submit Payment Request</button></div>
    </form>
  </div>`;
}
STAGE_BINDERS.payment = function(db, c, idx){
  const nextBtn = $("[data-next]"); if (nextBtn) nextBtn.addEventListener("click", ()=> goToStage(13));
  const form = $("#payForm");
  if (!form) return;
  bindSignaturePad("signature");
  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    c.stages.payment = { ...c.stages.payment, method: fd.get("method"), dueDate: fd.get("dueDate"), approvedBy: fd.get("approvedBy"), submittedTo: fd.get("submittedTo"), remarks: fd.get("remarks")||"", signature: fd.get("signature")||"" };
    c.completed.payment = true; c.currentStage = 13;
    addHistory(db, c, `Payment request ${c.stages.payment.payNumber} submitted.`);
    saveDB(db); toast("Payment request submitted.", "ok"); goToStage(13);
  });
};

/* ============================================================================
   STAGE 13 — Purchase Closed
   ========================================================================== */

function stageClosed(db, c, idx){
  const student = db.students[c.studentId];
  const done = c.completed.closed;
  const data = c.stages.closed || {};

  const trailDocs = [
    ["Purchase Requisition", c.stages.pr.prNumber],
    ["Manager Approval", c.stages.approval.decision],
    ["Request for Quotation", c.stages.rfq.rfqNumber],
    ["Quotations Received", c.stages.quotations.length + " vendors"],
    ["Vendor Selected", getVendors(db).find(v=>v.id===c.stages.selection.vendorId).name],
    ["Purchase Order", c.stages.po.poNumber],
    ["Delivery", c.stages.deliveries.length + " shipment(s): " + c.stages.deliveries.map(d=>d.noteNumber).join(", ")],
    ["Goods Receipt Note", c.stages.grns.length + " GRN(s): " + c.stages.grns.map(g=>g.grnNumber).join(", ")],
    ["Invoice", c.stages.invoice.invoiceNumber],
    ["Payment Request", c.stages.payment.payNumber]
  ];

  return `
  <div class="panel">
    ${roleBanner("Procurement Head","Close out the case once the full trail is in order.")}
    <div class="panel-head"><h2>Purchase Case Closure</h2>${done?'<span class="chip chip-neutral">Closed</span>':""}</div>

    <table class="dtable" style="margin-bottom:18px;">
      <thead><tr><th>Document</th><th>Reference</th></tr></thead>
      <tbody>${trailDocs.map(([k,v])=>`<tr><td>${escapeHtml(k)}</td><td class="mono">${escapeHtml(String(v))}</td></tr>`).join("")}</tbody>
    </table>

    <div class="panel-head"><h2 style="font-size:14px;">Full Audit Trail</h2></div>
    <ul class="trail">
      ${c.history.map(h=>`<li><span class="ts">${fmtDateTime(h.ts)}</span><span>${escapeHtml(h.text)}</span></li>`).join("")}
    </ul>

    ${done ? `
      <div class="callout callout-ok" style="margin-top:16px;"><strong>Case closed</strong> by ${escapeHtml(data.closedBy)} on ${fmtDate(data.closedAt)}.<br>${escapeHtml(data.remarks)}</div>
      ${c.instructorReview ? `
        <div class="doc-note" style="margin-top:12px;"><div class="k">Instructor Feedback${c.instructorReview.score!==null&&c.instructorReview.score!==undefined?` — Score: ${c.instructorReview.score}/100`:""}</div>${escapeHtml(c.instructorReview.feedback||"No written feedback.")}</div>
      ` : ""}
      <div class="btn-row no-print">
        <button class="btn btn-outline" onclick="window.print()">Print Full Case File</button>
        <button class="btn btn-outline" id="exportCaseCsv">Export Summary (.csv)</button>
        <button class="btn btn-brass" id="downloadCertBtn">Download Certificate</button>
        <button class="btn btn-primary" data-act="dashboard">Back to Dashboard</button>
      </div>
      <div id="certificateBlock" class="certificate-block">
        <div class="cert-border">
          <div class="cert-mark">SK</div>
          <div class="cert-eyebrow">Skelora Procurement Simulator</div>
          <h2 class="cert-title">Certificate of Completion</h2>
          <p class="cert-body">This certifies that</p>
          <p class="cert-name">${escapeHtml(student.name)}</p>
          <p class="cert-body">has successfully completed the procure-to-pay training case</p>
          <p class="cert-case">${escapeHtml(c.scenario.itemName)} — ${escapeHtml(c.scenario.department)}</p>
          <p class="cert-body">covering requisition, approval, RFQ, vendor selection, purchase ordering, goods receipt, invoice verification and payment — case ${c.id}.</p>
          <div class="cert-meta">
            <div><div class="k">Closed</div><div class="v">${fmtDate(data.closedAt)}</div></div>
            <div><div class="k">Case Value (incl. GST)</div><div class="v">${fmtMoney(linesTotals(c.stages.po.lineItems).grand)}</div></div>
            ${c.instructorReview && c.instructorReview.score!=null ? `<div><div class="k">Instructor Score</div><div class="v">${c.instructorReview.score}/100</div></div>` : ""}
          </div>
        </div>
      </div>
    ` : `
      <form id="closeForm" style="margin-top:18px;">
        <div class="field"><label>Closing Remarks <span class="req">*</span></label><textarea name="remarks" required minlength="10" placeholder="Summarise the outcome of this procurement case."></textarea></div>
        <div class="field"><label>Closed By</label><input type="text" value="${escapeHtml(student.name)} (Procurement Head)" readonly></div>
        <div class="btn-row"><button type="submit" class="btn btn-primary">Close Purchase Case</button></div>
      </form>
    `}
  </div>`;
}
STAGE_BINDERS.closed = function(db, c, idx){
  const csvBtn = $("#exportCaseCsv");
  if (csvBtn) csvBtn.addEventListener("click", ()=> downloadText(`${c.id}-summary.csv`, caseToCSV(c), "text/csv"));
  const certBtn = $("#downloadCertBtn");
  if (certBtn) certBtn.addEventListener("click", printCertificate);
  const form = $("#closeForm");
  if (!form) return;
  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const student = db.students[c.studentId];
    c.stages.closed = { remarks: new FormData(form).get("remarks"), closedBy: `${student.name} (Procurement Head)`, closedAt: todayISO() };
    c.completed.closed = true;
    addHistory(db, c, "Purchase case closed.");
    saveDB(db); toast("Case closed.", "ok"); render();
  });
};

/* ================================== boot ================================== */

document.addEventListener("DOMContentLoaded", ()=>{
  const sid = getSession();
  const db = loadDB();
  if (sid && db.students[sid]){ STATE.studentId = sid; STATE.view = "dashboard"; STATE.lastActivity = Date.now(); }
  render();
  startInactivityWatch();
});

// ─────────────────────────────────────────────────────────────
// Auth — client-side only, by design. This simulator is static
// files with no backend, so there is no server to verify a
// password against. What this module actually does is:
//   1) Give each Student ID its own isolated save-slot in this
//      browser's localStorage, so multiple students sharing one
//      lab computer never overwrite each other's progress.
//   2) Present a professional-looking sign-in gate with a
//      typo-catching captcha.
// It is NOT secure authentication — a password only has to match
// what that Student ID registered with on THIS browser. Don't
// reuse a real password here, and don't rely on this for anything
// beyond keeping classroom sessions separate.
// ─────────────────────────────────────────────────────────────
var Auth = (function () {
  const ACCOUNTS_KEY = 'procurement-simulator-accounts';

  function hasLocalStorage() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; } catch (e) { return false; }
  }

  // Small non-cryptographic string hash (cyrb53) — just enough so
  // a password isn't sitting in localStorage in plain text.
  function hashString(str) {
    let h1 = 0xdeadbeef ^ 0;
    let h2 = 0x41c6ce57 ^ 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
  }

  function loadAccounts() {
    if (!hasLocalStorage()) return {};
    try {
      const raw = localStorage.getItem(ACCOUNTS_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  }

  function saveAccounts(accounts) {
    if (!hasLocalStorage()) return;
    try { localStorage.setItem(ACCOUNTS_KEY, JSON.stringify(accounts)); } catch (e) { /* storage full/unavailable */ }
  }

  function normalizeId(id) {
    return String(id || '').trim().toUpperCase();
  }

  function validateStudentId(id) {
    const v = normalizeId(id);
    if (!v) return 'Student ID is required.';
    if (!v.startsWith('SKELORA')) return 'Student ID must start with SKELORA (e.g. SKELORA-2026-014).';
    if (v.length < 8) return 'That Student ID looks incomplete — e.g. SKELORA-2026-014.';
    return null;
  }

  function register(id, password) {
    const studentId = normalizeId(id);
    const idError = validateStudentId(studentId);
    if (idError) return { ok: false, error: idError };
    if (!password || password.length < 4) return { ok: false, error: 'Password must be at least 4 characters.' };
    const accounts = loadAccounts();
    if (accounts[studentId]) return { ok: false, error: 'That Student ID is already registered on this computer. Sign in instead.' };
    accounts[studentId] = { passwordHash: hashString(password), createdAt: new Date().toISOString() };
    saveAccounts(accounts);
    return { ok: true, studentId };
  }

  function login(id, password) {
    const studentId = normalizeId(id);
    const idError = validateStudentId(studentId);
    if (idError) return { ok: false, error: idError };
    const accounts = loadAccounts();
    const account = accounts[studentId];
    if (!account) return { ok: false, error: 'No account found for that Student ID on this computer. Create one first.' };
    if (account.passwordHash !== hashString(password || '')) return { ok: false, error: 'Incorrect password.' };
    return { ok: true, studentId };
  }

  function accountExists(id) {
    const accounts = loadAccounts();
    return !!accounts[normalizeId(id)];
  }

  // ── Captcha — a typo-catching friction step, not bot protection ──
  const CAPTCHA_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no O/0, I/1 — avoids ambiguity
  function generateCaptcha() {
    let code = '';
    for (let i = 0; i < 5; i++) code += CAPTCHA_CHARS[Math.floor(Math.random() * CAPTCHA_CHARS.length)];
    return code;
  }
  function captchaMatches(code, input) {
    return String(code || '').toUpperCase() === String(input || '').trim().toUpperCase();
  }

  return { register, login, accountExists, validateStudentId, normalizeId, generateCaptcha, captchaMatches, ACCOUNTS_KEY };
})();

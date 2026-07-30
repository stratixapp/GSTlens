/* ==========================================================================
   Skelora Procurement Simulator — Console Layer
   Notifications, account settings, vendor scorecards, budget utilisation,
   reports, the instructor console, and the signature-pad component.
   Loaded after data.js and app.js; shares their global scope (no modules).
   ========================================================================== */

/* ============================== notifications ============================= */

function computeNotifications(db, student){
  const notes = [];
  getCasesForStudent(db, student.id).forEach(c=>{
    if (c.terminated || c.completed.closed) return;
    if (c.stages.invoice && c.stages.invoice.decision && c.stages.invoice.decision !== "Approve for Payment" && !c.completed.invoice){
      notes.push({ caseId: c.id, text: `Invoice on hold for ${c.id} — ${c.scenario.itemName}` });
    }
    if (c.stages.rfq && c.stages.rfq.quoteDeadline && !c.completed.quotations && new Date(c.stages.rfq.quoteDeadline) < new Date()){
      notes.push({ caseId: c.id, text: `RFQ quotation deadline has passed for ${c.id}` });
    }
    if (c.stages.po && c.stages.po.deliveryDate && !c.completed.delivery && new Date(c.stages.po.deliveryDate) < new Date()){
      notes.push({ caseId: c.id, text: `Expected delivery date has passed for ${c.id}` });
    }
  });
  return notes;
}

/* =============================== signature pad ============================= */

function signaturePadHtml(name, label){
  return `
  <div class="field">
    <label>${escapeHtml(label)} <span class="hint">(optional — draw with mouse, stylus or touch)</span></label>
    <div class="sig-pad-wrap">
      <canvas class="sig-pad" id="sig_${name}" width="440" height="110"></canvas>
      <button type="button" class="btn btn-outline btn-sm" data-sig-clear="${name}">Clear Signature</button>
    </div>
    <input type="hidden" name="${name}">
  </div>`;
}

function bindSignaturePad(name){
  const canvas = document.getElementById("sig_" + name);
  if (!canvas) return;
  let ctx = null;
  try{ ctx = canvas.getContext && canvas.getContext("2d"); }catch(e){ ctx = null; }
  if (!ctx) return; // no 2D canvas support in this environment — degrade silently, field stays optional

  ctx.strokeStyle = "#1C2333"; ctx.lineWidth = 2.2; ctx.lineCap = "round"; ctx.lineJoin = "round";
  let drawing = false;
  const hidden = canvas.parentElement.parentElement.querySelector(`input[name="${name}"]`);

  function pos(e){
    const rect = canvas.getBoundingClientRect();
    const src = e.touches && e.touches[0] ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
  }
  function start(e){ drawing = true; const p = pos(e); ctx.beginPath(); ctx.moveTo(p.x, p.y); if (e.preventDefault) e.preventDefault(); }
  function move(e){ if (!drawing) return; const p = pos(e); ctx.lineTo(p.x, p.y); ctx.stroke(); if (hidden) hidden.value = canvas.toDataURL(); if (e.preventDefault) e.preventDefault(); }
  function stop(){ drawing = false; }

  canvas.addEventListener("mousedown", start);
  canvas.addEventListener("mousemove", move);
  window.addEventListener("mouseup", stop);
  canvas.addEventListener("touchstart", start, { passive:false });
  canvas.addEventListener("touchmove", move, { passive:false });
  canvas.addEventListener("touchend", stop);

  const clearBtn = document.querySelector(`[data-sig-clear="${name}"]`);
  if (clearBtn) clearBtn.addEventListener("click", ()=>{
    ctx.clearRect(0,0,canvas.width,canvas.height);
    if (hidden) hidden.value = "";
  });
}

function signatureImgIfPresent(dataUrl){
  if (!dataUrl) return "";
  return `<div class="sig-preview"><img src="${dataUrl}" alt="Signature"></div>`;
}

/* ============================== data export/import ========================= */

function downloadText(filename, text, mime){
  const blob = new Blob([text], { type: mime || "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=> URL.revokeObjectURL(url), 2000);
}

function exportStudentData(db, student){
  const cases = getCasesForStudent(db, student.id);
  const payload = { exportedAt: new Date().toISOString(), student: { id: student.id, name: student.name }, cases };
  downloadText(`skelora-procurement-${student.id}-${todayISO()}.json`, JSON.stringify(payload, null, 2), "application/json");
}

function importStudentData(db, student, jsonText){
  let payload;
  try{ payload = JSON.parse(jsonText); }catch(e){ throw new Error("That file isn't valid JSON."); }
  const incoming = payload.cases || {};
  let count = 0;
  Object.values(incoming).forEach(c=>{
    if (!c || !c.id) return;
    c.studentId = student.id; c.studentName = student.name;
    db.cases[c.id] = c;
    count++;
  });
  saveDB(db);
  return count;
}

function caseToCSV(c){
  const rows = [["Field","Value"]];
  rows.push(["Case ID", c.id]);
  rows.push(["Department", c.scenario.department]);
  rows.push(["Item", c.scenario.itemName]);
  if (c.stages.pr) rows.push(["PR Number", c.stages.pr.prNumber], ["PR Line Items", c.stages.pr.lineItems.length], ["PR Total (incl. GST)", linesTotals(c.stages.pr.lineItems).grand.toFixed(2)]);
  if (c.stages.approval) rows.push(["Approval Decision", c.stages.approval.decision]);
  if (c.stages.rfq) rows.push(["RFQ Number", c.stages.rfq.rfqNumber], ["Vendors Invited", c.stages.rfq.vendorsInvited.length]);
  if (c.stages.negotiations && c.stages.negotiations.length) rows.push(["Negotiation Rounds", c.stages.negotiations.length]);
  if (c.stages.po) rows.push(["PO Number", c.stages.po.poNumber], ["PO Total (incl. GST)", linesTotals(c.stages.po.lineItems).grand.toFixed(2)], ["Amendments", (c.stages.po.amendments||[]).length]);
  if (c.stages.grns && c.stages.grns.length) rows.push(["GRNs Filed", c.stages.grns.length], ["Qty Accepted (total)", c.stages.grns.reduce((sum,g)=> sum + g.qtyAccepted.reduce((a,b)=>a+b,0), 0)]);
  if (c.stages.invoice) rows.push(["Invoice Number", c.stages.invoice.invoiceNumber], ["Invoice Decision", c.stages.invoice.decision]);
  if (c.stages.payment) rows.push(["Payment Request", c.stages.payment.payNumber]);
  rows.push(["Status", statusOf(c).label]);
  return rows.map(r=> r.map(v=>`"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
}

/* ================================ settings view ============================ */

function viewSettings(db, student){
  return `
    <button class="btn btn-outline btn-sm no-print" data-act="dashboard" style="margin-bottom:16px;">&larr; Back</button>
    <span class="eyebrow">Account</span>
    <h1 style="font-size:22px;">Settings</h1>

    <div class="panel">
      <div class="panel-head"><h2>Change Password</h2></div>
      <form id="changePwForm">
        <div class="field"><label>Current Password <span class="req">*</span></label><input type="password" name="current" required></div>
        <div class="field"><label>New Password <span class="req">*</span></label><input type="password" name="newPassword" id="settingsNewPw" required minlength="8"></div>
        <div id="pwStrengthBar" class="pw-strength"></div>
        <div class="field"><label>Confirm New Password <span class="req">*</span></label><input type="password" name="confirm" required minlength="8"></div>
        <div class="btn-row"><button type="submit" class="btn btn-primary">Update Password</button></div>
      </form>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Security Question</h2></div>
      <form id="secQForm">
        <div class="field"><label>Question</label>
          <select name="securityQuestion">${SECURITY_QUESTIONS.map(q=>`<option ${student.securityQuestion===q?"selected":""}>${escapeHtml(q)}</option>`).join("")}</select>
        </div>
        <div class="field"><label>New Answer <span class="req">*</span></label><input type="text" name="securityAnswer" required></div>
        <div class="btn-row"><button type="submit" class="btn btn-outline">Update Security Question</button></div>
      </form>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Login Activity</h2></div>
      <ul class="trail">
        ${(student.loginHistory||[]).length ? student.loginHistory.map(ts=>`<li><span class="ts">${fmtDateTime(ts)}</span><span>Signed in successfully</span></li>`).join("") : `<li class="muted">No login history recorded yet.</li>`}
      </ul>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Data Backup</h2></div>
      <p class="small muted">Export your cases as a backup file, or restore from a previously exported file.</p>
      <div class="btn-row">
        <button class="btn btn-outline" id="exportBtn">Export My Data (.json)</button>
        <label class="btn btn-outline" style="cursor:pointer;">Import Data (.json)<input type="file" id="importFile" accept="application/json" style="display:none;"></label>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2 style="color:var(--bad);">Danger Zone</h2></div>
      <p class="small muted">Permanently delete all your cases from this device. Your profile stays intact. This cannot be undone.</p>
      <button class="btn btn-danger" id="deleteCasesBtn">Delete All My Cases</button>
    </div>
  `;
}

function bindSettings(db, student){
  const pwLive = $("#settingsNewPw");
  const strengthBar = $("#pwStrengthBar");
  if (pwLive && strengthBar) pwLive.addEventListener("input", ()=>{
    const { score, label } = passwordStrength(pwLive.value);
    strengthBar.innerHTML = `<div class="pw-strength-track"><div class="pw-strength-fill s${score}"></div></div><span class="pw-strength-label">${label}</span>`;
  });

  const pwForm = $("#changePwForm");
  if (pwForm) pwForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (!pwForm.checkValidity()){ pwForm.reportValidity(); return; }
    const fd = new FormData(pwForm);
    const ok = await verifySecret(fd.get("current"), student.salt, student.passwordHash);
    if (!ok){ toast("Current password is incorrect.", "err"); return; }
    if (fd.get("newPassword") !== fd.get("confirm")){ toast("New passwords don't match.", "err"); return; }
    if (passwordStrength(fd.get("newPassword")).score < 2){ toast("Please choose a stronger password.", "err"); return; }
    student.salt = randomSalt();
    student.passwordHash = await hashSecret(fd.get("newPassword"), student.salt);
    saveDB(db);
    toast("Password updated.", "ok");
    pwForm.reset();
  });

  const secForm = $("#secQForm");
  if (secForm) secForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    if (!secForm.checkValidity()){ secForm.reportValidity(); return; }
    const fd = new FormData(secForm);
    student.securityQuestion = fd.get("securityQuestion");
    student.secSalt = randomSalt();
    student.securityAnswerHash = await hashSecret(fd.get("securityAnswer").trim().toLowerCase(), student.secSalt);
    saveDB(db);
    toast("Security question updated.", "ok");
    secForm.reset();
  });

  const exportBtn = $("#exportBtn");
  if (exportBtn) exportBtn.addEventListener("click", ()=>{ exportStudentData(db, student); toast("Export downloaded.", "ok"); });

  const importFile = $("#importFile");
  if (importFile) importFile.addEventListener("change", ()=>{
    const file = importFile.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const count = importStudentData(db, student, reader.result);
        toast(`Imported ${count} case(s).`, "ok");
        render();
      }catch(err){ toast(err.message, "err"); }
    };
    reader.readAsText(file);
  });

  const delBtn = $("#deleteCasesBtn");
  if (delBtn) delBtn.addEventListener("click", ()=>{
    if (!confirm("This will permanently delete every case you've created on this device. Continue?")) return;
    getCasesForStudent(db, student.id).forEach(c=> delete db.cases[c.id]);
    saveDB(db);
    toast("All your cases have been deleted.", "ok");
    render();
  });
}

/* ================================ vendors view ============================= */

function computeVendorStats(db, vendorId){
  const cases = Object.values(db.cases).filter(c=> c.stages.selection && c.stages.selection.vendorId === vendorId && c.completed.closed);
  const total = cases.length;
  const onTime = cases.filter(c=>{
    if (!c.stages.deliveries || !c.stages.deliveries.length || !c.stages.po) return false;
    const lastDate = c.stages.deliveries.reduce((max,d)=> d.date > max ? d.date : max, c.stages.deliveries[0].date);
    return new Date(lastDate) <= new Date(c.stages.po.deliveryDate);
  }).length;
  const qualityPass = cases.filter(c=> c.stages.grns && c.stages.grns.length && c.stages.grns.every(g=> g.qualityResult === "Passed")).length;
  return {
    total,
    onTimePct: total ? Math.round((onTime/total)*100) : null,
    qualityPct: total ? Math.round((qualityPass/total)*100) : null
  };
}

function viewVendors(db, student){
  const isInstructor = student.role === "instructor";
  const vendors = getVendors(db);
  return `
    <button class="btn btn-outline btn-sm no-print" data-act="dashboard" style="margin-bottom:16px;">&larr; Back</button>
    <span class="eyebrow">Master Data</span>
    <h1 style="font-size:22px;">Vendor Directory</h1>
    <p class="muted" style="margin-top:-6px;">Scorecards are computed automatically from your closed procurement cases.</p>

    ${isInstructor ? `
      <div class="panel">
        <div class="panel-head"><h2>Add Vendor</h2></div>
        <form id="addVendorForm">
          <div class="row2">
            <div class="field"><label>Vendor Name <span class="req">*</span></label><input type="text" name="name" required></div>
            <div class="field"><label>Category <span class="req">*</span></label><input type="text" name="category" required></div>
          </div>
          <div class="row3">
            <div class="field"><label>Contact Person</label><input type="text" name="contact"></div>
            <div class="field"><label>Email</label><input type="email" name="email"></div>
            <div class="field"><label>City</label><input type="text" name="city"></div>
          </div>
          <div class="btn-row"><button class="btn btn-primary" type="submit">Add Vendor</button></div>
        </form>
      </div>
    ` : ""}

    <div class="scenario-grid">
      ${vendors.map(v=>{
        const stats = computeVendorStats(db, v.id);
        const inactive = v.active === false;
        return `
        <div class="scenario-card" style="${inactive?'opacity:.55;':''}">
          <div class="sdept">${escapeHtml(v.category)} · ${escapeHtml(v.city||"")}</div>
          <h3>${escapeHtml(v.name)}${inactive?' <span class="chip chip-neutral">Inactive</span>':''}</h3>
          <p>${escapeHtml(v.contact||"")} ${v.email?"· "+escapeHtml(v.email):""}</p>
          ${stats.total ? `
            <div class="ref-grid" style="margin-bottom:10px;">
              <div><div class="k">On-Time Delivery</div><div class="v">${stats.onTimePct}%</div></div>
              <div><div class="k">Quality Pass Rate</div><div class="v">${stats.qualityPct}%</div></div>
              <div><div class="k">Closed Cases</div><div class="v">${stats.total}</div></div>
            </div>
          ` : `<p class="small muted">No completed cases with this vendor yet.</p>`}
          ${isInstructor ? `<button class="btn btn-outline btn-sm" data-toggle-vendor="${v.id}">${inactive?"Reactivate":"Deactivate"}</button>` : ""}
        </div>`;
      }).join("")}
    </div>
  `;
}

function bindVendors(db, student){
  $$("[data-toggle-vendor]").forEach(b=> b.addEventListener("click", ()=>{
    const v = getVendors(db).find(x=>x.id===b.dataset.toggleVendor);
    v.active = v.active === false ? true : false;
    saveDB(db); render();
  }));
  const addForm = $("#addVendorForm");
  if (addForm) addForm.addEventListener("submit", (e)=>{
    e.preventDefault();
    if (!addForm.checkValidity()){ addForm.reportValidity(); return; }
    const fd = new FormData(addForm);
    const id = "V-" + Math.floor(100+Math.random()*900) + Date.now().toString().slice(-3);
    getVendors(db).push({ id, name:fd.get("name"), category:fd.get("category"), contact:fd.get("contact")||"", email:fd.get("email")||"", phone:"", city:fd.get("city")||"", active:true });
    saveDB(db); toast("Vendor added.", "ok"); render();
  });
}

/* ================================ budgets view ============================= */

function computeBudgetUsage(db, scopeStudentId){
  const cases = scopeStudentId ? getCasesForStudent(db, scopeStudentId) : Object.values(db.cases);
  const usage = {};
  getBudgetCodes(db).forEach(b=> usage[b.code] = { label:b.label, allocated:b.allocatedBudget||0, used:0, active: b.active!==false });
  cases.forEach(c=>{
    if (c.stages.po && c.stages.pr && c.stages.pr.budgetCode){
      const code = c.stages.pr.budgetCode;
      if (!usage[code]) usage[code] = { label:code, allocated:0, used:0, active:true };
      usage[code].used += linesTotals(c.stages.po.lineItems).taxable;
    }
  });
  return usage;
}

function viewBudgets(db, student){
  const isInstructor = student.role === "instructor";
  const usage = computeBudgetUsage(db, isInstructor ? null : student.id);
  return `
    <button class="btn btn-outline btn-sm no-print" data-act="dashboard" style="margin-bottom:16px;">&larr; Back</button>
    <span class="eyebrow">Finance</span>
    <h1 style="font-size:22px;">Budget Utilisation</h1>
    <p class="muted" style="margin-top:-6px;">${isInstructor ? "Utilisation across all students' cases on this device." : "Utilisation across your own procurement cases, based on issued Purchase Orders."}</p>

    ${isInstructor ? `
    <div class="panel">
      <div class="panel-head"><h2>Add / Update Budget Code</h2></div>
      <form id="budgetForm">
        <div class="row3">
          <div class="field"><label>Code <span class="req">*</span></label><input type="text" class="mono-input" name="code" required placeholder="e.g. OPEX-QA-07"></div>
          <div class="field"><label>Label <span class="req">*</span></label><input type="text" name="label" required placeholder="e.g. OPEX-QA-07 — Quality Assurance"></div>
          <div class="field"><label>Allocated Budget (₹) <span class="req">*</span></label><input type="number" name="allocated" min="0" step="1000" required></div>
        </div>
        <div class="btn-row"><button class="btn btn-primary" type="submit">Save Budget Code</button></div>
      </form>
    </div>` : ""}

    <div class="panel">
      <div class="panel-head"><h2>Utilisation by Budget Code</h2></div>
      <div class="case-list">
        ${Object.entries(usage).map(([code, u])=>{
          const pct = u.allocated ? Math.min(100, Math.round((u.used/u.allocated)*100)) : 0;
          const over = u.allocated && u.used > u.allocated;
          return `
          <div class="case-row" style="cursor:default;">
            <div class="cl">
              <div class="cid">${escapeHtml(code)}</div>
              <div class="cname">${escapeHtml(u.label)}</div>
              <div class="cdept">${fmtMoney(u.used)} of ${fmtMoney(u.allocated)} used</div>
            </div>
            <div class="cr">
              <div class="progress-mini"><div style="width:${pct}%;${over?'background:var(--bad);':''}"></div></div>
              <span class="chip ${over?'chip-bad':pct>80?'chip-warn':'chip-ok'}">${pct}%</span>
            </div>
          </div>`;
        }).join("")}
      </div>
    </div>
  `;
}

function bindBudgets(db, student){
  const form = $("#budgetForm");
  if (!form) return;
  form.addEventListener("submit",(e)=>{
    e.preventDefault();
    if (!form.checkValidity()){ form.reportValidity(); return; }
    const fd = new FormData(form);
    const code = fd.get("code").trim().toUpperCase();
    const codes = getBudgetCodes(db);
    const existing = codes.find(b=>b.code===code);
    if (existing){ existing.label = fd.get("label"); existing.allocatedBudget = Number(fd.get("allocated")); }
    else codes.push({ code, label: fd.get("label"), allocatedBudget: Number(fd.get("allocated")), active:true });
    saveDB(db); toast("Budget code saved.", "ok"); render();
  });
}

/* ============================ weighted vendor scoring ======================= */

function computeWeightedScores(db, c, weights){
  const quotations = c.stages.quotations;
  const pr = c.stages.pr;
  const prices = quotations.map(q=> quoteLineTotal(pr, q));
  const leads = quotations.map(q=>q.leadDays);
  const minP = Math.min(...prices), maxP = Math.max(...prices);
  const minL = Math.min(...leads), maxL = Math.max(...leads);

  return quotations.map((q,i)=>{
    const total = prices[i];
    const priceScore = maxP===minP ? 100 : ((maxP-total)/(maxP-minP))*100;
    const deliveryScore = maxL===minL ? 100 : ((maxL-q.leadDays)/(maxL-minL))*100;
    const termsScore = PAYMENT_TERMS_SCORE[q.paymentTerms] ?? 50;
    const weighted = (priceScore*weights.price + deliveryScore*weights.delivery + termsScore*weights.terms) / 100;
    return { vendorId: q.vendorId, priceScore: Math.round(priceScore), deliveryScore: Math.round(deliveryScore), termsScore: Math.round(termsScore), weighted: Math.round(weighted*10)/10 };
  }).sort((a,b)=> b.weighted - a.weighted);
}

function weightedScoreTableHtml(db, scores){
  const rows = scores.map((s,i)=>{
    const v = getVendors(db).find(x=>x.id===s.vendorId);
    return `<tr class="${i===0?'best':''}"><td>${escapeHtml(v.name)}${i===0?' <span class="chip chip-ok">Top Score</span>':''}</td><td class="mono">${s.priceScore}</td><td class="mono">${s.deliveryScore}</td><td class="mono">${s.termsScore}</td><td class="mono" style="font-weight:700;">${s.weighted}</td></tr>`;
  }).join("");
  return `<table class="dtable" style="margin-top:14px;">
    <thead><tr><th>Vendor</th><th>Price Score</th><th>Delivery Score</th><th>Terms Score</th><th>Weighted Score</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function weightFormHtml(weights){
  return `
  <div class="field">
    <label>Weighting Model <span class="hint">(must sum to 100 — set how much each factor matters for this purchase)</span></label>
    <div class="row3">
      <div class="field"><label>Price Weight (%)</label><input type="number" name="priceWeight" id="wPrice" min="0" max="100" value="${weights.price}"></div>
      <div class="field"><label>Delivery Weight (%)</label><input type="number" name="deliveryWeight" id="wDelivery" min="0" max="100" value="${weights.delivery}"></div>
      <div class="field"><label>Payment Terms Weight (%)</label><input type="number" name="termsWeight" id="wTerms" min="0" max="100" value="${weights.terms}"></div>
    </div>
    <div class="small muted" id="weightTotalDisplay">Total: ${weights.price+weights.delivery+weights.terms}%</div>
  </div>
  <div id="weightedScoreHost"></div>`;
}

function bindWeightForm(db, c, onRecalc){
  const pEl = $("#wPrice"), dEl = $("#wDelivery"), tEl = $("#wTerms"), totalDisp = $("#weightTotalDisplay"), host = $("#weightedScoreHost");
  if (!pEl) return;
  function recalc(){
    const weights = { price:Number(pEl.value)||0, delivery:Number(dEl.value)||0, terms:Number(tEl.value)||0 };
    const sum = weights.price + weights.delivery + weights.terms;
    totalDisp.textContent = `Total: ${sum}%`;
    totalDisp.style.color = sum===100 ? "var(--ok)" : "var(--bad)";
    if (host) host.innerHTML = weightedScoreTableHtml(db, computeWeightedScores(db, c, weights));
    if (onRecalc) onRecalc(weights, sum);
  }
  [pEl,dEl,tEl].forEach(el=> el.addEventListener("input", recalc));
  recalc();
}

function svgBarChart(data, opts){
  opts = opts || {};
  const w = opts.width || 640, h = opts.height || 220, pad = 40;
  const max = Math.max(1, ...data.map(d=>d.value));
  const gap = (w - pad*2) / data.length;
  const barW = gap * 0.55;
  const bars = data.map((d,i)=>{
    const bh = Math.round((d.value/max) * (h - pad*2));
    const x = pad + i*gap + (gap-barW)/2;
    const y = h - pad - bh;
    return `<rect x="${x.toFixed(1)}" y="${y}" width="${barW.toFixed(1)}" height="${bh}" rx="3" fill="${opts.color||'#A9793F'}"></rect>
      <text x="${(x+barW/2).toFixed(1)}" y="${h-pad+16}" font-size="10" text-anchor="middle" fill="#4B5266">${escapeHtml(d.label)}</text>
      <text x="${(x+barW/2).toFixed(1)}" y="${y-6}" font-size="11" text-anchor="middle" fill="#1C2333" font-weight="700">${d.value}</text>`;
  }).join("");
  return `<svg viewBox="0 0 ${w} ${h}" width="100%" height="${h}" style="font-family:'IBM Plex Mono',monospace;">
    <line x1="${pad}" y1="${h-pad}" x2="${w-pad}" y2="${h-pad}" stroke="#D8D3C6"></line>
    ${bars}
  </svg>`;
}

/* ============================ certificate printing =========================== */

function printCertificate(){
  document.body.classList.add("printing-certificate");
  window.print();
}
window.addEventListener("afterprint", ()=>{ document.body.classList.remove("printing-certificate"); });

/* ================================ help / glossary ============================ */

function helpDrawerHtml(){
  return `
  <div class="modal-backdrop no-print" role="dialog" aria-modal="true" aria-label="Glossary of procurement terms">
    <div class="modal-card" style="max-width:480px;max-height:80vh;overflow-y:auto;text-align:left;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3 style="margin:0;">Glossary</h3>
        <button class="btn btn-outline btn-sm" data-act="help-close" aria-label="Close glossary">Close</button>
      </div>
      ${GLOSSARY.map(g=>`<div class="glossary-item"><div class="gt">${escapeHtml(g.term)}</div><div class="gd">${escapeHtml(g.def)}</div></div>`).join("")}
    </div>
  </div>`;
}

function viewReports(db, student){
  const isInstructor = student.role === "instructor";
  const cases = isInstructor ? Object.values(db.cases) : getCasesForStudent(db, student.id);
  const funnel = STAGES.filter(s=>s.key!=="closed").map(s=>({
    label: "S"+s.num,
    value: cases.filter(c=>!c.completed.closed && !c.terminated && c.currentStage===s.num).length
  }));
  const closedCases = cases.filter(c=>c.completed.closed);
  const avgDays = closedCases.length ? Math.round(closedCases.reduce((sum,c)=> sum + (new Date(c.stages.closed.closedAt) - new Date(c.createdAt))/86400000, 0)/closedCases.length) : null;
  const rejectionRate = cases.length ? Math.round((cases.filter(c=>c.terminated).length/cases.length)*100) : 0;

  return `
    <button class="btn btn-outline btn-sm no-print" data-act="dashboard" style="margin-bottom:16px;">&larr; Back</button>
    <span class="eyebrow">${isInstructor ? "Class-Wide" : "My Performance"}</span>
    <h1 style="font-size:22px;">Reports</h1>

    <div class="stat-row">
      <div class="stat-card"><div class="num">${cases.length}</div><div class="lbl">Total Cases</div></div>
      <div class="stat-card"><div class="num">${closedCases.length}</div><div class="lbl">Closed</div></div>
      <div class="stat-card"><div class="num">${avgDays===null?"—":avgDays}</div><div class="lbl">Avg. Days to Close</div></div>
      <div class="stat-card"><div class="num">${rejectionRate}%</div><div class="lbl">Rejection Rate</div></div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Cases In Progress, by Stage</h2></div>
      ${cases.length ? svgBarChart(funnel) : `<div class="empty-note">No cases yet.</div>`}
    </div>
  `;
}

function bindReports(db, student){ /* purely informational view, nothing to bind */ }

/* ============================ instructor console ============================ */

function viewInstructorConsole(db, student){
  const tab = STATE.instructorTab;
  const allStudents = studentList(db).filter(s=>s.role!=="instructor");
  const allCases = Object.values(db.cases);

  return `
    <div class="dash-head">
      <div><span class="eyebrow">Instructor Console</span><h1 style="font-size:24px;margin:0;">Class Overview</h1></div>
    </div>
    <div class="tabs" style="max-width:520px;margin-bottom:20px;">
      <button data-itab="overview" class="${tab==="overview"?"active":""}">Overview</button>
      <button data-itab="students" class="${tab==="students"?"active":""}">Students</button>
      <button data-itab="masterdata" class="${tab==="masterdata"?"active":""}">Master Data</button>
    </div>

    ${tab==="overview" ? `
      <div class="stat-row">
        <div class="stat-card"><div class="num">${allStudents.length}</div><div class="lbl">Students</div></div>
        <div class="stat-card"><div class="num">${allCases.length}</div><div class="lbl">Total Cases</div></div>
        <div class="stat-card"><div class="num">${allCases.filter(c=>c.completed.closed).length}</div><div class="lbl">Closed</div></div>
        <div class="stat-card"><div class="num">${allCases.filter(c=>c.terminated).length}</div><div class="lbl">Rejected</div></div>
      </div>
      <div class="panel">
        <div class="panel-head"><h2>Recent Activity</h2></div>
        <ul class="trail">
          ${allCases.flatMap(c=>c.history.map(h=>({...h, caseId:c.id, student:c.studentName})))
            .sort((a,b)=> new Date(b.ts)-new Date(a.ts)).slice(0,15)
            .map(h=>`<li><span class="ts">${fmtDateTime(h.ts)}</span><span>${escapeHtml(h.student)} — ${escapeHtml(h.text)}</span></li>`).join("") || `<li class="muted">No activity yet.</li>`}
        </ul>
      </div>
      <div class="btn-row no-print"><button class="btn btn-outline" data-act="reports">View Class Reports</button></div>
    ` : ""}

    ${tab==="students" ? viewInstructorStudents(db, allStudents) : ""}
    ${tab==="masterdata" ? `<p class="small muted">Manage vendors and budget codes from the <strong>Vendors</strong> and <strong>Budgets</strong> pages.</p>
      <div class="btn-row"><button class="btn btn-outline" data-act="vendors">Open Vendor Directory</button><button class="btn btn-outline" data-act="budgets">Open Budgets</button></div>` : ""}
  `;
}

function viewInstructorStudents(db, allStudents){
  if (STATE.instructorViewStudentId){
    const s = db.students[STATE.instructorViewStudentId];
    const cases = getCasesForStudent(db, s.id);
    return `
      <button class="btn btn-outline btn-sm" id="backToStudents" style="margin-bottom:14px;">&larr; All Students</button>
      <div class="panel">
        <div class="panel-head"><h2>${escapeHtml(s.name)}'s Cases</h2><span class="muted small">${escapeHtml(s.id)}${s.batch?" · "+escapeHtml(s.batch):""}</span></div>
        <div class="case-list">
          ${cases.length ? cases.map(c=>{
            const st = statusOf(c);
            return `<div class="case-row" data-review="${c.id}">
              <div class="cl"><div class="cid">${c.id}</div><div class="cname">${escapeHtml(c.scenario.itemName)}</div><div class="cdept">${escapeHtml(c.scenario.department)}</div></div>
              <div class="cr">${c.instructorReview?`<span class="chip chip-neutral">Score: ${c.instructorReview.score}</span>`:""}<span class="chip ${st.cls}">${st.label}</span></div>
            </div>`;
          }).join("") : `<div class="empty-note">No cases yet.</div>`}
        </div>
      </div>`;
  }
  return `
    <div class="panel">
      <div class="panel-head"><h2>All Students</h2></div>
      <div class="case-list">
        ${allStudents.length ? allStudents.map(s=>{
          const cases = getCasesForStudent(db, s.id);
          const closed = cases.filter(c=>c.completed.closed).length;
          return `<div class="case-row" data-view-student="${s.id}">
            <div class="cl"><div class="cid">${escapeHtml(s.id)}</div><div class="cname">${escapeHtml(s.name)}</div><div class="cdept">${s.batch?escapeHtml(s.batch):""}</div></div>
            <div class="cr"><span class="chip chip-neutral">${cases.length} case(s)</span><span class="chip chip-ok">${closed} closed</span></div>
          </div>`;
        }).join("") : `<div class="empty-note">No students registered on this device yet.</div>`}
      </div>
    </div>`;
}

function bindInstructorConsole(db, student){
  $$("[data-itab]").forEach(b=> b.addEventListener("click", ()=>{ STATE.instructorTab = b.dataset.itab; STATE.instructorViewStudentId=null; render(); }));
  $$("[data-view-student]").forEach(b=> b.addEventListener("click", ()=>{ STATE.instructorViewStudentId = b.dataset.viewStudent; render(); }));
  const back = $("#backToStudents");
  if (back) back.addEventListener("click", ()=>{ STATE.instructorViewStudentId = null; render(); });
  $$("[data-review]").forEach(b=> b.addEventListener("click", ()=>{ STATE.reviewCaseId = b.dataset.review; STATE.view = "instructorCaseReview"; render(); }));
}

/* =========================== instructor case review ========================= */

function viewInstructorCaseReview(db, c){
  const student = db.students[c.studentId];
  return `
    <button class="btn btn-outline btn-sm no-print" id="backToStudentCases" style="margin-bottom:16px;">&larr; Back to ${escapeHtml(student.name)}'s Cases</button>
    <span class="eyebrow">Read-Only Review</span>
    <h1 style="font-size:21px;">${escapeHtml(c.scenario.itemName)}</h1>
    <p class="muted small">${c.id} · ${escapeHtml(student.name)} (${escapeHtml(student.id)}) · ${escapeHtml(c.scenario.department)}</p>

    <div class="panel">
      <div class="panel-head"><h2>Document Trail</h2></div>
      ${c.stages.pr ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Purchase Requisition — ${c.stages.pr.prNumber}</span></div><div class="accordion-b">${prDocCard(c.stages.pr, c.stages.pr.prNumber)}</div></div>` : ""}
      ${c.stages.approval ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Manager Approval — ${escapeHtml(c.stages.approval.decision)}</span></div><div class="accordion-b">${signatureImgIfPresent(c.stages.approval.signature)}<p class="small">${escapeHtml(c.stages.approval.comments||"No comments.")}</p></div></div>` : ""}
      ${c.stages.rfq ? `<div class="accordion-item"><div class="accordion-h"><span class="t">RFQ — ${c.stages.rfq.rfqNumber}</span></div><div class="accordion-b">${rfqDocCard(c.stages.rfq, c.stages.rfq.vendorsInvited.map(id=>getVendors(db).find(v=>v.id===id)))}</div></div>` : ""}
      ${(c.stages.quotations && c.stages.quotations.length) ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Quotations Received</span></div><div class="accordion-b">${quotationsTable(db, c.stages.quotations)}</div></div>` : ""}
      ${c.stages.comparison ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Comparison</span></div><div class="accordion-b">${comparisonTable(db, c, true)}${c.stages.comparison.scores?weightedScoreTableHtml(db, c.stages.comparison.scores):""}${(c.stages.negotiations&&c.stages.negotiations.length)?negotiationHistoryHtml(db, c):""}<p class="small" style="margin-top:10px;">${escapeHtml(c.stages.comparison.notes)}</p></div></div>` : ""}
      ${c.stages.selection ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Vendor Selected — ${escapeHtml(getVendors(db).find(v=>v.id===c.stages.selection.vendorId).name)}</span></div><div class="accordion-b"><p class="small">${escapeHtml(c.stages.selection.justification)}</p></div></div>` : ""}
      ${c.stages.po ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Purchase Order — ${c.stages.po.poNumber}${(c.stages.po.amendments&&c.stages.po.amendments.length)?` (${c.stages.po.amendments.length} amendment(s))`:""}</span></div><div class="accordion-b">${poDocCard(c.stages.po, getVendors(db).find(v=>v.id===c.stages.selection.vendorId))}${(c.stages.po.amendments||[]).map((a,i)=>poAmendmentCard(a,i)).join("")}</div></div>` : ""}
      ${(c.stages.deliveries && c.stages.deliveries.length) ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Delivery — ${c.stages.deliveries.length} shipment(s)</span></div><div class="accordion-b"><p class="small">${c.stages.deliveries.reduce((s,d)=>s+d.qtyDelivered.reduce((a,b)=>a+b,0),0)} unit(s) delivered across ${c.stages.deliveries.length} shipment(s).</p></div></div>` : ""}
      ${(c.stages.grns && c.stages.grns.length) ? `<div class="accordion-item"><div class="accordion-h"><span class="t">GRN — ${c.stages.grns.length} filed</span></div><div class="accordion-b"><p class="small">${c.stages.grns.reduce((s,g)=>s+g.qtyAccepted.reduce((a,b)=>a+b,0),0)} unit(s) accepted across ${c.stages.grns.length} inspection(s).</p></div></div>` : ""}
      ${c.stages.invoice && c.stages.invoice.lineItems ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Invoice — ${escapeHtml(c.stages.invoice.invoiceNumber||"")}</span></div><div class="accordion-b">${invoiceMatchBlock(c.stages.po.lineItems, cumulativeQty(c.stages.grns, c.stages.po.lineItems.length, "qtyAccepted"), c.stages.invoice.lineItems)}</div></div>` : ""}
      ${c.stages.payment && c.stages.payment.method ? `<div class="accordion-item"><div class="accordion-h"><span class="t">Payment Request — ${c.stages.payment.payNumber}</span></div><div class="accordion-b">${signatureImgIfPresent(c.stages.payment.signature)}<p class="small">${escapeHtml(c.stages.payment.method)}, due ${fmtDate(c.stages.payment.dueDate)}</p></div></div>` : ""}
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Audit Trail</h2></div>
      <ul class="trail">${c.history.map(h=>`<li><span class="ts">${fmtDateTime(h.ts)}</span><span>${escapeHtml(h.text)}</span></li>`).join("")}</ul>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Instructor Review</h2></div>
      <form id="reviewForm">
        <div class="row2">
          <div class="field"><label>Score (0–100)</label><input type="number" name="score" min="0" max="100" value="${c.instructorReview?c.instructorReview.score:""}"></div>
          <div class="field"><label>Graded By</label><input type="text" value="Instructor" readonly></div>
        </div>
        <div class="field"><label>Feedback</label><textarea name="feedback" rows="3">${escapeHtml(c.instructorReview?c.instructorReview.feedback:"")}</textarea></div>
        <div class="btn-row"><button class="btn btn-primary" type="submit">Save Review</button></div>
      </form>
    </div>
  `;
}

function bindInstructorCaseReview(db, c){
  const back = $("#backToStudentCases");
  if (back) back.addEventListener("click", ()=>{ STATE.view="dashboard"; STATE.instructorTab="students"; render(); });
  $$(".accordion-h").forEach(h=> h.addEventListener("click", ()=>{
    const body = h.nextElementSibling;
    body.classList.toggle("hidden");
  }));
  const form = $("#reviewForm");
  if (form) form.addEventListener("submit",(e)=>{
    e.preventDefault();
    const fd = new FormData(form);
    c.instructorReview = { score: fd.get("score")?Number(fd.get("score")):null, feedback: fd.get("feedback")||"", gradedBy: "Instructor", gradedAt: new Date().toISOString() };
    saveDB(db); toast("Review saved.", "ok"); render();
  });
}

/* ============================ session inactivity ============================ */

const SESSION_IDLE_LIMIT_MS = 20*60*1000;
const SESSION_WARNING_WINDOW_MS = 60*1000;

function markActivity(){ STATE.lastActivity = Date.now(); if (STATE.sessionWarning){ STATE.sessionWarning = false; } }

function startInactivityWatch(){
  ["click","keydown","touchstart"].forEach(evt=> document.addEventListener(evt, markActivity, { passive:true }));
  setInterval(()=>{
    if (getSession() === null) return;
    const idleFor = Date.now() - STATE.lastActivity;
    if (idleFor > SESSION_IDLE_LIMIT_MS + SESSION_WARNING_WINDOW_MS){
      clearSession(); STATE.studentId = null; STATE.view = "login"; STATE.sessionWarning = false; render();
    } else if (idleFor > SESSION_IDLE_LIMIT_MS && !STATE.sessionWarning && STATE.studentId){
      STATE.sessionWarning = true; render();
    }
  }, 15000);
}

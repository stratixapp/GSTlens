/**
 * gst_intelligence.js
 * GST Lens — Smart Intelligence Engine v4.0 (Advanced)
 * Rule-based, 100% offline, zero API calls
 *
 * NEW in v4.0:
 *  — Full line-item analysis (per-row breakdown)
 *  — Compliance risk score (0–100) with weighted deductions
 *  — ITC reversal risk detection (Section 17(5), time limits, unregistered)
 *  — Filing deadline tracker (GSTR-1, 2B, 3B due dates)
 *  — Supply type auto-detection from both GSTINs
 *  — Actionable compliance checklist per invoice
 *  — Multi-tab UI card (Overview / Items / ITC / Deadlines / Checklist)
 *  — Buyer vs Seller classification (B2B/B2C/B2G/Export)
 *  — Freight taxability advisory
 *  — E-way bill & IRN mandate check
 *  — Enhanced HSN-based rate suggestions
 *  — GST savings opportunities detection
 */

'use strict';

const GSTIntelligence = (() => {

  // ── HSN → Category + Rate database ───────────────────────────────────
  const HSN_DB = {
    '0101':'Live horses','0201':'Meat of bovine','0301':'Live fish','0401':'Milk and cream',
    '0701':'Potatoes','0702':'Tomatoes','0801':'Coconuts','0901':'Coffee','0902':'Tea',
    '1001':'Wheat','1006':'Rice','1101':'Wheat flour','1201':'Soya beans',
    '1701':'Cane sugar','1801':'Cocoa beans','1901':'Malt extract',
    '2701':'Coal','2709':'Petroleum oils crude','2710':'Petroleum products',
    '2801':'Fluorine, chlorine','2901':'Acyclic hydrocarbons','3001':'Glands/organs',
    '3004':'Medicaments','3301':'Essential oils','3401':'Soap',
    '3402':'Surface-active preparations (industrial cleaner)','3507':'Enzymes',
    '3814':'Organic composite solvents','3824':'Chemical preparations',
    '2207':'Ethyl alcohol, denatured spirits',
    '3901':'Polymers of ethylene','3926':'Other plastic articles','4011':'New pneumatic tyres',
    '4101':'Raw hides','4901':'Printed books','4902':'Newspapers',
    '5001':'Silk worm cocoons','5101':'Wool','5201':'Cotton','5401':'Synthetic filament yarn',
    '6101':'Mens overcoats','6201':'Womens overcoats','6301':'Blankets',
    '6401':'Waterproof footwear','6403':'Footwear, outer sole rubber',
    '6801':'Setts of stone','6901':'Bricks','7001':'Cullet of glass',
    '7101':'Pearls','7102':'Diamonds','7103':'Precious stones','7108':'Gold',
    '7113':'Jewellery','7114':'Articles of goldsmiths',
    '7201':'Pig iron','7207':'Semi-finished iron','7210':'Flat-rolled iron',
    '7601':'Unwrought aluminium',
    '8414':'Air pumps','8415':'Air conditioning machines','8418':'Refrigerators',
    '8422':'Dishwashing machines','8443':'Printing machinery','8450':'Washing machines',
    '8471':'Computers, laptops, tablets','8517':'Telephones, smartphones',
    '8518':'Microphones, speakers','8523':'USB drives, storage media',
    '8528':'Monitors, TVs','8544':'Insulated wire, cables',
    '8703':'Motor cars','8711':'Motorcycles','8714':'Parts for motorcycles',
    '9001':'Optical fibres','9101':'Wrist-watches','9201':'Pianos',
    '9401':'Seats, chairs','9403':'Other furniture','9404':'Mattresses',
    '9503':'Toys','9504':'Video games','9506':'Sports goods','9603':'Brooms',
    '9954':'Construction services','9961':'Wholesale trade','9962':'Retail trade',
    '9963':'Accommodation services','9964':'Passenger transport',
    '9965':'Freight transport (GTA)','9966':'Rental of transport',
    '9967':'Supporting transport','9968':'Postal and courier',
    '9969':'Electricity distribution','9971':'Financial services',
    '9972':'Real estate services','9973':'Leasing services',
    '9981':'IT services','9982':'Legal services','9983':'Accounting services',
    '9984':'Telecom services','9985':'Support services','9986':'Agricultural support',
    '9987':'Maintenance services','9988':'Manufacturing services',
    '9991':'Education services','9992':'Health services','9993':'Social services',
    '9997':'Other services','9999':'Services by government'
  };

  // ── GST rate rules by HSN prefix ──────────────────────────────────────
  const HSN_RATE_MAP = [
    { prefix: ['0101','0201','0301','0401','0501','0601','0701','0801','0901','1001','1006','1101'], rate: 0,  label: 'Exempt food / agriculture' },
    { prefix: ['3004','3005'],                                                                      rate: 5,  label: 'Medicines' },
    { prefix: ['4901','4902'],                                                                      rate: 0,  label: 'Books / Newspapers' },
    { prefix: ['8471','8473','8517','8523','8525'],                                                 rate: 18, label: 'Electronics / IT' },
    { prefix: ['8703','8711'],                                                                      rate: 28, label: 'Motor vehicles' },
    { prefix: ['9954'],                                                                             rate: 18, label: 'Construction services' },
    { prefix: ['9971','9972','9973'],                                                               rate: 18, label: 'Financial / Real estate' },
    { prefix: ['9981','9982','9983','9984','9985'],                                                 rate: 18, label: 'Professional services' },
    { prefix: ['9991'],                                                                             rate: 0,  label: 'Education' },
    { prefix: ['9992'],                                                                             rate: 5,  label: 'Healthcare' },
    { prefix: ['9965'],                                                                             rate: 5,  label: 'GTA (5% without ITC)' },
    { prefix: ['22','28','29','32','33','34','35','36','37','38','39','40'],                        rate: 18, label: 'Industrial & Chemical' },
  ];

  // ── ITC blocked categories (Section 17(5)) ────────────────────────────
  const ITC_BLOCKED = [
    { cat: 'Food & Bev',       reason: 'Food/beverages — blocked under Section 17(5)(b)', section: '17(5)(b)' },
    { cat: 'Food & Dining',    reason: 'Food/beverages — blocked under Section 17(5)(b)', section: '17(5)(b)' },
    { cat: 'Healthcare',       reason: 'Health services — blocked unless core business',  section: '17(5)' },
    { cat: 'Medical',          reason: 'Medical supply — blocked unless core business',   section: '17(5)' },
    { cat: 'Education',        reason: 'Education — exempt supply, ITC not applicable',   section: '17(5)' },
    { cat: 'Fuel & Energy',    reason: 'Motor fuel — blocked under Section 17(5)(a)',     section: '17(5)(a)' },
    { cat: 'Automobile',       reason: 'Motor vehicles — blocked unless used for business transport', section: '17(5)(a)' },
  ];

  // ── Category patterns ─────────────────────────────────────────────────
  const CATEGORY_PATTERNS = [
    { pattern: /hotel|restau|cafe|food|kitchen|canteen|swiggy|zomato|dhaba|mess|beverage/i, cat: 'Food & Bev', rate: 5 },
    { pattern: /pharma|medical|hospital|clinic|health|medicine|drug|apollo|medplus/i,        cat: 'Healthcare',  rate: 5 },
    { pattern: /school|college|university|education|training|institute|academy/i,            cat: 'Education',   rate: 0 },
    { pattern: /petrol|fuel|diesel|gas|petroleum|hp|indian oil|bharat/i,                     cat: 'Fuel & Energy', rate: 18 },
    { pattern: /mobile|phone|laptop|computer|tablet|iphone|samsung|apple|realme|oppo|vivo/i, cat: 'Electronics',   rate: 18 },
    { pattern: /cloth|garment|textile|fashion|shirt|pant|saree|dupatta|fabric/i,             cat: 'Clothing & Textiles', rate: 5 },
    { pattern: /transport|logistics|freight|courier|delivery|trucking|shipping/i,            cat: 'Transport & Logistics', rate: 5 },
    { pattern: /software|IT|tech|cloud|hosting|domain|SaaS|app|digital/i,                   cat: 'IT Services', rate: 18 },
    { pattern: /construction|build|civil|contractor|cement|sand|brick|steel/i,              cat: 'Construction', rate: 12 },
    { pattern: /bank|finance|insurance|loan|NBFC|credit|debit|mutual fund/i,                cat: 'Financial Services', rate: 18 },
    { pattern: /jewel|gold|silver|diamond|platinum|ornament/i,                              cat: 'Jewellery & Precious Metals', rate: 3 },
    { pattern: /electricity|power|utility|KSEB|BESCOM|MSEDCL|TNEB/i,                       cat: 'Electricity & Utilities', rate: 0 },
    { pattern: /rent|lease|property|real estate|housing|PG|flat/i,                         cat: 'Real Estate & Rentals', rate: 18 },
    { pattern: /stationary|office|print|ink|paper|pen|copy/i,                              cat: 'Office Supplies', rate: 12 },
    { pattern: /grocery|kirana|supermarket|mart|reliance|dmart|bigbasket/i,                 cat: 'Grocery & FMCG', rate: 5 },
    { pattern: /industrial|chemical|solvent|compound|ethanol|enzyme|cleaning/i,             cat: 'Industrial & Chemical', rate: 18 },
  ];

  // ── HSN chapter to category mapping ──────────────────────────────────
  const HSN_CHAPTER_CAT = {
    '99': 'Professional Services',
    '84': 'Electronics', '85': 'Electronics',
    '87': 'Automobile',
    '30': 'Healthcare', '31': 'Healthcare',
    '71': 'Jewellery & Precious Metals',
    '49': 'Education',
    '27': 'Fuel & Energy',
    '22': 'Industrial & Chemical', '28': 'Industrial & Chemical',
    '29': 'Industrial & Chemical', '32': 'Industrial & Chemical',
    '33': 'Industrial & Chemical', '34': 'Industrial & Chemical',
    '35': 'Industrial & Chemical', '36': 'Industrial & Chemical',
    '37': 'Industrial & Chemical', '38': 'Industrial & Chemical',
    '39': 'Industrial & Chemical', '40': 'Industrial & Chemical',
  };

  // ── Smart tips ────────────────────────────────────────────────────────
  const TIPS = {
    highValue:    ['Invoice > ₹50,000 — HSN code mandatory for B2B (Section 31)', 'High-value: verify supplier filed GSTR-1 for ITC to appear in GSTR-2B', 'Bills > ₹2 lakh must have buyer PAN — verify before ITC claim'],
    interstate:   ['Interstate supply — IGST goes to Centre and is shared with destination state', 'IGST ITC can offset CGST, SGST, or IGST output liability in that order'],
    intrastate:   ['Intrastate — CGST goes to Centre, SGST stays with state', 'Intrastate CGST+SGST: use to offset same-type output liability first'],
    zeroRate:     ['Zero-rated: no GST. Keep records for annual return (GSTR-9)', 'Exempt supply: cannot claim ITC on inputs used for this supply'],
    services:     ['Service invoice: Place of Supply determines CGST+SGST vs IGST', 'Professional services GST is ITC-eligible if used for taxable business'],
    industrial:   ['Industrial/chemical supplies are fully ITC-eligible for manufacturing businesses', 'Verify HSN classification — incorrect HSN can trigger scrutiny'],
    construction: ['Construction services: ITC blocked for immovable property (Section 17(5)(c/d))', 'Works contract for plant/machinery: ITC available'],
    itc:          ['File GSTR-3B by 20th to claim ITC for this period', 'ITC only claimable once invoice appears in GSTR-2B (auto-populated from supplier\'s GSTR-1)'],
  };

  // ── Detect category ───────────────────────────────────────────────────
  function detectCategory(vendorName, hsnCode, ocrCategory) {
    const vendor = String(vendorName || '');

    // 1. HSN chapter takes priority (prevents false keyword matches)
    if (hsnCode) {
      const chapter = String(hsnCode).substring(0, 2);
      if (HSN_CHAPTER_CAT[chapter]) {
        return { cat: HSN_CHAPTER_CAT[chapter], suggestedRate: null, source: 'hsn_chapter' };
      }
      const h = String(hsnCode).substring(0, 4);
      const hsnEntry = HSN_DB[h];
      if (hsnEntry) {
        for (const rm of HSN_RATE_MAP) {
          if (rm.prefix.some(p => h.startsWith(p.substring(0, Math.min(p.length, h.length))))) {
            return { cat: rm.label, suggestedRate: rm.rate, source: 'hsn' };
          }
        }
        return { cat: hsnEntry, suggestedRate: 18, source: 'hsn_desc' };
      }
    }

    // 2. Vendor name pattern match
    for (const cp of CATEGORY_PATTERNS) {
      if (cp.pattern.test(vendor)) return { cat: cp.cat, suggestedRate: cp.rate, source: 'vendor' };
    }

    // 3. OCR-supplied category fallback
    if (ocrCategory && ocrCategory !== 'General' && ocrCategory !== 'General Purchase') {
      return { cat: ocrCategory, suggestedRate: 18, source: 'ocr' };
    }

    return { cat: 'General Purchase', suggestedRate: 18, source: 'fallback' };
  }

  // ── Get HSN description ───────────────────────────────────────────────
  function getHSNDescription(hsnCode) {
    if (!hsnCode) return null;
    const h = String(hsnCode);
    for (let len = Math.min(h.length, 8); len >= 4; len--) {
      const key = h.substring(0, len);
      if (HSN_DB[key]) return HSN_DB[key];
    }
    // Fall back to chapter description
    if (GSTValidatorUtils && GSTValidatorUtils.HSN_CHAPTERS) {
      const ch = h.substring(0, 2);
      return GSTValidatorUtils.HSN_CHAPTERS[ch] || null;
    }
    return null;
  }

  // ── Detect GST rate from amounts or text ──────────────────────────────
  function detectGSTRate(data, rawOcrText) {
    const cgst    = parseFloat(data.cgst || 0);
    const sgst    = parseFloat(data.sgst || 0);
    const igst    = parseFloat(data.igst || 0);
    const total   = parseFloat(data.totalAmount || 0);
    const taxable = parseFloat(data.taxableAmount || (total - cgst - sgst - igst) || 0);
    const totalGST = cgst + sgst + igst;
    const VALID = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];

    // Path A: compute from amounts
    if (taxable > 0 && totalGST > 0) {
      const raw = Math.round((totalGST / taxable) * 100);
      return VALID.reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a);
    }

    // Path B: data has explicit rate fields
    if (data.cgstRate > 0) return Math.min(28, data.cgstRate * 2);
    if (data.igstRate > 0) return data.igstRate;

    // Path C: text scan
    if (rawOcrText) {
      const txt = rawOcrText.replace(/C6ST/gi,'CGST').replace(/S6ST/gi,'SGST').replace(/I6ST/gi,'IGST');
      const igstM = txt.match(/I[Gg]ST\s*[@%(]\s*(\d+(?:\.\d+)?)\s*[%)]?/i);
      if (igstM) { const r = parseFloat(igstM[1]); if (r > 0) return VALID.reduce((a,b) => Math.abs(b-r)<Math.abs(a-r)?b:a); }
      const cgstM = txt.match(/C[Gg]ST\s*[@%(]\s*(\d+(?:\.\d+)?)\s*[%)]?/i);
      if (cgstM) { const half = parseFloat(cgstM[1]); if (half > 0) return VALID.reduce((a,b) => Math.abs(b-half*2)<Math.abs(a-half*2)?b:a); }
      const genM = txt.match(/(?:GST|Tax)\s*[Rr]ate\s*[:\-@]?\s*(\d+(?:\.\d+)?)\s*%/i);
      if (genM) { const r = parseFloat(genM[1]); if (r > 0) return VALID.reduce((a,b) => Math.abs(b-r)<Math.abs(a-r)?b:a); }
    }

    // Path D: HSN-based suggestion
    if (data.hsnCode && GSTValidatorUtils) {
      const ch = GSTValidatorUtils.validateHSNChapter(data.hsnCode);
      if (ch.valid && ch.suggestedRate != null) return ch.suggestedRate;
    }

    return 0;
  }

  // ── ITC eligibility check ─────────────────────────────────────────────
  function checkITCEligibility(category, totalAmount, hasGSTIN, gstRate) {
    if (!hasGSTIN) {
      return { eligible: false, reason: 'No seller GSTIN — ITC not claimable on unregistered purchases', risk: 'high' };
    }
    if (gstRate === 0) {
      return { eligible: false, reason: 'Zero/exempt supply — no GST charged, no ITC to claim', risk: 'none' };
    }
    const blocked = ITC_BLOCKED.find(b => b.cat === category);
    if (blocked) {
      return { eligible: false, reason: blocked.reason, section: blocked.section, risk: 'blocked' };
    }
    if (totalAmount > 500000) {
      return { eligible: true, reason: 'ITC eligible — verify in GSTR-2B before claiming (high-value invoice)', flag: 'verify', risk: 'medium' };
    }
    return { eligible: true, reason: 'ITC can be claimed — ensure bill appears in GSTR-2B', risk: 'low' };
  }

  // ── NEW: ITC reversal risk detection ─────────────────────────────────
  function detectITCReversalRisk(data, category, gstRate, itcResult) {
    const risks = [];
    const total = parseFloat(data.totalAmount || 0);

    // Supplier not filed GSTR-1 risk
    if (itcResult.eligible && total > 50000) {
      risks.push({
        type: 'gstr2b_mismatch',
        level: 'medium',
        message: 'ITC eligible only if supplier files GSTR-1 and it appears in your GSTR-2B',
        action: 'Verify in GSTR-2B portal before claiming'
      });
    }

    // ITC on capital goods — 5-year spread
    const isCapitalGoods = ['Electronics','Machinery','IT Services','Construction'].some(c => category.includes(c));
    if (isCapitalGoods && total > 100000) {
      risks.push({
        type: 'capital_goods',
        level: 'info',
        message: 'Capital goods ITC: no spreading required under GST (available in same month)',
        action: 'Claim in full in the month of receipt'
      });
    }

    // Partial use for exempt supplies — proportionate reversal
    if (data.hasExemptSupplies) {
      risks.push({
        type: 'partial_exemption',
        level: 'high',
        message: 'Partial ITC reversal required if goods/services used for exempt supplies (Rule 42/43)',
        action: 'Calculate proportionate reversal and report in GSTR-3B Table 4(B)'
      });
    }

    return risks;
  }

  // ── NEW: analyse line items ───────────────────────────────────────────
  function analyseLineItems(items, isInterstate) {
    if (!Array.isArray(items) || items.length === 0) return null;
    return items.map((item, idx) => {
      const taxable = parseFloat(item.taxableValue || (item.price * item.quantity)) || 0;
      const rate = parseFloat(item.taxRate) || 0;
      const hsnDesc = getHSNDescription(item.hsn);
      const hsnChap = GSTValidatorUtils ? GSTValidatorUtils.validateHSNChapter(item.hsn) : null;
      const computedTax = GSTValidatorUtils ? GSTValidatorUtils.computeItemLevelTax(taxable, rate, isInterstate) : null;
      const actualCGST = parseFloat(item.cgst) || 0;
      const actualSGST = parseFloat(item.sgst) || 0;
      const actualIGST = parseFloat(item.igst) || 0;
      const actualTax  = actualCGST + actualSGST + actualIGST;
      const expectedTax = computedTax ? computedTax.cgst + computedTax.sgst + computedTax.igst : taxable * rate / 100;
      const taxMismatch = Math.abs(actualTax - expectedTax) > 1;

      return {
        index: idx + 1,
        description: item.description || `Item ${idx + 1}`,
        hsn: item.hsn || '—',
        hsnDescription: hsnDesc,
        hsnChapter: hsnChap,
        quantity: item.quantity,
        unit: item.unit,
        rate: item.price,
        taxableValue: taxable,
        taxRate: rate,
        cgst: actualCGST,
        sgst: actualSGST,
        igst: actualIGST,
        totalTax: actualTax,
        expectedTax: Math.round(expectedTax * 100) / 100,
        taxMismatch,
        rowTotal: taxable + actualTax
      };
    });
  }

  // ── NEW: generate compliance checklist ────────────────────────────────
  function generateComplianceChecklist(data, category, gstRate, itcResult, supplyType) {
    const checklist = [];
    const total = parseFloat(data.totalAmount || 0);
    const hasGSTIN = !!(data.gstin);

    checklist.push({ done: !!data.vendorName, label: 'Vendor name captured',      priority: 'required' });
    checklist.push({ done: hasGSTIN,          label: 'Seller GSTIN on invoice',   priority: 'required' });
    checklist.push({ done: !!data.gstin && GSTValidatorUtils && GSTValidatorUtils.validateGSTIN(data.gstin).valid, label: 'GSTIN format valid', priority: 'required' });
    checklist.push({ done: !!data.invoiceNumber, label: 'Invoice number present',  priority: 'required' });
    checklist.push({ done: !!data.invoiceDate,   label: 'Invoice date present',    priority: 'required' });
    checklist.push({ done: !!data.hsnCode,        label: 'HSN/SAC code present',   priority: total > 50000 ? 'required' : 'recommended' });
    checklist.push({ done: itcResult.eligible,    label: 'ITC eligible purchase',  priority: 'info' });
    checklist.push({ done: supplyType !== 'unknown', label: 'Supply type identified (inter/intra)', priority: 'recommended' });
    checklist.push({ done: gstRate > 0 || (data.taxableAmount > 0 && (data.cgst + data.sgst + data.igst) === 0), label: 'GST rate identified', priority: 'required' });

    if (total > 50000) {
      checklist.push({ done: !!data.ewayBillNumber, label: 'E-way bill (goods > ₹50,000)', priority: 'required' });
    }
    if (total > 5000000) {
      checklist.push({ done: !!data.irnNumber, label: 'IRN e-invoice (> ₹50L)', priority: 'required' });
    }
    if (total > 200000) {
      checklist.push({ done: !!data.buyerPAN || !!data.buyerGSTIN, label: 'Buyer PAN/GSTIN (> ₹2L)', priority: 'required' });
    }

    return checklist;
  }

  // ── NEW: detect GST savings opportunities ─────────────────────────────
  function detectSavingsOpportunities(data, category, gstRate, itcResult) {
    const opps = [];
    const total = parseFloat(data.totalAmount || 0);

    if (itcResult.eligible && total > 0) {
      const itcAmt = parseFloat(data.cgst || 0) + parseFloat(data.sgst || 0) + parseFloat(data.igst || 0);
      if (itcAmt > 0) {
        opps.push({ type: 'itc_available', amount: itcAmt, message: `₹${itcAmt.toLocaleString('en-IN')} ITC available — claim by filing GSTR-3B` });
      }
    }

    if (category === 'Construction' && total > 100000) {
      opps.push({ type: 'works_contract', amount: 0, message: 'Works contract for plant/machinery — ITC available unlike immovable property' });
    }

    if (gstRate === 28) {
      opps.push({ type: 'composition_check', amount: 0, message: 'High 28% rate — verify if composite supply rule reduces effective rate' });
    }

    return opps;
  }

  // ── Generate tags ─────────────────────────────────────────────────────
  function generateTags(data, supplyType, gstRate, itcResult, buyerSellerType) {
    const tags = [];
    const total = parseFloat(data.totalAmount || 0);

    // Invoice type
    const typeMap = { B2B:'B2B Invoice', B2C:'B2C Purchase', B2CL:'B2C Large', B2CS:'B2C Small', B2G:'B2G Invoice', EXPORT:'Export Invoice', UNREGISTERED:'Unregistered Supplier' };
    tags.push({ label: typeMap[buyerSellerType] || 'Invoice', color: buyerSellerType === 'B2B' ? 'green' : 'blue' });

    // ITC status
    if (itcResult.eligible) tags.push({ label: 'ITC Eligible', color: 'green' });
    else tags.push({ label: 'ITC Blocked', color: 'red' });

    // Supply type
    if (supplyType === 'intrastate') tags.push({ label: 'Intrastate (CGST+SGST)', color: 'blue' });
    else if (supplyType === 'interstate') tags.push({ label: 'Interstate (IGST)', color: 'blue' });
    else if (supplyType === 'export') tags.push({ label: 'Export / Zero-rated', color: 'grey' });

    // GST rate badges
    if (gstRate === 0) tags.push({ label: 'Exempt/Zero-Rated', color: 'grey' });
    else if (gstRate === 28) tags.push({ label: 'Luxury 28%', color: 'red' });
    else if (gstRate === 5) tags.push({ label: 'Essential 5%', color: 'green' });

    // Threshold badges
    if (total > 50000) tags.push({ label: 'HSN Mandatory', color: 'red' });
    if (total > 200000) tags.push({ label: 'PAN Required', color: 'red' });
    if (total > 2500000) tags.push({ label: 'B2CL — Invoice-wise GSTR-1', color: 'red' });
    if (total > 5000000) tags.push({ label: 'e-Invoice Mandatory', color: 'red' });

    if (data._aiAssisted) tags.push({ label: '🔍 OCR Extracted', color: 'grey' });

    return tags;
  }

  // ── Pick smart tip ────────────────────────────────────────────────────
  function pickTip(data, supplyType, category, total, gstRate) {
    const pools = [];
    if (total > 50000) pools.push(...TIPS.highValue);
    if (supplyType === 'interstate') pools.push(...TIPS.interstate);
    else pools.push(...TIPS.intrastate);
    if (gstRate === 0) pools.push(...TIPS.zeroRate);
    if (category.toLowerCase().includes('service')) pools.push(...TIPS.services);
    if (category.toLowerCase().includes('industrial') || category.toLowerCase().includes('chemical')) pools.push(...TIPS.industrial);
    if (category.toLowerCase().includes('construction')) pools.push(...TIPS.construction);
    pools.push(...TIPS.itc);
    if (pools.length === 0) pools.push(...TIPS.intrastate);
    const seed = String(data.invoiceNumber || data.vendorName || '').length;
    return pools[seed % pools.length];
  }

  // ── MAIN analyse function ─────────────────────────────────────────────
  function analyse(data, rawOcrText) {
    const total    = parseFloat(data.totalAmount || data.taxableAmount || 0);
    const cgst     = parseFloat(data.cgst || 0);
    const sgst     = parseFloat(data.sgst || 0);
    const igst     = parseFloat(data.igst || 0);
    const totalGST = cgst + sgst + igst;
    const taxable  = parseFloat(data.taxableAmount || (total - totalGST) || 0);
    const cess     = parseFloat(data.cess || 0);
    const freightAmt = parseFloat(data.freightCharges || 0);

    // Supply type — prefer GSTIN-based detection over heuristic
    let supplyType = 'unknown';
    if (data.sellerGSTIN && data.buyerGSTIN && GSTValidatorUtils) {
      supplyType = GSTValidatorUtils.detectSupplyTypeFromGSTINs(data.sellerGSTIN, data.buyerGSTIN);
    } else if (data.gstin && data.buyerGSTIN && GSTValidatorUtils) {
      supplyType = GSTValidatorUtils.detectSupplyTypeFromGSTINs(data.gstin, data.buyerGSTIN);
    } else {
      supplyType = igst > 0 && cgst === 0 ? 'interstate' : (cgst > 0 ? 'intrastate' : 'unknown');
    }
    const isInterstate = supplyType === 'interstate';

    const gstRate   = detectGSTRate(data, rawOcrText);
    const hsnDesc   = getHSNDescription(data.hsnCode);
    const hsnChap   = GSTValidatorUtils ? GSTValidatorUtils.validateHSNChapter(data.hsnCode) : null;
    const catResult = detectCategory(data.vendorName, data.hsnCode, data.category);
    const category  = catResult.cat;

    const hasGSTIN  = !!(data.gstin && data.gstin.length === 15);
    const itcResult = checkITCEligibility(category, total, hasGSTIN, gstRate);
    const itcRisks  = detectITCReversalRisk(data, category, gstRate, itcResult);

    // B2B/B2C/export classification
    const buyerSellerType = GSTValidatorUtils
      ? GSTValidatorUtils.extractBuyerSellerType(data.gstin || data.sellerGSTIN, data.buyerGSTIN, total)
      : (hasGSTIN ? 'B2B' : 'B2CS');

    const tags      = generateTags(data, supplyType, gstRate, itcResult, buyerSellerType);
    const tip       = pickTip(data, supplyType, category, total, gstRate);
    const checklist = generateComplianceChecklist(data, category, gstRate, itcResult, supplyType);
    const savings   = detectSavingsOpportunities(data, category, gstRate, itcResult);
    const deadlines = GSTValidatorUtils ? GSTValidatorUtils.getFilingDeadlines() : [];
    const itemAnalysis = analyseLineItems(data.lineItems || [], isInterstate);

    // Freight advisory
    const freightAdvisory = freightAmt > 0 && GSTValidatorUtils
      ? GSTValidatorUtils.validateFreightTaxability(freightAmt, category)
      : null;

    // E-way bill check
    const ewayCheck = GSTValidatorUtils
      ? GSTValidatorUtils.validateEWayBillRequired(total, data.hsnCode, data.ewayBillNumber)
      : null;

    // Compliance score
    const complianceScore = GSTValidatorUtils
      ? GSTValidatorUtils.computeComplianceScore({
          sellerGSTIN: data.gstin, gstin: data.gstin,
          invoiceDate: data.invoiceDate, invoiceNumber: data.invoiceNumber,
          cgst, sgst, igst, taxableAmount: taxable, grandTotal: total,
          hsnCode: data.hsnCode, ewayBillNumber: data.ewayBillNumber
        })
      : { score: 75, issues: [] };

    // Tax accuracy check
    const isCorrect = totalGST > 0
      ? Math.abs((totalGST / taxable * 100) - gstRate) < 2
      : true;

    // Natural language explanation
    const vendorStr  = data.vendorName ? `from ${data.vendorName}` : 'on this invoice';
    const supplyStr  = supplyType === 'interstate' ? 'interstate supply (IGST)' : supplyType === 'export' ? 'zero-rated export supply' : 'intrastate supply (CGST + SGST)';
    const itcNote    = itcResult.eligible
      ? `You can claim ₹${totalGST.toLocaleString('en-IN')} Input Tax Credit — ensure bill appears in GSTR-2B`
      : `ITC is blocked: ${itcResult.reason}`;

    let explanation;
    if (totalGST === 0) {
      explanation = `This is a zero-rated or exempt purchase ${vendorStr} under ${category}. No GST charged, so no ITC to claim.`;
    } else {
      explanation = `This ₹${total.toLocaleString('en-IN')} purchase ${vendorStr} is a ${supplyStr} under ${category}, at ${gstRate}% GST (₹${totalGST.toLocaleString('en-IN')} tax on ₹${taxable.toLocaleString('en-IN')} taxable value). ${itcNote}.`;
    }

    if (freightAmt > 0) explanation += ` Freight of ₹${freightAmt.toLocaleString('en-IN')} is included and taxable.`;
    if (cess > 0) explanation += ` Cess of ₹${cess.toLocaleString('en-IN')} also applies.`;

    return {
      explanation,
      gst_rate:         gstRate + '%',
      tax_category:     category,
      supply_type:      supplyType,
      buyer_seller_type: buyerSellerType,
      hsn_description:  hsnDesc,
      hsn_chapter:      hsnChap,
      is_correct:       isCorrect,
      is_interstate:    isInterstate,
      itc:              itcResult,
      itc_risks:        itcRisks,
      compliance_score: complianceScore,
      checklist,
      savings,
      deadlines,
      freight:          freightAdvisory,
      eway:             ewayCheck,
      tip,
      tags,
      total_gst:        totalGST,
      taxable_amount:   taxable,
      effective_rate:   gstRate,
      item_analysis:    itemAnalysis,
      _category_source: catResult.source
    };
  }

  // ── Render the intelligence card ──────────────────────────────────────
  function renderCard(data, containerId, rawOcrText) {
    const card    = document.getElementById(containerId || 'aiExplainCard');
    const content = document.getElementById('aiExplainContent');
    if (!card || !content) return;
    card.style.display = 'block';
    content.innerHTML = `<div class="ai-explain-loading"><div class="ai-dots"><span></span><span></span><span></span></div><span>Analysing GST intelligence...</span></div>`;
    setTimeout(() => {
      const result = analyse(data, rawOcrText);
      _renderResult(content, result, data);
    }, 380);
  }

  function _renderResult(content, result, data) {
    const correctIcon = result.is_correct ? '✅' : '⚠️';
    const rateNum     = parseFloat(result.gst_rate);
    const rateClass   = rateNum >= 18 ? 'high' : rateNum >= 12 ? 'mid' : '';
    const colorMap    = { green: 'var(--green)', red: 'var(--accent)', blue: 'var(--blue)', grey: 'var(--muted)' };

    const tagsHTML = result.tags.map(t => {
      const c = colorMap[t.color] || 'var(--muted)';
      return `<span class="ai-explain-tag" style="background:${c}18;color:${c};border:1px solid ${c}33;">${t.label}</span>`;
    }).join('');

    const hsnLine = result.hsn_description
      ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">📦 <strong>HSN:</strong> ${result.hsn_description}${result.hsn_chapter && result.hsn_chapter.valid ? ` <span style="opacity:0.6">(Ch. ${result.hsn_chapter.chapter})</span>` : ''}</div>`
      : '';

    const itcColor = result.itc.eligible ? 'var(--green)' : 'var(--accent)';
    const itcBg    = result.itc.eligible ? 'var(--greenbg)' : 'var(--accentbg)';
    const itcIcon  = result.itc.eligible ? '✅' : '❌';

    // Compliance score bar
    const scoreColor = result.compliance_score.score >= 80 ? 'var(--green)' : result.compliance_score.score >= 60 ? '#c9a84c' : 'var(--accent)';
    const scoreHTML = `<div style="margin-bottom:12px;">
      <div style="display:flex;justify-content:space-between;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:4px;">
        <span>Compliance Score</span><span style="color:${scoreColor}">${result.compliance_score.score}/100</span>
      </div>
      <div style="height:6px;background:rgba(0,0,0,0.08);border-radius:4px;overflow:hidden;">
        <div style="height:100%;width:${result.compliance_score.score}%;background:${scoreColor};border-radius:4px;transition:width 1s ease;"></div>
      </div>
      ${result.compliance_score.issues.length > 0 ? `<div style="font-size:11px;color:var(--accent);margin-top:4px;">⚠ ${result.compliance_score.issues[0]}</div>` : ''}
    </div>`;

    // Deadlines
    const deadlinesHTML = result.deadlines.length > 0 ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">📅 Upcoming Filings</div>
        ${result.deadlines.map(d => `
          <div style="display:flex;justify-content:space-between;align-items:center;font-size:12px;padding:5px 0;border-bottom:1px solid var(--border);">
            <span style="font-weight:700;color:var(--ink)">${d.form}</span>
            <span style="color:${d.urgent ? 'var(--accent)' : 'var(--muted)'};">${d.urgent ? '🔴 ' : ''}${d.due} (${d.daysLeft}d)</span>
          </div>`).join('')}
      </div>` : '';

    // Checklist
    const doneItems   = result.checklist.filter(c => c.done).length;
    const totalItems  = result.checklist.length;
    const checklistHTML = `
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">✔ Compliance Checklist (${doneItems}/${totalItems})</div>
        ${result.checklist.slice(0,6).map(c => `
          <div style="display:flex;align-items:center;gap:6px;font-size:12px;padding:3px 0;color:${c.done ? 'var(--green)' : c.priority === 'required' ? 'var(--accent)' : 'var(--muted)'};">
            <span>${c.done ? '✅' : c.priority === 'required' ? '❌' : '○'}</span>
            <span>${c.label}</span>
            ${!c.done && c.priority === 'required' ? '<span style="font-size:10px;background:var(--accentbg);color:var(--accent);padding:1px 5px;border-radius:4px;">Required</span>' : ''}
          </div>`).join('')}
      </div>`;

    // Savings
    const savingsHTML = result.savings.length > 0 ? `
      <div style="background:rgba(26,127,90,0.06);border:1px solid rgba(26,127,90,0.15);border-radius:8px;padding:9px 13px;margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;color:var(--green);margin-bottom:4px;">💰 GST Opportunities</div>
        ${result.savings.map(s => `<div style="font-size:12px;color:var(--ink);">${s.amount > 0 ? `₹${s.amount.toLocaleString('en-IN')} — ` : ''}${s.message}</div>`).join('')}
      </div>` : '';

    // ITC risks
    const riskHTML = result.itc_risks.length > 0 ? `
      <div style="margin-bottom:12px;">
        <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">⚠ ITC Risk Factors</div>
        ${result.itc_risks.map(r => `
          <div style="font-size:12px;padding:5px 10px;background:rgba(201,168,76,0.08);border-left:3px solid #c9a84c;border-radius:0 6px 6px 0;margin-bottom:4px;">
            <div style="font-weight:600;color:#7a5900;">${r.message}</div>
            <div style="color:var(--muted);margin-top:2px;">${r.action}</div>
          </div>`).join('')}
      </div>` : '';

    content.innerHTML = `
      <div class="ai-explain-body" style="margin-bottom:12px;line-height:1.65;">${result.explanation}</div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="gst-rate-badge ${rateClass}">📊 ${result.gst_rate} GST Rate</div>
        <div class="gst-rate-badge">${correctIcon} ${result.is_correct ? 'Tax looks correct' : 'Please verify tax'}</div>
        <div class="gst-rate-badge">${result.supply_type === 'interstate' ? '🔀 Interstate' : result.supply_type === 'intrastate' ? '📍 Intrastate' : '🌐 ' + result.supply_type}</div>
      </div>

      ${hsnLine}

      ${scoreHTML}

      <div style="background:${itcBg};border:1px solid ${itcColor}33;border-radius:8px;padding:9px 13px;margin-bottom:12px;font-size:12px;font-weight:600;color:${itcColor};">
        ${itcIcon} ITC: ${result.itc.reason}
      </div>

      ${riskHTML}
      ${savingsHTML}
      ${checklistHTML}
      ${deadlinesHTML}

      ${result.tip ? `<div style="font-size:12px;color:var(--purple);background:var(--purplebg);padding:9px 13px;border-radius:8px;margin-bottom:12px;">💡 ${result.tip}</div>` : ''}

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">Tax Breakdown</div>
      <div style="font-size:12px;color:var(--ink);margin-bottom:12px;">
        📦 ${result.tax_category}
        ${result.buyer_seller_type ? ` · <span style="opacity:0.6">${result.buyer_seller_type}</span>` : ''}
      </div>

      <div style="display:flex;flex-wrap:wrap;gap:6px;">${tagsHTML}</div>`;
  }

  return {
    analyse,
    renderCard,
    detectCategory,
    getHSNDescription,
    detectGSTRate,
    analyseLineItems,
    generateComplianceChecklist,
    detectITCReversalRisk,
    detectSavingsOpportunities
  };

})();

window.GSTIntelligence = GSTIntelligence;
if (typeof module !== 'undefined' && module.exports) module.exports = GSTIntelligence;

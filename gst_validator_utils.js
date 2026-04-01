/**
 * gst_validator_utils.js
 * GST Lens — Core Validation Utilities v4.0 (Advanced)
 * Pure rule-based, zero dependencies, fully offline
 *
 * NEW in v4.0:
 *  — normalizeDate()          : handles DD/MM/YYYY, DD-Mon-YYYY, ISO, timestamps
 *  — validateHSNChapter()     : validates against 99 real HSN chapters
 *  — crossValidateLineItems() : sum of rows vs invoice totals
 *  — detectSupplyTypeFromGSTINs() : interstate/intrastate/export from both GSTINs
 *  — validateFreightTaxability()  : freight as part of taxable value check
 *  — validateEWayBillRequired()   : threshold + goods vs services check
 *  — validateB2CThreshold()       : ₹2.5L B2C invoice-wise reporting
 *  — validateRCMApplicability()   : enhanced RCM detection
 *  — computeItemLevelTax()        : per-item CGST/SGST/IGST amounts
 *  — computeComplianceScore()     : 0–100 score per invoice
 *  — getFilingDeadlines()         : GSTR-1, 3B, 9 due dates for current month
 *  — detectRoundOffAdjustment()   : flag suspicious rounding
 *  — validateIRNFormat()          : 64-char hex IRN check
 *  — validateEWayBillFormat()     : 12-digit EWB check
 *  — extractBuyerSellerType()     : B2B/B2C/B2G/Export classification
 */

'use strict';

const GSTValidatorUtils = (() => {

  // ── Indian State Codes ────────────────────────────────────────────────
  const STATE_CODES = {
    '01':'Jammu and Kashmir','02':'Himachal Pradesh','03':'Punjab','04':'Chandigarh',
    '05':'Uttarakhand','06':'Haryana','07':'Delhi','08':'Rajasthan','09':'Uttar Pradesh',
    '10':'Bihar','11':'Sikkim','12':'Arunachal Pradesh','13':'Nagaland','14':'Manipur',
    '15':'Mizoram','16':'Tripura','17':'Meghalaya','18':'Assam','19':'West Bengal',
    '20':'Jharkhand','21':'Odisha','22':'Chhattisgarh','23':'Madhya Pradesh',
    '24':'Gujarat','25':'Daman and Diu','26':'Dadra and Nagar Haveli','27':'Maharashtra',
    '28':'Andhra Pradesh (Old)','29':'Karnataka','30':'Goa','31':'Lakshadweep',
    '32':'Kerala','33':'Tamil Nadu','34':'Puducherry','35':'Andaman and Nicobar Islands',
    '36':'Telangana','37':'Andhra Pradesh','38':'Ladakh','97':'Other Territory','99':'Centre Jurisdiction'
  };

  // ── Valid GST Rates ───────────────────────────────────────────────────
  const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];

  // ── HSN Chapter descriptions (1–99) ──────────────────────────────────
  const HSN_CHAPTERS = {
    '01':'Live animals','02':'Meat and edible offal','03':'Fish','04':'Dairy products',
    '05':'Other animal products','06':'Live trees and plants','07':'Vegetables',
    '08':'Fruits and nuts','09':'Coffee, tea, spices','10':'Cereals','11':'Milling products',
    '12':'Oil seeds','13':'Lac, gums, resins','14':'Vegetable materials',
    '15':'Animal/vegetable fats','16':'Meat preparations','17':'Sugar',
    '18':'Cocoa products','19':'Cereal preparations','20':'Vegetable preparations',
    '21':'Miscellaneous edible preparations','22':'Beverages, spirits',
    '23':'Residues from food industry','24':'Tobacco','25':'Salt, sulphur, stone',
    '26':'Ores, slag','27':'Mineral fuels, oils','28':'Inorganic chemicals',
    '29':'Organic chemicals','30':'Pharmaceutical products','31':'Fertilizers',
    '32':'Tanning/dyeing extracts','33':'Essential oils, cosmetics','34':'Soap, wax',
    '35':'Albuminoidal substances','36':'Explosives, pyrotechnic','37':'Photographic goods',
    '38':'Miscellaneous chemical products','39':'Plastics','40':'Rubber',
    '41':'Raw hides and skins','42':'Leather articles','43':'Furskins',
    '44':'Wood and wood articles','45':'Cork','46':'Straw manufactures',
    '47':'Pulp of wood','48':'Paper and paperboard','49':'Printed books, newspapers',
    '50':'Silk','51':'Wool, animal hair','52':'Cotton','53':'Other vegetable fibres',
    '54':'Man-made filaments','55':'Man-made staple fibres','56':'Wadding, felt',
    '57':'Carpets','58':'Special woven fabrics','59':'Impregnated textiles',
    '60':'Knitted fabrics','61':'Knitted apparel','62':'Woven apparel',
    '63':'Other textile articles','64':'Footwear','65':'Headgear','66':'Umbrellas',
    '67':'Prepared feathers','68':'Stone, plaster articles','69':'Ceramic products',
    '70':'Glass and glassware','71':'Gems, precious metals','72':'Iron and steel',
    '73':'Iron/steel articles','74':'Copper','75':'Nickel','76':'Aluminium',
    '77':'Reserved','78':'Lead','79':'Zinc','80':'Tin','81':'Other base metals',
    '82':'Tools, cutlery','83':'Miscellaneous metal articles',
    '84':'Machinery, mechanical appliances','85':'Electrical machinery',
    '86':'Railway locomotives','87':'Vehicles (not railway)',
    '88':'Aircraft, spacecraft','89':'Ships, boats','90':'Optical instruments',
    '91':'Clocks and watches','92':'Musical instruments','93':'Arms and ammunition',
    '94':'Furniture, bedding','95':'Toys, games','96':'Miscellaneous manufactured',
    '97':'Works of art','98':'Special provisions','99':'Services (SAC)'
  };

  // ── HSN chapter → typical GST rate ───────────────────────────────────
  const HSN_RATE_GUIDE = {
    '01':0,'02':0,'03':0,'04':0,'05':0,'06':5,'07':0,'08':0,'09':5,'10':0,
    '11':0,'12':0,'13':18,'14':0,'15':5,'16':12,'17':5,'18':18,'19':18,'20':12,
    '21':18,'22':28,'23':0,'24':28,'25':5,'26':0,'27':18,'28':18,'29':18,'30':12,
    '31':5,'32':18,'33':18,'34':18,'35':18,'36':18,'37':18,'38':18,'39':18,'40':18,
    '41':0,'42':18,'43':18,'44':12,'45':18,'46':12,'47':12,'48':12,'49':0,
    '50':5,'51':5,'52':5,'53':5,'54':12,'55':12,'56':12,'57':12,'58':12,'59':12,
    '60':12,'61':12,'62':12,'63':12,'64':18,'65':18,'66':18,'67':18,'68':12,'69':12,
    '70':18,'71':3,'72':18,'73':18,'74':18,'75':18,'76':18,'78':18,'79':18,'80':18,
    '81':18,'82':18,'83':18,'84':18,'85':18,'86':18,'87':28,'88':18,'89':5,
    '90':18,'91':18,'92':28,'93':0,'94':18,'95':12,'96':18,'97':12,'99':18
  };

  // ── GSTIN checksum ────────────────────────────────────────────────────
  const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function computeGSTINChecksum(gstin14) {
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      const val = GSTIN_CHARS.indexOf(gstin14[i]);
      const factor = (i % 2 === 0) ? 1 : 2;
      const product = val * factor;
      sum += Math.floor(product / 36) + (product % 36);
    }
    return GSTIN_CHARS[(36 - (sum % 36)) % 36];
  }

  // ── Validate GSTIN (full) ─────────────────────────────────────────────
  function validateGSTIN(gstin) {
    const result = { valid: true, errors: [], stateCode: null, pan: null, entityType: null, stateName: null };
    if (!gstin || typeof gstin !== 'string') {
      result.valid = false; result.errors.push('GSTIN is missing or empty'); return result;
    }
    const g = gstin.trim().toUpperCase();
    if (g.length !== 15) {
      result.valid = false; result.errors.push(`Invalid length: ${g.length} (must be 15)`); return result;
    }
    const stateCode = g.substring(0, 2);
    if (!STATE_CODES[stateCode]) {
      result.valid = false; result.errors.push(`Invalid state code "${stateCode}"`);
    } else {
      result.stateCode = stateCode;
      result.stateName = STATE_CODES[stateCode];
    }
    const pan = g.substring(2, 12);
    if (!/^[A-Z]{3}[PCHABGJLFT][A-Z]\d{4}[A-Z]$/.test(pan)) {
      result.valid = false; result.errors.push(`Invalid PAN format in GSTIN: "${pan}"`);
    } else {
      result.pan = pan;
      const entityMap = {P:'Individual',C:'Company',H:'HUF',F:'Firm',A:'AOP/BOI',T:'Trust',B:'BOI',G:'Government',L:'LLP',J:'Artificial Juridical'};
      result.entityType = entityMap[pan[3]] || pan[3];
    }
    if (!/^[1-9A-Z]$/.test(g[12])) {
      result.valid = false; result.errors.push(`Invalid entity number at position 13: "${g[12]}"`);
    }
    if (g[13] !== 'Z') {
      result.valid = false; result.errors.push(`Position 14 must be "Z", found "${g[13]}"`);
    }
    const expectedCheck = computeGSTINChecksum(g.substring(0, 14));
    if (g[14] !== expectedCheck) {
      result.valid = false; result.errors.push(`Checksum invalid (expected "${expectedCheck}", found "${g[14]}")`);
    }
    return result;
  }

  function getStateCodeFromGSTIN(gstin) {
    if (!gstin || gstin.length < 2) return null;
    const code = gstin.trim().substring(0, 2).toUpperCase();
    return STATE_CODES[code] ? code : null;
  }

  // ── Validate HSN ──────────────────────────────────────────────────────
  function validateHSN(hsn) {
    if (!hsn || hsn === '' || hsn === null || hsn === undefined) {
      return { valid: false, error: 'HSN code is missing' };
    }
    const h = String(hsn).trim();
    if (!/^\d+$/.test(h)) return { valid: false, error: `Invalid HSN format: "${h}" (only digits)` };
    if (h.length < 4 || h.length > 8) return { valid: false, error: `HSN length ${h.length} invalid (must be 4–8 digits)` };
    return { valid: true, error: null };
  }

  // NEW: validate HSN chapter exists
  function validateHSNChapter(hsn) {
    if (!hsn) return { valid: false, chapter: null, description: null };
    const h = String(hsn).trim();
    const chapter = h.substring(0, 2);
    const desc = HSN_CHAPTERS[chapter];
    if (!desc) return { valid: false, chapter, description: null, error: `Chapter ${chapter} not found in HSN` };
    const suggestedRate = HSN_RATE_GUIDE[chapter];
    return { valid: true, chapter, description: desc, suggestedRate };
  }

  // ── Validate GST Rate ─────────────────────────────────────────────────
  function validateGSTRate(rate) {
    const r = parseFloat(rate);
    if (isNaN(r)) return { valid: false, error: `"${rate}" is not a number` };
    if (!VALID_GST_RATES.includes(r)) {
      return { valid: false, error: `${r}% is not a valid GST rate (valid: ${VALID_GST_RATES.join(', ')}%)` };
    }
    return { valid: true, error: null };
  }

  // ── NEW: normalizeDate — handles ALL date formats ─────────────────────
  function normalizeDate(raw) {
    if (!raw) return null;
    const s = String(raw).trim();

    // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
    const dmy = s.match(/^(\d{1,2})[-/.](d{1,2})[-/.](\d{2,4})$/);
    if (dmy) {
      let [, d, m, y] = dmy;
      if (y.length === 2) y = '20' + y;
      return `${d.padStart(2,'0')}/${m.padStart(2,'0')}/${y}`;
    }

    // DD-Mon-YYYY e.g. 01-Apr-2026
    const MONTHS = {jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12};
    const dMonY = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,9})[-/ ](\d{4})$/);
    if (dMonY) {
      const [, d, mon, y] = dMonY;
      const mo = MONTHS[mon.toLowerCase().substring(0,3)];
      if (mo) return `${d.padStart(2,'0')}/${String(mo).padStart(2,'0')}/${y}`;
    }

    // YYYY-MM-DD (ISO)
    const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}/${iso[2]}/${iso[1]}`;

    // Try native Date parse as last resort
    const dt = new Date(s);
    if (!isNaN(dt)) {
      const d = String(dt.getDate()).padStart(2,'0');
      const m = String(dt.getMonth()+1).padStart(2,'0');
      return `${d}/${m}/${dt.getFullYear()}`;
    }
    return s; // return as-is if unparseable
  }

  // ── Validate Invoice Date ─────────────────────────────────────────────
  function validateDate(dateStr) {
    if (!dateStr) return { valid: false, error: 'Invoice date is missing' };
    const normalized = normalizeDate(dateStr);
    if (!normalized) return { valid: false, error: `Unparseable date: "${dateStr}"` };

    // Try to parse the normalized DD/MM/YYYY
    const parts = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    let date = null;
    if (parts) {
      date = new Date(`${parts[3]}-${parts[2]}-${parts[1]}`);
    } else {
      date = new Date(dateStr);
    }

    if (!date || isNaN(date.getTime())) {
      return { valid: false, error: `Invalid date: "${dateStr}" — use DD/MM/YYYY` };
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) {
      return { valid: false, error: `Future date: ${dateStr} is in the future` };
    }

    // ITC deadline: 18 months (Section 16(4))
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - 18);
    if (date < cutoff) {
      const months = Math.floor((today - date) / (1000 * 60 * 60 * 24 * 30));
      return { valid: true, warning: `Invoice is ${months} months old — ITC deadline (Section 16(4)) may have lapsed` };
    }

    return { valid: true, error: null };
  }

  // ── Round to 2 decimals ───────────────────────────────────────────────
  function round2(val) {
    return Math.round((parseFloat(val) || 0) * 100) / 100;
  }

  // ── Validate item-level tax calculation ──────────────────────────────
  function validateItemTaxCalc(item) {
    const price   = parseFloat(item.price) || 0;
    const qty     = parseFloat(item.quantity) || 0;
    const rate    = parseFloat(item.taxRate) || 0;
    const taxable = round2(price * qty);
    const expected = round2(taxable * rate / 100);
    const cgst = round2(item.cgst || 0);
    const sgst = round2(item.sgst || 0);
    const igst = round2(item.igst || 0);
    const totalTax = round2(cgst + sgst + igst);
    const diff = Math.abs(totalTax - expected);
    return { taxableAmount: taxable, expectedTax: expected, actualTax: totalTax, diff: round2(diff), mismatch: diff > 1 };
  }

  // ── NEW: compute item-level CGST/SGST/IGST from taxable + rate ───────
  function computeItemLevelTax(taxableAmount, gstRate, isInterstate) {
    const total = round2(taxableAmount * gstRate / 100);
    if (isInterstate) {
      return { cgst: 0, sgst: 0, igst: total };
    } else {
      const half = round2(total / 2);
      return { cgst: half, sgst: half, igst: 0 };
    }
  }

  // ── NEW: cross-validate line items vs invoice totals ─────────────────
  function crossValidateLineItems(items, invoiceTotals) {
    if (!Array.isArray(items) || items.length === 0) {
      return { valid: true, message: 'No line items to validate' };
    }
    const sumTaxable = items.reduce((s, i) => s + (parseFloat(i.taxableValue || i.price * i.quantity) || 0), 0);
    const sumCGST    = items.reduce((s, i) => s + (parseFloat(i.cgst) || 0), 0);
    const sumSGST    = items.reduce((s, i) => s + (parseFloat(i.sgst) || 0), 0);
    const sumIGST    = items.reduce((s, i) => s + (parseFloat(i.igst) || 0), 0);

    const taxableDiff = Math.abs(round2(sumTaxable) - round2(invoiceTotals.taxableAmount || 0));
    const cgstDiff    = Math.abs(round2(sumCGST) - round2(invoiceTotals.cgst || 0));
    const sgstDiff    = Math.abs(round2(sumSGST) - round2(invoiceTotals.sgst || 0));
    const igstDiff    = Math.abs(round2(sumIGST) - round2(invoiceTotals.igst || 0));

    const errors = [];
    if (taxableDiff > 2) errors.push(`Taxable sum mismatch: items total ₹${round2(sumTaxable)}, invoice shows ₹${invoiceTotals.taxableAmount}`);
    if (cgstDiff > 2)    errors.push(`CGST sum mismatch: items ₹${round2(sumCGST)}, invoice ₹${invoiceTotals.cgst}`);
    if (sgstDiff > 2)    errors.push(`SGST sum mismatch: items ₹${round2(sumSGST)}, invoice ₹${invoiceTotals.sgst}`);
    if (igstDiff > 2)    errors.push(`IGST sum mismatch: items ₹${round2(sumIGST)}, invoice ₹${invoiceTotals.igst}`);

    return {
      valid: errors.length === 0,
      errors,
      itemSums: { taxable: round2(sumTaxable), cgst: round2(sumCGST), sgst: round2(sumSGST), igst: round2(sumIGST) }
    };
  }

  // ── NEW: detect supply type from both GSTINs ─────────────────────────
  function detectSupplyTypeFromGSTINs(sellerGSTIN, buyerGSTIN) {
    if (!sellerGSTIN || !buyerGSTIN) return 'unknown';
    const sellerCode = String(sellerGSTIN).substring(0, 2);
    const buyerCode  = String(buyerGSTIN).substring(0, 2);
    if (sellerCode === '97' || buyerCode === '97') return 'export';
    return sellerCode === buyerCode ? 'intrastate' : 'interstate';
  }

  // Keep old name for backward compatibility
  function detectTransactionType(sellerCode, buyerCode) {
    if (!sellerCode || !buyerCode) return 'unknown';
    return sellerCode === buyerCode ? 'intrastate' : 'interstate';
  }

  // ── NEW: validate freight taxability ─────────────────────────────────
  function validateFreightTaxability(freightAmt, invoiceType) {
    // Per GST, freight is part of transaction value and taxable
    // For pure freight invoices (GTA), RCM may apply
    if (freightAmt <= 0) return { applicable: false };
    const isGTA = invoiceType && /transport|freight|gta|logistics|courier/i.test(invoiceType);
    return {
      applicable: true,
      freightAmount: round2(freightAmt),
      taxable: true,
      note: isGTA
        ? 'GTA service — RCM may apply. Freight at 5% without ITC or 12% with ITC.'
        : 'Freight included in transaction value — taxed at invoice GST rate (Rule 27)'
    };
  }

  // ── NEW: validate E-way bill requirement ─────────────────────────────
  function validateEWayBillRequired(totalAmount, hsnCode, ewayBillNumber) {
    // Services (SAC 99xx) don't need e-way bill
    const isService = hsnCode && String(hsnCode).startsWith('99');
    if (isService) return { required: false, reason: 'Service supply — e-way bill not required' };
    if (totalAmount <= 50000) return { required: false, reason: 'Value ≤ ₹50,000 — e-way bill optional' };

    if (!ewayBillNumber) {
      return {
        required: true,
        missing: true,
        error: `Goods invoice ₹${totalAmount.toLocaleString('en-IN')} > ₹50,000 — e-way bill mandatory (Rule 138)`,
        portal: 'https://ewaybillgst.gov.in'
      };
    }
    const ewbValid = validateEWayBillFormat(ewayBillNumber);
    return { required: true, missing: false, valid: ewbValid.valid, format: ewbValid };
  }

  // ── NEW: validate e-way bill format (12 digits) ───────────────────────
  function validateEWayBillFormat(ewb) {
    if (!ewb) return { valid: false, error: 'E-way bill number missing' };
    const clean = String(ewb).replace(/\s/g, '');
    if (!/^\d{12}$/.test(clean)) return { valid: false, error: `E-way bill must be 12 digits, got "${clean}"` };
    return { valid: true };
  }

  // ── NEW: validate IRN format (64-char hex) ────────────────────────────
  function validateIRNFormat(irn) {
    if (!irn) return { valid: false, error: 'IRN missing' };
    const clean = String(irn).trim();
    if (!/^[0-9a-fA-F]{64}$/.test(clean)) {
      return { valid: false, error: `IRN must be 64 hex characters, got ${clean.length} chars` };
    }
    return { valid: true };
  }

  // ── NEW: B2C high-value invoice check ────────────────────────────────
  function validateB2CThreshold(totalAmount, buyerGSTIN) {
    if (buyerGSTIN && buyerGSTIN.length === 15) return { b2c: false }; // B2B
    if (totalAmount > 250000) {
      return {
        b2c: true, highValue: true,
        warning: `B2C invoice ₹${totalAmount.toLocaleString('en-IN')} > ₹2.5L — must be reported invoice-wise in GSTR-1 Table 5`,
        requiresPAN: totalAmount > 200000
      };
    }
    return { b2c: true, highValue: false };
  }

  // ── NEW: extract buyer/seller classification ──────────────────────────
  function extractBuyerSellerType(sellerGSTIN, buyerGSTIN, totalAmount) {
    const hasSellerGSTIN = sellerGSTIN && sellerGSTIN.length === 15;
    const hasBuyerGSTIN  = buyerGSTIN  && buyerGSTIN.length  === 15;
    if (!hasSellerGSTIN) return 'UNREGISTERED';
    if (!hasBuyerGSTIN) {
      return totalAmount > 250000 ? 'B2CL' : 'B2CS'; // Large / Small B2C
    }
    const sellerCode = sellerGSTIN.substring(0, 2);
    const buyerCode  = buyerGSTIN.substring(0, 2);
    if (sellerCode === '97' || buyerCode === '97') return 'EXPORT';
    const buyerEntityType = buyerGSTIN.substring(5, 6);
    if (buyerEntityType === 'G') return 'B2G'; // Government
    return 'B2B';
  }

  // ── NEW: detect round-off adjustment ─────────────────────────────────
  function detectRoundOffAdjustment(calculatedTotal, invoiceTotal) {
    const diff = Math.abs(round2(calculatedTotal) - round2(invoiceTotal));
    if (diff === 0) return { hasRoundOff: false };
    if (diff <= 1) return { hasRoundOff: true, amount: diff, note: 'Normal rounding (≤ ₹1) — acceptable' };
    return { hasRoundOff: true, amount: diff, suspicious: true, note: `Round-off ₹${diff} exceeds ₹1 — verify calculation` };
  }

  // ── NEW: compute per-invoice compliance score ─────────────────────────
  function computeComplianceScore(invoice) {
    let score = 100;
    const issues = [];

    // GSTIN checks
    const sellerVal = validateGSTIN(invoice.sellerGSTIN || invoice.gstin || '');
    if (!sellerVal.valid) { score -= 20; issues.push('Invalid seller GSTIN'); }

    // Date check
    const dateVal = validateDate(invoice.invoiceDate || invoice.date || '');
    if (!dateVal.valid) { score -= 10; issues.push(dateVal.error); }
    else if (dateVal.warning) { score -= 3; issues.push(dateVal.warning); }

    // Invoice number
    if (!invoice.invoiceNumber && !invoice.invoice) { score -= 5; issues.push('Missing invoice number'); }

    // Tax structure
    const cgst = parseFloat(invoice.cgst) || 0;
    const sgst = parseFloat(invoice.sgst) || 0;
    const igst = parseFloat(invoice.igst) || 0;
    if (cgst > 0 && igst > 0) { score -= 15; issues.push('Both CGST and IGST present — conflicting tax'); }
    if (Math.abs(cgst - sgst) > 1) { score -= 8; issues.push('CGST ≠ SGST'); }

    // Total check
    const taxable = parseFloat(invoice.taxableAmount || invoice.taxable) || 0;
    const cess = parseFloat(invoice.cess) || 0;
    const calcTotal = round2(taxable + cgst + sgst + igst + cess);
    const grandTotal = parseFloat(invoice.grandTotal || invoice.total || invoice.totalAmount) || 0;
    if (grandTotal > 0 && Math.abs(calcTotal - grandTotal) > 2) { score -= 12; issues.push('Grand total mismatch'); }

    // HSN check
    const hsnCode = invoice.hsnCode || invoice.hsn || '';
    if (!hsnCode) { score -= 5; issues.push('Missing HSN/SAC code'); }
    else {
      const hsnVal = validateHSN(hsnCode);
      if (!hsnVal.valid) { score -= 5; issues.push(hsnVal.error); }
    }

    // E-way bill
    const ewb = validateEWayBillRequired(grandTotal, hsnCode, invoice.ewayBillNumber);
    if (ewb.required && ewb.missing) { score -= 4; issues.push('E-way bill missing'); }

    return { score: Math.max(0, Math.min(100, score)), issues };
  }

  // ── NEW: RCM applicability check ──────────────────────────────────────
  const RCM_KEYWORDS = [
    'legal services','advocate','gta','goods transport','insurance agent',
    'recovery agent','author','royalty','director','import of services',
    'sponsorship','arbitral tribunal','security services','renting motor vehicle'
  ];

  function validateRCMApplicability(vendorName, description, sellerGSTIN) {
    const text = ((vendorName || '') + ' ' + (description || '')).toLowerCase();
    const matchedService = RCM_KEYWORDS.find(k => text.includes(k));
    if (!matchedService) return { applicable: false };

    const isUnregistered = !sellerGSTIN || sellerGSTIN.length < 15;
    return {
      applicable: true,
      service: matchedService,
      unregisteredSupplier: isUnregistered,
      note: isUnregistered
        ? `Unregistered RCM supply (${matchedService}) — self-invoice required, pay GST directly`
        : `Registered RCM supply (${matchedService}) — verify if RCM applies under Notification 13/2017`
    };
  }

  // ── NEW: GSTR filing deadlines for current month ──────────────────────
  function getFilingDeadlines() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const nextMonth = month === 11 ? 0 : month + 1;
    const nextYear  = month === 11 ? year + 1 : year;
    const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

    const gstr1Due  = new Date(nextYear, nextMonth, 11);
    const gstr3bDue = new Date(nextYear, nextMonth, 20);
    const gstr2bAvail = new Date(nextYear, nextMonth, 14);

    const daysTo = (d) => Math.ceil((d - now) / (1000 * 60 * 60 * 24));

    return [
      {
        form: 'GSTR-1',
        desc: `Outward supplies for ${MONTH_NAMES[month]} ${year}`,
        due: `${String(gstr1Due.getDate()).padStart(2,'0')} ${MONTH_NAMES[gstr1Due.getMonth()]} ${gstr1Due.getFullYear()}`,
        daysLeft: daysTo(gstr1Due),
        urgent: daysTo(gstr1Due) <= 5
      },
      {
        form: 'GSTR-2B',
        desc: `Auto-drafted ITC statement for ${MONTH_NAMES[month]} ${year}`,
        due: `${String(gstr2bAvail.getDate()).padStart(2,'0')} ${MONTH_NAMES[gstr2bAvail.getMonth()]} ${gstr2bAvail.getFullYear()}`,
        daysLeft: daysTo(gstr2bAvail),
        urgent: false
      },
      {
        form: 'GSTR-3B',
        desc: `Monthly summary return for ${MONTH_NAMES[month]} ${year}`,
        due: `${String(gstr3bDue.getDate()).padStart(2,'0')} ${MONTH_NAMES[gstr3bDue.getMonth()]} ${gstr3bDue.getFullYear()}`,
        daysLeft: daysTo(gstr3bDue),
        urgent: daysTo(gstr3bDue) <= 5
      }
    ];
  }

  // ── Check negative values ─────────────────────────────────────────────
  function hasNegativeValues(invoice) {
    const negFields = [];
    if ((parseFloat(invoice.subtotal) || 0) < 0) negFields.push('subtotal');
    if ((parseFloat(invoice.grandTotal) || 0) < 0) negFields.push('grandTotal');
    if ((parseFloat(invoice.cgstTotal) || 0) < 0) negFields.push('CGST total');
    if ((parseFloat(invoice.sgstTotal) || 0) < 0) negFields.push('SGST total');
    if ((parseFloat(invoice.igstTotal) || 0) < 0) negFields.push('IGST total');
    (invoice.items || []).forEach((item, i) => {
      if ((parseFloat(item.price) || 0) < 0) negFields.push(`Item ${i+1} price`);
      if ((parseFloat(item.quantity) || 0) < 0) negFields.push(`Item ${i+1} qty`);
    });
    return negFields;
  }

  // ── Check duplicate invoice in localStorage ───────────────────────────
  function checkDuplicateInvoice(invoiceNumber, currentBillId) {
    try {
      const raw = localStorage.getItem('gstlens_state');
      if (!raw) return false;
      const state = JSON.parse(raw);
      return (state.bills || []).some(b => b.invoiceNumber === invoiceNumber && b.id !== currentBillId);
    } catch (e) { return false; }
  }

  // ── Expose ────────────────────────────────────────────────────────────
  return {
    STATE_CODES,
    VALID_GST_RATES,
    HSN_CHAPTERS,
    HSN_RATE_GUIDE,
    validateGSTIN,
    getStateCodeFromGSTIN,
    validateHSN,
    validateHSNChapter,
    validateGSTRate,
    validateDate,
    normalizeDate,
    round2,
    validateItemTaxCalc,
    computeItemLevelTax,
    crossValidateLineItems,
    detectTransactionType,
    detectSupplyTypeFromGSTINs,
    validateFreightTaxability,
    validateEWayBillRequired,
    validateEWayBillFormat,
    validateIRNFormat,
    validateB2CThreshold,
    extractBuyerSellerType,
    detectRoundOffAdjustment,
    computeComplianceScore,
    validateRCMApplicability,
    getFilingDeadlines,
    hasNegativeValues,
    checkDuplicateInvoice
  };

})();

window.GSTValidatorUtils = GSTValidatorUtils;
if (typeof module !== 'undefined' && module.exports) module.exports = GSTValidatorUtils;

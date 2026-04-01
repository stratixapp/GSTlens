/**
 * gst_validator_utils.js
 * GST Lens — Core Validation Utilities
 * Pure rule-based, zero dependencies, fully offline
 */

'use strict';

const GSTValidatorUtils = (() => {

  // ── Indian State Codes (as per GST law) ──────────────────────────────
  const STATE_CODES = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh (Old)',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh',
    '97': 'Other Territory',
    '99': 'Centre Jurisdiction'
  };

  // ── Valid GST Rates ────────────────────────────────────────────────────
  const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];

  // ── GSTIN Checksum (Luhn-like) ─────────────────────────────────────────
  const GSTIN_CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  function computeGSTINChecksum(gstin14) {
    let sum = 0;
    for (let i = 0; i < 14; i++) {
      const val = GSTIN_CHARS.indexOf(gstin14[i]);
      const factor = (i % 2 === 0) ? 1 : 2;
      const product = val * factor;
      sum += Math.floor(product / 36) + (product % 36);
    }
    const remainder = sum % 36;
    return GSTIN_CHARS[(36 - remainder) % 36];
  }

  // ── Validate GSTIN ─────────────────────────────────────────────────────
  function validateGSTIN(gstin) {
    const result = { valid: true, errors: [], stateCode: null, pan: null };

    if (!gstin || typeof gstin !== 'string') {
      result.valid = false;
      result.errors.push('GSTIN is missing or empty');
      return result;
    }

    const g = gstin.trim().toUpperCase();

    if (g.length !== 15) {
      result.valid = false;
      result.errors.push(`Invalid GSTIN length: ${g.length} characters (must be 15)`);
      return result;
    }

    // State code check
    const stateCode = g.substring(0, 2);
    if (!STATE_CODES[stateCode]) {
      result.valid = false;
      result.errors.push(`Invalid state code "${stateCode}" in GSTIN`);
    } else {
      result.stateCode = stateCode;
    }

    // PAN format: chars 3-12 → AAAAA9999A
    const pan = g.substring(2, 12);
    const panRegex = /^[A-Z]{3}[PCHABGJLFT][A-Z]\d{4}[A-Z]$/;
    if (!panRegex.test(pan)) {
      result.valid = false;
      result.errors.push(`Invalid PAN embedded in GSTIN (positions 3-12): "${pan}"`);
    } else {
      result.pan = pan;
    }

    // Entity number (char 13): 1-9 or A-Z
    const entityNum = g[12];
    if (!/^[1-9A-Z]$/.test(entityNum)) {
      result.valid = false;
      result.errors.push(`Invalid entity number "${entityNum}" at position 13 of GSTIN`);
    }

    // Z check (char 14 must be 'Z')
    if (g[13] !== 'Z') {
      result.valid = false;
      result.errors.push(`Position 14 of GSTIN must be "Z", found "${g[13]}"`);
    }

    // Checksum (char 15)
    const expectedCheck = computeGSTINChecksum(g.substring(0, 14));
    if (g[14] !== expectedCheck) {
      result.valid = false;
      result.errors.push(`GSTIN checksum invalid (expected "${expectedCheck}", found "${g[14]}")`);
    }

    return result;
  }

  // ── Get State Code from GSTIN ──────────────────────────────────────────
  function getStateCodeFromGSTIN(gstin) {
    if (!gstin || gstin.length < 2) return null;
    const code = gstin.trim().substring(0, 2).toUpperCase();
    return STATE_CODES[code] ? code : null;
  }

  // ── Validate HSN Code ──────────────────────────────────────────────────
  function validateHSN(hsn) {
    if (!hsn || hsn === '' || hsn === null || hsn === undefined) {
      return { valid: false, error: 'HSN code is missing' };
    }
    const h = String(hsn).trim();
    if (!/^\d+$/.test(h)) {
      return { valid: false, error: `Invalid HSN format: "${h}" (only digits allowed)` };
    }
    if (h.length < 4 || h.length > 8) {
      return { valid: false, error: `HSN code length ${h.length} is invalid (must be 4–8 digits)` };
    }
    return { valid: true, error: null };
  }

  // ── Validate GST Rate ──────────────────────────────────────────────────
  function validateGSTRate(rate) {
    const r = parseFloat(rate);
    if (isNaN(r)) return { valid: false, error: `GST rate "${rate}" is not a number` };
    if (!VALID_GST_RATES.includes(r)) {
      return { valid: false, error: `GST rate ${r}% is not a standard GST rate (valid: ${VALID_GST_RATES.join(', ')}%)` };
    }
    return { valid: true, error: null };
  }

  // ── Validate Invoice Date ──────────────────────────────────────────────
  function validateDate(dateStr) {
    if (!dateStr) return { valid: false, error: 'Invoice date is missing' };

    // Accept DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY
    let date = null;
    const formats = [
      /^(\d{2})\/(\d{2})\/(\d{4})$/, // DD/MM/YYYY
      /^(\d{4})-(\d{2})-(\d{2})$/,   // YYYY-MM-DD
      /^(\d{2})-(\d{2})-(\d{4})$/,   // DD-MM-YYYY
    ];

    for (const fmt of formats) {
      const m = String(dateStr).match(fmt);
      if (m) {
        if (fmt === formats[0] || fmt === formats[2]) {
          date = new Date(`${m[3]}-${m[2]}-${m[1]}`);
        } else {
          date = new Date(`${m[1]}-${m[2]}-${m[3]}`);
        }
        break;
      }
    }

    if (!date || isNaN(date.getTime())) {
      return { valid: false, error: `Invalid date format: "${dateStr}" (use DD/MM/YYYY)` };
    }

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (date > today) {
      return { valid: false, error: `Invoice date ${dateStr} is in the future` };
    }

    // Warn if older than 3 years (GSTIN claim window)
    const threeYearsAgo = new Date();
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
    if (date < threeYearsAgo) {
      return { valid: true, warning: `Invoice date ${dateStr} is more than 3 years old — ITC claim window may have lapsed` };
    }

    return { valid: true, error: null };
  }

  // ── Round to 2 decimals ────────────────────────────────────────────────
  function round2(val) {
    return Math.round((parseFloat(val) || 0) * 100) / 100;
  }

  // ── Validate Tax Calculation per Item ─────────────────────────────────
  function validateItemTaxCalc(item) {
    const price    = parseFloat(item.price) || 0;
    const qty      = parseFloat(item.quantity) || 0;
    const rate     = parseFloat(item.taxRate) || 0;
    const taxable  = round2(price * qty);
    const expected = round2(taxable * rate / 100);

    const cgst = round2(item.cgst || 0);
    const sgst = round2(item.sgst || 0);
    const igst = round2(item.igst || 0);
    const totalTax = round2(cgst + sgst + igst);

    const diff = Math.abs(totalTax - expected);
    return {
      taxableAmount: taxable,
      expectedTax: expected,
      actualTax: totalTax,
      diff: round2(diff),
      mismatch: diff > 1
    };
  }

  // ── Detect Transaction Type ────────────────────────────────────────────
  function detectTransactionType(sellerCode, buyerCode) {
    if (!sellerCode || !buyerCode) return 'unknown';
    return sellerCode === buyerCode ? 'intrastate' : 'interstate';
  }

  // ── Check Negative Values ──────────────────────────────────────────────
  function hasNegativeValues(invoice) {
    const negFields = [];
    if ((parseFloat(invoice.subtotal) || 0) < 0) negFields.push('subtotal');
    if ((parseFloat(invoice.grandTotal) || 0) < 0) negFields.push('grandTotal');
    if ((parseFloat(invoice.cgstTotal) || 0) < 0) negFields.push('CGST total');
    if ((parseFloat(invoice.sgstTotal) || 0) < 0) negFields.push('SGST total');
    if ((parseFloat(invoice.igstTotal) || 0) < 0) negFields.push('IGST total');
    (invoice.items || []).forEach((item, i) => {
      if ((parseFloat(item.price) || 0) < 0) negFields.push(`Item ${i+1} price`);
      if ((parseFloat(item.quantity) || 0) < 0) negFields.push(`Item ${i+1} quantity`);
      if ((parseFloat(item.cgst) || 0) < 0) negFields.push(`Item ${i+1} CGST`);
      if ((parseFloat(item.sgst) || 0) < 0) negFields.push(`Item ${i+1} SGST`);
      if ((parseFloat(item.igst) || 0) < 0) negFields.push(`Item ${i+1} IGST`);
    });
    return negFields;
  }

  // ── Check Duplicate Invoice in LocalStorage ────────────────────────────
  function checkDuplicateInvoice(invoiceNumber, currentBillId) {
    try {
      const raw = localStorage.getItem('gstlens_state');
      if (!raw) return false;
      const state = JSON.parse(raw);
      const bills = state.bills || [];
      return bills.some(b =>
        b.invoiceNumber === invoiceNumber &&
        b.id !== currentBillId
      );
    } catch (e) {
      return false;
    }
  }

  // ── Expose ─────────────────────────────────────────────────────────────
  return {
    STATE_CODES,
    VALID_GST_RATES,
    validateGSTIN,
    getStateCodeFromGSTIN,
    validateHSN,
    validateGSTRate,
    validateDate,
    round2,
    validateItemTaxCalc,
    detectTransactionType,
    hasNegativeValues,
    checkDuplicateInvoice
  };

})();

// CommonJS + browser dual export
window.GSTValidatorUtils = GSTValidatorUtils;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GSTValidatorUtils;
}

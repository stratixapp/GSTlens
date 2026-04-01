/**
 * gst_error_detector.js
 * GST Lens — Rule-Based GST Error Detection Engine
 * Fully offline, zero AI, pure validation logic
 * Supports up to 500 invoices with instant browser performance
 */

'use strict';

const GSTErrorDetector = (() => {

  // Score deductions per issue type
  const DEDUCTIONS = {
    // Critical errors (−15 each)
    INVALID_SELLER_GSTIN:      { points: 15, severity: 'error' },
    INVALID_BUYER_GSTIN:       { points: 15, severity: 'error' },
    WRONG_TAX_STRUCTURE:       { points: 15, severity: 'error' },
    CONFLICTING_TAX:           { points: 15, severity: 'error' },
    TOTAL_MISMATCH:            { points: 12, severity: 'error' },
    TAX_CALC_MISMATCH:         { points: 10, severity: 'error' },
    NEGATIVE_VALUES:           { points: 12, severity: 'error' },
    DUPLICATE_INVOICE:         { points: 10, severity: 'error' },
    // Warnings (−5 each)
    INVALID_HSN:               { points: 5,  severity: 'warning' },
    MISSING_HSN:               { points: 5,  severity: 'warning' },
    INVALID_GST_RATE:          { points: 5,  severity: 'warning' },
    CGST_SGST_MISMATCH:        { points: 8,  severity: 'error' },
    FUTURE_DATE:               { points: 8,  severity: 'error' },
    INVALID_DATE:              { points: 5,  severity: 'warning' },
    OLD_DATE:                  { points: 2,  severity: 'warning' },
    GST_ON_ZERO_RATED:         { points: 8,  severity: 'error' },
    MISSING_INVOICE_NUMBER:    { points: 5,  severity: 'warning' },
    IGST_IN_INTRASTATE:        { points: 15, severity: 'error' },
    NO_CGST_SGST_INTRASTATE:   { points: 12, severity: 'error' },
  };

  /**
   * Main audit function
   * @param {Object} invoice - The invoice object to audit
   * @param {*} currentBillId - Optional: ID of current bill (to exclude from duplicate check)
   * @returns {{ score: number, errors: string[], warnings: string[], suggestions: string[], details: Object }}
   */
  function audit(invoice, currentBillId = null) {
    if (!invoice || typeof invoice !== 'object') {
      return { score: 0, errors: ['Invalid invoice data'], warnings: [], suggestions: [], details: {} };
    }
    const errors      = [];
    const warnings    = [];
    const suggestions = [];
    const details     = {};
    let deductTotal   = 0;

    function addIssue(key, message, customSeverity) {
      const def = DEDUCTIONS[key] || { points: 5, severity: 'warning' };
      const severity = customSeverity || def.severity;
      deductTotal += def.points;
      if (severity === 'error') {
        errors.push(message);
      } else {
        warnings.push(message);
      }
    }

    // ── 0. MISSING INVOICE NUMBER ─────────────────────────────────────
    if (!invoice.invoiceNumber || !String(invoice.invoiceNumber).trim()) {
      addIssue('MISSING_INVOICE_NUMBER', 'Invoice number is missing');
      suggestions.push('Always assign a unique invoice number for traceability');
    }

    // ── 1. DUPLICATE INVOICE CHECK ────────────────────────────────────
    if (invoice.invoiceNumber && GSTValidatorUtils.checkDuplicateInvoice(String(invoice.invoiceNumber).trim(), currentBillId)) {
      addIssue('DUPLICATE_INVOICE', `Duplicate invoice detected: Invoice #${invoice.invoiceNumber} already exists`);
      suggestions.push('Verify invoice number — duplicate invoices can cause ITC rejection');
    }

    // ── 2. DATE VALIDATION ────────────────────────────────────────────
    const dateResult = GSTValidatorUtils.validateDate(invoice.invoiceDate);
    details.dateResult = dateResult;
    if (!dateResult.valid) {
      if (dateResult.error && dateResult.error.includes('future')) {
        addIssue('FUTURE_DATE', `Future date: ${dateResult.error}`);
      } else if (dateResult.error) {
        addIssue('INVALID_DATE', dateResult.error);
        suggestions.push('Use DD/MM/YYYY format for invoice dates');
      }
    } else if (dateResult.warning) {
      addIssue('OLD_DATE', dateResult.warning);
    }

    // ── 3. SELLER GSTIN VALIDATION ────────────────────────────────────
    const sellerGSTIN = GSTValidatorUtils.validateGSTIN(invoice.sellerGSTIN);
    details.sellerGSTIN = sellerGSTIN;
    if (!sellerGSTIN.valid) {
      sellerGSTIN.errors.forEach(e => addIssue('INVALID_SELLER_GSTIN', `Seller GSTIN: ${e}`));
      suggestions.push('Cross-check seller GSTIN on the GST portal: https://www.gst.gov.in');
    }

    // ── 4. BUYER GSTIN VALIDATION ─────────────────────────────────────
    if (invoice.buyerGSTIN && String(invoice.buyerGSTIN).trim() !== '') {
      const buyerGSTIN = GSTValidatorUtils.validateGSTIN(invoice.buyerGSTIN);
      details.buyerGSTIN = buyerGSTIN;
      if (!buyerGSTIN.valid) {
        buyerGSTIN.errors.forEach(e => addIssue('INVALID_BUYER_GSTIN', `Buyer GSTIN: ${e}`));
        suggestions.push('Verify buyer GSTIN before claiming ITC — invalid GSTIN blocks credit');
      }
    }

    // ── 5. STATE CODE & TRANSACTION TYPE ─────────────────────────────
    const sellerCode = sellerGSTIN.stateCode || GSTValidatorUtils.getStateCodeFromGSTIN(invoice.sellerGSTIN);
    const buyerCode  = invoice.buyerGSTIN
      ? (GSTValidatorUtils.validateGSTIN(invoice.buyerGSTIN).stateCode || GSTValidatorUtils.getStateCodeFromGSTIN(invoice.buyerGSTIN))
      : (invoice.stateCodeBuyer || null);

    const txType = GSTValidatorUtils.detectTransactionType(sellerCode, buyerCode);
    details.txType = txType;

    const cgstTotal = GSTValidatorUtils.round2(invoice.cgstTotal || 0);
    const sgstTotal = GSTValidatorUtils.round2(invoice.sgstTotal || 0);
    const igstTotal = GSTValidatorUtils.round2(invoice.igstTotal || 0);
    const hasCGST   = cgstTotal > 0;
    const hasSGST   = sgstTotal > 0;
    const hasIGST   = igstTotal > 0;

    // ── 6. TAX STRUCTURE VALIDATION ───────────────────────────────────
    if (txType === 'intrastate') {
      // Should have CGST+SGST, NOT IGST
      if (hasIGST) {
        addIssue('IGST_IN_INTRASTATE', `Incorrect tax structure: Intrastate transaction (${GSTValidatorUtils.STATE_CODES[sellerCode] || sellerCode}) must use CGST+SGST, not IGST`);
        suggestions.push('For intrastate supplies: apply CGST + SGST (each at half the GST rate)');
      }
      if (!hasCGST && !hasSGST && igstTotal === 0) {
        // No tax at all — could be zero-rated; check items
      }
    } else if (txType === 'interstate') {
      // Should have IGST, NOT CGST+SGST
      if (hasCGST || hasSGST) {
        addIssue('NO_CGST_SGST_INTRASTATE', `Incorrect tax structure: Interstate transaction must use IGST, not CGST/SGST`);
        suggestions.push('For interstate supplies: apply IGST (full GST rate)');
      }
    }

    // ── 7. CONFLICTING TAX (both CGST/SGST AND IGST) ─────────────────
    if ((hasCGST || hasSGST) && hasIGST) {
      addIssue('CONFLICTING_TAX', 'Conflicting tax structure: Both CGST/SGST and IGST applied on same invoice');
      suggestions.push('An invoice must use either CGST+SGST (intrastate) OR IGST (interstate), never both');
    }

    // ── 8. CGST = SGST CHECK ──────────────────────────────────────────
    if (hasCGST || hasSGST) {
      if (Math.abs(cgstTotal - sgstTotal) > 0.5) {
        addIssue('CGST_SGST_MISMATCH', `CGST (₹${cgstTotal}) and SGST (₹${sgstTotal}) must be equal — current difference: ₹${Math.abs(cgstTotal - sgstTotal).toFixed(2)}`);
        suggestions.push('CGST and SGST are always equal — each is 50% of the applicable GST rate');
      }
    }

    // ── 9. PER-ITEM VALIDATIONS ───────────────────────────────────────
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    let totalCalcTax = 0;
    let totalCalcTaxable = 0;

    items.forEach((item, idx) => {
      const label = item.description ? `"${item.description}"` : `Item ${idx + 1}`;

      // HSN Validation
      const hsnResult = GSTValidatorUtils.validateHSN(item.hsn);
      if (!hsnResult.valid) {
        if (hsnResult.error.includes('missing')) {
          addIssue('MISSING_HSN', `${label}: HSN code missing`);
          suggestions.push('HSN codes are mandatory for B2B invoices and invoices above ₹50,000');
        } else {
          addIssue('INVALID_HSN', `${label}: ${hsnResult.error}`);
        }
      }

      // GST Rate Validation
      const rateResult = GSTValidatorUtils.validateGSTRate(item.taxRate);
      if (!rateResult.valid) {
        addIssue('INVALID_GST_RATE', `${label}: ${rateResult.error}`);
        suggestions.push('Verify correct HSN-based GST rate at https://cbic-gst.gov.in/gst-goods-services-rates.html');
      }

      // GST on zero-rated item
      const rate = parseFloat(item.taxRate) || 0;
      const itemCGST = GSTValidatorUtils.round2(item.cgst || 0);
      const itemSGST = GSTValidatorUtils.round2(item.sgst || 0);
      const itemIGST = GSTValidatorUtils.round2(item.igst || 0);
      const itemTotalTax = itemCGST + itemSGST + itemIGST;

      if (rate === 0 && itemTotalTax > 0.5) {
        addIssue('GST_ON_ZERO_RATED', `${label}: GST applied (₹${itemTotalTax}) on a zero-rated item (0% rate)`);
        suggestions.push('Zero-rated items (0% GST) must have ₹0 tax — remove tax or correct the GST rate');
      }

      // Tax Calculation Accuracy
      const calcResult = GSTValidatorUtils.validateItemTaxCalc(item);
      if (calcResult.mismatch && rate > 0) {
        addIssue('TAX_CALC_MISMATCH', `${label}: Tax calculation mismatch — expected ₹${calcResult.expectedTax}, found ₹${calcResult.actualTax} (difference: ₹${calcResult.diff})`);
        suggestions.push('Recalculate: Tax = (Price × Quantity) × GST Rate ÷ 100');
      }

      totalCalcTax     += calcResult.expectedTax;
      totalCalcTaxable += calcResult.taxableAmount;
    });

    details.totalCalcTax     = GSTValidatorUtils.round2(totalCalcTax);
    details.totalCalcTaxable = GSTValidatorUtils.round2(totalCalcTaxable);

    // ── 10. NEGATIVE VALUES ───────────────────────────────────────────
    const negFields = GSTValidatorUtils.hasNegativeValues(invoice);
    if (negFields.length > 0) {
      addIssue('NEGATIVE_VALUES', `Invalid negative values detected in: ${negFields.join(', ')}`);
      suggestions.push('All monetary values and quantities must be positive on a GST invoice');
    }

    // ── 11. GRAND TOTAL VALIDATION ────────────────────────────────────
    const subtotal   = GSTValidatorUtils.round2(invoice.subtotal || 0);
    const grandTotal = GSTValidatorUtils.round2(invoice.grandTotal || 0);
    const calcTotal  = GSTValidatorUtils.round2(subtotal + cgstTotal + sgstTotal + igstTotal);

    if (Math.abs(calcTotal - grandTotal) > 1) {
      addIssue('TOTAL_MISMATCH', `Invoice total mismatch: Subtotal (₹${subtotal}) + Tax (₹${GSTValidatorUtils.round2(cgstTotal + sgstTotal + igstTotal)}) = ₹${calcTotal}, but grand total shows ₹${grandTotal}`);
      suggestions.push('Grand Total must equal: Subtotal + CGST + SGST + IGST');
    }

    // ── FINAL SUGGESTIONS (generic) ──────────────────────────────────
    if (errors.length === 0 && warnings.length === 0) {
      suggestions.push('Invoice looks compliant — file GSTR-1 before the 11th of next month');
      suggestions.push('Ensure invoice is retained for at least 6 years as per GST law');
    }
    if (errors.length > 0) {
      suggestions.push('Correct all errors before using this invoice for ITC claims');
    }

    // ── SCORE ─────────────────────────────────────────────────────────
    const score = Math.max(0, Math.min(100, 100 - deductTotal));

    return {
      score,
      errors:      [...new Set(errors)],
      warnings:    [...new Set(warnings)],
      suggestions: [...new Set(suggestions)],
      details,
      txType,
      totalErrors:   errors.length,
      totalWarnings: warnings.length
    };
  }

  /**
   * Batch audit — audit multiple invoices, returns array of reports
   * Supports up to 500 invoices efficiently
   * @param {Array} invoices
   * @returns {Array}
   */
  function batchAudit(invoices) {
    if (!Array.isArray(invoices)) return [];
    return invoices.map((inv, i) => ({
      index: i,
      invoiceNumber: inv.invoiceNumber || `#${i + 1}`,
      report: audit(inv, inv.id)
    }));
  }

  /**
   * Quick score only (no full report) — for list views
   * @param {Object} invoice
   * @returns {number} 0-100
   */
  function quickScore(invoice) {
    return audit(invoice, invoice.id).score;
  }

  return { audit, batchAudit, quickScore };

})();

// CommonJS + browser dual export
window.GSTErrorDetector = GSTErrorDetector;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GSTErrorDetector;
}

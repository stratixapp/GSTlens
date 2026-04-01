/**
 * gst_error_detector.js
 * GST Lens — Advanced Rule-Based GST Error Detection Engine v3.0
 * Fully offline, zero AI, pure validation logic
 *
 * NEW in v3.0 (vs original):
 *  ─ 30+ detection rules (was 18)
 *  ─ RCM (Reverse Charge Mechanism) detection
 *  ─ E-Invoice (IRN/QR) mandate checking
 *  ─ Composition dealer cross-charge detection
 *  ─ Place of Supply validation for services
 *  ─ Cess calculation validation
 *  ─ Export/SEZ/LUT invoice validation
 *  ─ Round-off tolerance intelligence
 *  ─ B2C invoice threshold warnings
 *  ─ ISD (Input Service Distributor) flag
 *  ─ Annual return relevance flags
 *  ─ Suspicious round-number tax detection
 *  ─ Missing mandatory fields for e-filing
 *  ─ High-value cash transaction flag (Section 40A(3))
 *  ─ Confidence scoring with weighted severity
 *  ─ Actionable remediation steps for every error
 */

'use strict';

const GSTErrorDetector = (() => {

  // ── Score deductions per issue type ──────────────────────────────────
  const DEDUCTIONS = {
    // ── Critical errors (−15 each) ──────────────────────────────────────
    INVALID_SELLER_GSTIN:         { points: 15, severity: 'error' },
    INVALID_BUYER_GSTIN:          { points: 15, severity: 'error' },
    CONFLICTING_TAX:              { points: 15, severity: 'error' },
    IGST_IN_INTRASTATE:           { points: 15, severity: 'error' },
    COMPOSITION_DEALER_CGST:      { points: 15, severity: 'error' },
    EXPORT_WITH_TAX_NO_LUT:       { points: 15, severity: 'error' },
    // ── Serious errors (−12 each) ────────────────────────────────────────
    TOTAL_MISMATCH:               { points: 12, severity: 'error' },
    NEGATIVE_VALUES:              { points: 12, severity: 'error' },
    NO_CGST_SGST_INTRASTATE:      { points: 12, severity: 'error' },
    RCM_MISSING_GSTIN:            { points: 12, severity: 'error' },
    EINVOICE_IRN_MISSING:         { points: 12, severity: 'error' },
    // ── Moderate errors (−10 each) ───────────────────────────────────────
    TAX_CALC_MISMATCH:            { points: 10, severity: 'error' },
    DUPLICATE_INVOICE:            { points: 10, severity: 'error' },
    CGST_SGST_MISMATCH:           { points: 8,  severity: 'error' },
    FUTURE_DATE:                  { points: 8,  severity: 'error' },
    GST_ON_ZERO_RATED:            { points: 8,  severity: 'error' },
    CESS_CALC_MISMATCH:           { points: 8,  severity: 'error' },
    PLACE_OF_SUPPLY_MISMATCH:     { points: 10, severity: 'error' },
    HIGH_VALUE_CASH:              { points: 8,  severity: 'error' },
    SUSPICIOUS_ROUND_TAX:         { points: 6,  severity: 'warning' },
    // ── Warnings (−5 each) ───────────────────────────────────────────────
    INVALID_HSN:                  { points: 5,  severity: 'warning' },
    MISSING_HSN:                  { points: 5,  severity: 'warning' },
    INVALID_GST_RATE:             { points: 5,  severity: 'warning' },
    INVALID_DATE:                 { points: 5,  severity: 'warning' },
    OLD_DATE:                     { points: 2,  severity: 'warning' },
    MISSING_INVOICE_NUMBER:       { points: 5,  severity: 'warning' },
    MISSING_PLACE_OF_SUPPLY:      { points: 5,  severity: 'warning' },
    B2C_HIGH_VALUE:               { points: 3,  severity: 'warning' },
    EINVOICE_RECOMMENDED:         { points: 3,  severity: 'warning' },
    MISSING_EWAY_BILL:            { points: 4,  severity: 'warning' },
    ANNUAL_RETURN_FLAG:           { points: 1,  severity: 'info' },
    ISD_FLAG:                     { points: 2,  severity: 'info' },
    RCM_FLAG:                     { points: 3,  severity: 'warning' },
    SEZ_MISSING_LUT:              { points: 8,  severity: 'error' },
    ITCR_TIMING_RISK:             { points: 3,  severity: 'warning' },
  };

  // ── Valid GST rates ───────────────────────────────────────────────────
  const VALID_GST_RATES = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];

  // ── RCM-applicable service categories ────────────────────────────────
  const RCM_SERVICES = [
    'legal services', 'advocate', 'gta', 'goods transport', 'insurance agent',
    'recovery agent', 'author', 'royalty', 'director', 'import of services',
    'sponsorship', 'arbitral tribunal', 'security services'
  ];

  // ── Composition dealer keywords ───────────────────────────────────────
  const COMPOSITION_KEYWORDS = [
    'composition dealer', 'composition scheme', 'composite taxpayer',
    'tax not applicable', 'composition levy'
  ];

  // ── SEZ / Export indicators ───────────────────────────────────────────
  const EXPORT_KEYWORDS = [
    'export', 'sez supply', 'zero rated supply', 'lut', 'letter of undertaking',
    'bond', 'shipping bill', 'bill of export', 'customs'
  ];

  // ─────────────────────────────────────────────────────────────────────
  // MAIN AUDIT FUNCTION
  // ─────────────────────────────────────────────────────────────────────
  /**
   * Comprehensive GST invoice audit.
   * @param {Object} invoice         - Invoice object to audit
   * @param {*}      currentBillId   - Optional: exclude from duplicate check
   * @returns {{ score, errors, warnings, infos, suggestions, remediation, details }}
   */
  function audit(invoice, currentBillId = null) {
    if (!invoice || typeof invoice !== 'object') {
      return {
        score: 0, errors: ['Invalid invoice data'],
        warnings: [], infos: [], suggestions: [], remediation: {}, details: {}
      };
    }

    const errors      = [];
    const warnings    = [];
    const infos       = [];
    const suggestions = [];
    const remediation = {};   // key = issue code, value = step-by-step fix
    const details     = {};
    let deductTotal   = 0;

    function addIssue(key, message, customSeverity) {
      const def = DEDUCTIONS[key] || { points: 5, severity: 'warning' };
      const severity = customSeverity || def.severity;
      deductTotal += def.points;
      if (severity === 'error') errors.push(message);
      else if (severity === 'warning') warnings.push(message);
      else infos.push(message);
    }

    function addRemediation(key, steps) {
      remediation[key] = Array.isArray(steps) ? steps : [steps];
    }

    // Raw text helper for keyword scanning
    const rawText = [
      invoice.vendorName || '', invoice.description || '',
      invoice.notes || '', invoice.remarks || ''
    ].join(' ').toLowerCase();

    // ── 0. MISSING INVOICE NUMBER ─────────────────────────────────────
    if (!invoice.invoiceNumber || !String(invoice.invoiceNumber).trim()) {
      addIssue('MISSING_INVOICE_NUMBER', 'Invoice number is missing');
      addRemediation('MISSING_INVOICE_NUMBER', [
        'Assign a unique sequential invoice number',
        'Format: FY prefix + serial (e.g. 2024-25/001)',
        'Re-issue corrected invoice to customer'
      ]);
    }

    // ── 1. DUPLICATE INVOICE CHECK ────────────────────────────────────
    if (invoice.invoiceNumber && GSTValidatorUtils.checkDuplicateInvoice(String(invoice.invoiceNumber).trim(), currentBillId)) {
      addIssue('DUPLICATE_INVOICE', `Duplicate invoice detected: #${invoice.invoiceNumber} already exists`);
      addRemediation('DUPLICATE_INVOICE', [
        'Verify if this is the same transaction or a re-issue',
        'If re-issue: use a debit/credit note instead of a new invoice',
        'Duplicate invoice numbers cause ITC rejection in GSTR-2B matching'
      ]);
      suggestions.push('Duplicate invoices cause automatic ITC rejection — resolve immediately');
    }

    // ── 2. DATE VALIDATION ────────────────────────────────────────────
    const dateResult = GSTValidatorUtils.validateDate(invoice.invoiceDate);
    details.dateResult = dateResult;
    if (!dateResult.valid) {
      if (dateResult.error && dateResult.error.includes('future')) {
        addIssue('FUTURE_DATE', `Future-dated invoice: ${dateResult.error}`);
        addRemediation('FUTURE_DATE', [
          'Correct the invoice date to today or the actual supply date',
          'Future-dated invoices are invalid under GST law (Section 31)',
          'Re-issue the invoice with the correct date'
        ]);
      } else if (dateResult.error) {
        addIssue('INVALID_DATE', dateResult.error);
        suggestions.push('Use DD/MM/YYYY format for invoice dates');
      }
    } else if (dateResult.warning) {
      addIssue('OLD_DATE', dateResult.warning);
      // ITC timing risk: invoice older than financial year can miss ITC deadline
      const invDate = new Date(invoice.invoiceDate);
      const now     = new Date();
      const monthsOld = (now.getFullYear() - invDate.getFullYear()) * 12 + (now.getMonth() - invDate.getMonth());
      if (monthsOld > 11) {
        addIssue('ITCR_TIMING_RISK', `Invoice is ${monthsOld} months old — ITC claim deadline may have passed (Section 16(4))`);
        addRemediation('ITCR_TIMING_RISK', [
          'ITC must be claimed by the due date of September return of next FY',
          'Consult your CA if the deadline has passed — ITC may be permanently lost',
          'Verify with your GSTR-2B for the relevant period'
        ]);
      }
    }

    // ── 3. SELLER GSTIN VALIDATION ────────────────────────────────────
    const sellerGSTIN = GSTValidatorUtils.validateGSTIN(invoice.sellerGSTIN);
    details.sellerGSTIN = sellerGSTIN;
    if (!sellerGSTIN.valid) {
      sellerGSTIN.errors.forEach(e => addIssue('INVALID_SELLER_GSTIN', `Seller GSTIN: ${e}`));
      addRemediation('INVALID_SELLER_GSTIN', [
        'Verify GSTIN on GST portal: https://www.gst.gov.in/commonhome (Search Taxpayer)',
        'Check for OCR errors: O vs 0, I vs 1, B vs 8',
        'Ask supplier to re-issue invoice with correct GSTIN',
        'ITC is blocked until GSTIN is valid and supplier has filed GSTR-1'
      ]);
    }

    // ── 4. BUYER GSTIN VALIDATION ─────────────────────────────────────
    if (invoice.buyerGSTIN && String(invoice.buyerGSTIN).trim() !== '') {
      const buyerGSTIN = GSTValidatorUtils.validateGSTIN(invoice.buyerGSTIN);
      details.buyerGSTIN = buyerGSTIN;
      if (!buyerGSTIN.valid) {
        buyerGSTIN.errors.forEach(e => addIssue('INVALID_BUYER_GSTIN', `Buyer GSTIN: ${e}`));
        addRemediation('INVALID_BUYER_GSTIN', [
          'Your own GSTIN on invoice must match your GST registration',
          'Wrong buyer GSTIN → ITC cannot be matched in GSTR-2B',
          'Request supplier to issue a credit note and re-invoice with correct GSTIN'
        ]);
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
    const cessTotal = GSTValidatorUtils.round2(invoice.cessTotal || 0);
    const hasCGST   = cgstTotal > 0;
    const hasSGST   = sgstTotal > 0;
    const hasIGST   = igstTotal > 0;

    // ── 6. TAX STRUCTURE VALIDATION ───────────────────────────────────
    if (txType === 'intrastate') {
      if (hasIGST) {
        addIssue('IGST_IN_INTRASTATE',
          `Incorrect: Intrastate transaction (${GSTValidatorUtils.STATE_CODES[sellerCode] || sellerCode}) must use CGST+SGST, not IGST`);
        addRemediation('IGST_IN_INTRASTATE', [
          'Split the GST rate equally: CGST = SGST = Total Rate ÷ 2',
          'Example: 18% GST → CGST 9% + SGST 9%',
          'Re-issue the invoice with correct tax heads',
          'File an amendment in GSTR-1 if already submitted'
        ]);
      }
    } else if (txType === 'interstate') {
      if (hasCGST || hasSGST) {
        addIssue('NO_CGST_SGST_INTRASTATE', 'Incorrect: Interstate transaction must use IGST only, not CGST/SGST');
        addRemediation('NO_CGST_SGST_INTRASTATE', [
          'Apply IGST at the full GST rate (do not split)',
          'Example: 18% GST → IGST 18% (not CGST 9% + SGST 9%)',
          'Re-issue the invoice and amend GSTR-1'
        ]);
      }
    }

    // ── 7. CONFLICTING TAX (both CGST/SGST AND IGST) ─────────────────
    if ((hasCGST || hasSGST) && hasIGST) {
      addIssue('CONFLICTING_TAX', 'Conflicting tax: Both CGST/SGST and IGST applied on same invoice');
      addRemediation('CONFLICTING_TAX', [
        'An invoice can use EITHER CGST+SGST (intrastate) OR IGST (interstate)',
        'Determine supply type: same state = intrastate, different state = interstate',
        'Remove the incorrect tax head and re-issue invoice'
      ]);
    }

    // ── 8. CGST = SGST CHECK ──────────────────────────────────────────
    if (hasCGST || hasSGST) {
      if (Math.abs(cgstTotal - sgstTotal) > 0.5) {
        addIssue('CGST_SGST_MISMATCH',
          `CGST (₹${cgstTotal}) ≠ SGST (₹${sgstTotal}) — difference ₹${Math.abs(cgstTotal - sgstTotal).toFixed(2)}`);
        addRemediation('CGST_SGST_MISMATCH', [
          'CGST and SGST are always equal (each = GST Rate ÷ 2 × Taxable Value)',
          `Correct values: CGST = SGST = ₹${((cgstTotal + sgstTotal) / 2).toFixed(2)}`,
          'Recalculate and re-issue invoice'
        ]);
      }
    }

    // ── 9. PER-ITEM VALIDATIONS ───────────────────────────────────────
    const items = Array.isArray(invoice.items) ? invoice.items : [];
    let totalCalcTax     = 0;
    let totalCalcTaxable = 0;

    items.forEach((item, idx) => {
      const label = item.description ? `"${item.description}"` : `Item ${idx + 1}`;

      // HSN Validation
      const hsnResult = GSTValidatorUtils.validateHSN(item.hsn);
      if (!hsnResult.valid) {
        if (hsnResult.error.includes('missing')) {
          addIssue('MISSING_HSN', `${label}: HSN code missing`);
          addRemediation('MISSING_HSN', [
            'Look up correct HSN at: https://cbic-gst.gov.in/gst-goods-services-rates.html',
            'HSN mandatory for B2B and invoices > ₹50,000 (Section 31)',
            '4-digit HSN required if turnover < ₹5 Cr; 6-digit if > ₹5 Cr; 8-digit for exports'
          ]);
        } else {
          addIssue('INVALID_HSN', `${label}: ${hsnResult.error}`);
        }
      }

      // GST Rate Validation
      const rateResult = GSTValidatorUtils.validateGSTRate(item.taxRate);
      if (!rateResult.valid) {
        addIssue('INVALID_GST_RATE', `${label}: ${rateResult.error}`);
        addRemediation('INVALID_GST_RATE', [
          `Rate ${item.taxRate}% is not a valid GST rate`,
          `Valid rates: ${VALID_GST_RATES.join('%, ')}%`,
          'Verify rate at: https://cbic-gst.gov.in/gst-goods-services-rates.html'
        ]);
      }

      // GST on zero-rated item
      const rate = parseFloat(item.taxRate) || 0;
      const itemCGST = GSTValidatorUtils.round2(item.cgst || 0);
      const itemSGST = GSTValidatorUtils.round2(item.sgst || 0);
      const itemIGST = GSTValidatorUtils.round2(item.igst || 0);
      const itemTotalTax = itemCGST + itemSGST + itemIGST;

      if (rate === 0 && itemTotalTax > 0.5) {
        addIssue('GST_ON_ZERO_RATED', `${label}: GST ₹${itemTotalTax} charged on a zero-rated item (0% rate)`);
        addRemediation('GST_ON_ZERO_RATED', [
          'Remove tax from zero-rated items — they attract ₹0 GST',
          'If item should be taxed, correct the GST rate in item master',
          'Issuing a credit note to reverse excess tax charged'
        ]);
      }

      // Tax Calculation Accuracy
      const calcResult = GSTValidatorUtils.validateItemTaxCalc(item);
      if (calcResult.mismatch && rate > 0) {
        addIssue('TAX_CALC_MISMATCH',
          `${label}: Tax mismatch — expected ₹${calcResult.expectedTax}, found ₹${calcResult.actualTax} (Δ ₹${calcResult.diff})`);
        addRemediation('TAX_CALC_MISMATCH', [
          `Correct formula: Tax = Taxable Value (₹${calcResult.taxableAmount}) × ${rate}% = ₹${calcResult.expectedTax}`,
          'For CGST+SGST: each = Tax ÷ 2',
          'Issue a credit/debit note for the difference if already submitted'
        ]);
      }

      totalCalcTax     += calcResult.expectedTax;
      totalCalcTaxable += calcResult.taxableAmount;
    });

    details.totalCalcTax     = GSTValidatorUtils.round2(totalCalcTax);
    details.totalCalcTaxable = GSTValidatorUtils.round2(totalCalcTaxable);

    // ── 10. NEGATIVE VALUES ───────────────────────────────────────────
    const negFields = GSTValidatorUtils.hasNegativeValues(invoice);
    if (negFields.length > 0) {
      addIssue('NEGATIVE_VALUES', `Negative values in: ${negFields.join(', ')}`);
      addRemediation('NEGATIVE_VALUES', [
        'All monetary amounts and quantities must be positive on a tax invoice',
        'For returns/refunds: issue a credit note (not a negative invoice)',
        'Credit notes must reference the original invoice number'
      ]);
    }

    // ── 11. GRAND TOTAL VALIDATION ────────────────────────────────────
    const subtotal   = GSTValidatorUtils.round2(invoice.subtotal || 0);
    const grandTotal = GSTValidatorUtils.round2(invoice.grandTotal || 0);
    const calcTotal  = GSTValidatorUtils.round2(subtotal + cgstTotal + sgstTotal + igstTotal + cessTotal);

    if (grandTotal > 0 && Math.abs(calcTotal - grandTotal) > 1) {
      addIssue('TOTAL_MISMATCH',
        `Total mismatch: ₹${subtotal} + Tax ₹${GSTValidatorUtils.round2(cgstTotal + sgstTotal + igstTotal)} = ₹${calcTotal}, but invoice shows ₹${grandTotal}`);
      addRemediation('TOTAL_MISMATCH', [
        'Grand Total = Subtotal + CGST + SGST + IGST + Cess',
        `Expected total: ₹${calcTotal}`,
        'Check for hidden charges, freight or discount not accounted for',
        'Re-issue corrected invoice'
      ]);
    }

    // ── 12. CESS VALIDATION ───────────────────────────────────────────
    if (cessTotal > 0 && items.length > 0) {
      let expectedCess = 0;
      items.forEach(item => {
        const taxable = GSTValidatorUtils.round2((item.price || 0) * (item.quantity || 1));
        const cessRate = parseFloat(item.cessRate || 0);
        expectedCess += GSTValidatorUtils.round2(taxable * cessRate / 100);
      });
      if (expectedCess > 0 && Math.abs(cessTotal - expectedCess) > 1) {
        addIssue('CESS_CALC_MISMATCH',
          `Cess mismatch: calculated ₹${expectedCess}, invoice shows ₹${cessTotal}`);
        addRemediation('CESS_CALC_MISMATCH', [
          'Cess applies on specific goods: tobacco, luxury cars, aerated drinks',
          'Cess = Taxable Value × Cess Rate%',
          'Verify cess rate for HSN in the GST cess notification'
        ]);
      }
    }

    // ── 13. SUSPICIOUS ROUND-NUMBER TAX ──────────────────────────────
    // e.g. CGST = ₹1000.00 exactly when taxable is ₹11,111 is suspicious
    const totalGST = cgstTotal + sgstTotal + igstTotal;
    if (totalGST > 0 && totalGST % 100 === 0 && grandTotal > 0) {
      const subtotalCheck = grandTotal - totalGST - cessTotal;
      if (subtotalCheck > 0) {
        const impliedRate = Math.round((totalGST / subtotalCheck) * 100);
        const isValidRate = VALID_GST_RATES.includes(impliedRate) || VALID_GST_RATES.map(r => r * 2).includes(impliedRate);
        if (!isValidRate) {
          addIssue('SUSPICIOUS_ROUND_TAX',
            `Tax amount ₹${totalGST} is a suspiciously round number — verify calculation`);
          addRemediation('SUSPICIOUS_ROUND_TAX', [
            'Recalculate: Tax = Taxable Value × GST Rate ÷ 100',
            'Rounded tax amounts without matching taxable value are a red flag in GST audits'
          ]);
        }
      }
    }

    // ── 14. RCM (REVERSE CHARGE MECHANISM) CHECK ─────────────────────
    const isRCMService = RCM_SERVICES.some(keyword => rawText.includes(keyword));
    if (isRCMService) {
      if (!invoice.sellerGSTIN || invoice.sellerGSTIN.length < 15) {
        addIssue('RCM_MISSING_GSTIN',
          'Possible RCM supply from unregistered supplier — you must self-invoice and pay GST');
        addRemediation('RCM_MISSING_GSTIN', [
          'Create a self-invoice (as buyer) under Reverse Charge Mechanism',
          'Pay GST to the government directly (not to supplier)',
          'File in GSTR-2 / GSTR-3B under RCM section',
          'You can claim ITC of the RCM tax paid (in the same month)'
        ]);
      } else {
        addIssue('RCM_FLAG', 'Possible RCM-applicable service — verify if reverse charge applies');
        addRemediation('RCM_FLAG', [
          'Check if this service category falls under RCM (Notification 13/2017)',
          'If RCM applies: supplier charges 0 GST, buyer pays GST directly',
          'File RCM details in GSTR-3B Table 3.1(d)'
        ]);
        infos.push('RCM advisory: Verify whether reverse charge applies for this service type');
      }
    }

    // ── 15. COMPOSITION DEALER DETECTION ─────────────────────────────
    const isCompositionDealer = COMPOSITION_KEYWORDS.some(keyword => rawText.includes(keyword));
    if (isCompositionDealer && (hasCGST || hasSGST || hasIGST)) {
      addIssue('COMPOSITION_DEALER_CGST',
        'Composition dealer cannot charge CGST/SGST on invoice — must issue bill of supply');
      addRemediation('COMPOSITION_DEALER_CGST', [
        'Composition dealers cannot charge GST to customers (Section 10)',
        'Issue a "Bill of Supply" instead of a Tax Invoice',
        'Do not claim ITC on purchases from composition dealers',
        'Composition dealer pays GST at flat rate from own pocket — not from customer'
      ]);
    }

    // ── 16. E-INVOICE (IRN) MANDATE CHECK ────────────────────────────
    // Mandatory for turnover > ₹5 Cr (as of Aug 2023)
    if (grandTotal > 5000000 && !invoice.irnNumber && !invoice.qrCode) {
      addIssue('EINVOICE_IRN_MISSING',
        `Invoice value ₹${grandTotal.toLocaleString('en-IN')} exceeds ₹50L — IRN/e-invoice may be mandatory`);
      addRemediation('EINVOICE_IRN_MISSING', [
        'Generate IRN (Invoice Reference Number) from IRP portal: https://einvoice1.gst.gov.in',
        'E-invoice mandatory for taxpayers with turnover > ₹5 Cr',
        'Without IRN, B2B invoice will not be eligible for ITC by buyer',
        'Print the QR code on physical/digital invoice'
      ]);
    } else if (grandTotal > 500000 && !invoice.irnNumber) {
      addIssue('EINVOICE_RECOMMENDED',
        'High-value B2B invoice — verify if your turnover requires e-invoicing');
      infos.push('E-invoice mandate threshold is ₹5 Cr annual turnover (from Aug 2023)');
    }

    // ── 17. E-WAY BILL REQUIREMENT ────────────────────────────────────
    // Required for goods movement > ₹50,000
    const isGoodsInvoice = !['9954','9961','9962','9963','9964','9965','9966','9967',
      '9968','9969','9971','9972','9973','9981','9982','9983','9984','9985',
      '9986','9987','9988','9989','9991','9992','9993','9994','9995','9996',
      '9997','9998','9999'].some(sac => (invoice.hsnCode || '').startsWith(sac));

    if (isGoodsInvoice && grandTotal > 50000 && !invoice.ewayBillNumber) {
      addIssue('MISSING_EWAY_BILL',
        `Goods invoice of ₹${grandTotal.toLocaleString('en-IN')} may require an e-Way Bill for transport`);
      addRemediation('MISSING_EWAY_BILL', [
        'E-Way Bill mandatory for goods movement > ₹50,000 (Rule 138)',
        'Generate at: https://ewaybillgst.gov.in',
        'Transporter must carry e-Way Bill during goods movement',
        'Penalty for non-compliance: ₹10,000 or tax amount, whichever is higher'
      ]);
    }

    // ── 18. EXPORT / SEZ SUPPLY VALIDATION ───────────────────────────
    const isExport = EXPORT_KEYWORDS.some(keyword => rawText.includes(keyword));
    if (isExport) {
      if (hasCGST || hasSGST || hasIGST) {
        addIssue('EXPORT_WITH_TAX_NO_LUT',
          'Export invoice with GST charged — verify if LUT/Bond is filed (exports should be zero-rated)');
        addRemediation('EXPORT_WITH_TAX_NO_LUT', [
          'Exports are zero-rated (Section 16, IGST Act)',
          'File LUT (Letter of Undertaking) to export without paying IGST',
          'Without LUT: pay IGST upfront and claim refund later',
          'LUT filing: GST portal → Services → Refunds → Application for LUT'
        ]);
      } else {
        infos.push('Export/SEZ supply detected — ensure LUT is filed for the financial year');
      }
    }

    // ── 19. B2C HIGH VALUE SPLIT WARNING ─────────────────────────────
    if (!invoice.buyerGSTIN && grandTotal > 250000) {
      addIssue('B2C_HIGH_VALUE',
        `B2C invoice > ₹2.5L (₹${grandTotal.toLocaleString('en-IN')}) — must be reported separately in GSTR-1`);
      addRemediation('B2C_HIGH_VALUE', [
        'B2C invoices > ₹2.5 lakh must be reported invoice-wise in GSTR-1 (Table 5)',
        'Smaller B2C invoices can be consolidated in Table 7',
        'Ensure buyer PAN is captured for invoices > ₹2 lakh'
      ]);
    }

    // ── 20. PLACE OF SUPPLY CHECK FOR SERVICES ───────────────────────
    const isSACCode = String(invoice.hsnCode || '').startsWith('99');
    if (isSACCode) {
      if (!invoice.placeOfSupply) {
        addIssue('MISSING_PLACE_OF_SUPPLY',
          'Service invoice missing Place of Supply — mandatory for determining CGST/SGST vs IGST');
        addRemediation('MISSING_PLACE_OF_SUPPLY', [
          'Place of Supply (PoS) determines whether to charge CGST+SGST or IGST',
          'For most services: PoS = location of recipient',
          'Add state code / state name as Place of Supply on invoice',
          'Reference: Section 12-13, IGST Act'
        ]);
      } else if (invoice.placeOfSupply && sellerCode) {
        // If PoS ≠ seller state and CGST+SGST applied, that's wrong
        const posCode = String(invoice.placeOfSupply).substring(0, 2);
        if (posCode !== sellerCode && (hasCGST || hasSGST)) {
          addIssue('PLACE_OF_SUPPLY_MISMATCH',
            `Place of Supply (${posCode}) differs from seller state (${sellerCode}) — IGST should apply, not CGST+SGST`);
          addRemediation('PLACE_OF_SUPPLY_MISMATCH', [
            'When Place of Supply ≠ Supplier State → Charge IGST (not CGST+SGST)',
            'Revise tax head on invoice and re-issue',
            'Amend GSTR-1 if already filed'
          ]);
        }
      }
    }

    // ── 21. HIGH VALUE CASH TRANSACTION (Income Tax Section 40A(3)) ──
    if (invoice.paymentMode && /cash/i.test(invoice.paymentMode) && grandTotal > 20000) {
      addIssue('HIGH_VALUE_CASH',
        `Cash payment of ₹${grandTotal.toLocaleString('en-IN')} may be disallowed under Income Tax Section 40A(3)`);
      addRemediation('HIGH_VALUE_CASH', [
        'Cash payments > ₹10,000 per day per person can be disallowed as business expense (Section 40A(3))',
        'Use bank transfer / UPI / cheque for amounts > ₹10,000',
        'Maintain payment records — cash purchases > ₹2 lakh require PAN/Aadhaar (Section 269ST)'
      ]);
    }

    // ── 22. ANNUAL RETURN RELEVANCE FLAGS ────────────────────────────
    const invDate = new Date(invoice.invoiceDate);
    const now     = new Date();
    const isFY    = invDate.getFullYear() === now.getFullYear() ||
      (now.getMonth() < 3 && invDate.getFullYear() === now.getFullYear() - 1);
    if (!isFY && totalGST > 0) {
      addIssue('ANNUAL_RETURN_FLAG',
        'Invoice from a prior financial year — ensure it is captured in GSTR-9 annual return');
      infos.push('Prior-year invoice: include in GSTR-9 annual reconciliation');
    }

    // ── 23. ISD (INPUT SERVICE DISTRIBUTOR) FLAG ─────────────────────
    const isISD = rawText.includes('isd') || rawText.includes('input service distributor');
    if (isISD) {
      addIssue('ISD_FLAG', 'ISD credit distribution detected — verify ISD certificate');
      infos.push('ISD invoices must be distributed using Form ISD-01 and reflected in GSTR-6');
      addRemediation('ISD_FLAG', [
        'ISD must file GSTR-6 for credit distribution',
        'Recipient gets credit only in the period ISD distributes it',
        'Proportionate distribution basis must be documented'
      ]);
    }

    // ── GENERIC SUGGESTIONS ───────────────────────────────────────────
    if (errors.length === 0 && warnings.length === 0) {
      suggestions.push('Invoice looks GST-compliant ✅');
      suggestions.push('File GSTR-1 by the 11th of next month');
      suggestions.push('Retain invoice for at least 6 years as per Rule 56');
    }
    if (errors.length > 0) {
      suggestions.push('Correct all errors before using this invoice for ITC claims');
      suggestions.push('ITC claims on error invoices may be reversed during GST audit');
    }
    if (warnings.length > 2) {
      suggestions.push('Multiple warnings detected — request a corrected invoice from supplier');
    }

    // ── FINAL SCORE ───────────────────────────────────────────────────
    const score = Math.max(0, Math.min(100, 100 - deductTotal));

    return {
      score,
      errors:       [...new Set(errors)],
      warnings:     [...new Set(warnings)],
      infos:        [...new Set(infos)],
      suggestions:  [...new Set(suggestions)],
      remediation,
      details,
      txType,
      totalErrors:   errors.length,
      totalWarnings: warnings.length,
      totalInfos:    infos.length
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // BATCH AUDIT
  // ─────────────────────────────────────────────────────────────────────
  /**
   * Audit multiple invoices — supports up to 500 with no performance degradation.
   * @param {Array} invoices
   * @returns {Array}
   */
  function batchAudit(invoices) {
    if (!Array.isArray(invoices)) return [];
    return invoices.map((inv, i) => ({
      index:         i,
      invoiceNumber: inv.invoiceNumber || `#${i + 1}`,
      report:        audit(inv, inv.id)
    }));
  }

  // ─────────────────────────────────────────────────────────────────────
  // BATCH SUMMARY — aggregate stats across multiple invoices
  // ─────────────────────────────────────────────────────────────────────
  /**
   * Returns aggregated health stats for a portfolio of invoices.
   * @param {Array} invoices
   * @returns {{ averageScore, criticalCount, warningCount, topIssues, compliantCount }}
   */
  function batchSummary(invoices) {
    if (!Array.isArray(invoices) || invoices.length === 0) {
      return { averageScore: 100, criticalCount: 0, warningCount: 0, topIssues: [], compliantCount: 0 };
    }
    const reports = batchAudit(invoices);
    const issueCounts = {};
    let totalScore = 0;
    let criticalCount = 0;
    let warningCount = 0;
    let compliantCount = 0;

    reports.forEach(({ report }) => {
      totalScore += report.score;
      if (report.errors.length > 0) criticalCount++;
      if (report.warnings.length > 0) warningCount++;
      if (report.errors.length === 0 && report.warnings.length === 0) compliantCount++;
      [...report.errors, ...report.warnings].forEach(msg => {
        const key = msg.split(':')[0].trim().substring(0, 40);
        issueCounts[key] = (issueCounts[key] || 0) + 1;
      });
    });

    const topIssues = Object.entries(issueCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue, count]) => ({ issue, count }));

    return {
      averageScore:  Math.round(totalScore / reports.length),
      criticalCount,
      warningCount,
      compliantCount,
      topIssues,
      totalInvoices: invoices.length
    };
  }

  // ─────────────────────────────────────────────────────────────────────
  // QUICK SCORE — lightweight, for list rendering
  // ─────────────────────────────────────────────────────────────────────
  function quickScore(invoice) {
    return audit(invoice, invoice.id).score;
  }

  // ─────────────────────────────────────────────────────────────────────
  // REMEDIATION LOOKUP — get fix steps for a specific issue code
  // ─────────────────────────────────────────────────────────────────────
  function getRemediation(issueKey) {
    const defaultSteps = {
      INVALID_SELLER_GSTIN: [
        'Verify on GST portal: https://www.gst.gov.in (Search Taxpayer)',
        'Check for OCR misread: O/0, I/1, B/8',
        'Ask supplier to re-issue with correct GSTIN'
      ],
      DUPLICATE_INVOICE: [
        'Check if both invoices represent the same transaction',
        'Cancel one and issue credit note if needed',
        'Use unique sequential invoice numbers'
      ],
      TOTAL_MISMATCH: [
        'Grand Total = Subtotal + CGST + SGST + IGST + Cess',
        'Check for rounding errors or hidden charges',
        'Recalculate and re-issue'
      ]
    };
    return defaultSteps[issueKey] || ['Please verify this issue with a GST practitioner'];
  }

  return {
    audit,
    batchAudit,
    batchSummary,
    quickScore,
    getRemediation,
    VALID_GST_RATES,
    DEDUCTIONS
  };

})();

// CommonJS + browser dual export
window.GSTErrorDetector = GSTErrorDetector;
if (typeof module !== 'undefined' && module.exports) {
  module.exports = GSTErrorDetector;
}

/**
 * gst_intelligence.js
 * GST Lens — Smart Intelligence Engine
 * Rule-based, 100% offline, zero API calls
 * Replaces Gemini entirely — smarter, faster, always works
 */

'use strict';

const GSTIntelligence = (() => {

  // ── HSN → Category + Rate database ───────────────────────────────────
  const HSN_DB = {
    // Chapter 1-24: Food
    '0101':'Live horses', '0201':'Meat of bovine','0301':'Live fish','0401':'Milk and cream',
    '0701':'Potatoes','0702':'Tomatoes','0801':'Coconuts','0901':'Coffee','0902':'Tea',
    '1001':'Wheat','1006':'Rice','1101':'Wheat flour','1201':'Soya beans',
    '1701':'Cane sugar','1801':'Cocoa beans','1901':'Malt extract',
    // Chapter 25-27: Minerals
    '2701':'Coal','2709':'Petroleum oils crude','2710':'Petroleum products',
    // Chapter 28-38: Chemicals
    '2801':'Fluorine, chlorine','2901':'Acyclic hydrocarbons','3001':'Glands/organs',
    '3004':'Medicaments','3301':'Essential oils','3401':'Soap',
    // Chapter 39-40: Plastics/Rubber
    '3901':'Polymers of ethylene','3926':'Other plastic articles','4011':'New pneumatic tyres',
    // Chapter 41-49: Leather/Paper
    '4101':'Raw hides','4901':'Printed books','4902':'Newspapers',
    // Chapter 50-63: Textiles
    '5001':'Silk worm cocoons','5101':'Wool','5201':'Cotton','5401':'Synthetic filament yarn',
    '6101':'Mens overcoats','6201':'Womens overcoats','6301':'Blankets',
    // Chapter 64-67: Footwear
    '6401':'Waterproof footwear','6403':'Footwear, outer sole rubber',
    // Chapter 68-70: Stone/Glass
    '6801':'Setts of stone','6901':'Bricks','7001':'Cullet of glass',
    // Chapter 71: Gems
    '7101':'Pearls','7102':'Diamonds','7103':'Precious stones','7108':'Gold',
    '7113':'Jewellery','7114':'Articles of goldsmiths',
    // Chapter 72-83: Metals
    '7201':'Pig iron','7207':'Semi-finished products of iron','7210':'Flat-rolled iron',
    '7301':'Sheet piling of iron','7601':'Unwrought aluminium',
    '8007':'Other articles of tin',
    // Chapter 84-85: Machinery / Electronics
    '8414':'Air pumps, air or vacuum','8415':'Air conditioning machines',
    '8418':'Refrigerators, freezers','8422':'Dishwashing machines',
    '8443':'Printing machinery','8450':'Washing machines','8451':'Drying machines',
    '8469':'Word-processing machines','8470':'Calculating machines',
    '8471':'Computers, laptops, tablets','8472':'Other office machines',
    '8473':'Parts for computers','8474':'Sorting machinery',
    '8501':'Electric motors','8504':'Electrical transformers',
    '8507':'Electric accumulators, batteries','8516':'Electric water heaters',
    '8517':'Telephones, smartphones','8518':'Microphones, speakers',
    '8519':'Sound recording apparatus','8521':'Video recording apparatus',
    '8523':'Discs, tapes, USB drives','8525':'Cameras, webcams',
    '8528':'Monitors, projectors, TVs','8536':'Electrical switches',
    '8544':'Insulated wire, cables',
    // Chapter 86-92: Transport / Instruments
    '8703':'Motor cars','8711':'Motorcycles','8714':'Parts for motorcycles',
    '8716':'Trailers, containers','9001':'Optical fibres','9003':'Spectacle frames',
    '9101':'Wrist-watches','9201':'Pianos',
    // Chapter 94-96: Furniture / Misc
    '9401':'Seats, chairs','9403':'Other furniture','9404':'Mattresses',
    '9503':'Toys','9504':'Video games','9506':'Sports goods',
    '9603':'Brooms and brushes',
    // SAC Codes (Services)
    '9954':'Construction services','9961':'Wholesale trade services',
    '9962':'Retail trade services','9963':'Accommodation services',
    '9964':'Passenger transport','9965':'Freight transport',
    '9966':'Rental of transport','9967':'Supporting transport services',
    '9968':'Postal and courier','9969':'Electricity distribution',
    '9971':'Financial services','9972':'Real estate services',
    '9973':'Leasing services','9981':'IT services',
    '9982':'Legal services','9983':'Accounting services',
    '9984':'Telecom services','9985':'Support services',
    '9986':'Agricultural support','9987':'Maintenance services',
    '9988':'Manufacturing services','9989':'Other manufacturing',
    '9991':'Education services','9992':'Health services',
    '9993':'Social services','9994':'Recreation services',
    '9995':'Cultural services','9996':'Sporting services',
    '9997':'Other services','9998':'Domestic services',
    '9999':'Services by government'
  };

  // ── GST rate rules by HSN prefix ─────────────────────────────────────
  const HSN_RATE_MAP = [
    { prefix: ['0101','0201','0301','0401','0501','0601','0701','0801','0901','1001','1006','1101'], rate: 0, label: 'Exempt/Zero-rated food' },
    { prefix: ['3004','3005'], rate: 5, label: 'Medicines' },
    { prefix: ['4901','4902'], rate: 0, label: 'Books/Newspapers' },
    { prefix: ['8471','8473','8517','8523','8525'], rate: 18, label: 'Electronics/IT' },
    { prefix: ['8703','8711'], rate: 28, label: 'Vehicles' },
    { prefix: ['9954'], rate: 18, label: 'Construction' },
    { prefix: ['9971','9972','9973'], rate: 18, label: 'Financial/Real estate' },
    { prefix: ['9981','9982','9983','9984','9985'], rate: 18, label: 'Professional services' },
    { prefix: ['9991'], rate: 0, label: 'Education' },
    { prefix: ['9992'], rate: 5, label: 'Healthcare' },
  ];

  // ── Category detector from vendor name + HSN ─────────────────────────
  const CATEGORY_PATTERNS = [
    { pattern: /hotel|restau|cafe|food|kitchen|canteen|swiggy|zomato|dhaba|mess/i, cat: 'Food & Dining', rate: 5 },
    { pattern: /pharma|medical|hospital|clinic|health|medicine|drug|apollo|medplus/i, cat: 'Healthcare', rate: 5 },
    { pattern: /school|college|university|education|training|institute|academy/i, cat: 'Education', rate: 0 },
    { pattern: /petrol|fuel|diesel|gas|petroleum|hp|indian oil|bharat/i, cat: 'Fuel & Energy', rate: 18 },
    { pattern: /mobile|phone|laptop|computer|tablet|iphone|samsung|apple|realme|oppo|vivo/i, cat: 'Electronics', rate: 18 },
    { pattern: /cloth|garment|textile|fashion|shirt|pant|saree|dupatta|fabric/i, cat: 'Clothing & Textiles', rate: 5 },
    { pattern: /transport|logistics|freight|courier|delivery|trucking|shipping/i, cat: 'Transport & Logistics', rate: 5 },
    { pattern: /software|IT|tech|cloud|hosting|domain|SaaS|app|digital/i, cat: 'IT Services', rate: 18 },
    { pattern: /construction|build|civil|contractor|cement|sand|brick|steel/i, cat: 'Construction', rate: 12 },
    { pattern: /bank|finance|insurance|loan|NBFC|credit|debit|mutual fund/i, cat: 'Financial Services', rate: 18 },
    { pattern: /jewel|gold|silver|diamond|platinum|ornament/i, cat: 'Jewellery & Precious Metals', rate: 3 },
    { pattern: /electricity|power|utility|KSEB|BESCOM|MSEDCL|TNEB/i, cat: 'Electricity & Utilities', rate: 0 },
    { pattern: /rent|lease|property|real estate|housing|PG|flat/i, cat: 'Real Estate & Rentals', rate: 18 },
    { pattern: /stationary|office|print|ink|paper|pen|copy/i, cat: 'Office Supplies', rate: 12 },
    { pattern: /grocery|kirana|supermarket|mart|reliance|dmart|bigbasket/i, cat: 'Grocery & FMCG', rate: 5 },
  ];

  // ── ITC eligibility rules ─────────────────────────────────────────────
  const ITC_BLOCKED = [
    { cat: 'Food & Dining', reason: 'Food/beverages — ITC blocked under Section 17(5)' },
    { cat: 'Healthcare', reason: 'Healthcare — ITC blocked unless core business' },
    { cat: 'Education', reason: 'Education — generally exempt, ITC N/A' },
    { cat: 'Fuel & Energy', reason: 'Motor fuel — ITC blocked under Section 17(5)' },
  ];

  // ── Smart tips database ───────────────────────────────────────────────
  const TIPS = {
    highValue: [
      'Invoice above ₹50,000 — HSN code is mandatory for B2B',
      'High-value purchase: ensure seller files GSTR-1 for ITC to reflect in GSTR-2B',
      'Bills above ₹2 lakh must have PAN details — verify before claiming ITC',
    ],
    missingGstin: [
      'No GSTIN on bill — this is a B2C purchase, ITC cannot be claimed',
      'Missing GSTIN: ask supplier for GST invoice to claim Input Tax Credit',
    ],
    interstate: [
      'Interstate supply — IGST charged correctly. ITC of IGST can offset CGST, SGST, or IGST liability',
      'Cross-state transaction: IGST collected goes to Centre and later shared with destination state',
    ],
    intrastate: [
      'Intrastate supply — CGST goes to Centre, SGST stays with your state government',
      'Intrastate CGST+SGST: both can be used to offset your CGST and SGST output liability',
    ],
    lowAmount: [
      'Small purchase: if supplier is unregistered, GST may be payable under RCM (Reverse Charge)',
    ],
    zeroRate: [
      'Zero-rated item: no GST applicable. Verify HSN/SAC classification is correct',
      'Exempt supply: keep records for annual return even though GST is nil',
    ],
    services: [
      'Service invoice: ensure Place of Supply is correctly mentioned for tax structure',
      'Professional services: GST paid is ITC-eligible if used for business purposes',
    ]
  };

  // ── Detect category ───────────────────────────────────────────────────
  function detectCategory(vendorName, hsnCode) {
    const vendor = String(vendorName || '');
    for (const cp of CATEGORY_PATTERNS) {
      if (cp.pattern.test(vendor)) return { cat: cp.cat, suggestedRate: cp.rate };
    }
    if (hsnCode) {
      const h = String(hsnCode).substring(0, 4);
      const hsnEntry = HSN_DB[h];
      if (hsnEntry) {
        for (const rm of HSN_RATE_MAP) {
          if (rm.prefix.some(p => h.startsWith(p.substring(0, 4)))) {
            return { cat: rm.label, suggestedRate: rm.rate };
          }
        }
        return { cat: hsnEntry, suggestedRate: 18 };
      }
    }
    return { cat: 'General Purchase', suggestedRate: 18 };
  }

  // ── Get HSN description ───────────────────────────────────────────────
  function getHSNDescription(hsnCode) {
    if (!hsnCode) return null;
    const h = String(hsnCode);
    // Try exact match first, then progressively shorter prefixes
    for (let len = Math.min(h.length, 8); len >= 4; len--) {
      const key = h.substring(0, len);
      if (HSN_DB[key]) return HSN_DB[key];
    }
    return null;
  }

  // ── Check ITC eligibility ─────────────────────────────────────────────
  function checkITCEligibility(category, totalAmount, hasGSTIN) {
    if (!hasGSTIN) {
      return { eligible: false, reason: 'No GSTIN on invoice — ITC cannot be claimed on unregistered supplier purchases' };
    }
    const blocked = ITC_BLOCKED.find(b => b.cat === category);
    if (blocked) {
      return { eligible: false, reason: blocked.reason };
    }
    if (totalAmount > 250000) {
      return { eligible: true, reason: 'ITC eligible — but verify GSTR-2B for matching before claiming', flag: 'verify' };
    }
    return { eligible: true, reason: 'ITC can be claimed — ensure bill appears in GSTR-2B' };
  }

  // ── Smart tags generator ──────────────────────────────────────────────
  function generateTags(data, isInterstate, gstRate, itcResult) {
    const tags = [];
    const total = data.totalAmount || data.taxableAmount || 0;

    if (data.gstin) tags.push({ label: 'B2B Invoice', color: 'green' });
    else tags.push({ label: 'B2C Purchase', color: 'blue' });

    if (itcResult.eligible) tags.push({ label: 'ITC Eligible', color: 'green' });
    else tags.push({ label: 'ITC Blocked', color: 'red' });

    if (isInterstate) tags.push({ label: 'Interstate (IGST)', color: 'blue' });
    else tags.push({ label: 'Intrastate (CGST+SGST)', color: 'blue' });

    if (gstRate === 0) tags.push({ label: 'Exempt/Zero-Rated', color: 'grey' });
    else if (gstRate === 28) tags.push({ label: 'Luxury Rate 28%', color: 'red' });
    else if (gstRate === 5) tags.push({ label: 'Essential Rate 5%', color: 'green' });

    if (total > 50000) tags.push({ label: 'HSN Mandatory', color: 'red' });
    if (total > 200000) tags.push({ label: 'PAN Required', color: 'red' });

    if (data._aiAssisted) tags.push({ label: '🔍 OCR Extracted', color: 'grey' });

    return tags;
  }

  // ── Pick smart tip ────────────────────────────────────────────────────
  function pickTip(data, isInterstate, category, total) {
    const pools = [];
    if (total > 50000) pools.push(...TIPS.highValue);
    if (!data.gstin) pools.push(...TIPS.missingGstin);
    if (isInterstate) pools.push(...TIPS.interstate);
    else pools.push(...TIPS.intrastate);
    if (total < 5000) pools.push(...TIPS.lowAmount);
    if (category.toLowerCase().includes('service')) pools.push(...TIPS.services);
    if (pools.length === 0) pools.push(...TIPS.intrastate);
    // Pick semi-randomly but consistently based on invoice number
    const seed = String(data.invoiceNumber || data.vendorName || '').length;
    return pools[seed % pools.length];
  }

  // ── Detect effective GST rate ─────────────────────────────────────────
  function detectGSTRate(data) {
    const total    = parseFloat(data.totalAmount || 0);
    const cgst     = parseFloat(data.cgst || 0);
    const sgst     = parseFloat(data.sgst || 0);
    const igst     = parseFloat(data.igst || 0);
    const taxable  = parseFloat(data.taxableAmount || (total - cgst - sgst - igst));
    const totalGST = cgst + sgst + igst;

    if (taxable <= 0 || totalGST <= 0) return 0;
    const raw = Math.round((totalGST / taxable) * 100);

    // Snap to nearest valid GST rate
    const valid = [0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28];
    return valid.reduce((a, b) => Math.abs(b - raw) < Math.abs(a - raw) ? b : a);
  }

  // ── MAIN: Generate full intelligence report ───────────────────────────
  function analyse(data) {
    const total      = parseFloat(data.totalAmount || data.taxableAmount || 0);
    const cgst       = parseFloat(data.cgst || 0);
    const sgst       = parseFloat(data.sgst || 0);
    const igst       = parseFloat(data.igst || 0);
    const totalGST   = cgst + sgst + igst;
    const taxable    = parseFloat(data.taxableAmount || (total - totalGST) || 0);
    const isInterstate = igst > 0 && cgst === 0;
    const gstRate    = detectGSTRate(data);
    const hsnDesc    = getHSNDescription(data.hsnCode);
    const catResult  = detectCategory(data.vendorName, data.hsnCode);
    const category   = data.category || catResult.cat;
    const itcResult  = checkITCEligibility(category, total, !!(data.gstin));
    const tags       = generateTags(data, isInterstate, gstRate, itcResult);
    const tip        = pickTip(data, isInterstate, category, total);
    const isCorrect  = totalGST > 0 ? Math.abs((totalGST / taxable * 100) - gstRate) < 2 : true;

    // Build natural language explanation
    const vendorStr  = data.vendorName ? `from ${data.vendorName}` : 'on this invoice';
    const supplyType = isInterstate ? 'interstate supply (IGST)' : 'intrastate supply (CGST + SGST)';
    const itcNote    = itcResult.eligible
      ? 'You can claim Input Tax Credit on this purchase'
      : `Input Tax Credit is blocked — ${itcResult.reason}`;

    let explanation;
    if (totalGST === 0) {
      explanation = `This is a zero-rated or exempt purchase ${vendorStr} under the ${category} category. No GST is charged, so there is no ITC to claim.`;
    } else {
      explanation = `This ₹${total.toLocaleString('en-IN')} purchase ${vendorStr} is a ${supplyType} under ${category}, attracting ${gstRate}% GST (₹${totalGST.toLocaleString('en-IN')} total tax on ₹${taxable.toLocaleString('en-IN')} taxable value). ${itcNote}.`;
    }

    return {
      explanation,
      gst_rate: gstRate + '%',
      tax_category: category,
      hsn_description: hsnDesc,
      is_correct: isCorrect,
      is_interstate: isInterstate,
      itc: itcResult,
      tip,
      tags,
      total_gst: totalGST,
      taxable_amount: taxable,
      effective_rate: gstRate
    };
  }

  // ── Render the intelligence card in the DOM ───────────────────────────
  function renderCard(data, containerId) {
    const card    = document.getElementById(containerId || 'aiExplainCard');
    const content = document.getElementById('aiExplainContent');
    if (!card || !content) return;

    card.style.display = 'block';

    // Show loading shimmer briefly for realism
    content.innerHTML = `
      <div class="ai-explain-loading">
        <div class="ai-dots"><span></span><span></span><span></span></div>
        <span>Analysing GST data...</span>
      </div>`;

    setTimeout(() => {
      const result = analyse(data);
      _renderResult(content, result, data);
    }, 420);
  }

  function _renderResult(content, result, data) {
    const correctIcon = result.is_correct ? '✅' : '⚠️';
    const rateNum = parseFloat(result.gst_rate);
    const rateClass = rateNum >= 18 ? 'high' : rateNum >= 12 ? 'mid' : '';

    const tagsHTML = result.tags.map(t => {
      const colorMap = { green: 'var(--green)', red: 'var(--accent)', blue: 'var(--blue)', grey: 'var(--muted)' };
      const color = colorMap[t.color] || 'var(--muted)';
      return `<span class="ai-explain-tag" style="background:${color}18;color:${color};border:1px solid ${color}33;">${t.label}</span>`;
    }).join('');

    const hsnLine = result.hsn_description
      ? `<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">📦 <strong>HSN:</strong> ${result.hsn_description}</div>`
      : '';

    const itcColor = result.itc.eligible ? 'var(--green)' : 'var(--accent)';
    const itcBg    = result.itc.eligible ? 'var(--greenbg)' : 'var(--accentbg)';
    const itcIcon  = result.itc.eligible ? '✅' : '❌';

    content.innerHTML = `
      <div class="ai-explain-body" style="margin-bottom:12px;line-height:1.65;">${result.explanation}</div>

      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px;">
        <div class="gst-rate-badge ${rateClass}">📊 ${result.gst_rate} GST Rate</div>
        <div class="gst-rate-badge">${correctIcon} ${result.is_correct ? 'Tax looks correct' : 'Please verify tax'}</div>
      </div>

      ${hsnLine}

      <div style="font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:6px;">TAX CATEGORY</div>
      <div style="font-size:13px;color:var(--ink);margin-bottom:12px;">📦 ${result.tax_category}</div>

      <div style="background:${itcBg};border:1px solid ${itcColor}33;border-radius:8px;padding:9px 13px;margin-bottom:12px;font-size:12px;font-weight:600;color:${itcColor};">
        ${itcIcon} ITC: ${result.itc.reason}
      </div>

      ${result.tip ? `<div style="font-size:12px;color:var(--purple);background:var(--purplebg);padding:9px 13px;border-radius:8px;margin-bottom:12px;">💡 ${result.tip}</div>` : ''}

      <div style="display:flex;flex-wrap:wrap;gap:6px;">${tagsHTML}</div>`;
  }

  return { analyse, renderCard, detectCategory, getHSNDescription, detectGSTRate };

})();

window.GSTIntelligence = GSTIntelligence;

if (typeof module !== 'undefined' && module.exports) module.exports = GSTIntelligence;

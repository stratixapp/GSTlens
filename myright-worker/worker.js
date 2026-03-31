/**
 * MyRight Cloudflare Worker
 * Endpoints: /generate  /ai-chat  /analyze
 *
 * Environment Variables (set in Cloudflare Dashboard → Workers → Settings → Variables):
 *   GEMINI_API_KEY   — your Google AI Studio key
 *   ALLOWED_ORIGIN   — https://your-firebase-project.web.app  (or * for dev)
 */

const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// ─── CORS HEADERS ────────────────────────────────────────────────────────────
function cors(env) {
  const origin = env.ALLOWED_ORIGIN || '*';
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

function ok(data, env) {
  return new Response(JSON.stringify(data), { status: 200, headers: cors(env) });
}

function err(msg, env, status = 400) {
  return new Response(JSON.stringify({ error: msg }), { status, headers: cors(env) });
}

// ─── MAIN ROUTER ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors(env) });
    }

    if (request.method !== 'POST') {
      return err('Only POST requests are accepted', env, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return err('Invalid JSON body', env);
    }

    switch (url.pathname) {
      case '/generate':  return handleGenerate(body, env);
      case '/ai-chat':   return handleAiChat(body, env);
      case '/analyze':   return handleAnalyze(body, env);
      default:           return err('Not found', env, 404);
    }
  }
};

// ─── /generate ───────────────────────────────────────────────────────────────
async function handleGenerate(body, env) {
  const { docType, formData } = body;
  if (!docType || !formData) return err('docType and formData are required', env);

  const prompt = buildDocumentPrompt(docType, formData);

  const content = await callGemini(prompt, env, {
    systemInstruction: `You are an expert Indian legal document drafter. 
Generate a complete, formal, legally accurate document in English.
Use proper legal formatting with headings, numbered clauses, and signature blocks.
Include THIS AGREEMENT IS MADE ON [date] format for dated documents.
End every document with a proper signature block with spaces for signatures, dates, and witnesses.
Output ONLY the document text — no explanations, no markdown, no commentary.`,
    maxTokens: 2048
  });

  if (!content) return err('Document generation failed', env, 500);
  return ok({ content }, env);
}

// ─── /ai-chat ─────────────────────────────────────────────────────────────────
async function handleAiChat(body, env) {
  const { message, history = [] } = body;
  if (!message) return err('message is required', env);

  // Build Gemini conversation turns
  const contents = [];

  for (const turn of history) {
    contents.push({ role: turn.role, parts: [{ text: turn.content }] });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const reply = await callGeminiChat(contents, env, {
    systemInstruction: `You are MyRight's AI legal assistant, an expert in Indian law.
Your role:
- Answer questions about Indian laws, rights, and legal procedures in simple language
- Help users understand which legal documents they need
- Explain legal terms in plain Hindi/English mix when helpful
- Guide users through common legal situations (tenant rights, employment, contracts, family law)
- Recommend specific documents from this list when relevant:
  Affidavit, Rent Agreement, NDA, Partnership Deed, Power of Attorney, Gift Deed,
  Loan Agreement, Employment Contract, Service Agreement, Legal Notice, and 30+ more on MyRight

Keep responses concise (under 200 words), friendly, and practical.
Always add: "I can generate this document for you on MyRight" when recommending a document.
Never give advice that requires a specific lawyer consultation — suggest they consult a lawyer for complex matters.`,
    maxTokens: 1024
  });

  if (!reply) return err('AI chat failed', env, 500);
  return ok({ reply }, env);
}

// ─── /analyze ────────────────────────────────────────────────────────────────
async function handleAnalyze(body, env) {
  const { text } = body;
  if (!text || text.trim().length < 50) return err('Document text too short', env);

  const prompt = `Analyze this legal document and respond ONLY with a valid JSON object (no markdown, no backticks):

Document:
"""
${text.substring(0, 8000)}
"""

JSON format required:
{
  "riskScore": 35,
  "riskLevel": "MEDIUM",
  "summary": "One paragraph summary of this document",
  "issues": [
    {"severity": "HIGH", "title": "Issue title", "description": "What is wrong"},
    {"severity": "MEDIUM", "title": "Issue title", "description": "What is wrong"}
  ],
  "missingClauses": [
    "Clause name that is missing",
    "Another missing clause"
  ],
  "recommendations": [
    "Specific actionable recommendation",
    "Another recommendation"
  ]
}

riskScore: 0-100 (0=safe, 100=very risky)
riskLevel: "LOW" | "MEDIUM" | "HIGH"
issues: array of 2-6 issues found
missingClauses: array of important clauses not present
recommendations: array of 2-5 actionable steps`;

  const rawJson = await callGemini(prompt, env, {
    systemInstruction: 'You are an expert Indian legal document analyzer. Always respond with valid JSON only.',
    maxTokens: 1500
  });

  if (!rawJson) return err('Analysis failed', env, 500);

  // Parse and validate JSON response
  try {
    const cleaned = rawJson.replace(/```json|```/g, '').trim();
    const analysis = JSON.parse(cleaned);
    return ok(analysis, env);
  } catch {
    // Return raw text if JSON parse fails — frontend handles fallback
    return ok({ raw: rawJson }, env);
  }
}

// ─── GEMINI HELPERS ───────────────────────────────────────────────────────────
async function callGemini(prompt, env, { systemInstruction, maxTokens = 1500 }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY not set');
    return null;
  }

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.3,
      topP: 0.8,
    }
  };

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const e = await res.text();
      console.error('Gemini error:', e);
      return null;
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch (e) {
    console.error('Gemini fetch failed:', e);
    return null;
  }
}

async function callGeminiChat(contents, env, { systemInstruction, maxTokens = 1024 }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const body = {
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents,
    generationConfig: {
      maxOutputTokens: maxTokens,
      temperature: 0.6,
      topP: 0.9,
    }
  };

  try {
    const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || null;
  } catch {
    return null;
  }
}

// ─── DOCUMENT PROMPT BUILDER ─────────────────────────────────────────────────
function buildDocumentPrompt(docType, formData) {
  const fields = Object.entries(formData)
    .map(([k, v]) => `${k.replace(/_/g, ' ').toUpperCase()}: ${v}`)
    .join('\n');

  const docNames = {
    affidavit: 'General Affidavit',
    rent_agreement: 'Residential Rent Agreement',
    lease_agreement: 'Lease Agreement',
    nda: 'Non-Disclosure Agreement (NDA)',
    partnership_deed: 'Partnership Deed',
    loan_agreement: 'Loan Agreement',
    employment_contract: 'Employment Contract',
    service_agreement: 'Service Agreement',
    power_of_attorney: 'Power of Attorney',
    gift_deed: 'Gift Deed',
    legal_notice: 'Legal Notice',
    name_change: 'Name Change Affidavit',
    property_sale: 'Property Sale Agreement',
    promissory_note: 'Promissory Note',
    payment_agreement: 'Payment Agreement',
    debt_settlement: 'Debt Settlement Agreement',
    vendor_agreement: 'Vendor Agreement',
    freelance_contract: 'Freelance Service Contract',
    marriage_affidavit: 'Marriage Affidavit',
    poa_general: 'General Power of Attorney',
    poa_property: 'Property Power of Attorney',
    guardianship_declaration: 'Guardianship Declaration',
    gap_certificate: 'Gap Certificate Affidavit',
    bonafide_declaration: 'Bonafide Declaration',
    general_affidavit: 'General Affidavit',
    notary_affidavit: 'Notary Affidavit',
    court_declaration: 'Court Declaration',
    legal_undertaking: 'Legal Undertaking',
  };

  const docName = docNames[docType] || docType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  return `Draft a complete and formal Indian ${docName} using the following details:

${fields}

Requirements:
- Follow Indian law and standard legal language
- Use proper document structure with numbered clauses
- Include date, parties, terms, and obligations clearly
- Add a signature block at the end with spaces for Party signatures, date, and two witnesses
- The document should be legally valid and enforceable under Indian law
- Include relevant Indian legal acts/sections where applicable`;
}

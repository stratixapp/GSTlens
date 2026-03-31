// ===========================
// MYRIGHT — FIREBASE CONFIG
// Replace with your Firebase project config
// ===========================

const firebaseConfig = {
  apiKey: "AIzaSyAkq3f19TALpHQ89CoALb-4z18-Lz_Jndc",
  authDomain: "my-right-a4982.firebaseapp.com",
  projectId: "my-right-a4982",
  storageBucket: "my-right-a4982.firebasestorage.app",
  messagingSenderId: "522849413367",
  appId: "1:522849413367:web:ede20dd4876808da390bf2"
};

// ===========================
// FIREBASE INIT
// ===========================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  getDocs,
  serverTimestamp,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const googleProvider = new GoogleAuthProvider();

// ===========================
// AUTH STATE
// ===========================

onAuthStateChanged(auth, (user) => {
  const publicPages = ['index.html', 'pages/login.html', 'pages/signup.html', 'pages/privacy.html', 'pages/terms.html', 'pages/disclaimer.html'];
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';

  if (user) {
    // Redirect if on auth pages
    if (currentPage === 'login.html' || currentPage === 'signup.html') {
      window.location.href = 'dashboard.html';
    }
    // Update user display
    updateUserUI(user);
  } else {
    // Redirect if on protected pages
    const protectedPages = ['dashboard.html', 'generate.html', 'history.html', 'profile.html', 'subscription.html'];
    if (protectedPages.includes(currentPage)) {
      window.location.href = 'login.html';
    }
  }
});

function updateUserUI(user) {
  const nameEls = document.querySelectorAll('.user-name');
  const emailEls = document.querySelectorAll('.user-email');
  const avatarEls = document.querySelectorAll('.user-avatar');
  nameEls.forEach(el => el.textContent = user.displayName || 'User');
  emailEls.forEach(el => el.textContent = user.email);
  avatarEls.forEach(el => el.textContent = (user.displayName || user.email || 'U')[0].toUpperCase());
}

// ===========================
// SIGN UP
// ===========================

async function signUp(name, email, password) {
  try {
    showLoading(true);
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: name });

    // Create Firestore user doc
    await setDoc(doc(db, 'users', cred.user.uid), {
      name,
      email,
      plan: 'free',
      docsGenerated: 0,
      createdAt: serverTimestamp()
    });

    showToast('✅ Account created! Welcome to MyRight.', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 1500);
  } catch (err) {
    showLoading(false);
    showError(getFirebaseError(err.code));
  }
}

// ===========================
// SIGN IN
// ===========================

async function signIn(email, password) {
  try {
    showLoading(true);
    await signInWithEmailAndPassword(auth, email, password);
    showToast('✅ Welcome back!', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 1000);
  } catch (err) {
    showLoading(false);
    showError(getFirebaseError(err.code));
  }
}

// ===========================
// GOOGLE SIGN IN
// ===========================

async function signInWithGoogle() {
  try {
    showLoading(true);
    const result = await signInWithPopup(auth, googleProvider);
    const user = result.user;

    // Create user doc if new
    const userRef = doc(db, 'users', user.uid);
    const snap = await getDoc(userRef);
    if (!snap.exists()) {
      await setDoc(userRef, {
        name: user.displayName,
        email: user.email,
        plan: 'free',
        docsGenerated: 0,
        createdAt: serverTimestamp()
      });
    }

    showToast('✅ Signed in with Google!', 'success');
    setTimeout(() => window.location.href = 'dashboard.html', 1000);
  } catch (err) {
    showLoading(false);
    showError(getFirebaseError(err.code));
  }
}

// ===========================
// SIGN OUT
// ===========================

async function logout() {
  await signOut(auth);
  window.location.href = '../index.html';
}

// ===========================
// GET USER DATA
// ===========================

async function getUserData() {
  const user = auth.currentUser;
  if (!user) return null;
  const snap = await getDoc(doc(db, 'users', user.uid));
  return snap.exists() ? { uid: user.uid, ...snap.data() } : null;
}

// ===========================
// DOCUMENT GENERATION
// ===========================

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";

// Document prompts
const DOC_PROMPTS = {
  rent_agreement: (data) => `Generate a complete, legally accurate Indian Rent Agreement with the following details:
    - Landlord Name: ${data.landlord_name}
    - Tenant Name: ${data.tenant_name}
    - Property Address: ${data.property_address}
    - City/State: ${data.city}
    - Monthly Rent: ₹${data.monthly_rent}
    - Security Deposit: ₹${data.security_deposit}
    - Agreement Duration: ${data.duration} months
    - Start Date: ${data.start_date}
    - Furnished Status: ${data.furnished}
    
    Generate a complete rent agreement with all standard Indian legal clauses including: parties, property description, rent payment terms, security deposit, maintenance responsibilities, termination clause, dispute resolution, and signatures section. Use proper legal language. Format it professionally.`,

  nda: (data) => `Generate a complete, legally accurate Indian Non-Disclosure Agreement (NDA) with:
    - Disclosing Party: ${data.party1_name} (${data.party1_type})
    - Receiving Party: ${data.party2_name} (${data.party2_type})
    - Purpose: ${data.purpose}
    - Duration of Confidentiality: ${data.duration} years
    - Jurisdiction: ${data.jurisdiction}, India
    - Date: ${data.date}
    
    Include all standard clauses: definitions, obligations, exclusions, term, remedies, governing law. Professional legal format.`,

  partnership_deed: (data) => `Generate a complete Indian Partnership Deed with:
    - Partner 1: ${data.partner1_name}, ${data.partner1_address}
    - Partner 2: ${data.partner2_name}, ${data.partner2_address}
    - Business Name: ${data.business_name}
    - Business Type: ${data.business_type}
    - Capital Contribution Partner 1: ₹${data.capital1}
    - Capital Contribution Partner 2: ₹${data.capital2}
    - Profit Sharing Ratio: ${data.profit_ratio}
    - Registration State: ${data.state}
    - Date: ${data.date}
    
    Include: commencement, capital accounts, profit/loss distribution, banking, accounts, duties, retirement, dissolution clauses. Full legal format.`,

  employment_letter: (data) => `Generate a professional Indian Employment Offer Letter with:
    - Company Name: ${data.company_name}
    - Company Address: ${data.company_address}
    - Employee Name: ${data.employee_name}
    - Designation: ${data.designation}
    - Department: ${data.department}
    - CTC: ₹${data.ctc} per annum
    - Joining Date: ${data.joining_date}
    - Reporting Manager: ${data.manager}
    - Work Location: ${data.location}
    - Probation Period: ${data.probation} months
    
    Include professional offer letter format with salary breakup, benefits, terms and conditions, acceptance clause.`,

  freelance_agreement: (data) => `Generate a complete Indian Freelance Service Agreement with:
    - Client Name: ${data.client_name}
    - Freelancer Name: ${data.freelancer_name}
    - Service Description: ${data.service}
    - Project Amount: ₹${data.amount}
    - Payment Terms: ${data.payment_terms}
    - Timeline: ${data.timeline}
    - Jurisdiction: ${data.jurisdiction}, India
    - Date: ${data.date}
    
    Include: scope of work, payment, IP ownership, confidentiality, termination, liability, dispute resolution.`,

  legal_notice: (data) => `Draft a formal Indian Legal Notice with:
    - Sender Name: ${data.sender_name}
    - Sender Address: ${data.sender_address}
    - Recipient Name: ${data.recipient_name}
    - Recipient Address: ${data.recipient_address}
    - Subject Matter: ${data.subject}
    - Nature of Dispute: ${data.dispute_details}
    - Amount Claimed (if any): ₹${data.amount || 'N/A'}
    - Response Deadline: ${data.deadline} days
    
    Formal legal notice format under Indian law. Include proper legal language, demand, consequence of non-compliance.`
};

async function generateDocument(docType, formData) {
  const user = auth.currentUser;
  if (!user) { showToast('❌ Please sign in first', 'error'); return; }

  const userData = await getUserData();
  if (!userData) return;

  // Check plan limits
  if (userData.plan === 'free' && userData.docsGenerated >= 1) {
    showToast('⚡ Upgrade to Pro for unlimited documents!', 'warning');
    window.location.href = 'subscription.html';
    return;
  }

  showGenerating(true);

  try {
    const prompt = DOC_PROMPTS[docType](formData);

    const response = await fetch(CLAUDE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();
    const documentText = data.content[0].text;

    // Save to Firestore
    const docRef = await addDoc(collection(db, 'documents'), {
      userId: user.uid,
      docType,
      formData,
      content: documentText,
      status: 'generated',
      createdAt: serverTimestamp()
    });

    // Update user doc count
    await updateDoc(doc(db, 'users', user.uid), {
      docsGenerated: (userData.docsGenerated || 0) + 1
    });

    showGenerating(false);

    // Store for preview
    sessionStorage.setItem('generatedDoc', JSON.stringify({
      id: docRef.id,
      type: docType,
      content: documentText
    }));

    window.location.href = 'preview.html';
  } catch (err) {
    showGenerating(false);
    console.error(err);
    showToast('❌ Generation failed. Please try again.', 'error');
  }
}

// ===========================
// GET DOCUMENT HISTORY
// ===========================

async function getDocHistory() {
  const user = auth.currentUser;
  if (!user) return [];

  const q = query(
    collection(db, 'documents'),
    where('userId', '==', user.uid),
    orderBy('createdAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

// ===========================
// PDF DOWNLOAD
// ===========================

function downloadAsPDF(content, filename) {
  // Uses browser print to PDF
  const win = window.open('', '_blank');
  win.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${filename}</title>
      <style>
        body { font-family: Georgia, serif; padding: 60px; line-height: 1.8; color: #1a1a1a; font-size: 13px; max-width: 800px; margin: 0 auto; }
        h1, h2, h3 { font-family: Georgia, serif; }
        .header { text-align: center; border-bottom: 2px solid #1a1a1a; padding-bottom: 20px; margin-bottom: 30px; }
        .logo-text { font-size: 12px; color: #666; margin-top: 4px; }
        pre { white-space: pre-wrap; font-family: Georgia, serif; }
        @media print {
          @page { margin: 1in; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div style="font-size:22px; font-weight:bold;">⚖️ MyRight</div>
        <div class="logo-text">Generated by MyRight — myright.app | This document is a template. Consult a lawyer for complex matters.</div>
      </div>
      <pre>${content}</pre>
    </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 500);
}

// ===========================
// SUBSCRIPTION
// ===========================

async function upgradeToPro(planType) {
  // Razorpay integration point
  const user = auth.currentUser;
  if (!user) return;

  const plans = {
    monthly: { amount: 49900, name: 'Pro Monthly' },
    yearly: { amount: 399900, name: 'Pro Yearly' }
  };

  const plan = plans[planType];

  // Initialize Razorpay
  const options = {
    key: 'YOUR_RAZORPAY_KEY',
    amount: plan.amount,
    currency: 'INR',
    name: 'MyRight',
    description: plan.name,
    image: '../icons/icon-192.png',
    prefill: {
      name: user.displayName,
      email: user.email
    },
    theme: { color: '#c9a84c' },
    handler: async (response) => {
      // Payment success — update Firestore
      await updateDoc(doc(db, 'users', user.uid), {
        plan: planType,
        planStartDate: serverTimestamp(),
        razorpayPaymentId: response.razorpay_payment_id
      });
      showToast('🎉 You are now a Pro member!', 'success');
      setTimeout(() => window.location.href = 'dashboard.html', 1500);
    }
  };

  const rzp = new Razorpay(options);
  rzp.open();
}

// ===========================
// HELPERS
// ===========================

function showLoading(state) {
  const btn = document.querySelector('.btn-submit');
  if (btn) {
    btn.disabled = state;
    btn.textContent = state ? 'Please wait...' : btn.dataset.text;
  }
}

function showGenerating(state) {
  const overlay = document.querySelector('.generating-overlay');
  if (overlay) overlay.classList.toggle('show', state);
}

function showError(msg) {
  const errEl = document.querySelector('.form-error');
  if (errEl) {
    errEl.textContent = msg;
    errEl.classList.add('show');
    setTimeout(() => errEl.classList.remove('show'), 4000);
  }
}

function showToast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', warning: '⚡', info: 'ℹ️' };
  let toast = document.querySelector('.toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<span class="toast-icon">${icons[type]}</span> ${msg}`;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function getFirebaseError(code) {
  const errors = {
    'auth/email-already-in-use': 'This email is already registered.',
    'auth/invalid-email': 'Invalid email address.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/wrong-password': 'Incorrect password.',
    'auth/too-many-requests': 'Too many attempts. Please try again later.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.'
  };
  return errors[code] || 'Something went wrong. Please try again.';
}

function formatDocType(type) {
  const names = {
    rent_agreement: 'Rent Agreement',
    nda: 'NDA Agreement',
    partnership_deed: 'Partnership Deed',
    employment_letter: 'Employment Letter',
    freelance_agreement: 'Freelance Agreement',
    legal_notice: 'Legal Notice',
    affidavit: 'Affidavit',
    poa: 'Power of Attorney',
    sale_agreement: 'Sale Agreement',
    leave_license: 'Leave & License'
  };
  return names[type] || type;
}

// Export for use in pages
window.MyRight = {
  signUp, signIn, signInWithGoogle, logout,
  getUserData, generateDocument, getDocHistory,
  downloadAsPDF, upgradeToPro, showToast, formatDocType
};

// ===========================
// MAIN.JS — Landing page interactions
// ===========================

document.addEventListener('DOMContentLoaded', () => {
  // Scroll animations
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.style.animation = 'fadeUp 0.6s ease both';
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.doc-card, .step, .trust-item, .plan-card').forEach(el => {
    el.style.opacity = '0';
    observer.observe(el);
  });

  // Smooth anchor scroll
  document.querySelectorAll('a[href^="#"]').forEach(a => {
    a.addEventListener('click', e => {
      e.preventDefault();
      const target = document.querySelector(a.getAttribute('href'));
      if (target) target.scrollIntoView({ behavior: 'smooth' });
    });
  });
});

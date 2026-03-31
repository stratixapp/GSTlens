// ===========================
// MYRIGHT — SHARED FIREBASE CONFIG
// Replace these values with your actual Firebase project settings
// from https://console.firebase.google.com
// ===========================

export const firebaseConfig = {
  apiKey: "AIzaSyAkq3f19TALpHQ89CoALb-4z18-Lz_Jndc",
  authDomain: "my-right-a4982.firebaseapp.com",
  projectId: "my-right-a4982",
  storageBucket: "my-right-a4982.firebasestorage.app",
  messagingSenderId: "522849413367",
  appId: "1:522849413367:web:ede20dd4876808da390bf2"
};

// ===========================
// GUEST / SKIP LOGIN
// Users who click "Skip" get a guest session stored in localStorage.
// They can generate documents but cannot save history.
// ===========================

export function setGuestMode() {
  localStorage.setItem('mr_guest', '1');
}

export function isGuest() {
  return localStorage.getItem('mr_guest') === '1';
}

export function clearGuest() {
  localStorage.removeItem('mr_guest');
}

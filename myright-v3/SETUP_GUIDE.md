# MyRight v2 — Setup Guide

## 🔥 Step 1: Firebase Setup

1. Go to https://console.firebase.google.com
2. Create a new project called "myright"
3. Enable **Authentication** → Sign-in methods:
   - ✅ Email/Password
   - ✅ Google
4. Enable **Firestore Database** → Start in production mode
5. Go to Project Settings → General → Your apps → Add web app
6. Copy the firebaseConfig object

## 🔧 Step 2: Replace Firebase Config

Search for `YOUR_API_KEY` in ALL HTML files and replace with your config.
Files to update:
- `pages/login.html`
- `pages/signup.html`
- `pages/dashboard.html`
- `pages/generate.html`
- `pages/history.html`
- `pages/profile.html`
- `pages/subscription.html`
- `pages/forgot.html`

Replace the firebaseConfig block in each with yours:
```js
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "your-app-id"
};
```

## 🛡️ Step 3: Firestore Security Rules

In Firebase Console → Firestore → Rules, paste:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /documents/{docId} {
      allow read, write: if request.auth != null && 
        (resource == null || resource.data.userId == request.auth.uid);
    }
  }
}
```

## 💳 Step 4: Razorpay Payments (Optional)

1. Sign up at https://razorpay.com
2. Get your Key ID from Dashboard → Settings → API Keys
3. In `pages/subscription.html`, replace `YOUR_RAZORPAY_KEY_ID`

## 🤖 Step 5: Anthropic AI (Optional)

The generate.html calls the Anthropic Claude API to generate documents.
To enable real AI generation, you need a server-side proxy (for security — never expose API keys in frontend).

For testing, the app includes a fallback template generator that works without AI.

## 📱 Step 6: PWA / Play Store

This app is Play Store-ready via Trusted Web Activity (TWA):
1. Deploy to a domain with HTTPS
2. Use Bubblewrap (https://github.com/GoogleChromeLabs/bubblewrap) to generate APK
3. Upload to Play Store

Icons are already generated at all required sizes in /icons/

## 🚀 Step 7: Deploy

Deploy to Firebase Hosting:
```bash
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```

Or deploy to any static hosting (Netlify, Vercel, Cloudflare Pages).

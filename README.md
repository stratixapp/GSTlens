# GST Lens by Stratix — Play Store Deployment Guide

## Live App Pages
- `index.html` — Main app
- `privacy.html` — Privacy Policy (required for Play Store)
- `terms.html` — Terms of Service (required for Play Store)
- `about.html` — About page
- `support.html` — Support & feedback (stratixapp@gmail.com)

## Deploy to GitHub Pages
```bash
git init
git add .
git commit -m "GST Lens v5"
git remote add origin https://github.com/yourname/gstlens.git
git push -u origin main
```
Settings → Pages → main → / (root) → Save

## Firebase Setup
1. Firebase Console → Auth → Sign-in method → Enable Google
2. Auth → Settings → Authorised Domains → Add your GitHub Pages domain
3. Firestore → Create database → Production mode → asia-south1
4. Firestore → Rules → paste firestore.rules content → Publish
5. Storage → Get started → Rules → paste storage.rules → Publish

## Play Store (TWA) — Step by Step
```bash
npm install -g @bubblewrap/cli
bubblewrap init --manifest https://yourdomain/manifest.json
bubblewrap build
```
Generated file: `app-release-bundle.aab` → upload to Google Play Console

## Get SHA-256 Fingerprint
```bash
keytool -list -v -keystore ./android.keystore
```
Paste SHA-256 into `.well-known/assetlinks.json` → push to GitHub

## Play Store Listing Requirements
- Privacy Policy URL: `https://yourdomain/privacy.html`
- Support email: `stratixapp@gmail.com`
- App category: Finance
- Content rating: Everyone
- Target audience: 18+ (businesses)

## Package Name
`in.gstlens.app`

# Bug Report: extractDateFromFilename Not Defined

**Date:** 2026-06-12  
**Project:** LESAVI-SURAMADU  
**File:** artifacts/lesavi-dashboard/src/features/import/ImportPage.tsx

---

## Error Description

\`\`\`
Uncaught ReferenceError: extractDateFromFilename is not defined
    at index-nL6joWzf.js:150:61903
\`\`\`

---

## Root Causes

### 1. Code Bug: Duplicate Variable Declaration

File ImportPage.tsx memiliki bug di function extractDateFromFilename:

- const match2 dideklarasikan 2x
- if (match1) padahal harusnya if (match2)

### 2. Tree-shaking Issue

Function tidak masuk bundle karena:
- Function adalah local function (tidak di-export)
- Vite build mengasumsikan function tidak digunakan secara sync
- Function dipanggil di async callback

---

## Solutions Applied

### Fix 1: Pindahkan function ke App.tsx sebagai global

window.extractDateFromFilename function ditambahkan di App.tsx

### Fix 2: Update semua pemanggilan function

Semua extractDateFromFilename(改为 window.extractDateFromFilename(

---

## Prevention Guidelines

### 1. Selalu Export Helper Functions
Buat utility file di src/lib/ jika function digunakan multiple tempat

### 2. Hindari Duplicate Variable Names
Gunakan nama yang jelas dan unik

### 3. Build & Test After Changes
Selalu build dan cek function ada di bundle sebelum deploy

### 4. Checklist Sebelum Deploy
- Build sukses
- Function ada di bundle
- PM2 restarted
- Test fitur

---

## Build Command Reference

\`\`\`bash
cd /home/ivalora/LESAVI-SURAMADU/artifacts/lesavi-dashboard
node node_modules/vite/bin/vite.js build
pm2 restart lesavi-suramadu-8081
\`\`\`

---

**Last Updated:** 2026-06-12 04:30 WIB

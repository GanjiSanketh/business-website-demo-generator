#!/usr/bin/env node
/**
 * Diagnostic script: tests Firestore write with aggressive timeouts
 * to pinpoint exactly where the operation hangs.
 */

const fs = require('fs');
const path = require('path');

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`TIMEOUT after ${ms}ms: ${label}`)), ms)
    ),
  ]);
}

async function main() {
  // ── Load Firebase config ──
  const configPath = path.resolve(__dirname, '..', 'public', 'env-config.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  const firebaseConfig = {
    apiKey: raw.FIREBASE_API_KEY,
    authDomain: raw.FIREBASE_AUTH_DOMAIN,
    projectId: raw.FIREBASE_PROJECT_ID,
    storageBucket: raw.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: raw.FIREBASE_MESSAGING_SENDER_ID,
    appId: raw.FIREBASE_APP_ID,
  };

  console.log('[SAMPLE] Config loaded. Project:', firebaseConfig.projectId);
  console.log('[SAMPLE] Auth domain:', firebaseConfig.authDomain);

  // ── Import Firebase ──
  console.log('[SAMPLE] Importing Firebase modules...');
  const { initializeApp } = await import('firebase/app');
  const {
    getFirestore,
    collection,
    doc,
    addDoc,
    getDoc,
    getDocs,
    query,
    where,
    Timestamp,
  } = await import('firebase/firestore');
  console.log('[SAMPLE] Firebase modules imported.');

  // ── Initialize app ──
  console.log('[SAMPLE] Initializing Firebase app...');
  const app = initializeApp(firebaseConfig);
  console.log('[SAMPLE] App initialized. Getting Firestore...');

  const db = getFirestore(app);
  console.log('[SAMPLE] Firestore instance obtained.');

  // ── Test 1: Simple read (count documents) ──
  console.log('\n[SAMPLE] === TEST 1: Read collection ===');
  try {
    console.log('[SAMPLE] Querying businesses collection...');
    const snap = await withTimeout(
      getDocs(collection(db, 'businesses')),
      10000,
      'getDocs(collection)'
    );
    console.log('[SAMPLE] ✅ Read succeeded. Documents:', snap.size);
  } catch (err) {
    console.error('[SAMPLE] ❌ Read failed:', err.message);
    if (err.code) console.error('[SAMPLE] Error code:', err.code);
  }

  // ── Test 2: Simple write ──
  console.log('\n[SAMPLE] === TEST 2: Write document ===');
  try {
    const now = Timestamp.now();
    const data = {
      businessName: 'Test Salon',
      category: 'Salon',
      templateId: 'salon-01',
      tagline: 'Your Style. Your Moment.',
      description: 'A modern salon offering professional beauty and styling services.',
      phone: '9855474123',
      whatsapp: '9855471256',
      address: 'Hitech City',
      services: ['Haircut', 'Hair Styling', 'Hair Coloring', 'Facial', 'Bridal Makeup'],
      slug: 'test-salon',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    console.log('[SAMPLE] addDoc starting...');
    const docRef = await withTimeout(
      addDoc(collection(db, 'businesses'), data),
      15000,
      'addDoc'
    );
    console.log('[SAMPLE] ✅ Write succeeded. Document ID:', docRef.id);

    // ── Test 3: Verify ──
    console.log('\n[SAMPLE] === TEST 3: Verify document ===');
    const verifySnap = await withTimeout(
      getDoc(doc(db, 'businesses', docRef.id)),
      10000,
      'getDoc(verify)'
    );
    if (verifySnap.exists()) {
      console.log('[SAMPLE] ✅ Verification passed. Document exists in Firestore.');
      console.log('[SAMPLE] businessName:', verifySnap.data().businessName);
      console.log('[SAMPLE] status:', verifySnap.data().status);
      console.log('[SAMPLE] slug:', verifySnap.data().slug);
    } else {
      console.error('[SAMPLE] ❌ Document not found after creation!');
    }
  } catch (err) {
    console.error('[SAMPLE] ❌ Write/verify failed:', err.message);
    if (err.code) console.error('[SAMPLE] Error code:', err.code);
    if (err.stack) console.error('[SAMPLE] Stack:', err.stack?.substring(0, 500));
  }

  // ── Test 4: Count ──
  console.log('\n[SAMPLE] === TEST 4: Count documents ===');
  try {
    const allSnap = await withTimeout(
      getDocs(collection(db, 'businesses')),
      10000,
      'getDocs(count)'
    );
    console.log('[SAMPLE] ✅ Total businesses:', allSnap.size);
    allSnap.forEach((d) => {
      const data = d.data();
      console.log(`  - ${data.businessName} (${data.status}) [${d.id}]`);
    });
  } catch (err) {
    console.error('[SAMPLE] ❌ Count failed:', err.message);
  }

  console.log('\n[SAMPLE] All tests complete.');
}

main().catch((err) => {
  console.error('[SAMPLE] FATAL:', err.message || err);
  process.exit(1);
});

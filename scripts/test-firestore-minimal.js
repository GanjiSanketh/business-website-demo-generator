#!/usr/bin/env node
/**
 * Minimal diagnostic: isolate exactly where Firebase hangs.
 * Tests each step individually with timeouts.
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

function log(msg) {
  const ts = new Date().toISOString().substring(11, 23);
  console.log(`[${ts}] ${msg}`);
}

async function main() {
  // Step 1: Load config
  log('STEP 1: Loading env-config.json...');
  const configPath = path.resolve(__dirname, '..', 'public', 'env-config.json');
  const raw = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  log('STEP 1: Config loaded. Project: ' + raw.FIREBASE_PROJECT_ID);

  // Step 2: Import firebase/app
  log('STEP 2: Importing firebase/app...');
  const { initializeApp } = await withTimeout(
    import('firebase/app'),
    15000,
    'import firebase/app'
  );
  log('STEP 2: firebase/app imported.');

  // Step 3: Import firebase/firestore
  log('STEP 3: Importing firebase/firestore...');
  const firestore = await withTimeout(
    import('firebase/firestore'),
    15000,
    'import firebase/firestore'
  );
  log('STEP 3: firebase/firestore imported. Exports:', Object.keys(firestore).join(', '));

  // Step 4: Initialize app
  log('STEP 4: Calling initializeApp...');
  const app = initializeApp({
    apiKey: raw.FIREBASE_API_KEY,
    authDomain: raw.FIREBASE_AUTH_DOMAIN,
    projectId: raw.FIREBASE_PROJECT_ID,
    storageBucket: raw.FIREBASE_STORAGE_BUCKET,
    messagingSenderId: raw.FIREBASE_MESSAGING_SENDER_ID,
    appId: raw.FIREBASE_APP_ID,
  });
  log('STEP 4: initializeApp done.');

  // Step 5: Get Firestore instance
  log('STEP 5: Calling getFirestore...');
  const db = firestore.getFirestore(app);
  log('STEP 5: getFirestore done.');

  // Step 6: Try a simple collection reference
  log('STEP 6: Creating collection reference...');
  const colRef = firestore.collection(db, 'businesses');
  log('STEP 6: collection() done. type:', typeof colRef);

  // Step 7: Try getDocs (read)
  log('STEP 7: Calling getDocs (read)...');
  try {
    const snap = await withTimeout(firestore.getDocs(colRef), 15000, 'getDocs');
    log('STEP 7: getDocs succeeded. Size: ' + snap.size);
  } catch (err) {
    log('STEP 7: ❌ getDocs FAILED: ' + err.message);
    if (err.code) log('  Error code: ' + err.code);
  }

  // Step 8: Try addDoc (write)
  log('STEP 8: Calling addDoc (write)...');
  try {
    const now = firestore.Timestamp.now();
    const docRef = await withTimeout(
      firestore.addDoc(firestore.collection(db, 'businesses'), {
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
      }),
      15000,
      'addDoc'
    );
    log('STEP 8: ✅ addDoc succeeded. Document ID: ' + docRef.id);

    // Step 9: Verify
    log('STEP 9: Verifying document...');
    const verifySnap = await withTimeout(
      firestore.getDoc(firestore.doc(db, 'businesses', docRef.id)),
      15000,
      'getDoc(verify)'
    );
    if (verifySnap.exists()) {
      log('STEP 9: ✅ Document verified. businessName: ' + verifySnap.data().businessName);
    } else {
      log('STEP 9: ❌ Document not found after creation!');
    }
  } catch (err) {
    log('STEP 8: ❌ addDoc FAILED: ' + err.message);
    if (err.code) log('  Error code: ' + err.code);
  }

  log('DONE');
  process.exit(0);
}

main().catch((err) => {
  log('FATAL: ' + (err.message || err));
  process.exit(1);
});

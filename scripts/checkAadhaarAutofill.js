const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function run() {
  const root = path.resolve(__dirname, '..');
  const indexHtml = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const appJs = fs.readFileSync(path.join(root, 'public', 'app.js'), 'utf8');

  // Regression guard 1: Aadhaar input should be editable (not readonly).
  const aadhaarInputMatch = indexHtml.match(/<input\s+id="applyAadhaar"[^>]*>/i);
  assert(aadhaarInputMatch, 'applyAadhaar input not found in index.html');
  assert(!/\sreadonly(\s|>|=)/i.test(aadhaarInputMatch[0]), 'applyAadhaar input must not be readonly');

  // Regression guard 2: Scanned docs flow should invoke Aadhaar autofill helper.
  assert(
    appJs.includes('applyDetectedAadhaarDetails();'),
    'Expected applyDetectedAadhaarDetails() call in scanSupportingDocuments flow'
  );

  // Regression guard 3: Manual scan fallback should still use scanned row helper.
  assert(
    appJs.includes('bestAadhaarFromRow(scannedRow)'),
    'Expected bestAadhaarFromRow(scannedRow) usage in manual scan fallback'
  );

  console.log('Aadhaar autofill regression checks passed.');
}

try {
  run();
} catch (err) {
  console.error(err.message || err);
  process.exit(1);
}

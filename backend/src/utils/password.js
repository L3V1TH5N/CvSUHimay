// file path: backend/src/utils/password.js
//
// Fix 11: checkPasswordPolicy extracted from routes/auth.js into a utility module.
// Importing between route files creates tight coupling; utilities belong in utils/.
// Both auth.js and profile.js now import from here.

'use strict';

function checkPasswordPolicy(pw) {
  const errs = [];
  if (!pw || pw.length < 8)  errs.push('At least 8 characters');
  if (!/[A-Za-z]/.test(pw)) errs.push('At least one letter');
  if (!/\d/.test(pw))       errs.push('At least one digit');
  return errs;
}

module.exports = { checkPasswordPolicy };

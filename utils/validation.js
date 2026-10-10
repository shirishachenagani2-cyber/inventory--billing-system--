function isPositiveId(value) {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

// Accept a non-negative decimal with at most 2 fractional digits.
// Keep the original string for MySQL DECIMAL columns.
function isMoney(value) {
  return /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(String(value));
}

module.exports = { isPositiveId, isNonNegativeInteger, isMoney };

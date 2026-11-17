import Decimal from 'decimal.js';

// Configure Decimal.js for financial accuracy
Decimal.set({ precision: 28, rounding: Decimal.ROUND_HALF_UP });

export const ROUNDING_TOLERANCE = new Decimal('0.05'); // ₹0.05 (5 paise)
export const BASE_CURRENCY = 'INR';

/**
 * Clean monetary input and convert safely to Decimal.
 * Handles strings like "₹1,250.50", "1250.50", "-50", "(50.00)"
 */
export function toDecimal(val) {
  if (val === undefined || val === null || val === '') {
    return new Decimal(0);
  }
  if (val instanceof Decimal) {
    return val;
  }
  let str = String(val).trim();
  
  // Handle accounting parentheses negative format, e.g. "(50.00)"
  let isNegative = false;
  if (str.startsWith('(') && str.endsWith(')')) {
    isNegative = true;
    str = str.slice(1, -1);
  }
  
  // Strip currency symbols (₹, $, €, £), commas, and spaces
  const cleanStr = str.replace(/[^0-9.-]/g, '');
  if (!cleanStr || cleanStr === '-' || isNaN(Number(cleanStr))) {
    return new Decimal(0);
  }
  
  const result = new Decimal(cleanStr);
  return isNegative ? result.negated() : result;
}

/**
 * Format Decimal to 2 decimal places string
 */
export function formatINR(val) {
  return toDecimal(val).toFixed(2);
}

/**
 * Difference between two amounts: a - b
 */
export function safeDelta(a, b) {
  return toDecimal(a).minus(toDecimal(b));
}

/**
 * Parse an ISO date or date string to a normalized UTC Date object
 */
export function parseUTCDate(dateVal) {
  if (!dateVal) return null;
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return null;
  return d;
}

/**
 * Calculate difference in whole days: DateB - DateA (in UTC)
 */
export function dateDiffInDays(dateA, dateB) {
  const da = parseUTCDate(dateA);
  const db = parseUTCDate(dateB);
  if (!da || !db) return 0;
  
  const utc1 = Date.UTC(da.getUTCFullYear(), da.getUTCMonth(), da.getUTCDate());
  const utc2 = Date.UTC(db.getUTCFullYear(), db.getUTCMonth(), db.getUTCDate());
  
  return Math.floor((utc2 - utc1) / (1000 * 60 * 60 * 24));
}

/**
 * Normalized monthly period index: (Year * 12) + Month
 * Enables cross-year continuous comparison (e.g., Dec 2026 -> Jan 2027 gives +1)
 */
export function getPeriodIndex(dateVal) {
  const d = parseUTCDate(dateVal);
  if (!d) return 0;
  return (d.getUTCFullYear() * 12) + d.getUTCMonth();
}

/**
 * Format period string "YYYY-MM"
 */
export function getPeriodStr(dateVal) {
  const d = parseUTCDate(dateVal);
  if (!d) return 'UNKNOWN';
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${d.getUTCFullYear()}-${month}`;
}

/**
 * Calculate month lag between two dates: DateB period - DateA period
 */
export function monthLag(dateA, dateB) {
  return getPeriodIndex(dateB) - getPeriodIndex(dateA);
}


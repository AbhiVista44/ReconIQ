import Papa from 'papaparse';
import { BASE_CURRENCY, parseUTCDate, toDecimal } from '../utils/finance.js';

/**
 * Clean CSV header name
 */
function normalizeHeader(header) {
  return String(header || '')
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, '') // Strip UTF-8 BOM
    .replace(/[^a-z0-9_]/g, '_');
}

/**
 * Parse raw CSV string or buffer into normalized row objects
 */
export function parseCSV(csvContent) {
  const content = typeof csvContent === 'string' ? csvContent : csvContent.toString('utf8');
  const result = Papa.parse(content, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: normalizeHeader
  });

  return result.data;
}

/**
 * Validate and partition Payment Gateway records.
 * Preserves invalid rows and quarantines unsupported currencies.
 */
export function validatePaymentRows(rawRows) {
  const validRows = [];
  const invalidRows = [];
  const unsupportedCurrencyRows = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2; // Accounting for 1-based index and header
    const errors = [];

    const txnId = (row.transaction_id || row.txn_id || '').trim();
    const orderId = (row.order_id || '').trim();
    const txnDate = (row.transaction_date || row.date || '').trim();
    const type = (row.type || 'PAYMENT').trim().toUpperCase();
    const originalTxnId = (row.original_txn_id || row.parent_txn_id || '').trim();
    const rawAmount = String(row.amount || '').trim();
    const currency = (row.currency || BASE_CURRENCY).trim().toUpperCase();
    const status = (row.status || 'SUCCESS').trim().toUpperCase();

    if (!txnId) errors.push("Missing required field 'transaction_id'");
    if (!txnDate || !parseUTCDate(txnDate)) errors.push(`Invalid or unparseable 'transaction_date': '${txnDate}'`);
    const cleanAmountStr = rawAmount.replace(/[^0-9.-]/g, '');
    if (!rawAmount || !cleanAmountStr || cleanAmountStr === '-' || cleanAmountStr === '.' || isNaN(Number(cleanAmountStr))) {
      errors.push(`Invalid monetary value for 'amount': '${rawAmount}'`);
    }

    if (errors.length > 0) {
      invalidRows.push({
        dataset: 'PAYMENT_GATEWAY',
        row_number: rowNumber,
        raw_data: row,
        validation_errors: errors,
        remediation: 'Verify source gateway export format and rectify field values.'
      });
      return;
    }

    if (currency !== BASE_CURRENCY) {
      unsupportedCurrencyRows.push({
        dataset: 'PAYMENT_GATEWAY',
        row_number: rowNumber,
        transaction_id: txnId,
        currency,
        raw_data: row,
        reason: `Currency '${currency}' does not match assessment base currency '${BASE_CURRENCY}'.`
      });
      return;
    }

    validRows.push({
      row_number: rowNumber,
      transaction_id: txnId,
      order_id: orderId,
      transaction_date: txnDate,
      type: type === 'REFUND' ? 'REFUND' : 'PAYMENT',
      original_txn_id: originalTxnId,
      raw_amount: rawAmount,
      amount: toDecimal(rawAmount),
      currency,
      status
    });
  });

  return { validRows, invalidRows, unsupportedCurrencyRows };
}

/**
 * Validate and partition Bank Settlement records.
 * Preserves invalid rows and quarantines unsupported currencies.
 */
export function validateBankRows(rawRows) {
  const validRows = [];
  const invalidRows = [];
  const unsupportedCurrencyRows = [];

  rawRows.forEach((row, index) => {
    const rowNumber = index + 2;
    const errors = [];

    const settlementId = (row.settlement_id || row.id || '').trim();
    const bankReference = (row.bank_reference || row.reference_id || row.ref || '').trim();
    const settlementDate = (row.settlement_date || row.date || '').trim();
    const rawGross = String(row.gross_amount || row.gross || '').trim();
    const rawFee = String(row.fee_amount || row.fee || '0').trim();
    const rawNet = String(row.net_amount || row.net || '').trim();
    const currency = (row.currency || BASE_CURRENCY).trim().toUpperCase();
    const status = (row.settlement_status || row.status || 'SETTLED').trim().toUpperCase();

    if (!settlementId) errors.push("Missing required field 'settlement_id'");
    if (!settlementDate || !parseUTCDate(settlementDate)) {
      errors.push(`Invalid or unparseable 'settlement_date': '${settlementDate}'`);
    }
    const cleanGrossStr = rawGross.replace(/[^0-9.-]/g, '');
    if (!rawGross || !cleanGrossStr || cleanGrossStr === '-' || cleanGrossStr === '.' || isNaN(Number(cleanGrossStr))) {
      errors.push(`Invalid monetary value for 'gross_amount': '${rawGross}'`);
    }

    if (errors.length > 0) {
      invalidRows.push({
        dataset: 'BANK_SETTLEMENT',
        row_number: rowNumber,
        raw_data: row,
        validation_errors: errors,
        remediation: 'Inspect bank settlement file and populate mandatory fields.'
      });
      return;
    }

    if (currency !== BASE_CURRENCY) {
      unsupportedCurrencyRows.push({
        dataset: 'BANK_SETTLEMENT',
        row_number: rowNumber,
        settlement_id: settlementId,
        currency,
        raw_data: row,
        reason: `Currency '${currency}' does not match assessment base currency '${BASE_CURRENCY}'.`
      });
      return;
    }

    const grossDec = toDecimal(rawGross);
    const feeDec = toDecimal(rawFee);
    const netDec = rawNet ? toDecimal(rawNet) : grossDec.minus(feeDec);

    validRows.push({
      row_number: rowNumber,
      settlement_id: settlementId,
      bank_reference: bankReference,
      settlement_date: settlementDate,
      raw_gross: rawGross,
      gross_amount: grossDec,
      fee_amount: feeDec,
      net_amount: netDec,
      currency,
      status
    });
  });

  return { validRows, invalidRows, unsupportedCurrencyRows };
}

import { parseUTCDate } from '../utils/finance.js';

/**
 * Detect and quarantine duplicates in Payment Gateway records.
 * Uses multi-value Map grouping to prevent silent overwriting.
 */
export function detectGatewayDuplicates(validRows) {
  // 1. Group by transaction_id using Array buckets
  const txnIdMap = new Map();
  for (const row of validRows) {
    if (!txnIdMap.has(row.transaction_id)) {
      txnIdMap.set(row.transaction_id, []);
    }
    txnIdMap.get(row.transaction_id).push(row);
  }

  const technicalDuplicates = [];
  const uniqueRows = [];

  for (const [txnId, records] of txnIdMap.entries()) {
    if (records.length > 1) {
      // Quarantine ALL copies with their row numbers and exact timestamps
      records.forEach((rec, idx) => {
        technicalDuplicates.push({
          ...rec,
          duplicate_category: 'TECHNICAL_DUPLICATE_TXN_ID',
          duplicate_group_id: txnId,
          occurrence_index: idx + 1,
          total_occurrences: records.length,
          severity: 'HIGH',
          explanation: `Transaction ID '${txnId}' appears ${records.length} times in gateway records (Row ${rec.row_number}).`,
          remediation: 'Quarantine and review idempotent webhook delivery or database retry logs.'
        });
      });
    } else {
      uniqueRows.push(records[0]);
    }
  }

  // 2. Secondary check on uniqueRows: Detect suspected double-captures vs legitimate repeat orders
  // Group by (order_id + amount)
  const orderAmountMap = new Map();
  for (const row of uniqueRows) {
    if (row.order_id) {
      const key = `${row.order_id}_${row.amount.toFixed(2)}`;
      if (!orderAmountMap.has(key)) {
        orderAmountMap.set(key, []);
      }
      orderAmountMap.get(key).push(row);
    }
  }

  const suspectedDoubleCaptures = [];
  for (const [key, records] of orderAmountMap.entries()) {
    if (records.length > 1) {
      // Sort chronologically
      records.sort((a, b) => parseUTCDate(a.transaction_date) - parseUTCDate(b.transaction_date));
      for (let i = 0; i < records.length - 1; i++) {
        const t1 = parseUTCDate(records[i].transaction_date);
        const t2 = parseUTCDate(records[i + 1].transaction_date);
        const diffSeconds = Math.abs((t2 - t1) / 1000);

        if (diffSeconds <= 60) {
          // Suspected rapid double capture / double click
          suspectedDoubleCaptures.push({
            primary_txn_id: records[i].transaction_id,
            duplicate_txn_id: records[i + 1].transaction_id,
            order_id: records[i].order_id,
            amount: records[i].amount.toFixed(2),
            time_difference_seconds: diffSeconds,
            severity: 'MEDIUM',
            explanation: `Transactions '${records[i].transaction_id}' and '${records[i + 1].transaction_id}' share order '${records[i].order_id}' and amount ₹${records[i].amount.toFixed(2)} within ${diffSeconds} seconds. Suspected accidental double capture.`,
            remediation: 'Inspect merchant checkout logs. Confirm if customer was double-charged.'
          });
        }
      }
    }
  }

  return {
    uniqueRows,
    technicalDuplicates,
    suspectedDoubleCaptures
  };
}

/**
 * Detect and quarantine duplicates in Bank Settlement records.
 */
export function detectBankDuplicates(validRows) {
  const settlementIdMap = new Map();
  for (const row of validRows) {
    if (!settlementIdMap.has(row.settlement_id)) {
      settlementIdMap.set(row.settlement_id, []);
    }
    settlementIdMap.get(row.settlement_id).push(row);
  }

  const technicalDuplicates = [];
  const uniqueRows = [];

  for (const [settlementId, records] of settlementIdMap.entries()) {
    if (records.length > 1) {
      records.forEach((rec, idx) => {
        technicalDuplicates.push({
          ...rec,
          duplicate_category: 'TECHNICAL_DUPLICATE_SETTLEMENT_ID',
          duplicate_group_id: settlementId,
          occurrence_index: idx + 1,
          total_occurrences: records.length,
          severity: 'HIGH',
          explanation: `Settlement ID '${settlementId}' appears ${records.length} times in bank settlement records (Row ${rec.row_number}).`,
          remediation: 'Quarantine and verify bank clearing batch report for duplicate file ingestion.'
        });
      });
    } else {
      uniqueRows.push(records[0]);
    }
  }

  // Check for duplicate bank references with identical gross amount
  const bankRefMap = new Map();
  for (const row of uniqueRows) {
    if (row.bank_reference) {
      const key = `${row.bank_reference}_${row.gross_amount.toFixed(2)}`;
      if (!bankRefMap.has(key)) {
        bankRefMap.set(key, []);
      }
      bankRefMap.get(key).push(row);
    }
  }

  const duplicateBankReferences = [];
  for (const [key, records] of bankRefMap.entries()) {
    if (records.length > 1) {
      records.forEach((rec, idx) => {
        duplicateBankReferences.push({
          ...rec,
          duplicate_category: 'DUPLICATE_BANK_REFERENCE',
          duplicate_group_id: rec.bank_reference,
          occurrence_index: idx + 1,
          total_occurrences: records.length,
          severity: 'HIGH',
          explanation: `Bank reference '${rec.bank_reference}' appears ${records.length} times with identical gross amount ₹${rec.gross_amount.toFixed(2)}.`,
          remediation: 'Verify whether the acquiring bank duplicate-credited the settlement batch.'
        });
      });
    }
  }

  return {
    uniqueRows,
    technicalDuplicates,
    duplicateBankReferences
  };
}


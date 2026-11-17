import test from 'node:test';
import assert from 'node:assert/strict';
import Decimal from 'decimal.js';
import { runReconciliationPipeline } from '../src/services/reconciliationOrchestrator.js';
import { generateSyntheticReconciliationData } from '../src/services/syntheticData.js';
import { safeDelta, toDecimal, formatINR, monthLag } from '../src/utils/finance.js';

test('ReconIQ Suite 1: Financial Arithmetic & Decimal.js Precision', async (t) => {
  await t.test('Eliminates IEEE 754 floating point errors', () => {
    // Native JS float hazard: 0.1 + 0.2 === 0.30000000000000004
    const a = toDecimal('0.1');
    const b = toDecimal('0.2');
    const sum = a.plus(b);
    assert.equal(sum.toString(), '0.3', '0.1 + 0.2 must equal exact 0.3');
    assert.equal(sum.equals(new Decimal('0.3')), true);

    // Negative subtraction: 150.00 - 149.98
    const delta = safeDelta('150.00', '149.98');
    assert.equal(delta.toFixed(2), '0.02', '150.00 - 149.98 must equal exact 0.02');
  });

  await t.test('Handles currency symbols, commas, and negative formats correctly', () => {
    assert.equal(formatINR('₹1,250.50'), '1250.50');
    assert.equal(formatINR('(50.00)'), '-50.00');
    assert.equal(formatINR('-₹500.00'), '-500.00');
    assert.equal(formatINR(''), '0.00');
    assert.equal(formatINR(null), '0.00');
  });

  await t.test('Period indexing handles cross-year month lag seamlessly', () => {
    // Dec 2026 to Jan 2027 must be +1 month
    const lagCrossYear = monthLag('2026-12-31T23:59:59Z', '2027-01-02T10:00:00Z');
    assert.equal(lagCrossYear, 1, 'Dec 2026 -> Jan 2027 must equal +1 month lag');

    // Same month
    const lagSameMonth = monthLag('2026-10-15', '2026-10-20');
    assert.equal(lagSameMonth, 0, 'Same month must equal 0 lag');

    // Oct 2026 to Nov 2026
    const lagNextMonth = monthLag('2026-10-31', '2026-11-02');
    assert.equal(lagNextMonth, 1, 'Oct -> Nov must equal +1 lag');
  });
});

test('ReconIQ Suite 2: Full End-to-End Pipeline on Synthetic Dataset', async (t) => {
  const synthetic = generateSyntheticReconciliationData();
  const result = runReconciliationPipeline({
    paymentSource: synthetic.paymentCsv,
    bankSource: synthetic.bankCsv
  });

  await t.test('TC-01: Clean Match produces exact match with no variance', () => {
    const record = result.audit_records.find(r => r.transaction_id === 'TXN_101');
    assert.ok(record, 'TXN_101 must exist in audit records');
    assert.equal(record.primary_classification, 'CLEAN_MATCH');
    assert.equal(record.gross_variance, '0.00');
    assert.equal(record.severity, 'NONE');
    assert.deepEqual(record.discrepancy_flags, ['CLEAN_MATCH']);
  });

  await t.test('TC-02: Following Month Cutoff is detected across month boundary (Oct 31 -> Nov 02)', () => {
    const record = result.audit_records.find(r => r.transaction_id === 'TXN_102');
    assert.ok(record, 'TXN_102 must exist in audit records');
    assert.equal(record.primary_classification, 'FOLLOWING_MONTH_SETTLEMENT');
    assert.equal(record.month_lag, 1);
    assert.equal(record.gross_variance, '0.00');
    assert.ok(record.discrepancy_flags.includes('FOLLOWING_MONTH_SETTLEMENT'));
  });

  await t.test('TC-03: Rounding Difference alone is detected and added to cumulative drift', () => {
    const record = result.audit_records.find(r => r.transaction_id === 'TXN_103');
    assert.ok(record, 'TXN_103 must exist in audit records');
    assert.equal(record.primary_classification, 'ROUNDING_DIFFERENCE');
    assert.equal(record.gross_variance, '-0.03'); // 799.96 - 799.99 = -0.03
    assert.ok(record.discrepancy_flags.includes('ROUNDING_DIFFERENCE'));
  });

  await t.test('TC-04: Multi-Discrepancy preserves both Following Month AND Rounding Difference flags', () => {
    const record = result.audit_records.find(r => r.transaction_id === 'TXN_104');
    assert.ok(record, 'TXN_104 must exist in audit records');
    assert.equal(record.primary_classification, 'FOLLOWING_MONTH_SETTLEMENT');
    assert.ok(record.discrepancy_flags.includes('FOLLOWING_MONTH_SETTLEMENT'));
    assert.ok(record.discrepancy_flags.includes('ROUNDING_DIFFERENCE'));
    assert.equal(record.gross_variance, '-0.03'); // 1499.97 - 1500.00 = -0.03
  });

  await t.test('TC-05: Material Amount Mismatch (> ₹0.05) is flagged and excluded from cumulative drift', () => {
    const record = result.audit_records.find(r => r.transaction_id === 'TXN_105');
    assert.ok(record, 'TXN_105 must exist in audit records');
    assert.equal(record.primary_classification, 'MATERIAL_AMOUNT_MISMATCH');
    assert.equal(record.gross_variance, '-150.00');
    assert.equal(record.severity, 'HIGH');
  });

  await t.test('TC-06: Strict Parent Refund is verified and linked to TXN_106', () => {
    const verified = result.verified_refunds.find(r => r.transaction_id === 'RF_201');
    assert.ok(verified, 'RF_201 must be in verified refunds');
    assert.equal(verified.parent_txn_id, 'TXN_106');
    assert.equal(verified.magnitude.toFixed(2), '400.00');
  });

  await t.test('TC-07 & TC-08: Orphaned Refunds are strictly caught and quarantined', () => {
    // RF_202 references non-existent parent TXN_GHOST_999
    const ghostOrphan = result.orphaned_refunds.find(r => r.transaction_id === 'RF_202');
    assert.ok(ghostOrphan, 'RF_202 must be flagged as orphaned refund');
    assert.equal(ghostOrphan.discrepancy_type, 'ORPHANED_REFUND');
    assert.equal(ghostOrphan.severity, 'CRITICAL');

    // RF_203 has order_id but missing original_txn_id -> Must be rejected!
    const orderOnlyOrphan = result.orphaned_refunds.find(r => r.transaction_id === 'RF_203');
    assert.ok(orderOnlyOrphan, 'RF_203 with missing original_txn_id must be rejected as orphan');
    assert.equal(orderOnlyOrphan.discrepancy_type, 'ORPHANED_REFUND');
  });

  await t.test('TC-09: Bidirectional Ambiguity (2 payments to 1 bank record) is detected and withheld', () => {
    // TXN_301A and TXN_301B both match STL_301
    const p301A_matched = result.audit_records.find(r => r.transaction_id === 'TXN_301A');
    const p301B_matched = result.audit_records.find(r => r.transaction_id === 'TXN_301B');
    assert.equal(p301A_matched, undefined, 'TXN_301A must not be matched blindly');
    assert.equal(p301B_matched, undefined, 'TXN_301B must not be matched blindly');

    assert.ok(result.ambiguous_matches.length > 0, 'Ambiguous matches must be recorded');
    const hasAmbiguityReport = result.ambiguous_matches.some(
      m => m.id === 'STL_301' || m.id === 'TXN_301A' || m.id === 'TXN_301B'
    );
    assert.equal(hasAmbiguityReport, true, 'Ambiguity report must reference the conflicting records');
  });

  await t.test('TC-10: Technical Duplicates are preserved in audit without Map overwriting', () => {
    const dupRecords = result.duplicates.gateway_technical.filter(d => d.transaction_id === 'TXN_DUP_401');
    assert.equal(dupRecords.length, 2, 'Both duplicate records of TXN_DUP_401 must be preserved');
    assert.equal(dupRecords[0].duplicate_category, 'TECHNICAL_DUPLICATE_TXN_ID');
    assert.equal(dupRecords[1].duplicate_category, 'TECHNICAL_DUPLICATE_TXN_ID');
  });

  await t.test('TC-11: Cross-Year Settlement (Dec 31, 2026 -> Jan 03, 2027) triggers Following Month', () => {
    const record = result.audit_records.find(r => r.transaction_id === 'TXN_601');
    assert.ok(record, 'TXN_601 must exist in audit records');
    assert.equal(record.primary_classification, 'FOLLOWING_MONTH_SETTLEMENT');
    assert.equal(record.month_lag, 1, 'Cross-year period diff must equal 1 month');
  });

  await t.test('TC-12: Legitimate Repeated Orders (> 60s apart) are matched cleanly', () => {
    const repA = result.audit_records.find(r => r.transaction_id === 'TXN_REP_701A');
    const repB = result.audit_records.find(r => r.transaction_id === 'TXN_REP_701B');
    assert.ok(repA, 'TXN_REP_701A must be matched');
    assert.ok(repB, 'TXN_REP_701B must be matched');
    assert.equal(repA.primary_classification, 'CLEAN_MATCH');
    assert.equal(repB.primary_classification, 'CLEAN_MATCH');
  });

  await t.test('Quarantine & Ingestion Validation preserves invalid rows and unsupported currency', () => {
    // Unsupported currency (USD)
    const usdRow = result.quarantine.unsupported_currency.gateway.find(r => r.transaction_id === 'TXN_USD_901');
    assert.ok(usdRow, 'TXN_USD_901 must be quarantined in unsupported_currency');

    // Invalid row (not a valid date, NaN amount)
    const badRow = result.quarantine.invalid_rows.gateway.find(
      r => r.raw_data && r.raw_data.transaction_id === 'TXN_INVALID_999'
    );
    assert.ok(badRow, 'TXN_INVALID_999 must be preserved in invalid_rows');
    assert.ok(badRow.validation_errors.length >= 2, 'Must contain actionable field-level validation errors');
  });

  await t.test('Ledger Invariants & Balance Proofs hold strictly', () => {
    assert.equal(result.invariants.platform_partition_exact, true, 'Platform partition must be exact');
    assert.equal(result.invariants.bank_partition_exact, true, 'Bank partition must be exact');
    assert.equal(result.invariants.bank_internal_gross_net_exact, true, 'Bank Gross = Net + Fees must hold');
    assert.equal(result.invariants.reconciliation_bridge_balanced, true, 'Reconciliation bridge must balance');

    // Check cumulative drift computation: only TC-03 (-0.03) and TC-04 (-0.03) = -0.06
    assert.equal(result.summary.cumulative_rounding_drift, '-0.06');
  });
});


import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}`;
      resolve();
    });
  });
});

test.after(async () => {
  await new Promise((resolve) => {
    server.close(resolve);
  });
});

test('ReconIQ Suite 4: End-to-End Audit & Mandatory Discrepancy Verification', async (t) => {
  let paymentCsv;
  let bankCsv;
  let reconciliationData;

  await t.test('E2E-1: Root welcome and health check endpoints respond', async () => {
    const rootRes = await fetch(`${baseUrl}/`);
    assert.equal(rootRes.status, 200);
    const rootJson = await rootRes.json();
    assert.equal(rootJson.status, 'ACTIVE');

    const healthRes = await fetch(`${baseUrl}/api/health`);
    assert.equal(healthRes.status, 200);
    const healthJson = await healthRes.json();
    assert.equal(healthJson.status, 'UP');
  });

  await t.test('E2E-2: Generate synthetic datasets with embedded anomalies', async () => {
    const res = await fetch(`${baseUrl}/api/reconcile/synthetic-data`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.payment_csv);
    assert.ok(data.bank_csv);
    paymentCsv = data.payment_csv;
    bankCsv = data.bank_csv;
  });

  await t.test('E2E-3: Ingest paired datasets via multipart CSV upload', async () => {
    const formData = new FormData();
    formData.append(
      'payment_file',
      new Blob([paymentCsv], { type: 'text/csv' }),
      'payment_transactions.csv'
    );
    formData.append(
      'bank_file',
      new Blob([bankCsv], { type: 'text/csv' }),
      'bank_settlement.csv'
    );

    const res = await fetch(`${baseUrl}/api/reconcile/upload`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    reconciliationData = body.data;
    assert.ok(reconciliationData.summary);
    assert.ok(reconciliationData.counts);
  });

  await t.test('E2E-4: Verify Mandatory Discrepancy 1 - Transactions settled in following month', () => {
    const followingMonth = reconciliationData.audit_records.filter(r =>
      r.discrepancy_flags.includes('FOLLOWING_MONTH_SETTLEMENT')
    );
    assert.ok(followingMonth.length >= 2, 'Must detect at least 2 following month records');

    // Verify same-year cutoff (TXN_102: Oct 31 -> Nov 02)
    const sameYear = followingMonth.find(r => r.transaction_id === 'TXN_102');
    assert.ok(sameYear, 'TXN_102 must be flagged for following month settlement');
    assert.equal(sameYear.month_lag, 1);
    assert.ok(sameYear.explanation.includes('Lag: 1 month(s)'));

    // Verify cross-year cutoff (TXN_601: Dec 31, 2026 -> Jan 03, 2027)
    const crossYear = followingMonth.find(r => r.transaction_id === 'TXN_601');
    assert.ok(crossYear, 'TXN_601 must be flagged across year boundary');
    assert.equal(crossYear.month_lag, 1);
  });

  await t.test('E2E-5: Verify Mandatory Discrepancy 2 - Rounding differences & cumulative drift', () => {
    const roundingRecords = reconciliationData.audit_records.filter(r =>
      r.discrepancy_flags.includes('ROUNDING_DIFFERENCE')
    );
    assert.ok(roundingRecords.length >= 2, 'Must detect rounding differences');

    // Verify sub-tolerance rounding on TXN_103 (₹799.96 vs ₹799.99 = -₹0.03)
    const txn103 = roundingRecords.find(r => r.transaction_id === 'TXN_103');
    assert.ok(txn103, 'TXN_103 must be flagged for rounding difference');
    assert.equal(txn103.gross_variance, '-0.03');

    // Verify cumulative rounding drift is tracked exactly
    assert.equal(reconciliationData.summary.cumulative_rounding_drift, '-0.06');

    // Verify material mismatch is separated from cumulative drift
    assert.equal(reconciliationData.summary.total_material_variance, '150.00');
  });

  await t.test('E2E-6: Verify Mandatory Discrepancy 3 - Duplicate entries in either dataset', () => {
    // Gateway technical duplicates
    const gatewayDups = reconciliationData.duplicates.gateway_technical;
    assert.ok(gatewayDups.length >= 2, 'Must preserve duplicate gateway entries');
    const hasTxnDup401 = gatewayDups.every(d => d.transaction_id === 'TXN_DUP_401');
    assert.equal(hasTxnDup401, true);

    // Bank technical duplicates
    const bankDups = reconciliationData.duplicates.bank_technical;
    assert.ok(bankDups.length >= 2, 'Must preserve duplicate bank settlements');
    const hasStlDup501 = bankDups.every(d => d.settlement_id === 'STL_DUP_501');
    assert.equal(hasStlDup501, true);
  });

  await t.test('E2E-7: Verify Mandatory Discrepancy 4 - Orphaned refunds without valid parent', () => {
    const orphans = reconciliationData.orphaned_refunds;
    assert.ok(orphans.length >= 2, 'Must quarantine orphaned refunds');

    // RF_202 references non-existent parent
    const ghostOrphan = orphans.find(r => r.transaction_id === 'RF_202');
    assert.ok(ghostOrphan, 'RF_202 must be flagged as orphaned');
    assert.equal(ghostOrphan.severity, 'CRITICAL');

    // RF_203 has order ID only with missing original_txn_id
    const orderOnlyOrphan = orphans.find(r => r.transaction_id === 'RF_203');
    assert.ok(orderOnlyOrphan, 'RF_203 must be rejected as orphaned (order ID alone rejected)');
  });

  await t.test('E2E-8: Verify Financial Balances & Mathematical Ledger Invariants', () => {
    const inv = reconciliationData.invariants;
    assert.equal(inv.platform_partition_exact, true, 'Platform partition must be exact');
    assert.equal(inv.bank_partition_exact, true, 'Bank partition must be exact');
    assert.equal(inv.bank_internal_gross_net_exact, true, 'Bank Gross = Net + Fees must hold');
    assert.equal(inv.reconciliation_bridge_balanced, true, 'Reconciliation bridge must balance');

    // Zero float leakage check: all volumes are valid numeric decimal strings
    const summary = reconciliationData.summary;
    assert.ok(!isNaN(parseFloat(summary.platform_gross_volume)));
    assert.ok(!isNaN(parseFloat(summary.bank_gross_volume)));
    assert.ok(!isNaN(parseFloat(summary.bank_net_volume)));
    assert.ok(!isNaN(parseFloat(summary.total_processing_fees)));
  });

  await t.test('E2E-9: Verify CSV Audit Report Export', async () => {
    const res = await fetch(`${baseUrl}/api/reconcile/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_records: reconciliationData.audit_records })
    });

    assert.equal(res.status, 200);
    const csvContent = await res.text();
    assert.ok(csvContent.includes('Transaction_ID'));
    assert.ok(csvContent.includes('Primary_Classification'));
    assert.ok(csvContent.includes('Gross_Variance_INR'));
    assert.ok(csvContent.includes('Remediation'));
  });
});


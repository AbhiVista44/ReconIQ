import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../src/app.js';

let server;
let baseUrl;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
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

test('ReconIQ Suite 3: REST API Endpoints Integration', async (t) => {
  await t.test('GET /api/health returns UP status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.status, 'UP');
    assert.ok(data.service);
  });

  await t.test('GET /api/reconcile/synthetic-data generates valid CSV datasets', async () => {
    const res = await fetch(`${baseUrl}/api/reconcile/synthetic-data`);
    assert.equal(res.status, 200);
    const data = await res.json();
    assert.equal(data.success, true);
    assert.ok(data.payment_csv.includes('transaction_id'));
    assert.ok(data.bank_csv.includes('settlement_id'));
    assert.ok(data.payment_rows_count > 10);
    assert.ok(data.bank_rows_count > 10);
  });

  await t.test('POST /api/reconcile/run-demo executes full pipeline on synthetic dataset', async () => {
    const res = await fetch(`${baseUrl}/api/reconcile/run-demo`, {
      method: 'POST'
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.demo, true);
    assert.ok(body.data.summary);
    assert.ok(body.data.audit_records.length > 0);
    assert.ok(body.data.orphaned_refunds.length > 0);
    assert.ok(body.data.duplicates.gateway_technical.length > 0);
    assert.equal(body.data.invariants.platform_partition_exact, true);
    assert.equal(body.data.invariants.bank_partition_exact, true);
  });

  await t.test('POST /api/reconcile/upload handles multipart/form-data CSV upload', async () => {
    const syntheticRes = await fetch(`${baseUrl}/api/reconcile/synthetic-data`);
    const synthetic = await syntheticRes.json();

    const formData = new FormData();
    formData.append(
      'payment_file',
      new Blob([synthetic.payment_csv], { type: 'text/csv' }),
      'payment_transactions.csv'
    );
    formData.append(
      'bank_file',
      new Blob([synthetic.bank_csv], { type: 'text/csv' }),
      'bank_settlement.csv'
    );

    const res = await fetch(`${baseUrl}/api/reconcile/upload`, {
      method: 'POST',
      body: formData
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.ok(body.data.summary);
    assert.ok(body.data.audit_records.length > 0);
  });

  await t.test('POST /api/reconcile/export returns formatted CSV stream', async () => {
    const demoRes = await fetch(`${baseUrl}/api/reconcile/run-demo`, { method: 'POST' });
    const demoBody = await demoRes.json();

    const exportRes = await fetch(`${baseUrl}/api/reconcile/export`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audit_records: demoBody.data.audit_records })
    });

    assert.equal(exportRes.status, 200);
    assert.equal(exportRes.headers.get('content-type'), 'text/csv; charset=utf-8');
    const csvText = await exportRes.text();
    assert.ok(csvText.includes('Transaction_ID'));
    assert.ok(csvText.includes('TXN_101'));
  });
});


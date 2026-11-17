import express from 'express';
import multer from 'multer';
import Papa from 'papaparse';
import { runReconciliationPipeline } from '../services/reconciliationOrchestrator.js';
import { generateSyntheticReconciliationData } from '../services/syntheticData.js';

const router = express.Router();

// Configure Multer for in-memory CSV buffer handling (max 10MB per file)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

/**
 * POST /api/reconcile/upload
 * Upload two CSV files and execute full reconciliation pipeline
 */
router.post(
  '/upload',
  upload.fields([
    { name: 'payment_file', maxCount: 1 },
    { name: 'bank_file', maxCount: 1 }
  ]),
  (req, res) => {
    try {
      if (!req.files || !req.files.payment_file || !req.files.bank_file) {
        return res.status(400).json({
          error: 'Both payment_file and bank_file CSVs are required.'
        });
      }

      const paymentBuffer = req.files.payment_file[0].buffer;
      const bankBuffer = req.files.bank_file[0].buffer;

      const result = runReconciliationPipeline({
        paymentSource: paymentBuffer,
        bankSource: bankBuffer
      });

      return res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      console.error('Reconciliation error:', err);
      return res.status(500).json({
        success: false,
        error: 'Failed to process reconciliation files.',
        details: err.message
      });
    }
  }
);

/**
 * POST /api/reconcile/run-demo
 * Run reconciliation directly against the deterministic seeded synthetic dataset
 */
router.post('/run-demo', (req, res) => {
  try {
    const synthetic = generateSyntheticReconciliationData();
    const result = runReconciliationPipeline({
      paymentSource: synthetic.paymentCsv,
      bankSource: synthetic.bankCsv
    });

    return res.status(200).json({
      success: true,
      demo: true,
      data: result
    });
  } catch (err) {
    console.error('Demo execution error:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to execute demo reconciliation.',
      details: err.message
    });
  }
});

/**
 * GET /api/reconcile/synthetic-data
 * Retrieve generated synthetic CSV data for testing or manual upload
 */
router.get('/synthetic-data', (req, res) => {
  try {
    const synthetic = generateSyntheticReconciliationData();
    return res.status(200).json({
      success: true,
      payment_csv: synthetic.paymentCsv,
      bank_csv: synthetic.bankCsv,
      payment_rows_count: synthetic.paymentRows.length,
      bank_rows_count: synthetic.bankRows.length
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to generate synthetic data.',
      details: err.message
    });
  }
});

/**
 * POST /api/reconcile/export
 * Export audit records to CSV
 */
router.post('/export', (req, res) => {
  try {
    const { audit_records } = req.body;
    if (!audit_records || !Array.isArray(audit_records)) {
      return res.status(400).json({ error: 'Missing or invalid audit_records array.' });
    }

    const flatRows = audit_records.map(r => ({
      Transaction_ID: r.transaction_id,
      Bank_Reference: r.bank_reference,
      Order_ID: r.order_id,
      Primary_Classification: r.primary_classification,
      Discrepancy_Flags: Array.isArray(r.discrepancy_flags) ? r.discrepancy_flags.join('; ') : r.discrepancy_flags,
      Severity: r.severity,
      Gateway_Amount_INR: r.gateway_amount,
      Bank_Gross_INR: r.bank_gross_amount,
      Bank_Fee_INR: r.bank_fee_amount,
      Bank_Net_INR: r.bank_net_amount,
      Gross_Variance_INR: r.gross_variance,
      Gateway_Date: r.gateway_date,
      Settlement_Date: r.settlement_date,
      Explanation: r.explanation,
      Remediation: r.remediation
    }));

    const csvOutput = Papa.unparse(flatRows);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="reconiq_audit_report.csv"');
    return res.send(csvOutput);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: 'Failed to export CSV.',
      details: err.message
    });
  }
});

export default router;


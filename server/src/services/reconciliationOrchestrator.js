import { parseCSV, validateBankRows, validatePaymentRows } from './csvParser.js';
import { detectBankDuplicates, detectGatewayDuplicates } from './duplicateDetector.js';
import { partitionAndValidateRefunds } from './refundValidator.js';
import { executeReconciliationMatching } from './matchingEngine.js';
import { classifyMatchedAnomalies } from './anomalyClassifier.js';
import { compileDualLedgerSummary } from './ledgerSummary.js';

/**
 * End-to-end reconciliation pipeline orchestrator.
 */
export function runReconciliationPipeline({ paymentSource, bankSource }) {
  // 1. Ingest & Parse CSV if string/buffer provided
  const rawPaymentData = typeof paymentSource === 'string' || Buffer.isBuffer(paymentSource)
    ? parseCSV(paymentSource)
    : paymentSource;

  const rawBankData = typeof bankSource === 'string' || Buffer.isBuffer(bankSource)
    ? parseCSV(bankSource)
    : bankSource;

  // 2. Validate Rows & Quarantine Unsupported Currencies / Malformed Rows
  const paymentValidation = validatePaymentRows(rawPaymentData);
  const bankValidation = validateBankRows(rawBankData);

  // 3. Duplicate Detection & Quarantine (Multi-record grouping, no silent Map overwrite)
  const gatewayDupResult = detectGatewayDuplicates(paymentValidation.validRows);
  const bankDupResult = detectBankDuplicates(bankValidation.validRows);

  // 4. Partition Payments vs Refunds & Strict Parent Verification
  const refundResult = partitionAndValidateRefunds(gatewayDupResult.uniqueRows);

  // 5. Two-Stage Matching (Exact Reference + Bidirectional Composite Ambiguity Detection)
  const matchResult = executeReconciliationMatching(
    refundResult.paymentsPool,
    bankDupResult.uniqueRows
  );

  // 6. Anomaly Classification, Multi-Flag Preservation & Cumulative Drift Calculation
  const anomalyResult = classifyMatchedAnomalies(matchResult.matchedPairs);

  // 7. Compile Dual-Ledger Financial Summary & Invariant Verification
  const summaryReport = compileDualLedgerSummary({
    validPayments: refundResult.paymentsPool,
    verifiedRefunds: refundResult.verifiedRefunds,
    orphanedRefunds: refundResult.orphanedRefunds,
    gatewayDuplicates: gatewayDupResult.technicalDuplicates,
    invalidGatewayRows: paymentValidation.invalidRows,
    unsupportedCurrGateway: paymentValidation.unsupportedCurrencyRows,
    validBankRecords: bankDupResult.uniqueRows,
    bankDuplicates: bankDupResult.technicalDuplicates,
    invalidBankRows: bankValidation.invalidRows,
    unsupportedCurrBank: bankValidation.unsupportedCurrencyRows,
    matchedPairs: matchResult.matchedPairs,
    unmatchedPayments: matchResult.unmatchedPayments,
    unmatchedBank: matchResult.unmatchedBank,
    cumulativeRoundingDrift: anomalyResult.cumulativeRoundingDrift,
    totalMaterialVariance: anomalyResult.totalMaterialVariance,
    signedMaterialVariance: anomalyResult.signedMaterialVariance
  });

  return {
    summary: summaryReport.kpis,
    counts: summaryReport.counts,
    invariants: summaryReport.invariants,
    audit_records: anomalyResult.auditRecords,
    orphaned_refunds: refundResult.orphanedRefunds,
    verified_refunds: refundResult.verifiedRefunds,
    duplicates: {
      gateway_technical: gatewayDupResult.technicalDuplicates,
      gateway_suspected_double_captures: gatewayDupResult.suspectedDoubleCaptures,
      bank_technical: bankDupResult.technicalDuplicates,
      bank_duplicate_references: bankDupResult.duplicateBankReferences
    },
    ambiguous_matches: matchResult.ambiguousReports,
    unmatched: {
      in_transit_gateway: matchResult.unmatchedPayments,
      unmatched_bank_credits: matchResult.unmatchedBank
    },
    quarantine: {
      invalid_rows: {
        gateway: paymentValidation.invalidRows,
        bank: bankValidation.invalidRows
      },
      unsupported_currency: {
        gateway: paymentValidation.unsupportedCurrencyRows,
        bank: bankValidation.unsupportedCurrencyRows
      }
    }
  };
}

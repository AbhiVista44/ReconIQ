import Decimal from 'decimal.js';
import { ROUNDING_TOLERANCE, formatINR, getPeriodIndex, getPeriodStr, safeDelta } from '../utils/finance.js';

/**
 * Classify anomalies and compute financial variances on matched pairs.
 * Preserves multiple discrepancy conditions and tracks valid cumulative rounding drift.
 */
export function classifyMatchedAnomalies(matchedPairs) {
  let cumulativeRoundingDrift = new Decimal(0);
  let totalMaterialVariance = new Decimal(0); // Absolute magnitude for KPI
  let signedMaterialVariance = new Decimal(0); // Signed for bridge equation
  const auditRecords = [];

  for (const pair of matchedPairs) {
    const { payment, bank, match_stage } = pair;
    const grossDelta = safeDelta(bank.gross_amount, payment.amount);
    const absGrossDelta = grossDelta.abs();

    const txnPeriod = getPeriodIndex(payment.transaction_date);
    const stlPeriod = getPeriodIndex(bank.settlement_date);
    const monthLag = stlPeriod - txnPeriod;

    const discrepancyFlags = [];
    const explanationParts = [];
    const remediationParts = [];

    // 1. Cross-Month Cutoff Timing Discrepancy
    if (monthLag >= 1) {
      discrepancyFlags.push('FOLLOWING_MONTH_SETTLEMENT');
      explanationParts.push(
        `Captured in ${getPeriodStr(payment.transaction_date)} (${payment.transaction_date.slice(0, 10)}) but settled by bank in ${getPeriodStr(bank.settlement_date)} (${bank.settlement_date.slice(0, 10)}). Lag: ${monthLag} month(s).`
      );
      remediationParts.push('Reclassify to "In-Transit Settlement" clearing account for Month-End Accrual Closing.');
    } else if (monthLag < 0) {
      discrepancyFlags.push('RETROACTIVE_SETTLEMENT_DATE');
      explanationParts.push('Bank settlement date precedes payment capture date.');
      remediationParts.push('Inspect clock synchronization between gateway server and acquiring bank.');
    }

    // 2. Amount Differences: Material Mismatch vs Rounding Difference
    if (absGrossDelta.gt(ROUNDING_TOLERANCE)) {
      discrepancyFlags.push('MATERIAL_AMOUNT_MISMATCH');
      totalMaterialVariance = totalMaterialVariance.plus(absGrossDelta);
      signedMaterialVariance = signedMaterialVariance.plus(grossDelta);
      explanationParts.push(
        `Material gross variance of ₹${formatINR(absGrossDelta)} detected (Gateway: ₹${formatINR(payment.amount)}, Bank Gross: ₹${formatINR(bank.gross_amount)}).`
      );
      remediationParts.push('Hold settlement release. Investigate price discrepancy, merchant surcharge, or partial capture.');
    } else if (absGrossDelta.gt(0)) {
      discrepancyFlags.push('ROUNDING_DIFFERENCE');
      // Accumulate drift ONLY for valid matched records within <= ₹0.05
      cumulativeRoundingDrift = cumulativeRoundingDrift.plus(grossDelta);
      explanationParts.push(
        `Sub-tolerance rounding variance of ₹${formatINR(grossDelta)} (Bank: ₹${formatINR(bank.gross_amount)} vs Gateway: ₹${formatINR(payment.amount)}).`
      );
      remediationParts.push('Allocate variance to "Interchange Rounding & FX Variance" expense ledger.');
    }

    // Determine Primary Classification & Severity
    let primaryClassification = 'CLEAN_MATCH';
    let severity = 'NONE';

    if (discrepancyFlags.includes('MATERIAL_AMOUNT_MISMATCH')) {
      primaryClassification = 'MATERIAL_AMOUNT_MISMATCH';
      severity = 'HIGH';
    } else if (discrepancyFlags.includes('FOLLOWING_MONTH_SETTLEMENT')) {
      primaryClassification = 'FOLLOWING_MONTH_SETTLEMENT';
      severity = 'MEDIUM';
    } else if (discrepancyFlags.includes('ROUNDING_DIFFERENCE')) {
      primaryClassification = 'ROUNDING_DIFFERENCE';
      severity = 'LOW';
    }

    if (discrepancyFlags.length === 0) {
      discrepancyFlags.push('CLEAN_MATCH');
      explanationParts.push('Gross amounts match identically; settled within same calendar month.');
      remediationParts.push('Auto-reconciled. No audit action required.');
    }

    auditRecords.push({
      id: `AUD_${payment.transaction_id}`,
      transaction_id: payment.transaction_id,
      bank_reference: bank.bank_reference,
      order_id: payment.order_id,
      match_stage,
      primary_classification: primaryClassification,
      discrepancy_flags: discrepancyFlags,
      severity,
      gateway_amount: formatINR(payment.amount),
      bank_gross_amount: formatINR(bank.gross_amount),
      bank_fee_amount: formatINR(bank.fee_amount),
      bank_net_amount: formatINR(bank.net_amount),
      gross_variance: formatINR(grossDelta),
      gateway_date: payment.transaction_date,
      settlement_date: bank.settlement_date,
      month_lag: monthLag,
      explanation: explanationParts.join(' | '),
      remediation: remediationParts.join(' | ')
    });
  }

  return {
    auditRecords,
    cumulativeRoundingDrift,
    totalMaterialVariance,
    signedMaterialVariance
  };
}

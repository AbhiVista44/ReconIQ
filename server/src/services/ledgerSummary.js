import Decimal from 'decimal.js';
import { formatINR } from '../utils/finance.js';

/**
 * Compile dual-ledger financial reports, verify balance invariants, and calculate distinct totals.
 */
export function compileDualLedgerSummary({
  validPayments,
  verifiedRefunds,
  orphanedRefunds,
  gatewayDuplicates,
  invalidGatewayRows,
  unsupportedCurrGateway,
  validBankRecords,
  bankDuplicates,
  invalidBankRows,
  unsupportedCurrBank,
  matchedPairs,
  unmatchedPayments,
  unmatchedBank,
  cumulativeRoundingDrift,
  totalMaterialVariance,
  signedMaterialVariance = new Decimal(0)
}) {
  // Helper for summing Decimal values safely
  const sumDecimals = (items, key) =>
    items.reduce((acc, item) => acc.plus(item[key] instanceof Decimal ? item[key] : new Decimal(item[key] || 0)), new Decimal(0));

  // 1. Platform Ledger Metrics
  const validPaymentsGross = sumDecimals(validPayments, 'amount');
  const verifiedRefundsTotal = sumDecimals(verifiedRefunds, 'magnitude');
  const orphanedRefundsTotal = sumDecimals(orphanedRefunds, 'magnitude');
  const totalPlatformRefunds = verifiedRefundsTotal.plus(orphanedRefundsTotal);
  const gatewayDuplicatesTotal = sumDecimals(gatewayDuplicates, 'amount');
  const gatewayUnsupportedTotal = sumDecimals(unsupportedCurrGateway, 'amount');

  // Platform partition check: Valid Payments = Matched Payments + In-Transit Payments
  const matchedPaymentsGross = matchedPairs.reduce(
    (acc, pair) => acc.plus(pair.payment.amount),
    new Decimal(0)
  );
  const unmatchedPaymentsGross = sumDecimals(unmatchedPayments, 'amount');
  const platformPartitionDiff = validPaymentsGross.minus(matchedPaymentsGross.plus(unmatchedPaymentsGross));

  // 2. Bank Settlement Ledger Metrics
  const validBankGross = sumDecimals(validBankRecords, 'gross_amount');
  const validBankFees = sumDecimals(validBankRecords, 'fee_amount');
  const validBankNet = sumDecimals(validBankRecords, 'net_amount');
  const bankDuplicatesGross = sumDecimals(bankDuplicates, 'gross_amount');
  const bankUnsupportedGross = sumDecimals(unsupportedCurrBank, 'gross_amount');

  // Bank partition check: Valid Bank Gross = Matched Bank Gross + Unmatched Bank Gross
  const matchedBankGross = matchedPairs.reduce(
    (acc, pair) => acc.plus(pair.bank.gross_amount),
    new Decimal(0)
  );
  const unmatchedBankGross = sumDecimals(unmatchedBank, 'gross_amount');
  const bankPartitionDiff = validBankGross.minus(matchedBankGross.plus(unmatchedBankGross));

  // Bank internal accounting invariant: Gross = Net + Fees
  const bankInternalDiff = validBankGross.minus(validBankNet.plus(validBankFees));

  // 3. Reconciliation Bridge Invariant
  // Matched Bank Gross - Matched Payment Gross = Cumulative Drift + Signed Material Variance
  const matchedGrossVariance = matchedBankGross.minus(matchedPaymentsGross);
  const expectedGrossVariance = cumulativeRoundingDrift.plus(signedMaterialVariance);
  const bridgeDifference = matchedGrossVariance.minus(expectedGrossVariance).abs();

  // 4. Counts Summary
  const cleanMatchCount = matchedPairs.filter(p => {
    const delta = p.bank.gross_amount.minus(p.payment.amount).abs();
    const monthLag = (new Date(p.bank.settlement_date).getUTCFullYear() * 12 + new Date(p.bank.settlement_date).getUTCMonth()) -
                     (new Date(p.payment.transaction_date).getUTCFullYear() * 12 + new Date(p.payment.transaction_date).getUTCMonth());
    return delta.isZero() && monthLag === 0;
  }).length;

  const followingMonthCount = matchedPairs.filter(p => {
    const monthLag = (new Date(p.bank.settlement_date).getUTCFullYear() * 12 + new Date(p.bank.settlement_date).getUTCMonth()) -
                     (new Date(p.payment.transaction_date).getUTCFullYear() * 12 + new Date(p.payment.transaction_date).getUTCMonth());
    return monthLag >= 1;
  }).length;

  const roundingDifferenceCount = matchedPairs.filter(p => {
    const delta = p.bank.gross_amount.minus(p.payment.amount).abs();
    return delta.gt(0) && delta.lte(0.05);
  }).length;

  const materialMismatchCount = matchedPairs.filter(p => {
    const delta = p.bank.gross_amount.minus(p.payment.amount).abs();
    return delta.gt(0.05);
  }).length;

  return {
    kpis: {
      platform_gross_volume: formatINR(validPaymentsGross),
      bank_gross_volume: formatINR(validBankGross),
      bank_net_volume: formatINR(validBankNet),
      total_processing_fees: formatINR(validBankFees),
      matched_payment_volume: formatINR(matchedPaymentsGross),
      matched_bank_volume: formatINR(matchedBankGross),
      cumulative_rounding_drift: formatINR(cumulativeRoundingDrift),
      total_material_variance: formatINR(totalMaterialVariance),
      unmatched_gateway_in_transit: formatINR(unmatchedPaymentsGross),
      unmatched_bank_credits: formatINR(unmatchedBankGross),
      verified_refunds_total: formatINR(verifiedRefundsTotal),
      orphaned_refunds_total: formatINR(orphanedRefundsTotal),
      gateway_duplicates_volume: formatINR(gatewayDuplicatesTotal),
      bank_duplicates_volume: formatINR(bankDuplicatesGross),
      reconciliation_rate_percent: validPayments.length > 0 
        ? new Decimal(cleanMatchCount).dividedBy(validPayments.length).times(100).toFixed(1)
        : '0.0'
    },
    counts: {
      total_valid_payments: validPayments.length,
      total_valid_settlements: validBankRecords.length,
      matched_pairs: matchedPairs.length,
      clean_matches: cleanMatchCount,
      following_month_settlements: followingMonthCount,
      rounding_differences: roundingDifferenceCount,
      material_mismatches: materialMismatchCount,
      orphaned_refunds: orphanedRefunds.length,
      verified_refunds: verifiedRefunds.length,
      gateway_technical_duplicates: gatewayDuplicates.length,
      bank_technical_duplicates: bankDuplicates.length,
      unmatched_gateway: unmatchedPayments.length,
      unmatched_bank: unmatchedBank.length,
      invalid_gateway_rows: invalidGatewayRows.length,
      invalid_bank_rows: invalidBankRows.length,
      unsupported_currency_gateway: unsupportedCurrGateway.length,
      unsupported_currency_bank: unsupportedCurrBank.length
    },
    invariants: {
      platform_partition_exact: platformPartitionDiff.isZero(),
      bank_partition_exact: bankPartitionDiff.isZero(),
      bank_internal_gross_net_exact: bankInternalDiff.isZero(),
      reconciliation_bridge_balanced: bridgeDifference.lte(0.0001)
    }
  };
}

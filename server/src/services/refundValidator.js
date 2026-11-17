import Decimal from 'decimal.js';
import { formatINR } from '../utils/finance.js';

/**
 * Partition unique gateway rows into Payments and Normalized Refunds,
 * then validate refunds against successful parent payments.
 */
export function partitionAndValidateRefunds(gatewayUniqueRows) {
  const paymentsPool = [];
  const rawRefundsPool = [];

  for (const row of gatewayUniqueRows) {
    const isRefundType = row.type === 'REFUND';
    const isNegativeAmount = row.amount.isNegative();

    if (isRefundType || isNegativeAmount) {
      const mag = row.amount.abs();
      rawRefundsPool.push({
        ...row,
        type: 'REFUND',
        magnitude: mag,
        effective_amount: mag.negated() // -1 * magnitude for financial cash flow
      });
    } else {
      paymentsPool.push(row);
    }
  }

  // Index valid successful payments by exact transaction_id
  const paymentIndex = new Map();
  for (const p of paymentsPool) {
    paymentIndex.set(p.transaction_id, p);
  }

  const verifiedRefunds = [];
  const orphanedRefunds = [];
  const cumulativeRefundByParent = new Map();

  for (const refund of rawRefundsPool) {
    const parentId = refund.original_txn_id;

    // Strict validation: Parent must be an exact transaction ID of a successful payment
    if (!parentId) {
      orphanedRefunds.push({
        ...refund,
        discrepancy_type: 'ORPHANED_REFUND',
        severity: 'CRITICAL',
        parent_txn_id: null,
        explanation: `Refund '${refund.transaction_id}' is missing mandatory 'original_txn_id'. Order ID alone is rejected as proof of parent identity.`,
        remediation: 'Place immediate merchant debit hold. Investigate potential rogue credit memo.'
      });
      continue;
    }

    const parent = paymentIndex.get(parentId);
    if (!parent) {
      orphanedRefunds.push({
        ...refund,
        discrepancy_type: 'ORPHANED_REFUND',
        severity: 'CRITICAL',
        parent_txn_id: parentId,
        explanation: `Refund '${refund.transaction_id}' references non-existent parent transaction ID '${parentId}'.`,
        remediation: 'Flag for AML / Fraud review. Originating payment cannot be found in ledger.'
      });
      continue;
    }

    if (parent.status !== 'SUCCESS') {
      orphanedRefunds.push({
        ...refund,
        discrepancy_type: 'ORPHANED_REFUND',
        severity: 'CRITICAL',
        parent_txn_id: parentId,
        explanation: `Refund '${refund.transaction_id}' references parent transaction '${parentId}' which has status '${parent.status}' (must be 'SUCCESS').`,
        remediation: 'Reject refund settlement. A non-successful payment cannot be refunded.'
      });
      continue;
    }

    // Cumulative refund check against parent payment gross amount
    const priorTotal = cumulativeRefundByParent.get(parentId) || new Decimal(0);
    const newTotal = priorTotal.plus(refund.magnitude);

    if (newTotal.gt(parent.amount)) {
      orphanedRefunds.push({
        ...refund,
        discrepancy_type: 'EXCESSIVE_REFUND_AMOUNT',
        severity: 'HIGH',
        parent_txn_id: parentId,
        parent_amount: formatINR(parent.amount),
        cumulative_refunded: formatINR(newTotal),
        explanation: `Cumulative refund amount ₹${formatINR(newTotal)} exceeds parent payment amount ₹${formatINR(parent.amount)} for parent '${parentId}'.`,
        remediation: 'Block excess refund payout. Audit merchant refund permissions.'
      });
      continue;
    }

    cumulativeRefundByParent.set(parentId, newTotal);
    verifiedRefunds.push({
      ...refund,
      parent_txn_id: parentId,
      parent_amount: formatINR(parent.amount),
      parent_date: parent.transaction_date
    });
  }

  return {
    paymentsPool,
    verifiedRefunds,
    orphanedRefunds
  };
}


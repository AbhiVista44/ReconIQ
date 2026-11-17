import { ROUNDING_TOLERANCE, dateDiffInDays, safeDelta } from '../utils/finance.js';

/**
 * Execute two-stage reconciliation matching with bidirectional ambiguity detection.
 */
export function executeReconciliationMatching(validPayments, validBankRecords) {
  const matchedPairs = [];
  const unmatchedPayments = new Map(validPayments.map(p => [p.transaction_id, p]));
  const unmatchedBank = new Map(validBankRecords.map(b => [b.settlement_id, b]));

  // =========================================================================
  // STAGE 1: DETERMINISTIC 1-TO-1 EXACT REFERENCE MATCHING
  // =========================================================================
  // Find bank records whose bank_reference matches an unmatched payment transaction_id
  for (const [settlementId, bankRecord] of Array.from(unmatchedBank.entries())) {
    const bankRef = bankRecord.bank_reference;
    if (bankRef && unmatchedPayments.has(bankRef)) {
      const paymentRecord = unmatchedPayments.get(bankRef);
      matchedPairs.push({
        payment: paymentRecord,
        bank: bankRecord,
        match_stage: 'EXACT_REFERENCE_1_TO_1'
      });

      unmatchedPayments.delete(paymentRecord.transaction_id);
      unmatchedBank.delete(settlementId);
    }
  }

  // =========================================================================
  // STAGE 2: COMPOSITE MATCHING WITH BIDIRECTIONAL AMBIGUITY DETECTION
  // =========================================================================
  // Build Bipartite Candidate Graph between remaining unmatched records
  const paymentCandidates = new Map(); // payment_id -> Array<settlement_id>
  const bankCandidates = new Map();    // settlement_id -> Array<payment_id>

  for (const p of unmatchedPayments.values()) {
    paymentCandidates.set(p.transaction_id, []);
  }
  for (const b of unmatchedBank.values()) {
    bankCandidates.set(b.settlement_id, []);
  }

  // Populate candidate edges
  for (const payment of unmatchedPayments.values()) {
    for (const bank of unmatchedBank.values()) {
      // Check composite attributes: order_id match, date window, amount tolerance
      if (payment.order_id && payment.order_id === bank.bank_reference) {
        const daysDiff = dateDiffInDays(payment.transaction_date, bank.settlement_date);
        const amountDiff = safeDelta(bank.gross_amount, payment.amount).abs();

        if (daysDiff >= 0 && daysDiff <= 4 && amountDiff.lte(ROUNDING_TOLERANCE)) {
          paymentCandidates.get(payment.transaction_id).push(bank.settlement_id);
          bankCandidates.get(bank.settlement_id).push(payment.transaction_id);
        }
      }
    }
  }

  // Accept ONLY mutually unique 1-to-1 matches: deg(P) === 1 AND deg(B) === 1
  const acceptedCompositePairs = [];
  const ambiguousPayments = new Set();
  const ambiguousBank = new Set();

  for (const [pId, bList] of paymentCandidates.entries()) {
    if (bList.length === 1) {
      const bId = bList[0];
      const pList = bankCandidates.get(bId) || [];
      if (pList.length === 1 && pList[0] === pId) {
        // Mutually unique 1-to-1 match
        acceptedCompositePairs.push({ pId, bId });
      } else {
        // Bank record had multiple candidates -> Ambiguous!
        ambiguousPayments.add(pId);
        ambiguousBank.add(bId);
      }
    } else if (bList.length > 1) {
      // Payment had multiple bank candidates -> Ambiguous!
      ambiguousPayments.add(pId);
      bList.forEach(bId => ambiguousBank.add(bId));
    }
  }

  // Finalize accepted composite matches
  for (const { pId, bId } of acceptedCompositePairs) {
    // Double-check neither was tagged as ambiguous
    if (!ambiguousPayments.has(pId) && !ambiguousBank.has(bId)) {
      const paymentRecord = unmatchedPayments.get(pId);
      const bankRecord = unmatchedBank.get(bId);
      if (paymentRecord && bankRecord) {
        matchedPairs.push({
          payment: paymentRecord,
          bank: bankRecord,
          match_stage: 'COMPOSITE_MUTUAL_1_TO_1'
        });
        unmatchedPayments.delete(pId);
        unmatchedBank.delete(bId);
      }
    }
  }

  // Format ambiguous match reports for auditor review
  const ambiguousReports = [];
  for (const pId of ambiguousPayments) {
    const p = unmatchedPayments.get(pId);
    if (p) {
      const candidates = paymentCandidates.get(pId) || [];
      ambiguousReports.push({
        record_type: 'PAYMENT',
        id: pId,
        order_id: p.order_id,
        amount: p.amount.toFixed(2),
        candidate_count: candidates.length,
        candidate_ids: candidates,
        severity: 'HIGH',
        explanation: `Payment '${pId}' matches ${candidates.length} candidate bank records for order '${p.order_id}'. Bidirectional ambiguity detected; match withheld.`,
        remediation: 'Manual auditor intervention required. Check bank settlement timestamps to assign correct record.'
      });
    }
  }

  for (const bId of ambiguousBank) {
    const b = unmatchedBank.get(bId);
    if (b) {
      const candidates = bankCandidates.get(bId) || [];
      ambiguousReports.push({
        record_type: 'BANK_SETTLEMENT',
        id: bId,
        bank_reference: b.bank_reference,
        gross_amount: b.gross_amount.toFixed(2),
        candidate_count: candidates.length,
        candidate_ids: candidates,
        severity: 'HIGH',
        explanation: `Bank record '${bId}' matches ${candidates.length} candidate gateway payments for reference '${b.bank_reference}'. Ambiguity detected; match withheld.`,
        remediation: 'Review transaction ledger to determine which captured payment corresponds to settlement.'
      });
    }
  }

  return {
    matchedPairs,
    unmatchedPayments: Array.from(unmatchedPayments.values()),
    unmatchedBank: Array.from(unmatchedBank.values()),
    ambiguousReports
  };
}


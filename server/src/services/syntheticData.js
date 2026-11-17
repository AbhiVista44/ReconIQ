import Papa from 'papaparse';

/**
 * Generate deterministic paired test datasets in INR with all mandatory anomalies.
 */
export function generateSyntheticReconciliationData() {
  const paymentRows = [
    // TC-01: Clean Match (Happy path)
    {
      transaction_id: 'TXN_101',
      order_id: 'ORD_1001',
      transaction_date: '2026-10-15T10:30:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '1000.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-02: Following Month Cutoff (Same Year: Oct 31 -> Nov 02)
    {
      transaction_id: 'TXN_102',
      order_id: 'ORD_1002',
      transaction_date: '2026-10-31T22:45:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '2500.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-03: Rounding Difference Alone (₹0.03 sub-cent rounding)
    {
      transaction_id: 'TXN_103',
      order_id: 'ORD_1003',
      transaction_date: '2026-10-18T14:20:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '799.99',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-04: Multi-Discrepancy (Following Month + Rounding Difference)
    {
      transaction_id: 'TXN_104',
      order_id: 'ORD_1004',
      transaction_date: '2026-10-31T23:55:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '1500.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-05: Material Amount Mismatch (> ₹0.05 tolerance, e.g. ₹150 variance)
    {
      transaction_id: 'TXN_105',
      order_id: 'ORD_1005',
      transaction_date: '2026-10-20T11:15:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '5000.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // Parent payment for valid refund (TC-06)
    {
      transaction_id: 'TXN_106',
      order_id: 'ORD_1006',
      transaction_date: '2026-10-10T09:00:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '1200.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-06: Strict Valid Refund (references TXN_106)
    {
      transaction_id: 'RF_201',
      order_id: 'ORD_1006',
      transaction_date: '2026-10-14T16:00:00Z',
      type: 'REFUND',
      original_txn_id: 'TXN_106',
      amount: '-400.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-07: Orphaned Refund (Ghost Parent ID)
    {
      transaction_id: 'RF_202',
      order_id: 'ORD_1007',
      transaction_date: '2026-10-22T13:30:00Z',
      type: 'REFUND',
      original_txn_id: 'TXN_GHOST_999',
      amount: '600.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-08: Orphaned Refund (Order ID only, missing original_txn_id)
    {
      transaction_id: 'RF_203',
      order_id: 'ORD_1008',
      transaction_date: '2026-10-23T15:00:00Z',
      type: 'REFUND',
      original_txn_id: '',
      amount: '350.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-09A & TC-09B: Bidirectional Ambiguity (2 Payments matching 1 Bank Record on Order ID)
    {
      transaction_id: 'TXN_301A',
      order_id: 'ORD_AMBIG_50',
      transaction_date: '2026-10-12T10:00:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '500.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    {
      transaction_id: 'TXN_301B',
      order_id: 'ORD_AMBIG_50',
      transaction_date: '2026-10-12T10:05:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '500.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-10: Technical Duplicate Txn ID in Gateway (Row 1 & Row 2)
    {
      transaction_id: 'TXN_DUP_401',
      order_id: 'ORD_4001',
      transaction_date: '2026-10-19T08:00:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '850.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    {
      transaction_id: 'TXN_DUP_401', // Technical duplicate collision
      order_id: 'ORD_4001',
      transaction_date: '2026-10-19T08:00:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '850.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-11: Cross-Year Following Month Settlement (Dec 31, 2026 -> Jan 03, 2027)
    {
      transaction_id: 'TXN_601',
      order_id: 'ORD_6001',
      transaction_date: '2026-12-31T23:30:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '3200.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // TC-12: Legitimate Repeated Orders (Same Order, separated by 4 hours)
    {
      transaction_id: 'TXN_REP_701A',
      order_id: 'ORD_REP_700',
      transaction_date: '2026-10-25T09:00:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '450.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    {
      transaction_id: 'TXN_REP_701B',
      order_id: 'ORD_REP_700',
      transaction_date: '2026-10-25T14:30:00Z', // > 60s later: Legitimate re-order
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '450.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // Unmatched in-transit gateway transaction (authorized, pending settlement)
    {
      transaction_id: 'TXN_PENDING_801',
      order_id: 'ORD_8001',
      transaction_date: '2026-10-30T16:00:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '950.00',
      currency: 'INR',
      status: 'SUCCESS'
    },
    // Unsupported currency row to verify quarantine
    {
      transaction_id: 'TXN_USD_901',
      order_id: 'ORD_9001',
      transaction_date: '2026-10-28T12:00:00Z',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: '100.00',
      currency: 'USD',
      status: 'SUCCESS'
    },
    // Malformed row to verify invalid row preservation
    {
      transaction_id: 'TXN_INVALID_999',
      order_id: 'ORD_9999',
      transaction_date: 'not_a_valid_date',
      type: 'PAYMENT',
      original_txn_id: '',
      amount: 'NaN_AMOUNT',
      currency: 'INR',
      status: 'SUCCESS'
    }
  ];

  const bankRows = [
    // TC-01: Clean Match
    {
      settlement_id: 'STL_101',
      bank_reference: 'TXN_101',
      settlement_date: '2026-10-16',
      gross_amount: '1000.00',
      fee_amount: '20.00',
      net_amount: '980.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // TC-02: Following Month Cutoff (Nov 02)
    {
      settlement_id: 'STL_102',
      bank_reference: 'TXN_102',
      settlement_date: '2026-11-02',
      gross_amount: '2500.00',
      fee_amount: '50.00',
      net_amount: '2450.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // TC-03: Rounding Difference (₹799.96 vs ₹799.99 = -₹0.03)
    {
      settlement_id: 'STL_103',
      bank_reference: 'TXN_103',
      settlement_date: '2026-10-19',
      gross_amount: '799.96',
      fee_amount: '16.00',
      net_amount: '783.96',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // TC-04: Multi-Discrepancy (Following Month + ₹0.03 Rounding)
    {
      settlement_id: 'STL_104',
      bank_reference: 'TXN_104',
      settlement_date: '2026-11-02',
      gross_amount: '1499.97',
      fee_amount: '30.00',
      net_amount: '1469.97',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // TC-05: Material Amount Mismatch (₹4850.00 vs ₹5000.00 = -₹150.00)
    {
      settlement_id: 'STL_105',
      bank_reference: 'TXN_105',
      settlement_date: '2026-10-21',
      gross_amount: '4850.00',
      fee_amount: '97.00',
      net_amount: '4753.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // Bank settlement for TC-106
    {
      settlement_id: 'STL_106',
      bank_reference: 'TXN_106',
      settlement_date: '2026-10-11',
      gross_amount: '1200.00',
      fee_amount: '24.00',
      net_amount: '1176.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // TC-09: Bank settlement for ambiguous order (ORD_AMBIG_50)
    {
      settlement_id: 'STL_301',
      bank_reference: 'ORD_AMBIG_50',
      settlement_date: '2026-10-13',
      gross_amount: '500.00',
      fee_amount: '10.00',
      net_amount: '490.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // Technical duplicate in bank settlement (duplicate settlement ID)
    {
      settlement_id: 'STL_DUP_501',
      bank_reference: 'TXN_EXT_777',
      settlement_date: '2026-10-24',
      gross_amount: '600.00',
      fee_amount: '12.00',
      net_amount: '588.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    {
      settlement_id: 'STL_DUP_501', // Technical duplicate collision
      bank_reference: 'TXN_EXT_777',
      settlement_date: '2026-10-24',
      gross_amount: '600.00',
      fee_amount: '12.00',
      net_amount: '588.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // TC-11: Cross-Year Settlement (Jan 03, 2027)
    {
      settlement_id: 'STL_601',
      bank_reference: 'TXN_601',
      settlement_date: '2027-01-03',
      gross_amount: '3200.00',
      fee_amount: '64.00',
      net_amount: '3136.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // Legitimate repeated order settlements
    {
      settlement_id: 'STL_REP_701A',
      bank_reference: 'TXN_REP_701A',
      settlement_date: '2026-10-26',
      gross_amount: '450.00',
      fee_amount: '9.00',
      net_amount: '441.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    {
      settlement_id: 'STL_REP_701B',
      bank_reference: 'TXN_REP_701B',
      settlement_date: '2026-10-26',
      gross_amount: '450.00',
      fee_amount: '9.00',
      net_amount: '441.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    },
    // Unmatched bank credit (direct interest credit or unaccounted deposit)
    {
      settlement_id: 'STL_STRAY_901',
      bank_reference: 'INTEREST_CREDIT_OCT',
      settlement_date: '2026-10-31',
      gross_amount: '250.00',
      fee_amount: '0.00',
      net_amount: '250.00',
      currency: 'INR',
      settlement_status: 'SETTLED'
    }
  ];

  const paymentCsv = Papa.unparse(paymentRows);
  const bankCsv = Papa.unparse(bankRows);

  return {
    paymentRows,
    bankRows,
    paymentCsv,
    bankCsv
  };
}


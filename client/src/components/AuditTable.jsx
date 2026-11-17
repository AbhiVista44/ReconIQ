import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Eye,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  ArrowRight,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

export default function AuditTable({
  auditRecords = [],
  orphanedRefunds = [],
  duplicates = {},
  ambiguousMatches = [],
  unmatched = {},
  quarantine = {},
  activeTab = 'ALL',
  onSelectTab,
  onSelectRecord
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Normalize duplicate and quarantined records into table-compatible shapes
  const allRows = useMemo(() => {
    if (activeTab === 'ORPHAN_REFUNDS') {
      return orphanedRefunds.map((r) => ({
        id: `ORPHAN_${r.transaction_id}`,
        transaction_id: r.transaction_id,
        bank_reference: 'N/A (Missing)',
        order_id: r.order_id || 'N/A',
        primary_classification: r.discrepancy_type || 'ORPHANED_REFUND',
        discrepancy_flags: [r.discrepancy_type || 'ORPHANED_REFUND'],
        severity: r.severity || 'CRITICAL',
        gateway_amount: r.raw_amount || `₹${r.magnitude?.toFixed(2)}`,
        bank_gross_amount: '₹0.00',
        bank_fee_amount: '₹0.00',
        bank_net_amount: '₹0.00',
        gross_variance: r.raw_amount,
        gateway_date: r.transaction_date,
        settlement_date: 'N/A',
        month_lag: 0,
        explanation: r.explanation,
        remediation: r.remediation,
        isOrphan: true
      }));
    }

    if (activeTab === 'DUPLICATES') {
      const gDups = (duplicates.gateway_technical || []).map((d) => ({
        id: `DUP_GW_${d.transaction_id}_${d.row_number}`,
        transaction_id: d.transaction_id,
        bank_reference: 'N/A',
        order_id: d.order_id || 'N/A',
        primary_classification: 'GATEWAY_DUPLICATE_ID',
        discrepancy_flags: ['TECHNICAL_DUPLICATE_TXN_ID'],
        severity: 'HIGH',
        gateway_amount: `₹${parseFloat(d.amount || 0).toFixed(2)}`,
        bank_gross_amount: 'N/A',
        gross_variance: 'Duplicate',
        gateway_date: d.transaction_date,
        settlement_date: 'N/A',
        explanation: d.explanation,
        remediation: d.remediation,
        isDuplicate: true
      }));

      const bDups = (duplicates.bank_technical || []).map((d) => ({
        id: `DUP_BK_${d.settlement_id}_${d.row_number}`,
        transaction_id: 'N/A',
        bank_reference: d.bank_reference || d.settlement_id,
        order_id: 'N/A',
        primary_classification: 'BANK_DUPLICATE_SETTLEMENT',
        discrepancy_flags: ['DUPLICATE_SETTLEMENT_ID'],
        severity: 'HIGH',
        gateway_amount: 'N/A',
        bank_gross_amount: `₹${parseFloat(d.gross_amount || 0).toFixed(2)}`,
        gross_variance: 'Duplicate',
        gateway_date: 'N/A',
        settlement_date: d.settlement_date,
        explanation: d.explanation,
        remediation: d.remediation,
        isDuplicate: true
      }));

      return [...gDups, ...bDups];
    }

    if (activeTab === 'AMBIGUOUS') {
      return ambiguousMatches.map((a) => ({
        id: `AMBIG_${a.id}`,
        transaction_id: a.record_type === 'PAYMENT' ? a.id : 'N/A',
        bank_reference: a.record_type === 'BANK_SETTLEMENT' ? a.id : a.order_id,
        order_id: a.order_id || 'N/A',
        primary_classification: 'AMBIGUOUS_COMPOSITE_MATCH',
        discrepancy_flags: ['AMBIGUOUS_COMPOSITE_MATCH'],
        severity: 'HIGH',
        gateway_amount: a.amount ? `₹${a.amount}` : 'N/A',
        bank_gross_amount: a.gross_amount ? `₹${a.gross_amount}` : 'N/A',
        gross_variance: 'Ambiguous',
        gateway_date: 'N/A',
        settlement_date: 'N/A',
        explanation: a.explanation,
        remediation: a.remediation,
        isAmbiguous: true
      }));
    }

    if (activeTab === 'UNMATCHED') {
      const inTransit = (unmatched.in_transit_gateway || []).map((p) => ({
        id: `UNM_GW_${p.transaction_id}`,
        transaction_id: p.transaction_id,
        bank_reference: 'Pending Settlement',
        order_id: p.order_id || 'N/A',
        primary_classification: 'UNMATCHED_IN_TRANSIT',
        discrepancy_flags: ['IN_TRANSIT_CAPTURE'],
        severity: 'MEDIUM',
        gateway_amount: `₹${parseFloat(p.amount || 0).toFixed(2)}`,
        bank_gross_amount: '₹0.00',
        gross_variance: `₹${parseFloat(p.amount || 0).toFixed(2)}`,
        gateway_date: p.transaction_date,
        settlement_date: 'Pending',
        explanation: `Payment '${p.transaction_id}' authorized in gateway but no clearing record found in bank settlement.`,
        remediation: 'Check acquirer clearing queue or payout schedule.',
        isUnmatched: true
      }));

      const strayBank = (unmatched.unmatched_bank_credits || []).map((b) => ({
        id: `UNM_BK_${b.settlement_id}`,
        transaction_id: 'No Gateway Txn',
        bank_reference: b.bank_reference || b.settlement_id,
        order_id: 'N/A',
        primary_classification: 'UNMATCHED_BANK_CREDIT',
        discrepancy_flags: ['DIRECT_BANK_CREDIT'],
        severity: 'MEDIUM',
        gateway_amount: '₹0.00',
        bank_gross_amount: `₹${parseFloat(b.gross_amount || 0).toFixed(2)}`,
        gross_variance: `₹${parseFloat(b.gross_amount || 0).toFixed(2)}`,
        gateway_date: 'N/A',
        settlement_date: b.settlement_date,
        explanation: `Bank credit '${b.settlement_id}' received with no corresponding gateway authorization capture.`,
        remediation: 'Verify whether this is direct interest credit, manual wire, or unrecorded chargeback reversal.',
        isUnmatched: true
      }));

      return [...inTransit, ...strayBank];
    }

    if (activeTab === 'QUARANTINE') {
      const invalidG = (quarantine.invalid_rows?.gateway || []).map((r) => ({
        id: `INV_G_${r.row_number}`,
        transaction_id: r.raw_data?.transaction_id || `Row ${r.row_number}`,
        bank_reference: 'N/A',
        order_id: r.raw_data?.order_id || 'N/A',
        primary_classification: 'INVALID_GATEWAY_ROW',
        discrepancy_flags: ['INVALID_ROW_FORMAT'],
        severity: 'HIGH',
        gateway_amount: r.raw_data?.amount || 'ERR',
        bank_gross_amount: 'N/A',
        gross_variance: 'Format Error',
        gateway_date: r.raw_data?.transaction_date || 'ERR',
        settlement_date: 'N/A',
        explanation: (r.validation_errors || []).join('; '),
        remediation: r.remediation || 'Inspect source CSV and rectify.',
        isQuarantine: true
      }));

      const unsuppG = (quarantine.unsupported_currency?.gateway || []).map((r) => ({
        id: `UNSUPP_G_${r.transaction_id}`,
        transaction_id: r.transaction_id,
        bank_reference: 'N/A',
        order_id: r.raw_data?.order_id || 'N/A',
        primary_classification: 'UNSUPPORTED_CURRENCY',
        discrepancy_flags: ['CURRENCY_MISMATCH'],
        severity: 'MEDIUM',
        gateway_amount: `${r.currency} ${r.raw_data?.amount || ''}`,
        bank_gross_amount: 'N/A',
        gross_variance: 'Quarantined',
        gateway_date: r.raw_data?.transaction_date || 'N/A',
        settlement_date: 'N/A',
        explanation: r.reason,
        remediation: 'Exclude from INR batch or upload separate single-currency FX batch.',
        isQuarantine: true
      }));

      return [...invalidG, ...unsuppG];
    }

    // Default: Return matched audit records filtered by activeTab
    if (activeTab === 'CLEAN') {
      return auditRecords.filter((r) => r.primary_classification === 'CLEAN_MATCH');
    }
    if (activeTab === 'FOLLOWING_MONTH') {
      return auditRecords.filter((r) => r.discrepancy_flags?.includes('FOLLOWING_MONTH_SETTLEMENT'));
    }
    if (activeTab === 'ROUNDING') {
      return auditRecords.filter((r) => r.discrepancy_flags?.includes('ROUNDING_DIFFERENCE'));
    }
    if (activeTab === 'MATERIAL') {
      return auditRecords.filter((r) => r.discrepancy_flags?.includes('MATERIAL_AMOUNT_MISMATCH'));
    }

    return auditRecords;
  }, [
    activeTab,
    auditRecords,
    orphanedRefunds,
    duplicates,
    ambiguousMatches,
    unmatched,
    quarantine
  ]);

  // Search filter
  const filteredRows = useMemo(() => {
    if (!searchTerm.trim()) return allRows;
    const query = searchTerm.toLowerCase();

    return allRows.filter((row) => {
      const matchTxn = String(row.transaction_id || '').toLowerCase().includes(query);
      const matchRef = String(row.bank_reference || '').toLowerCase().includes(query);
      const matchOrder = String(row.order_id || '').toLowerCase().includes(query);
      const matchExpl = String(row.explanation || '').toLowerCase().includes(query);
      const matchClass = String(row.primary_classification || '').toLowerCase().includes(query);

      return matchTxn || matchRef || matchOrder || matchExpl || matchClass;
    });
  }, [allRows, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRows.length / pageSize) || 1;
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, currentPage, pageSize]);

  // Tab definitions with counts
  const tabs = [
    { id: 'ALL', label: 'All Matched', count: auditRecords.length },
    {
      id: 'CLEAN',
      label: 'Clean Matches',
      count: auditRecords.filter((r) => r.primary_classification === 'CLEAN_MATCH').length
    },
    {
      id: 'FOLLOWING_MONTH',
      label: 'Following Month',
      count: auditRecords.filter((r) => r.discrepancy_flags?.includes('FOLLOWING_MONTH_SETTLEMENT')).length
    },
    {
      id: 'ROUNDING',
      label: 'Rounding Variances',
      count: auditRecords.filter((r) => r.discrepancy_flags?.includes('ROUNDING_DIFFERENCE')).length
    },
    {
      id: 'MATERIAL',
      label: 'Material Mismatches',
      count: auditRecords.filter((r) => r.discrepancy_flags?.includes('MATERIAL_AMOUNT_MISMATCH')).length
    },
    {
      id: 'DUPLICATES',
      label: 'Duplicates',
      count:
        (duplicates.gateway_technical?.length || 0) +
        (duplicates.bank_technical?.length || 0)
    },
    { id: 'ORPHAN_REFUNDS', label: 'Orphan Refunds', count: orphanedRefunds.length },
    { id: 'AMBIGUOUS', label: 'Ambiguous', count: ambiguousMatches.length },
    {
      id: 'UNMATCHED',
      label: 'In-Transit / Credits',
      count:
        (unmatched.in_transit_gateway?.length || 0) +
        (unmatched.unmatched_bank_credits?.length || 0)
    },
    {
      id: 'QUARANTINE',
      label: 'Quarantine',
      count:
        (quarantine.invalid_rows?.gateway?.length || 0) +
        (quarantine.unsupported_currency?.gateway?.length || 0)
    }
  ];

  const getSeverityBadge = (severity, classification) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
  };

  const getVarianceBadge = (varianceStr) => {
    const num = parseFloat(String(varianceStr).replace(/[^0-9.-]/g, ''));
    if (isNaN(num) || num === 0) {
      return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
    }
    if (Math.abs(num) <= 0.05) {
      return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
    }
    return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
  };

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-2xl shadow-xl overflow-hidden">
      {/* Table Navigation & Search Header */}
      <div className="p-4 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/60">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by Transaction ID, Bank Ref, Order ID, or reason..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-4 py-2 bg-slate-800/80 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-400 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Total records found */}
        <div className="text-xs text-slate-400 flex items-center space-x-2">
          <span>Showing</span>
          <span className="font-semibold text-white">{filteredRows.length}</span>
          <span>record(s) in</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 font-medium text-slate-300">
            {activeTab}
          </span>
        </div>
      </div>

      {/* Filter Tabs Bar */}
      <div className="px-4 py-2 border-b border-slate-800 bg-slate-900/30 overflow-x-auto flex items-center space-x-2 scrollbar-none">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                onSelectTab(tab.id);
                setCurrentPage(1);
              }}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 font-semibold'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  isActive ? 'bg-blue-800 text-white' : 'bg-slate-800 text-slate-400'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-900/90 text-slate-400 uppercase font-semibold text-[10px] tracking-wider border-b border-slate-800">
            <tr>
              <th className="py-3 px-4">Status & Category</th>
              <th className="py-3 px-4">Gateway Txn ID</th>
              <th className="py-3 px-4">Bank Reference</th>
              <th className="py-3 px-4">Dates & Lag</th>
              <th className="py-3 px-4 text-right">Gateway Amount</th>
              <th className="py-3 px-4 text-right">Bank Gross</th>
              <th className="py-3 px-4 text-right">Gross Delta</th>
              <th className="py-3 px-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 text-slate-200">
            {paginatedRows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center space-y-2">
                    <AlertCircle className="w-8 h-8 text-slate-500" />
                    <span className="text-sm font-medium">No records match the active criteria.</span>
                    <span className="text-xs text-slate-500">
                      Try selecting another filter tab or clearing your search.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedRows.map((row) => (
                <tr
                  key={row.id}
                  className="hover:bg-slate-800/40 transition-colors group cursor-pointer"
                  onClick={() => onSelectRecord(row)}
                >
                  {/* Category & Flags */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col space-y-1">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border w-fit ${getSeverityBadge(
                          row.severity,
                          row.primary_classification
                        )}`}
                      >
                        {row.primary_classification}
                      </span>
                      {row.discrepancy_flags && row.discrepancy_flags.length > 1 && (
                        <div className="flex items-center space-x-1">
                          {row.discrepancy_flags
                            .filter((f) => f !== row.primary_classification)
                            .map((flag) => (
                              <span
                                key={flag}
                                className="text-[9px] text-slate-400 bg-slate-800 px-1.5 py-0.2 rounded"
                              >
                                +{flag}
                              </span>
                            ))}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Gateway Txn ID */}
                  <td className="py-3 px-4 font-mono font-medium text-slate-200">
                    <div>{row.transaction_id}</div>
                    {row.order_id && row.order_id !== 'N/A' && (
                      <div className="text-[10px] text-slate-400 font-sans">
                        Order: {row.order_id}
                      </div>
                    )}
                  </td>

                  {/* Bank Reference */}
                  <td className="py-3 px-4 font-mono text-slate-300">
                    {row.bank_reference || 'N/A'}
                  </td>

                  {/* Dates & Lag */}
                  <td className="py-3 px-4">
                    <div className="flex flex-col space-y-0.5">
                      <div className="flex items-center space-x-1 text-slate-300">
                        <span className="text-[10px] text-slate-400">GW:</span>
                        <span>{row.gateway_date?.slice(0, 10) || 'N/A'}</span>
                      </div>
                      <div className="flex items-center space-x-1 text-slate-400">
                        <span className="text-[10px] text-slate-500">BK:</span>
                        <span>{row.settlement_date?.slice(0, 10) || 'N/A'}</span>
                        {row.month_lag >= 1 && (
                          <span className="ml-1 px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-500/20 text-amber-400">
                            +{row.month_lag} mo
                          </span>
                        )}
                      </div>
                    </div>
                  </td>

                  {/* Gateway Amount */}
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                    {row.gateway_amount?.startsWith('₹') ? row.gateway_amount : `₹${row.gateway_amount}`}
                  </td>

                  {/* Bank Gross */}
                  <td className="py-3 px-4 text-right font-mono font-medium text-slate-200">
                    {row.bank_gross_amount?.startsWith('₹')
                      ? row.bank_gross_amount
                      : `₹${row.bank_gross_amount}`}
                  </td>

                  {/* Gross Delta */}
                  <td className="py-3 px-4 text-right">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-[11px] font-mono font-bold border ${getVarianceBadge(
                        row.gross_variance
                      )}`}
                    >
                      {row.gross_variance?.startsWith('₹') || isNaN(Number(row.gross_variance))
                        ? row.gross_variance
                        : `₹${row.gross_variance}`}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectRecord(row);
                      }}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-blue-600 text-slate-400 hover:text-white transition-colors"
                      title="Inspect Financial Audit Trail"
                    >
                      <Eye className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Bar */}
      <div className="p-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400 bg-slate-900/60">
        <div className="flex items-center space-x-2">
          <span>Rows per page:</span>
          <select
            value={pageSize}
            onChange={(e) => {
              setPageSize(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="bg-slate-800 border border-slate-700 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-blue-500"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
          </select>
          <span>
            Page {currentPage} of {totalPages}
          </span>
        </div>

        <div className="flex items-center space-x-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 disabled:hover:bg-slate-800"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}


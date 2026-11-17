import React from 'react';
import {
  X,
  ShieldAlert,
  ArrowRightLeft,
  FileText,
  Landmark,
  Scale,
  Calendar,
  CheckCircle2,
  Lightbulb,
  ExternalLink
} from 'lucide-react';

export default function DetailDrawer({ record, isOpen, onClose }) {
  if (!isOpen || !record) return null;

  const getSeverityPill = (severity) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-500/10 text-red-400 border-red-500/30';
      case 'HIGH':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 backdrop-blur-sm flex justify-end animate-fadeIn">
      <div className="w-full max-w-xl bg-slate-900 border-l border-slate-800 shadow-2xl h-full flex flex-col transform transition-transform duration-300 ease-in-out">
        {/* Drawer Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/80">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Transaction Audit Inspector
              </span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getSeverityPill(
                  record.severity
                )}`}
              >
                {record.severity} Severity
              </span>
            </div>
            <h2 className="text-lg font-bold text-white font-mono mt-1">
              {record.transaction_id || record.bank_reference}
            </h2>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Active Discrepancy Badges */}
          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Discrepancy Classifications
            </span>
            <div className="flex flex-wrap gap-2">
              {(record.discrepancy_flags || [record.primary_classification]).map((flag) => (
                <span
                  key={flag}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20"
                >
                  {flag}
                </span>
              ))}
              {record.match_stage && (
                <span className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                  Stage: {record.match_stage}
                </span>
              )}
            </div>
          </div>

          {/* Dual Ledger Side-by-Side Comparison */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Gateway Ledger Card */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              <div className="flex items-center space-x-2 text-blue-400 font-semibold text-xs border-b border-slate-700/60 pb-2">
                <FileText className="w-4 h-4" />
                <span>1. Payment Gateway Capture</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Transaction ID</span>
                  <span className="font-mono text-slate-200">{record.transaction_id}</span>
                </div>
                {record.order_id && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Order ID</span>
                    <span className="font-mono text-slate-200">{record.order_id}</span>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Capture Date</span>
                  <span className="text-slate-200">{record.gateway_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Gross Amount</span>
                  <span className="text-sm font-bold font-mono text-white">
                    {record.gateway_amount?.startsWith('₹')
                      ? record.gateway_amount
                      : `₹${record.gateway_amount}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Bank Ledger Card */}
            <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/60 space-y-3">
              <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs border-b border-slate-700/60 pb-2">
                <Landmark className="w-4 h-4" />
                <span>2. Bank Settlement File</span>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Bank Reference</span>
                  <span className="font-mono text-slate-200">{record.bank_reference || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Settlement Date</span>
                  <span className="text-slate-200">{record.settlement_date || 'N/A'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase">Bank Gross Amount</span>
                  <span className="text-sm font-bold font-mono text-white">
                    {record.bank_gross_amount?.startsWith('₹')
                      ? record.bank_gross_amount
                      : `₹${record.bank_gross_amount}`}
                  </span>
                </div>
                {record.bank_fee_amount && record.bank_fee_amount !== '₹0.00' && (
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase">Fee / Net</span>
                    <span className="text-slate-300">
                      Fee: {record.bank_fee_amount} | Net: {record.bank_net_amount}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Variance & Mathematical Breakdown */}
          <div className="p-4 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Gross Delta Calculation:</span>
              <span className="font-mono font-bold text-white">
                Bank Gross - Gateway Amount
              </span>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-slate-700 text-sm">
              <span className="text-slate-300 font-medium">Reconciled Variance:</span>
              <span
                className={`font-mono font-bold text-base ${
                  record.gross_variance === '0.00' || record.gross_variance === '₹0.00'
                    ? 'text-emerald-400'
                    : 'text-rose-400'
                }`}
              >
                {record.gross_variance?.startsWith('₹')
                  ? record.gross_variance
                  : `₹${record.gross_variance}`}
              </span>
            </div>
            {record.month_lag >= 1 && (
              <div className="flex items-center justify-between text-xs text-amber-400 pt-1">
                <span>Month Lag:</span>
                <span className="font-semibold">
                  +{record.month_lag} month(s) crossing calendar boundary
                </span>
              </div>
            )}
          </div>

          {/* Root Cause Explanation */}
          <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/20 space-y-1.5">
            <div className="flex items-center space-x-2 text-blue-400 font-semibold text-xs">
              <ShieldAlert className="w-4 h-4" />
              <span>Root Cause Explanation</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {record.explanation || 'Gross amounts match identically with no timing or rounding variances detected.'}
            </p>
          </div>

          {/* Remediation & Audit Recommendation */}
          <div className="p-4 rounded-xl bg-emerald-500/5 border border-emerald-500/20 space-y-1.5">
            <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-xs">
              <Lightbulb className="w-4 h-4" />
              <span>Recommended Accounting Remediation</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {record.remediation || 'No manual intervention required. Item cleared for automatic ledger posting.'}
            </p>
          </div>
        </div>

        {/* Drawer Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            Audit ID: {record.id}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
}


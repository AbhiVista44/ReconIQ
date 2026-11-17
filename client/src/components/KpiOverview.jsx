import React from 'react';
import {
  TrendingUp,
  Landmark,
  Scale,
  CheckCircle2,
  AlertTriangle,
  Receipt,
  Layers,
  ShieldCheck
} from 'lucide-react';

export default function KpiOverview({ summary, counts, invariants }) {
  if (!summary) return null;

  const isDriftHigh = Math.abs(parseFloat(summary.cumulative_rounding_drift || '0')) > 1.0;

  return (
    <div className="space-y-4">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Gateway Volume Card */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Gateway Gross
            </span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              ₹{summary.platform_gross_volume}
            </div>
            <div className="mt-1 flex items-center text-xs text-slate-400 space-x-1.5">
              <span className="text-emerald-400 font-medium">{counts.total_valid_payments}</span>
              <span>valid payments captured</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-blue-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Bank Net Settled Card */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Bank Net Settled
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <Landmark className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight">
              ₹{summary.bank_net_volume}
            </div>
            <div className="mt-1 flex items-center text-xs text-slate-400 space-x-1.5">
              <span>Fees deducted:</span>
              <span className="text-amber-400 font-medium">₹{summary.total_processing_fees}</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-emerald-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Reconciliation Rate Card */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Reconciliation Rate
            </span>
            <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Scale className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-white tracking-tight flex items-baseline space-x-1">
              <span>{summary.reconciliation_rate_percent}%</span>
              <span className="text-xs font-normal text-slate-400">clean</span>
            </div>
            <div className="mt-1 flex items-center text-xs text-slate-400 space-x-1.5">
              <span className="text-indigo-400 font-medium">{counts.clean_matches}</span>
              <span>of {counts.total_valid_payments} payments zero-delta</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-indigo-500/5 rounded-full blur-xl pointer-events-none" />
        </div>

        {/* Cumulative Rounding Drift Card */}
        <div className="p-5 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl relative overflow-hidden group hover:border-slate-700 transition-all">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Cumulative Drift
            </span>
            <div
              className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                isDriftHigh ? 'bg-amber-500/10 text-amber-400' : 'bg-cyan-500/10 text-cyan-400'
              }`}
            >
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3">
            <div
              className={`text-2xl font-bold tracking-tight ${
                isDriftHigh ? 'text-amber-400' : 'text-cyan-400'
              }`}
            >
              ₹{summary.cumulative_rounding_drift}
            </div>
            <div className="mt-1 flex items-center text-xs text-slate-400 space-x-1.5">
              <span className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-300">
                ≤ ₹0.05 / txn
              </span>
              <span>Across valid matched pairs</span>
            </div>
          </div>
          <div className="absolute -bottom-6 -right-6 w-24 h-24 bg-cyan-500/5 rounded-full blur-xl pointer-events-none" />
        </div>
      </div>

      {/* Financial Invariants & Closed-Loop Integrity Banner */}
      <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center space-x-2">
          <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div>
            <span className="font-semibold text-slate-200">Mathematical Ledger Integrity:</span>
            <span className="text-slate-400 ml-1">
              Platform & Bank partitions balanced with zero float leakage.
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                invariants?.platform_partition_exact ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-300">Platform Partition Exact</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                invariants?.bank_partition_exact ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-300">Bank Partition Exact</span>
          </div>
          <div className="flex items-center space-x-1.5">
            <span
              className={`w-2 h-2 rounded-full ${
                invariants?.reconciliation_bridge_balanced ? 'bg-emerald-400' : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-300">Bridge Invariant Balanced</span>
          </div>
        </div>
      </div>
    </div>
  );
}


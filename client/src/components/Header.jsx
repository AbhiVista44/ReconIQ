import React from 'react';
import { ShieldCheck, PlayCircle, Download, RefreshCw, AlertCircle, FileSpreadsheet } from 'lucide-react';

export default function Header({
  onRunDemo,
  onOpenUpload,
  onExport,
  loading,
  hasData,
  apiStatus,
  recordsCount
}) {
  return (
    <header className="border-b border-slate-800 bg-[#0F172A]/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-lg tracking-tight text-white">ReconIQ</span>
              <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20">
                FinTech v2.0
              </span>
            </div>
            <p className="text-xs text-slate-400">Payment Gateway & Bank Settlement Reconciliation Engine</p>
          </div>
        </div>

        {/* Status & Actions */}
        <div className="flex items-center space-x-3">
          {/* API Health indicator */}
          <div className="hidden sm:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-slate-800/80 border border-slate-700/60 text-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                apiStatus === 'UP' ? 'bg-emerald-400 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-300 font-medium">
              {apiStatus === 'UP' ? 'Engine Ready' : 'Connecting...'}
            </span>
          </div>

          {/* Upload CSVs Button */}
          <button
            onClick={onOpenUpload}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border border-slate-700 text-xs font-semibold transition-all disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4 text-blue-400" />
            <span>Upload CSVs</span>
          </button>

          {/* Quick Demo Data Button */}
          <button
            onClick={onRunDemo}
            disabled={loading}
            className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <PlayCircle className="w-4 h-4 text-blue-200" />
            )}
            <span>Load Demo Data</span>
          </button>

          {/* Export Report Button */}
          {hasData && (
            <button
              onClick={onExport}
              disabled={loading}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-all"
              title="Export Full Audit Report to CSV"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span className="hidden md:inline">Export CSV</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}


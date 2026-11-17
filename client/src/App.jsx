import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import KpiOverview from './components/KpiOverview';
import DiscrepancyBreakdown from './components/DiscrepancyBreakdown';
import AuditTable from './components/AuditTable';
import DetailDrawer from './components/DetailDrawer';
import UploadModal from './components/UploadModal';
import {
  checkHealth,
  runDemoReconciliation,
  uploadReconciliationFiles,
  exportAuditReport
} from './services/api';
import {
  ShieldCheck,
  PlayCircle,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  CalendarClock,
  Coins,
  Copy,
  Undo2,
  RefreshCw
} from 'lucide-react';

export default function App() {
  const [reconciliationData, setReconciliationData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('CONNECTING');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('ALL');
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [toast, setToast] = useState(null);

  // Check backend health on initial load
  useEffect(() => {
    const verifyBackend = async () => {
      try {
        const health = await checkHealth();
        if (health.status === 'UP') {
          setApiStatus('UP');
        } else {
          setApiStatus('DOWN');
        }
      } catch (err) {
        setApiStatus('DOWN');
      }
    };

    verifyBackend();
  }, []);

  const showToast = (message, type = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  // Run Demo Reconciliation using seeded dataset
  const handleRunDemo = async () => {
    try {
      setLoading(true);
      const res = await runDemoReconciliation();
      if (res.success && res.data) {
        setReconciliationData(res.data);
        setActiveTab('ALL');
        showToast('Demo dataset loaded & reconciled successfully!', 'success');
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      showToast('Failed to run demo reconciliation. Check server connection.', 'error');
    }
  };

  // Upload Custom CSV files
  const handleUploadFiles = async (paymentFile, bankFile) => {
    try {
      setLoading(true);
      const res = await uploadReconciliationFiles(paymentFile, bankFile);
      if (res.success && res.data) {
        setReconciliationData(res.data);
        setIsUploadOpen(false);
        setActiveTab('ALL');
        showToast('CSV files ingested & reconciled successfully!', 'success');
      }
      setLoading(false);
    } catch (err) {
      setLoading(false);
      showToast(
        err.response?.data?.details || 'Failed to reconcile uploaded files.',
        'error'
      );
    }
  };

  // Export full audit report
  const handleExportCSV = async () => {
    if (!reconciliationData || !reconciliationData.audit_records) return;
    try {
      showToast('Generating audit report export...', 'info');
      await exportAuditReport(reconciliationData.audit_records);
      showToast('Audit report downloaded successfully.', 'success');
    } catch (err) {
      showToast('Failed to export CSV report.', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B0F19] text-slate-100 flex flex-col font-sans">
      {/* App Header */}
      <Header
        onRunDemo={handleRunDemo}
        onOpenUpload={() => setIsUploadOpen(true)}
        onExport={handleExportCSV}
        loading={loading}
        hasData={!!reconciliationData}
        apiStatus={apiStatus}
        recordsCount={reconciliationData?.audit_records?.length || 0}
      />

      {/* Global Toast Notification */}
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 flex items-center space-x-2 px-4 py-3 rounded-xl shadow-2xl border text-xs font-medium animate-bounce bg-slate-900 border-slate-700 text-slate-200">
          {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400" />}
          {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400" />}
          {toast.type === 'info' && <RefreshCw className="w-4 h-4 text-blue-400" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Loading Overlay */}
        {loading && (
          <div className="p-8 rounded-2xl bg-slate-900/60 border border-slate-800 text-center flex flex-col items-center justify-center space-y-3">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
            <h3 className="text-sm font-semibold text-white">
              Running High-Precision Reconciliation Engine...
            </h3>
            <p className="text-xs text-slate-400 max-w-md">
              Validating RFC 4180 CSVs, hashing indexes, computing bipartite composite matches, and verifying dual-ledger invariants.
            </p>
          </div>
        )}

        {/* Empty State / Welcome Screen */}
        {!loading && !reconciliationData && (
          <div className="py-12 flex flex-col items-center justify-center text-center space-y-8 max-w-3xl mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-xl shadow-blue-500/20">
              <ShieldCheck className="w-9 h-9 text-white" />
            </div>

            <div className="space-y-2">
              <h1 className="text-3xl font-extrabold text-white tracking-tight sm:text-4xl">
                Smart Payment Reconciliation & Anomaly Engine
              </h1>
              <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
                ReconIQ cross-references payment gateway captures against acquiring bank settlement files to expose cutoff timing, sub-cent rounding drifts, duplicate charges, and rogue refunds.
              </p>
            </div>

            {/* Quick Action CTA Buttons */}
            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={handleRunDemo}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm shadow-xl shadow-blue-600/30 transition-all hover:scale-105"
              >
                <PlayCircle className="w-5 h-5 text-blue-200" />
                <span>Load Synthetic Assessment Demo</span>
              </button>

              <button
                onClick={() => setIsUploadOpen(true)}
                className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold text-sm transition-all"
              >
                <FileSpreadsheet className="w-5 h-5 text-blue-400" />
                <span>Upload Custom CSV Files</span>
              </button>
            </div>

            {/* Assessment Mandatory Feature Highlights */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 w-full pt-4 text-left">
              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-1.5">
                <CalendarClock className="w-5 h-5 text-amber-400" />
                <h4 className="text-xs font-bold text-white">Cross-Month Cutoff</h4>
                <p className="text-[11px] text-slate-400">
                  Continuous period indexing detects cross-month and cross-year settlement lag.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-1.5">
                <Coins className="w-5 h-5 text-blue-400" />
                <h4 className="text-xs font-bold text-white">Rounding Drift (≤ ₹0.05)</h4>
                <p className="text-[11px] text-slate-400">
                  Decimal.js sums sub-cent drift only over valid matched pairs.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-1.5">
                <Copy className="w-5 h-5 text-purple-400" />
                <h4 className="text-xs font-bold text-white">Duplicate Quarantine</h4>
                <p className="text-[11px] text-slate-400">
                  Separates technical duplicate IDs from legitimate repeat orders.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 space-y-1.5">
                <Undo2 className="w-5 h-5 text-red-400" />
                <h4 className="text-xs font-bold text-white">Orphaned Refunds</h4>
                <p className="text-[11px] text-slate-400">
                  Strictly validates parent transaction capture ID and caps excessive refunds.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Dashboard View (When Reconciliation Data is Active) */}
        {!loading && reconciliationData && (
          <div className="space-y-8 animate-fadeIn">
            {/* Row 1: KPI Overview Cards & Mathematical Invariant Status */}
            <KpiOverview
              summary={reconciliationData.summary}
              counts={reconciliationData.counts}
              invariants={reconciliationData.invariants}
            />

            {/* Row 2: Discrepancy Breakdown Slices */}
            <DiscrepancyBreakdown
              counts={reconciliationData.counts}
              summary={reconciliationData.summary}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
            />

            {/* Row 3: Comprehensive Audit Table with Multi-Tab Filtering & Search */}
            <AuditTable
              auditRecords={reconciliationData.audit_records}
              orphanedRefunds={reconciliationData.orphaned_refunds}
              duplicates={reconciliationData.duplicates}
              ambiguousMatches={reconciliationData.ambiguous_matches}
              unmatched={reconciliationData.unmatched}
              quarantine={reconciliationData.quarantine}
              activeTab={activeTab}
              onSelectTab={setActiveTab}
              onSelectRecord={setSelectedRecord}
            />
          </div>
        )}
      </main>

      {/* Transaction Detail Slide-Over Drawer */}
      <DetailDrawer
        record={selectedRecord}
        isOpen={!!selectedRecord}
        onClose={() => setSelectedRecord(null)}
      />

      {/* File Upload Modal */}
      <UploadModal
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onUpload={handleUploadFiles}
        loading={loading}
      />
    </div>
  );
}


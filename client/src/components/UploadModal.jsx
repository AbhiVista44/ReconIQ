import React, { useState, useRef } from 'react';
import { UploadCloud, FileText, CheckCircle2, X, AlertCircle, Download, ArrowRight } from 'lucide-react';
import { getSyntheticData } from '../services/api';

export default function UploadModal({ isOpen, onClose, onUpload, loading }) {
  const [paymentFile, setPaymentFile] = useState(null);
  const [bankFile, setBankFile] = useState(null);
  const [downloadingSample, setDownloadingSample] = useState(false);
  const [error, setError] = useState('');

  const paymentInputRef = useRef(null);
  const bankInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e, setFile) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (!file.name.endsWith('.csv')) {
        setError('Please select a valid .csv file.');
        return;
      }
      setError('');
      setFile(file);
    }
  };

  const handleDownloadSampleFiles = async () => {
    try {
      setDownloadingSample(true);
      setError('');
      const data = await getSyntheticData();

      // Download payment CSV
      const blob1 = new Blob([data.payment_csv], { type: 'text/csv' });
      const url1 = window.URL.createObjectURL(blob1);
      const link1 = document.createElement('a');
      link1.href = url1;
      link1.setAttribute('download', 'sample_payment_transactions.csv');
      document.body.appendChild(link1);
      link1.click();
      link1.remove();

      // Download bank CSV
      const blob2 = new Blob([data.bank_csv], { type: 'text/csv' });
      const url2 = window.URL.createObjectURL(blob2);
      const link2 = document.createElement('a');
      link2.href = url2;
      link2.setAttribute('download', 'sample_bank_settlement.csv');
      document.body.appendChild(link2);
      link2.click();
      link2.remove();

      setDownloadingSample(false);
    } catch (err) {
      setDownloadingSample(false);
      setError('Failed to download sample CSVs.');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!paymentFile || !bankFile) {
      setError('Both Payment Transactions and Bank Settlement CSVs are required.');
      return;
    }
    setError('');
    onUpload(paymentFile, bankFile);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/60">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-5 h-5 text-blue-400" />
              Upload Reconciliation CSV Files
            </h2>
            <p className="text-xs text-slate-400">
              Provide both the Payment Gateway transactions and the Bank Settlement records in INR.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {error && (
            <div className="flex items-center space-x-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Payment Dropzone */}
            <div
              onClick={() => paymentInputRef.current.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                paymentFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-blue-500 hover:bg-slate-800/40 bg-slate-900/40'
              }`}
            >
              <input
                ref={paymentInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFileChange(e, setPaymentFile)}
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                {paymentFile ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                      {paymentFile.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {(paymentFile.size / 1024).toFixed(1)} KB • Ready
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      1. Payment Gateway CSV
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Click to choose transaction captures
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Bank Dropzone */}
            <div
              onClick={() => bankInputRef.current.click()}
              className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                bankFile
                  ? 'border-emerald-500/50 bg-emerald-500/5'
                  : 'border-slate-700 hover:border-blue-500 hover:bg-slate-800/40 bg-slate-900/40'
              }`}
            >
              <input
                ref={bankInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => handleFileChange(e, setBankFile)}
              />
              <div className="flex flex-col items-center justify-center space-y-2">
                {bankFile ? (
                  <>
                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                    <span className="text-xs font-semibold text-white truncate max-w-[200px]">
                      {bankFile.name}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {(bankFile.size / 1024).toFixed(1)} KB • Ready
                    </span>
                  </>
                ) : (
                  <>
                    <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                      <FileText className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-semibold text-slate-200">
                      2. Bank Settlement CSV
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Click to choose acquirer settlement file
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Sample CSV Download Bar */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-800/60 border border-slate-800 text-xs">
            <span className="text-slate-400">Need paired sample files for testing?</span>
            <button
              type="button"
              onClick={handleDownloadSampleFiles}
              disabled={downloadingSample}
              className="flex items-center space-x-1.5 text-blue-400 hover:text-blue-300 font-semibold"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{downloadingSample ? 'Downloading...' : 'Download Sample CSVs'}</span>
            </button>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end space-x-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !paymentFile || !bankFile}
              className="flex items-center space-x-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
            >
              <span>{loading ? 'Reconciling Datasets...' : 'Run Reconciliation'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000',
  timeout: 30000
});

export const checkHealth = async () => {
  const response = await api.get('/api/health');
  return response.data;
};

export const getSyntheticData = async () => {
  const response = await api.get('/api/reconcile/synthetic-data');
  return response.data;
};

export const runDemoReconciliation = async () => {
  const response = await api.post('/api/reconcile/run-demo');
  return response.data;
};

export const uploadReconciliationFiles = async (paymentFile, bankFile) => {
  const formData = new FormData();
  formData.append('payment_file', paymentFile);
  formData.append('bank_file', bankFile);

  const response = await api.post('/api/reconcile/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const exportAuditReport = async (auditRecords) => {
  const response = await api.post(
    '/api/reconcile/export',
    { audit_records: auditRecords },
    { responseType: 'blob' }
  );

  // Trigger browser download
  const blob = new Blob([response.data], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'reconiq_audit_report.csv');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

export default api;


import express from 'express';
import cors from 'cors';
import reconciliationRoutes from './routes/reconciliationRoutes.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// API Routes
app.use('/api/reconcile', reconciliationRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    service: 'ReconIQ Backend Reconciliation Engine',
    timestamp: new Date().toISOString()
  });
});

export default app;


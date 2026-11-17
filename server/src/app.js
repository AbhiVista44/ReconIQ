import express from 'express';
import cors from 'cors';
import reconciliationRoutes from './routes/reconciliationRoutes.js';

const app = express();

const corsOptions = {
  origin: process.env.CLIENT_URL ? [process.env.CLIENT_URL, /.*\.vercel\.app$/] : true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Root welcome endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'ReconIQ Backend Reconciliation Engine API',
    status: 'ACTIVE',
    endpoints: {
      health: '/api/health',
      reconcile_upload: 'POST /api/reconcile/upload',
      reconcile_demo: 'POST /api/reconcile/run-demo',
      synthetic_data: 'GET /api/reconcile/synthetic-data',
      export_csv: 'POST /api/reconcile/export'
    }
  });
});

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

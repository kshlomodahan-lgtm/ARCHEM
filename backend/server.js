require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');
const path    = require('path');

process.on('unhandledRejection', (reason) => {
  console.error('[unhandledRejection]', reason?.message || reason);
});
process.on('uncaughtException', (err) => {
  console.error('[uncaughtException]', err.message);
});

const app = express();
app.set('trust proxy', true);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({ origin: '*', methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] }));
app.use(express.json());
app.use('/api', (_req, res, next) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  next();
});

// ── Static frontend (production build) ─────────────────
app.use(express.static(path.join(__dirname, '../frontend/dist/archem/browser')));

// ── API Routes ──────────────────────────────────────────
app.use('/api/auth',      require('./routes/auth'));
app.use('/api/orders',    require('./routes/orders'));
app.use('/api/suppliers', require('./routes/suppliers'));
app.use('/api/customers', require('./routes/customers'));
app.use('/api/meta',         require('./routes/meta'));
app.use('/api/order-intake', require('./routes/orderIntake'));
app.use('/api/refdata',      require('./routes/refdata'));
app.use('/api/attributes',   require('./routes/attributes'));
app.use('/api/catalog',      require('./routes/catalog'));

app.use('/api/{*path}', (_req, res) =>
  res.status(404).json({ success: false, message: 'Endpoint not found' })
);

// SPA fallback
app.use((_req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/dist/archem/browser/index.html'));
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✅  ARCHEM Server running on http://localhost:${PORT}`);
  console.log(`📦  DB: ${process.env.DB_SERVER} / ${process.env.DB_NAME}\n`);
});

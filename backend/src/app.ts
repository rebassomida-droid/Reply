import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

import authRoutes from './routes/auth';
import agentRoutes from './routes/agent';
import documentsRoutes from './routes/documents';
import callsRoutes from './routes/calls';
import vapiRoutes from './routes/vapi';
import whatsappRoutes from './routes/whatsapp';
import operatorsRoutes from './routes/operators';
import companiesRoutes from './routes/companies';

const app = express();

// CORS — supporta origini multiple separate da virgola (utile per preview deployments Vercel)
const rawOrigins = process.env.FRONTEND_URL || 'http://localhost:5173';
const allowedOrigins = rawOrigins.split(',').map((s) => s.trim());

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Webhook Vapi/Twilio non mandano Origin — permettiamo sempre
      if (!origin) return callback(null, true);
      // Origini configurate o qualsiasi preview *.vercel.app
      if (allowedOrigins.includes(origin) || origin.endsWith('.vercel.app')) {
        return callback(null, true);
      }
      callback(null, false);
    },
    credentials: true,
  }),
);
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsers — il webhook Vapi arriva come raw JSON, WhatsApp come urlencoded
app.use('/api/calls/webhook', express.raw({ type: '*/*' }));
app.use('/api/whatsapp/webhook', express.urlencoded({ extended: false }));
app.use(express.json({ limit: '10mb' }));

// File statici (uploads) — solo fuori da Vercel; su Vercel il filesystem è read-only
if (!process.env.VERCEL) {
  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
}

app.use('/api/auth', authRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/agent', agentRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/vapi', vapiRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/operators', operatorsRoutes);

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

export default app;

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import pool from '../db';

export interface AuthRequest extends Request {
  user?: { id: string };
  companyId?: number;
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Token mancante' });
    return;
  }
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'secret') as { id: string };
    req.user = payload;

    // company_id dall'header X-Company-ID
    const companyHeader = req.headers['x-company-id'];
    if (companyHeader) {
      const cid = parseInt(companyHeader as string, 10);
      if (!isNaN(cid)) req.companyId = cid;
    }

    next();
  } catch {
    res.status(401).json({ error: 'Token non valido o scaduto' });
  }
}

// Middleware che richiede company_id valido
export function requireCompany(req: AuthRequest, res: Response, next: NextFunction): void {
  if (!req.companyId) {
    res.status(400).json({ error: 'X-Company-ID header mancante' });
    return;
  }
  // Verifica che la company esista (async, non blocca se DB è lento)
  pool.query('SELECT id FROM companies WHERE id=$1', [req.companyId])
    .then((r) => {
      if (r.rows.length === 0) {
        res.status(404).json({ error: 'Azienda non trovata' });
      } else {
        next();
      }
    })
    .catch(() => next()); // se fallisce il check, lascia passare
}

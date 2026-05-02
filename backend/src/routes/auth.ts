import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();

// Login — restituisce token + lista aziende
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  const { password } = req.body;
  if (!password) {
    res.status(400).json({ error: 'Password richiesta' });
    return;
  }

  const adminPassword = process.env.ADMIN_PASSWORD || 'housetag2024';
  const isBcryptHash = adminPassword.startsWith('$2');
  const isValid = isBcryptHash
    ? await bcrypt.compare(password, adminPassword)
    : password === adminPassword;

  if (!isValid) {
    res.status(401).json({ error: 'Password non corretta' });
    return;
  }

  const token = jwt.sign({ id: 'admin' }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });

  // Restituisce le aziende disponibili
  const companies = await pool.query('SELECT * FROM companies ORDER BY created_at ASC').catch(() => ({ rows: [] }));

  res.json({ token, expiresIn: '7d', companies: companies.rows });
});

// Verifica token
router.get('/verify', (req: Request, res: Response): void => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ valid: false }); return; }
  try {
    jwt.verify(token, process.env.JWT_SECRET || 'secret');
    res.json({ valid: true });
  } catch {
    res.status(401).json({ valid: false });
  }
});

// Lista aziende (autenticato)
router.get('/companies', authMiddleware, async (_req: AuthRequest, res: Response): Promise<void> => {
  const result = await pool.query('SELECT * FROM companies ORDER BY created_at ASC');
  res.json(result.rows);
});

export default router;

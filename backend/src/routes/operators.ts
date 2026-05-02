import { Router, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

async function ensureTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS operators (
      id SERIAL PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      phone_number VARCHAR(50) NOT NULL,
      role VARCHAR(100),
      active BOOLEAN DEFAULT true,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);
  await pool.query(`ALTER TABLE operators ADD COLUMN IF NOT EXISTS role VARCHAR(100)`).catch(() => {});
  await pool.query(`ALTER TABLE operators ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`).catch(() => {});
}

// Lista operatori
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  await ensureTable();
  const cid = req.companyId;
  const query = cid
    ? 'SELECT * FROM operators WHERE company_id=$1 ORDER BY id ASC'
    : 'SELECT * FROM operators ORDER BY id ASC';
  const result = await pool.query(query, cid ? [cid] : []);
  res.json(result.rows);
});

// Crea operatore
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  await ensureTable();
  const { name, phone_number, role = '', active = true } = req.body;
  const cid = req.companyId || null;
  if (!name || !phone_number) {
    res.status(400).json({ error: 'name e phone_number sono obbligatori' });
    return;
  }
  const result = await pool.query(
    'INSERT INTO operators (name, phone_number, role, active, company_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [name.trim(), phone_number.trim(), role.trim(), active, cid]
  );
  res.status(201).json(result.rows[0]);
});

// Aggiorna operatore
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, phone_number, role, active } = req.body;
  const current = await pool.query('SELECT * FROM operators WHERE id=$1', [id]);
  if (current.rows.length === 0) {
    res.status(404).json({ error: 'Operatore non trovato' });
    return;
  }
  const cur = current.rows[0];
  const result = await pool.query(
    'UPDATE operators SET name=$1, phone_number=$2, role=$3, active=$4 WHERE id=$5 RETURNING *',
    [
      name ?? cur.name,
      phone_number ?? cur.phone_number,
      role !== undefined ? role : cur.role,
      active !== undefined ? active : cur.active,
      id,
    ]
  );
  res.json(result.rows[0]);
});

// Elimina operatore
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  await pool.query('DELETE FROM operators WHERE id=$1', [req.params.id]);
  res.json({ success: true });
});

export default router;

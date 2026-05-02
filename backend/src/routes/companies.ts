import { Router, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// Lista aziende
router.get('/', async (_req: AuthRequest, res: Response): Promise<void> => {
  const result = await pool.query('SELECT * FROM companies ORDER BY created_at ASC');
  res.json(result.rows);
});

// Crea azienda
router.post('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const { name, color = '#3B82F6' } = req.body;
  if (!name?.trim()) {
    res.status(400).json({ error: 'name obbligatorio' });
    return;
  }
  const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  const result = await pool.query(
    'INSERT INTO companies (name, slug, color) VALUES ($1, $2, $3) RETURNING *',
    [name.trim(), slug, color]
  );
  const company = result.rows[0];

  // Crea agent_config di default per la nuova azienda
  await pool.query(
    `INSERT INTO agent_config (company_id, name, persona_prompt, language, voice_id, first_message, end_call_message, transfer_trigger, updated_at)
     VALUES ($1, $2, $3, 'it', 'it-IT-ElsaNeural', $4, $5, $6, NOW())`,
    [
      company.id,
      'Assistente AI',
      `Sei un assistente virtuale di ${name}. Rispondi in italiano con tono professionale e cordiale.`,
      `Buongiorno, sono l'assistente di ${name}. Come posso aiutarla?`,
      `Grazie per aver contattato ${name}. Buona giornata!`,
      'Non so rispondere, hai bisogno del professionista, è urgente',
    ]
  );

  res.status(201).json(company);
});

// Aggiorna azienda
router.put('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const { name, color } = req.body;
  const result = await pool.query(
    'UPDATE companies SET name=$1, color=$2 WHERE id=$3 RETURNING *',
    [name, color, id]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Azienda non trovata' });
    return;
  }
  res.json(result.rows[0]);
});

// Elimina azienda (con tutte le sue risorse)
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  await pool.query('DELETE FROM operators WHERE company_id=$1', [id]).catch(() => {});
  await pool.query('DELETE FROM document_chunks WHERE document_id IN (SELECT id FROM documents WHERE company_id=$1)', [id]).catch(() => {});
  await pool.query('DELETE FROM documents WHERE company_id=$1', [id]).catch(() => {});
  await pool.query('DELETE FROM call_logs WHERE company_id=$1', [id]).catch(() => {});
  await pool.query('DELETE FROM agent_config WHERE company_id=$1', [id]).catch(() => {});
  await pool.query('DELETE FROM companies WHERE id=$1', [id]);
  res.json({ success: true });
});

export default router;

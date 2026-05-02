import { Router, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { extractText } from '../services/parser.service';
import { indexDocument } from '../services/rag.service';

const router = Router();
router.use(authMiddleware);

// Su Vercel il filesystem è read-only tranne /tmp (ephemeral, solo durante l'invocazione)
const uploadsDir = process.env.VERCEL ? '/tmp' : path.join(__dirname, '../../uploads');
if (!process.env.VERCEL && !fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Tipo file non supportato. Usa PDF, DOCX o TXT.'));
  },
});

// Lista documenti (per company)
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const cid = req.companyId;
  const query = cid
    ? 'SELECT id, filename, original_name, file_type, chunk_count, file_size, uploaded_at FROM documents WHERE company_id=$1 ORDER BY uploaded_at DESC'
    : 'SELECT id, filename, original_name, file_type, chunk_count, file_size, uploaded_at FROM documents ORDER BY uploaded_at DESC';
  const result = await pool.query(query, cid ? [cid] : []);
  res.json(result.rows);
});

// Upload documento
router.post('/', upload.single('file'), async (req: AuthRequest, res: Response): Promise<void> => {
  if (!req.file) {
    res.status(400).json({ error: 'File richiesto' });
    return;
  }

  const fileType = path.extname(req.file.originalname).replace('.', '').toLowerCase();
  const cid = req.companyId || null;
  let docId: number | null = null;

  try {
    const insertResult = await pool.query(
      `INSERT INTO documents (filename, original_name, file_type, file_size, content, company_id)
       VALUES ($1,$2,$3,$4,'',$5) RETURNING id`,
      [req.file.filename, req.file.originalname, fileType, req.file.size, cid]
    );
    docId = insertResult.rows[0].id;

    const text = await extractText(req.file.path, fileType);
    await pool.query('UPDATE documents SET content=$1 WHERE id=$2', [text, docId]);

    const chunkCount = await indexDocument(docId, text);
    const doc = await pool.query('SELECT * FROM documents WHERE id=$1', [docId]);
    res.json({ ...doc.rows[0], chunkCount });
  } catch (err: unknown) {
    if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    if (docId) await pool.query('DELETE FROM documents WHERE id=$1', [docId]).catch(() => {});
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    res.status(500).json({ error: `Errore elaborazione documento: ${message}` });
  }
});

// Elimina documento
router.delete('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const { id } = req.params;
  const cid = req.companyId;
  const query = cid
    ? 'SELECT filename FROM documents WHERE id=$1 AND company_id=$2'
    : 'SELECT filename FROM documents WHERE id=$1';
  const doc = await pool.query(query, cid ? [id, cid] : [id]);
  if (doc.rows.length === 0) {
    res.status(404).json({ error: 'Documento non trovato' });
    return;
  }
  const filePath = path.join(uploadsDir, doc.rows[0].filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  await pool.query('DELETE FROM documents WHERE id=$1', [id]);
  res.json({ success: true });
});

export default router;

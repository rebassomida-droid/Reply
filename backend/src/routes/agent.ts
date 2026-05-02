import { Router, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { createAssistant, updateAssistant } from '../services/vapi.service';

const router = Router();
router.use(authMiddleware);

// Ottieni configurazione agente della company corrente
router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const cid = req.companyId;
  const query = cid
    ? 'SELECT * FROM agent_config WHERE company_id=$1 ORDER BY id LIMIT 1'
    : 'SELECT * FROM agent_config ORDER BY id LIMIT 1';
  const result = await pool.query(query, cid ? [cid] : []);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Configurazione non trovata' });
    return;
  }
  res.json(result.rows[0]);
});

// Salva configurazione agente
router.put('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const {
    name, persona_prompt, transfer_number, transfer_trigger, language, voice_id,
    first_message, end_call_message, vapi_assistant_id,
    voice_speed, voice_stability, voice_similarity_boost, voice_style, voice_style_degree, voice_use_speaker_boost,
  } = req.body;
  const cid = req.companyId;

  const query = cid
    ? 'SELECT * FROM agent_config WHERE company_id=$1 ORDER BY id LIMIT 1'
    : 'SELECT * FROM agent_config ORDER BY id LIMIT 1';
  const existing = await pool.query(query, cid ? [cid] : []);

  let config;
  if (existing.rows.length === 0) {
    const result = await pool.query(
      `INSERT INTO agent_config (name, persona_prompt, transfer_number, transfer_trigger, language, voice_id, first_message, end_call_message, vapi_assistant_id, company_id,
         voice_speed, voice_stability, voice_similarity_boost, voice_style, voice_style_degree, voice_use_speaker_boost, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()) RETURNING *`,
      [name, persona_prompt, transfer_number, transfer_trigger, language, voice_id, first_message, end_call_message,
       vapi_assistant_id || null, cid || null,
       voice_speed ?? 1.0, voice_stability ?? 0.5, voice_similarity_boost ?? 0.75,
       voice_style ?? 0.0, voice_style_degree ?? 1.0, voice_use_speaker_boost ?? true]
    );
    config = result.rows[0];
  } else {
    const vapiId = vapi_assistant_id !== undefined ? vapi_assistant_id : existing.rows[0].vapi_assistant_id;
    const result = await pool.query(
      `UPDATE agent_config SET name=$1, persona_prompt=$2, transfer_number=$3, transfer_trigger=$4, language=$5, voice_id=$6, first_message=$7, end_call_message=$8, vapi_assistant_id=$9,
         voice_speed=$10, voice_stability=$11, voice_similarity_boost=$12, voice_style=$13, voice_style_degree=$14, voice_use_speaker_boost=$15, updated_at=NOW()
       WHERE id=$16 RETURNING *`,
      [name, persona_prompt, transfer_number, transfer_trigger, language, voice_id, first_message, end_call_message, vapiId,
       voice_speed ?? 1.0, voice_stability ?? 0.5, voice_similarity_boost ?? 0.75,
       voice_style ?? 0.0, voice_style_degree ?? 1.0, voice_use_speaker_boost ?? true,
       existing.rows[0].id]
    );
    config = result.rows[0];
  }
  res.json(config);
});

// Sincronizza su Vapi
router.post('/sync', async (req: AuthRequest, res: Response): Promise<void> => {
  const cid = req.companyId;
  const query = cid
    ? 'SELECT * FROM agent_config WHERE company_id=$1 ORDER BY id LIMIT 1'
    : 'SELECT * FROM agent_config ORDER BY id LIMIT 1';
  const result = await pool.query(query, cid ? [cid] : []);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Configurazione non trovata' });
    return;
  }

  const config = result.rows[0];
  if (!process.env.VAPI_API_KEY) {
    res.status(400).json({ error: 'VAPI_API_KEY non configurata' });
    return;
  }

  try {
    let operators = [];
    try {
      const opQ = cid
        ? 'SELECT * FROM operators WHERE active=true AND company_id=$1 ORDER BY id ASC'
        : 'SELECT * FROM operators WHERE active=true ORDER BY id ASC';
      const opResult = await pool.query(opQ, cid ? [cid] : []);
      operators = opResult.rows;
    } catch { /* tabella non ancora migrata */ }

    if (config.vapi_assistant_id) {
      await updateAssistant(config.vapi_assistant_id, config, operators);
    } else {
      const assistantId = await createAssistant(config, operators);
      await pool.query('UPDATE agent_config SET vapi_assistant_id=$1 WHERE id=$2', [assistantId, config.id]);
      config.vapi_assistant_id = assistantId;
    }
    res.json({ success: true, vapi_assistant_id: config.vapi_assistant_id, operators_synced: operators.length });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore sconosciuto';
    res.status(500).json({ error: `Errore sincronizzazione Vapi: ${message}` });
  }
});

export default router;

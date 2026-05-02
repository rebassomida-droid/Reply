import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { generateAnswer, generateCallSummary } from '../services/claude.service';
import { searchRelevantChunks } from '../services/rag.service';
import { listCallsFromVapi, normalizeTranscript, mapOutcome } from '../services/vapi.service';

const router = Router();

// Webhook Vapi — senza auth, identifica la company dall'assistant ID
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  let body: Record<string, unknown>;
  try {
    body = req.body instanceof Buffer ? JSON.parse(req.body.toString()) : req.body;
  } catch {
    res.status(400).json({ error: 'Body non valido' });
    return;
  }

  const { type, call } = body as { type: string; call: Record<string, unknown> };

  // Trova la company dall'assistant ID
  let companyId: number | null = null;
  if (call?.assistantId) {
    const agentRes = await pool.query(
      'SELECT company_id FROM agent_config WHERE vapi_assistant_id=$1 LIMIT 1',
      [call.assistantId]
    ).catch(() => null);
    companyId = agentRes?.rows[0]?.company_id || null;
  }

  if (type === 'call-started' && call) {
    await pool.query(
      `INSERT INTO call_logs (vapi_call_id, caller_number, started_at, outcome, company_id)
       VALUES ($1,$2,NOW(),'answered',$3) ON CONFLICT (vapi_call_id) DO NOTHING`,
      [call.id, (call.customer as { number?: string })?.number || 'Sconosciuto', companyId]
    ).catch(() => {});
  }

  if (type === 'transcript' && call) {
    await pool.query(
      'UPDATE call_logs SET transcript=$1 WHERE vapi_call_id=$2',
      [(call.transcript as string) || '', call.id]
    ).catch(() => {});
  }

  if (type === 'call-ended' && call) {
    const transcript = (call.transcript as string) || '';
    let summary = '';
    if (transcript) summary = await generateCallSummary(transcript).catch(() => '');

    const started = (call.startedAt as string) || null;
    const ended = (call.endedAt as string) || null;
    const duration = started && ended
      ? Math.round((new Date(ended).getTime() - new Date(started).getTime()) / 1000)
      : null;
    const outcome = mapOutcome(call.endedReason as string | undefined);

    await pool.query(
      `UPDATE call_logs SET ended_at=$1, duration_seconds=$2, transcript=$3, summary=$4, outcome=$5 WHERE vapi_call_id=$6`,
      [ended, duration, transcript, summary, outcome, call.id]
    ).catch(() => {});
  }

  res.json({ received: true });
});

// Query RAG durante chiamata
router.post('/query', async (req: Request, res: Response): Promise<void> => {
  const { question, call_id, company_id } = req.body as { question: string; call_id?: string; company_id?: number };
  if (!question) {
    res.status(400).json({ error: 'question richiesta' });
    return;
  }

  const cid = company_id || null;
  const agentQ = cid
    ? 'SELECT * FROM agent_config WHERE company_id=$1 ORDER BY id LIMIT 1'
    : 'SELECT * FROM agent_config ORDER BY id LIMIT 1';
  const agentResult = await pool.query(agentQ, cid ? [cid] : []);
  const agent = agentResult.rows[0];

  const context = await searchRelevantChunks(question, 5, cid).catch(() => '');
  const answer = await generateAnswer(agent?.persona_prompt || '', question, context);
  const shouldTransfer = !!(agent?.transfer_trigger) && answer.toLowerCase().includes('trasfer');

  if (call_id) {
    await pool.query(
      'UPDATE call_logs SET transcript=COALESCE(transcript,\'\')||$1 WHERE vapi_call_id=$2',
      [`\nD: ${question}\nR: ${answer}`, call_id]
    ).catch(() => {});
  }

  res.json({ answer, transfer: shouldTransfer });
});

// --- Rotte autenticate ---
router.use(authMiddleware);

/**
 * POST /api/calls/sync
 * Importa le chiamate da Vapi (GET /call) e le salva in call_logs via upsert.
 * Restituisce il numero di chiamate sincronizzate.
 */
router.post('/sync', async (req: AuthRequest, res: Response): Promise<void> => {
  const cid = req.companyId;

  // Recupera l'assistant ID configurato per questa company
  const agentRes = await pool.query(
    'SELECT vapi_assistant_id FROM agent_config WHERE company_id=$1 LIMIT 1',
    [cid],
  );
  const assistantId: string | undefined = agentRes.rows[0]?.vapi_assistant_id;

  if (!assistantId) {
    res.status(400).json({
      error: 'Nessun assistente Vapi configurato. Vai in Configurazione Agente e clicca "Salva e sincronizza su Vapi".',
    });
    return;
  }

  const vapiCalls = await listCallsFromVapi(assistantId, 500);

  let synced = 0;
  for (const call of vapiCalls) {
    const callerNumber =
      call.customer?.number ||
      'Sconosciuto';
    const startedAt  = call.startedAt  || call.createdAt || null;
    const endedAt    = call.endedAt    || null;

    const duration =
      typeof call.duration === 'number'
        ? call.duration
        : startedAt && endedAt
          ? Math.round(
              (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
            )
          : null;

    const outcome    = mapOutcome(call.endedReason);
    const transcript = normalizeTranscript(
      call.transcript ?? call.artifact?.transcript,
    );
    const summary    = call.summary || call.artifact?.summary || '';

    await pool.query(
      `INSERT INTO call_logs
         (vapi_call_id, caller_number, started_at, ended_at, duration_seconds,
          transcript, outcome, summary, company_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       ON CONFLICT (vapi_call_id) DO UPDATE SET
         caller_number     = EXCLUDED.caller_number,
         started_at        = COALESCE(EXCLUDED.started_at,        call_logs.started_at),
         ended_at          = COALESCE(EXCLUDED.ended_at,          call_logs.ended_at),
         duration_seconds  = COALESCE(EXCLUDED.duration_seconds,  call_logs.duration_seconds),
         transcript        = CASE
                               WHEN EXCLUDED.transcript <> '' THEN EXCLUDED.transcript
                               ELSE call_logs.transcript
                             END,
         outcome           = EXCLUDED.outcome,
         summary           = CASE
                               WHEN EXCLUDED.summary <> '' THEN EXCLUDED.summary
                               ELSE call_logs.summary
                             END`,
      [call.id, callerNumber, startedAt, endedAt, duration,
       transcript, outcome, summary, cid],
    ).catch((e) => console.error('[sync] upsert error', call.id, e.message));

    synced++;
  }

  res.json({ synced, total: vapiCalls.length });
});

router.get('/', async (req: AuthRequest, res: Response): Promise<void> => {
  const cid = req.companyId;
  const query = cid
    ? 'SELECT * FROM call_logs WHERE company_id=$1 ORDER BY created_at DESC LIMIT 200'
    : 'SELECT * FROM call_logs ORDER BY created_at DESC LIMIT 200';
  const result = await pool.query(query, cid ? [cid] : []);
  res.json(result.rows);
});

router.get('/stats/today', async (req: AuthRequest, res: Response): Promise<void> => {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const cid = req.companyId;

  const filter = cid ? 'AND company_id=$2' : '';
  const params: unknown[] = cid ? [today, cid] : [today];

  const result = await pool.query(
    `SELECT
       COUNT(*) FILTER (WHERE created_at >= $1 ${filter}) AS calls_today,
       ROUND(AVG(duration_seconds) FILTER (WHERE duration_seconds IS NOT NULL ${filter})) AS avg_duration,
       COUNT(*) FILTER (WHERE outcome='transferred' AND created_at >= $1 ${filter}) AS transfers_today,
       (SELECT COUNT(*) FROM documents${cid ? ' WHERE company_id=$2' : ''}) AS documents_count
     FROM call_logs`,
    params
  );
  res.json(result.rows[0]);
});

router.get('/:id', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await pool.query('SELECT * FROM call_logs WHERE id=$1', [req.params.id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'Chiamata non trovata' });
    return;
  }
  res.json(result.rows[0]);
});

export default router;

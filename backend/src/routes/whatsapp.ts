import { Router, Request, Response } from 'express';
import pool from '../db';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { sendMessage, validateMetaWebhook } from '../services/whatsapp.service';
import { searchRelevantChunks } from '../services/rag.service';
import { generateWhatsAppReply } from '../services/claude.service';

const router = Router();

// ──────────────────────────────────────────────
// WEBHOOK — riceve messaggi in entrata (Twilio o Meta)
// ──────────────────────────────────────────────

// Verifica webhook Meta (GET)
router.get('/webhook', (req: Request, res: Response): void => {
  const mode = req.query['hub.mode'] as string;
  const token = req.query['hub.verify_token'] as string;
  const challenge = req.query['hub.challenge'] as string;
  const result = validateMetaWebhook(mode, token, challenge);
  if (result) {
    res.status(200).send(result);
  } else {
    res.sendStatus(403);
  }
});

// Ricezione messaggi (POST) — Twilio invia form-urlencoded, Meta invia JSON
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  try {
    const provider = process.env.WHATSAPP_PROVIDER || 'twilio';
    let from = '';
    let messageBody = '';

    if (provider === 'twilio') {
      from = (req.body.From as string)?.replace('whatsapp:', '') || '';
      messageBody = (req.body.Body as string) || '';
    } else {
      // Meta Cloud API
      const entry = req.body?.entry?.[0];
      const change = entry?.changes?.[0]?.value;
      const msg = change?.messages?.[0];
      if (!msg) { res.sendStatus(200); return; }
      from = `+${msg.from}`;
      messageBody = msg.text?.body || '';
    }

    if (!from || !messageBody) { res.sendStatus(200); return; }

    // Trova o crea conversazione
    let convResult = await pool.query(
      'SELECT id FROM whatsapp_conversations WHERE phone_number=$1', [from]
    );
    let convId: number;
    if (convResult.rows.length === 0) {
      const ins = await pool.query(
        `INSERT INTO whatsapp_conversations (phone_number, last_message_at)
         VALUES ($1, NOW()) RETURNING id`,
        [from]
      );
      convId = ins.rows[0].id;
    } else {
      convId = convResult.rows[0].id;
      await pool.query('UPDATE whatsapp_conversations SET last_message_at=NOW() WHERE id=$1', [convId]);
    }

    // Salva messaggio in entrata
    await pool.query(
      `INSERT INTO whatsapp_messages (conversation_id, direction, content, message_sid)
       VALUES ($1,'inbound',$2,$3)`,
      [convId, messageBody, provider === 'twilio' ? req.body.MessageSid : '']
    );

    // Carica ultime 10 coppie di messaggi per contesto conversazione
    const historyResult = await pool.query(
      `SELECT direction, content FROM whatsapp_messages
       WHERE conversation_id=$1 ORDER BY created_at DESC LIMIT 20`,
      [convId]
    );
    const history = historyResult.rows.reverse().map((r) => ({
      role: r.direction === 'inbound' ? ('user' as const) : ('assistant' as const),
      content: r.content as string,
    }));

    // RAG + risposta AI
    const agentResult = await pool.query('SELECT * FROM agent_config ORDER BY id LIMIT 1');
    const agent = agentResult.rows[0];
    const context = await searchRelevantChunks(messageBody, 4).catch(() => '');
    const reply = await generateWhatsAppReply(agent?.persona_prompt || '', history, context);

    // Salva risposta in uscita
    const sid = await sendMessage(from, reply);
    await pool.query(
      `INSERT INTO whatsapp_messages (conversation_id, direction, content, message_sid)
       VALUES ($1,'outbound',$2,$3)`,
      [convId, reply, sid]
    );

    // Twilio si aspetta TwiML vuoto; Meta si aspetta 200
    if (provider === 'twilio') {
      res.set('Content-Type', 'text/xml');
      res.send('<Response></Response>');
    } else {
      res.sendStatus(200);
    }
  } catch (err) {
    console.error('Errore webhook WhatsApp:', err);
    res.sendStatus(200); // Twilio riprova se restituiamo 5xx
  }
});

// ──────────────────────────────────────────────
// ROTTE AUTENTICATE — pannello di controllo
// ──────────────────────────────────────────────
router.use(authMiddleware);

// Lista conversazioni
router.get('/conversations', async (_req: AuthRequest, res: Response): Promise<void> => {
  const result = await pool.query(
    `SELECT wc.*,
       (SELECT content FROM whatsapp_messages WHERE conversation_id=wc.id ORDER BY created_at DESC LIMIT 1) AS last_message,
       (SELECT COUNT(*) FROM whatsapp_messages WHERE conversation_id=wc.id) AS message_count
     FROM whatsapp_conversations wc
     ORDER BY last_message_at DESC LIMIT 100`
  );
  res.json(result.rows);
});

// Messaggi di una conversazione
router.get('/conversations/:id/messages', async (req: AuthRequest, res: Response): Promise<void> => {
  const result = await pool.query(
    'SELECT * FROM whatsapp_messages WHERE conversation_id=$1 ORDER BY created_at ASC',
    [req.params.id]
  );
  res.json(result.rows);
});

// Invia messaggio manuale
router.post('/conversations/:id/send', async (req: AuthRequest, res: Response): Promise<void> => {
  const { message } = req.body as { message: string };
  if (!message) {
    res.status(400).json({ error: 'message richiesto' });
    return;
  }

  const conv = await pool.query('SELECT phone_number FROM whatsapp_conversations WHERE id=$1', [req.params.id]);
  if (conv.rows.length === 0) {
    res.status(404).json({ error: 'Conversazione non trovata' });
    return;
  }

  const sid = await sendMessage(conv.rows[0].phone_number, message);
  await pool.query(
    `INSERT INTO whatsapp_messages (conversation_id, direction, content, message_sid)
     VALUES ($1,'outbound',$2,$3)`,
    [req.params.id, message, sid]
  );

  res.json({ success: true, sid });
});

// Stats WhatsApp
router.get('/stats', async (_req: AuthRequest, res: Response): Promise<void> => {
  const result = await pool.query(
    `SELECT
       COUNT(DISTINCT conversation_id) AS total_conversations,
       COUNT(*) FILTER (WHERE direction='inbound') AS messages_received,
       COUNT(*) FILTER (WHERE direction='outbound') AS messages_sent,
       COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '24 hours') AS messages_today
     FROM whatsapp_messages`
  );
  res.json(result.rows[0]);
});

export default router;

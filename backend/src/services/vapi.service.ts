import axios from 'axios';

const VAPI_BASE = 'https://api.vapi.ai';

function getHeaders() {
  return { Authorization: `Bearer ${process.env.VAPI_API_KEY}`, 'Content-Type': 'application/json' };
}

export interface Operator {
  id: number;
  name: string;
  phone_number: string;
  role?: string;
  active: boolean;
}

interface AgentConfig {
  name: string;
  persona_prompt: string;
  transfer_number?: string;
  voice_id?: string;
  first_message?: string;
  end_call_message?: string;
  language?: string;
  // Impostazioni voce avanzate
  voice_speed?: number;
  voice_stability?: number;
  voice_similarity_boost?: number;
  voice_style?: number;
  voice_style_degree?: number;
  voice_use_speaker_boost?: boolean;
}

function buildVoiceObject(config: AgentConfig) {
  const voiceId = config.voice_id || 'it-IT-ElsaNeural';
  const isAzure = voiceId.includes('-Neural') || voiceId.startsWith('it-') || voiceId.startsWith('en-') || voiceId.startsWith('fr-') || voiceId.startsWith('de-');

  // PostgreSQL NUMERIC columns arrive as strings — always parse to float
  const speed       = parseFloat(String(config.voice_speed))       || 1.0;
  const stability   = parseFloat(String(config.voice_stability))   || 0.5;
  const simBoost    = parseFloat(String(config.voice_similarity_boost)) || 0.75;
  const style       = parseFloat(String(config.voice_style))       || 0.0;
  const styleDeg    = parseFloat(String(config.voice_style_degree)) || 1.0;
  const speakerBoost = config.voice_use_speaker_boost !== false;

  if (isAzure) {
    // Azure Neural voices only support: provider, voiceId, speed
    // styleDegree is ElevenLabs-only — Vapi rejects it with 400 for Azure
    return {
      provider: 'azure' as const,
      voiceId,
      ...(speed !== 1.0 ? { speed } : {}),
    };
  }

  // ElevenLabs
  return {
    provider: '11labs' as const,
    voiceId,
    ...(speed !== 1.0 ? { speed } : {}),
    stability,
    similarityBoost: simBoost,
    style,
    useSpeakerBoost: speakerBoost,
  };
}

/** Rimuove spazi/trattini/parentesi → E.164 puro (richiesto da Vapi per destinations.number) */
function toE164(phone: string): string {
  return phone.replace(/[\s\-().]/g, '');
}

/**
 * Formato numerico per l'enum della funzione transferCall.
 * Dai log Vapi: quando il valore dell'enum NON corrisponde esattamente a
 * destinations.number, Vapi esegue il "direct dial" che funziona in modo
 * affidabile via Twilio. Inserisce uno spazio dopo +39 (o altro prefisso
 * internazionale) per creare questo mismatch intenzionale.
 *
 * Esempi: +393453973981 → "+39 3453973981"  |  +39031123456 → "+39 031123456"
 */
function toVapiDialFormat(phone: string): string {
  const e164 = toE164(phone);
  if (e164.startsWith('+39')) return '+39 ' + e164.slice(3);
  if (e164.startsWith('+1'))  return '+1 '  + e164.slice(2);
  if (e164.startsWith('+44')) return '+44 ' + e164.slice(3);
  if (e164.startsWith('+33')) return '+33 ' + e164.slice(3);
  if (e164.startsWith('+49')) return '+49 ' + e164.slice(3);
  // Fallback: inserisce spazio dopo i primi 3 caratteri (+XX)
  const m = e164.match(/^(\+\d{2})(\d+)$/);
  return m ? `${m[1]} ${m[2]}` : e164;
}

function buildAssistantPayload(config: AgentConfig, operators: Operator[] = []) {
  const activeOperators = operators.filter((o) => o.active);

  // destinations.number → E.164 (Vapi lo valida con /^\+?[a-zA-Z0-9]+$/)
  // enum → formato "+39 XXXXXXXXXX" (con spazio): così Vapi non trova match esatto
  // e usa il direct-dial via Twilio, che è il percorso affidabile dai log.
  const transferTool = activeOperators.length > 0
    ? [{
        type: 'transferCall',
        destinations: activeOperators.map((op) => ({
          type: 'number',
          number: toE164(op.phone_number),
          message: `Ti metto in contatto con ${op.role || op.name}. Attendi un momento.`,
          description: `Trasferisce la chiamata a ${op.name}${op.role ? ` — ${op.role}` : ''}`,
        })),
        function: {
          name: 'transferCall',
          description: [
            'Trasferisci la chiamata a un operatore umano.',
            'Usa questo strumento IMMEDIATAMENTE quando il cliente chiede di parlare con un operatore, la segreteria, o una persona reale.',
            'Non chiedere conferma: esegui il trasferimento appena richiesto.',
            'Operatori disponibili:',
            ...activeOperators.map((o) => `- ${toVapiDialFormat(o.phone_number)}: ${o.name}${o.role ? ` — ${o.role}` : ''}`),
          ].join('\n'),
          parameters: {
            type: 'object',
            properties: {
              destination: {
                type: 'string',
                // Formato con spazio → Vapi fa direct-dial (percorso affidabile)
                enum: activeOperators.map((o) => toVapiDialFormat(o.phone_number)),
                description: "Il numero dell'operatore a cui trasferire la chiamata",
              },
            },
            required: ['destination'],
          },
        },
      }]
    : [];

  return {
    name: config.name,
    model: {
      provider: 'anthropic',
      model: 'claude-sonnet-4-6',
      systemPrompt: config.persona_prompt,
      temperature: 0.3,
      ...(transferTool.length > 0 ? { tools: transferTool } : {}),
    },
    voice: buildVoiceObject(config),
    // firstMessage: il messaggio che l'assistente dice all'inizio della chiamata.
    // Se configurato, Vapi lo pre-renderizza in TTS (~2s per Azure Neural).
    // Durante quei ~2s il backgroundSound 'office' copre il silenzio.
    // Se null, l'assistente aspetta che sia il cliente a parlare per primo.
    // null esplicito necessario: PATCH Vapi non rimuove campi omessi.
    firstMessage: config.first_message || null,
    endCallMessage: config.end_call_message || null,
    startSpeakingPlan: null,
    // Suono ambiente durante il caricamento (evita silenzio morto prima del saluto)
    backgroundSound: 'office',
    transcriber: {
      provider: 'deepgram',
      language: config.language || 'it',
    },
    serverUrl: `${process.env.BACKEND_URL}/api/calls/webhook`,
  };
}

export async function createAssistant(config: AgentConfig, operators: Operator[] = []): Promise<string> {
  const res = await axios.post(`${VAPI_BASE}/assistant`, buildAssistantPayload(config, operators), {
    headers: getHeaders(),
  });
  return res.data.id;
}

export async function updateAssistant(assistantId: string, config: AgentConfig, operators: Operator[] = []): Promise<void> {
  await axios.patch(`${VAPI_BASE}/assistant/${assistantId}`, buildAssistantPayload(config, operators), {
    headers: getHeaders(),
  });
}

/** Lista numeri di telefono acquistati sull'account Vapi */
export async function listPhoneNumbers(): Promise<{ id: string; number: string; name?: string; assistantId?: string }[]> {
  try {
    const res = await axios.get(`${VAPI_BASE}/phone-number`, { headers: getHeaders() });
    const data = Array.isArray(res.data) ? res.data : (res.data?.results ?? []);
    return data.map((p: { id: string; number?: string; e164?: string; name?: string; assistantId?: string }) => ({
      id: p.id,
      number: p.number ?? p.e164 ?? p.id,
      name: p.name,
      assistantId: p.assistantId,
    }));
  } catch {
    return [];
  }
}

/** Collega un numero di telefono Vapi a un assistente */
export async function linkPhoneNumber(phoneNumberId: string, assistantId: string): Promise<void> {
  await axios.patch(
    `${VAPI_BASE}/phone-number/${phoneNumberId}`,
    { assistantId },
    { headers: getHeaders() },
  );
}

export async function listVoices(): Promise<{ id: string; name: string; provider: string }[]> {
  try {
    const res = await axios.get(`${VAPI_BASE}/voice`, { headers: getHeaders() });
    return res.data || [];
  } catch {
    return [
      { id: 'it-IT-ElsaNeural', name: 'Elsa — Italiano F (Azure)', provider: 'azure' },
      { id: 'it-IT-IsabellaNeural', name: 'Isabella — Italiano F (Azure)', provider: 'azure' },
      { id: 'it-IT-DiegoNeural', name: 'Diego — Italiano M (Azure)', provider: 'azure' },
      { id: 'it-IT-BenignoNeural', name: 'Benigno — Italiano M (Azure)', provider: 'azure' },
      { id: 'rachel', name: 'Rachel (ElevenLabs)', provider: '11labs' },
      { id: 'adam', name: 'Adam (ElevenLabs)', provider: '11labs' },
      { id: 'bella', name: 'Bella (ElevenLabs)', provider: '11labs' },
    ];
  }
}

export async function getCallDetails(callId: string) {
  const res = await axios.get(`${VAPI_BASE}/call/${callId}`, { headers: getHeaders() });
  return res.data;
}

/** Endpoint Vapi: GET /call — lista chiamate dell'assistente */
export interface VapiCall {
  id: string;
  createdAt: string;
  startedAt?: string;
  endedAt?: string;
  duration?: number;
  endedReason?: string;
  transcript?: string | { role: string; text: string }[];
  summary?: string;
  assistantId?: string;
  customer?: { number?: string };
  artifact?: {
    transcript?: string | { role: string; text: string }[];
    summary?: string;
  };
}

export async function listCallsFromVapi(
  assistantId: string,
  limit = 500,
): Promise<VapiCall[]> {
  try {
    const res = await axios.get(`${VAPI_BASE}/call`, {
      headers: getHeaders(),
      params: { assistantId, limit },
    });
    // Vapi returns the array directly or wrapped in { results: [...] }
    const data = res.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.results)) return data.results;
    return [];
  } catch (err) {
    console.error('[Vapi] listCallsFromVapi error:', err);
    return [];
  }
}

/** Normalizza il transcript (stringa o array di turni) in testo leggibile */
export function normalizeTranscript(
  raw?: string | { role: string; text: string }[],
): string {
  if (!raw) return '';
  if (typeof raw === 'string') return raw;
  return raw
    .map((t) => `${t.role === 'user' ? 'Cliente' : 'Assistente'}: ${t.text}`)
    .join('\n');
}

/** Mappa endedReason → outcome interno */
export function mapOutcome(endedReason?: string): string {
  if (!endedReason) return 'answered';
  if (endedReason.toLowerCase().includes('transfer')) return 'transferred';
  if (endedReason === 'voicemail') return 'voicemail';
  if (endedReason === 'no-answer') return 'missed';
  if (endedReason === 'silence-timed-out') return 'missed';
  return 'answered';
}

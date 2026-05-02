# PROMPT PER CLAUDE CODE — Piattaforma AI Voice Receptionist (Housetag)

## OBIETTIVO

Costruisci una piattaforma web completa chiamata **Housetag Voice AI** — un centralino intelligente basato su AI che:
- Riceve chiamate su un numero virtuale (via Vapi.ai)
- Risponde vocalmente ai clienti con una voce naturale
- Gestisce la knowledge base dello studio (normativa edilizia, APE, CTU, ecc.)
- Trasferisce le chiamate a un numero reale se necessario
- Offre un pannello di controllo per configurare tutto senza codice

---

## STACK TECNOLOGICO

```
Frontend:     React 18 + Vite + TypeScript
Styling:      Tailwind CSS
Backend:      Node.js + Express (REST API)
Database:     PostgreSQL + pgvector (per RAG su documenti)
AI Voice:     Vapi.ai (telefonia + STT + TTS)
LLM:          Anthropic Claude claude-sonnet-4-20250514 (via API)
File parsing: pdf-parse, mammoth (per PDF e DOCX)
Storage:      locale /uploads per i documenti
Auth:         JWT semplice (single user, uso interno)
```

---

## STRUTTURA DIRECTORY

```
housetag-voice-ai/
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx          # Overview: chiamate oggi, stato agente
│   │   │   ├── AgentConfig.tsx        # Configurazione prompt e personalità AI
│   │   │   ├── KnowledgeBase.tsx      # Caricamento e gestione documenti
│   │   │   ├── CallLogs.tsx           # Log chiamate con trascrizioni
│   │   │   └── Settings.tsx           # API keys, numero Vapi, numero trasferimento
│   │   ├── components/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── DocumentCard.tsx
│   │   │   └── CallCard.tsx
│   │   └── App.tsx
├── backend/
│   ├── routes/
│   │   ├── agent.ts                   # CRUD configurazione agente
│   │   ├── documents.ts               # Upload, parsing, embedding documenti
│   │   ├── calls.ts                   # Webhook Vapi + log chiamate
│   │   ├── vapi.ts                    # Proxy e sync con Vapi API
│   │   └── auth.ts                    # Login JWT
│   ├── services/
│   │   ├── claude.service.ts          # Chiamate Claude API
│   │   ├── vapi.service.ts            # Creazione/aggiornamento assistant Vapi
│   │   ├── rag.service.ts             # Embedding + similarity search pgvector
│   │   └── parser.service.ts          # PDF/DOCX text extraction
│   ├── db/
│   │   ├── schema.sql                 # Schema PostgreSQL
│   │   └── index.ts                   # Pool connessione
│   └── server.ts
├── docker-compose.yml                 # PostgreSQL + pgvector
├── .env.example
└── README.md
```

---

## DATABASE SCHEMA (PostgreSQL + pgvector)

```sql
-- Configurazione agente
CREATE TABLE agent_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) DEFAULT 'Assistente Housetag',
  persona_prompt TEXT,                    -- Prompt sistema personalizzabile
  transfer_number VARCHAR(20),            -- Numero reale a cui trasferire
  transfer_trigger VARCHAR(500),          -- Quando trasferire ("non so rispondere", "urgente", ecc.)
  language VARCHAR(10) DEFAULT 'it',
  voice_id VARCHAR(100),                  -- ID voce ElevenLabs/Vapi
  vapi_assistant_id VARCHAR(100),         -- ID assistant su Vapi
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Documenti knowledge base
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  file_type VARCHAR(20),                  -- pdf, docx, txt
  content TEXT,                           -- Testo estratto
  chunk_count INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Chunks con embedding per RAG
CREATE TABLE document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  content TEXT,
  embedding vector(1536),                 -- text-embedding-3-small OpenAI oppure alternativa
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX ON document_chunks USING ivfflat (embedding vector_cosine_ops);

-- Log chiamate
CREATE TABLE call_logs (
  id SERIAL PRIMARY KEY,
  vapi_call_id VARCHAR(100) UNIQUE,
  caller_number VARCHAR(20),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  transcript TEXT,
  outcome VARCHAR(50),                    -- answered, transferred, voicemail
  transferred_to VARCHAR(20),
  summary TEXT,                           -- Riassunto AI della chiamata
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## FUNZIONALITÀ CORE DA IMPLEMENTARE

### 1. Pannello Configurazione Agente (`AgentConfig.tsx`)

Interfaccia per modificare:
- **Nome agente** (es. "Giulia — Assistente Housetag")
- **Prompt sistema** (textarea grande con anteprima)
- **Trigger trasferimento** (quando passare la chiamata)
- **Numero di trasferimento**
- **Voce** (dropdown voci Vapi disponibili)
- Bottone **"Salva e Sincronizza su Vapi"** → aggiorna l'assistant su Vapi via API

Prompt sistema di default da pre-caricare:
```
Sei Giulia, l'assistente virtuale dello Studio Housetag di Antonino Basso, 
Perito Industriale iscritto al Collegio di Milano n. 7165, con sede in 
Via A. Volta 48, Cesano Maderno (MB).

Rispondi in italiano con tono professionale ma cordiale. 
Puoi aiutare su: certificazioni energetiche (APE), perizie immobiliari, 
pratiche urbanistiche e catastali, sicurezza cantieri (PSC/POS), 
consulenze CTU/CTP al Tribunale di Monza.

Se non conosci la risposta o la richiesta richiede valutazione diretta 
del professionista, proponi di trasferire la chiamata o lasciare un messaggio.

Orari studio: Lun-Ven 9:00-18:00.
```

### 2. Knowledge Base (`KnowledgeBase.tsx`)

- **Upload drag-and-drop** per PDF e DOCX
- Lista documenti caricati con: nome, tipo, data, numero chunk, bottone elimina
- Barra avanzamento durante parsing e embedding
- Backend: estrae testo → splitta in chunk da 500 token → genera embedding → salva in pgvector

### 3. Integrazione Vapi (backend)

**Webhook POST `/api/calls/webhook`** — riceve eventi da Vapi:
- `call-started` → crea record in call_logs
- `transcript` → aggiorna trascrizione
- `call-ended` → calcola durata, genera summary con Claude, salva outcome

**Flusso RAG durante la chiamata:**
Vapi chiama il backend con la domanda dell'utente → backend cerca i chunk rilevanti in pgvector → inserisce il contesto nel prompt → risponde a Vapi con la risposta contestualizzata

Endpoint: `POST /api/calls/query`
```json
{
  "question": "Quanto costa un APE?",
  "call_id": "vapi-call-xxx"
}
```
Risposta:
```json
{
  "answer": "Le certificazioni APE partono da...",
  "transfer": false
}
```

### 4. Log Chiamate (`CallLogs.tsx`)

Tabella con:
- Data/ora, numero chiamante, durata
- Outcome (badge colorato: risposta/trasferimento/voicemail)
- Espandi per vedere trascrizione completa e summary AI
- Filtri per data e outcome

### 5. Settings (`Settings.tsx`)

Form per configurare:
- `VAPI_API_KEY`
- `VAPI_PHONE_NUMBER_ID`
- `ANTHROPIC_API_KEY`
- Numero di trasferimento di default
- Password accesso pannello

---

## CONFIGURAZIONE VAPI

Nella documentazione Vapi, l'assistant va creato con:

```javascript
// vapi.service.ts
const assistant = {
  name: config.name,
  model: {
    provider: "anthropic",
    model: "claude-sonnet-4-20250514",
    systemPrompt: config.persona_prompt,
    temperature: 0.3
  },
  voice: {
    provider: "11labs",
    voiceId: config.voice_id || "rachel"
  },
  firstMessage: "Buongiorno, sono Giulia dello Studio Housetag. Come posso aiutarla?",
  endCallMessage: "Grazie per aver contattato lo Studio Housetag. Buona giornata!",
  transcriber: {
    provider: "deepgram",
    language: "it"
  },
  serverUrl: `${process.env.BACKEND_URL}/api/calls/webhook`,
  forwardingPhoneNumber: config.transfer_number
}
```

---

## UI/UX DESIGN

- **Palette**: Bianco, grigio scuro (#1a1a2e), accento blu (#4361ee) — coerente con brand Housetag
- **Font**: Inter
- **Sidebar** fissa con: logo Housetag, navigazione, badge stato agente (Online/Offline)
- **Dashboard** con card: Chiamate oggi / Durata media / Trasferimenti / Documenti caricati
- Design **responsive** ma ottimizzato desktop (uso interno)
- Componenti shadcn/ui per form, badge, tabelle

---

## FILE .env.example

```env
# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Vapi
VAPI_API_KEY=...
VAPI_PHONE_NUMBER_ID=...
BACKEND_URL=https://tuodominio.com

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/housetag_voice

# Auth
JWT_SECRET=cambia-questo-valore
ADMIN_PASSWORD=password-sicura

# OpenAI (per embedding, opzionale - si può usare anche alternativa locale)
OPENAI_API_KEY=sk-...
```

---

## README — SETUP IN 5 PASSI

Il README deve includere:
1. `docker-compose up -d` per PostgreSQL
2. `npm install` in frontend/ e backend/
3. Copia `.env.example` → `.env` e compila le chiavi
4. `npm run migrate` per creare le tabelle
5. `npm run dev` per avviare tutto

Più sezione: **"Come collegare Vapi"** con screenshot della dashboard Vapi e dove inserire il webhook URL.

---

## NOTE FINALI

- Tutto il codice in **TypeScript**
- Commenti in **italiano** dove utile per la manutenzione
- Gestione errori robusta su tutte le chiamate API esterne
- Il sistema deve funzionare **offline dalla rete Vapi** (il pannello di controllo e i log restano accessibili anche senza connessione Vapi)
- Priorità: funzionante > perfetto. Meglio codice funzionante con TODO che codice incompleto


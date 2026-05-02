# Housetag Voice AI

Centralino intelligente AI per Studio Housetag. Risponde alle chiamate via Vapi.ai e ai messaggi WhatsApp usando Claude + knowledge base RAG.

## Stack

- **Frontend**: React 18 + Vite + TypeScript + Tailwind CSS
- **Backend**: Node.js + Express + TypeScript
- **Database**: PostgreSQL + pgvector (RAG su documenti)
- **AI Voice**: Vapi.ai (telefonia + STT + TTS)
- **LLM**: Anthropic Claude claude-sonnet-4-20250514
- **WhatsApp**: Twilio o Meta WhatsApp Cloud API

## Setup in 5 passi

### 1. Avvia il database

```bash
docker-compose up -d
```

### 2. Installa le dipendenze

```bash
cd backend && npm install
cd ../frontend && npm install
```

### 3. Configura le variabili d'ambiente

```bash
cp .env.example backend/.env
# Apri backend/.env e compila le chiavi API
```

Campi obbligatori:
- `ANTHROPIC_API_KEY` — da console.anthropic.com
- `OPENAI_API_KEY` — da platform.openai.com (per embedding)
- `DATABASE_URL` — già configurato con i valori docker-compose

### 4. Esegui la migrazione database

```bash
cd backend && npm run migrate
```

### 5. Avvia i server

```bash
# Terminale 1 — Backend
cd backend && npm run dev

# Terminale 2 — Frontend
cd frontend && npm run dev
```

Apri **http://localhost:5173** — password default: `housetag2024`

---

## Come collegare Vapi

1. Vai su [vapi.ai](https://vapi.ai) e crea un account
2. Acquista un numero virtuale nella sezione **Phone Numbers**
3. Copia l'API Key da **Settings → API Keys**
4. Aggiungila nel pannello **Impostazioni** o nel file `.env`
5. Vai su **Agente AI** → clicca **Salva e sincronizza su Vapi**
6. Vapi creerà automaticamente l'assistant con il tuo prompt

Il webhook per gli eventi Vapi è: `https://tuodominio.com/api/calls/webhook`

---

## Come collegare WhatsApp

### Opzione A — Twilio (consigliato per iniziare)

1. Crea account su [twilio.com](https://twilio.com)
2. Attiva il **WhatsApp Sandbox** (gratuito) o acquista un numero business
3. In **Messaging → Sandbox Settings**, imposta il webhook:
   ```
   https://tuodominio.com/api/whatsapp/webhook
   ```
4. Aggiungi nel `.env`:
   ```
   WHATSAPP_PROVIDER=twilio
   TWILIO_ACCOUNT_SID=ACxxxx
   TWILIO_AUTH_TOKEN=xxxx
   TWILIO_WHATSAPP_NUMBER=+14155238886
   ```

### Opzione B — Meta WhatsApp Cloud API

1. Crea una Business App su [developers.facebook.com](https://developers.facebook.com)
2. Aggiungi il prodotto **WhatsApp** all'app
3. Configura il webhook con URL `https://tuodominio.com/api/whatsapp/webhook`
4. Aggiungi nel `.env`:
   ```
   WHATSAPP_PROVIDER=meta
   META_PHONE_NUMBER_ID=123456789
   META_ACCESS_TOKEN=EAAxxxx
   META_VERIFY_TOKEN=scegli-un-token
   ```

---

## Struttura progetto

```
├── backend/src/
│   ├── server.ts              # Entry point Express
│   ├── db/
│   │   ├── schema.sql         # Schema PostgreSQL
│   │   └── index.ts           # Pool connessione
│   ├── middleware/auth.ts     # JWT middleware
│   ├── services/
│   │   ├── claude.service.ts  # Chiamate Claude API
│   │   ├── vapi.service.ts    # Gestione assistant Vapi
│   │   ├── rag.service.ts     # Embedding + ricerca pgvector
│   │   ├── parser.service.ts  # Estrazione testo PDF/DOCX
│   │   └── whatsapp.service.ts # Invio messaggi WhatsApp
│   └── routes/
│       ├── auth.ts            # Login JWT
│       ├── agent.ts           # Config agente
│       ├── documents.ts       # Upload documenti
│       ├── calls.ts           # Webhook Vapi + log
│       ├── vapi.ts            # Proxy Vapi API
│       └── whatsapp.ts        # Webhook + chat WhatsApp
└── frontend/src/
    ├── pages/
    │   ├── Dashboard.tsx      # Overview e stats
    │   ├── AgentConfig.tsx    # Configurazione agente
    │   ├── KnowledgeBase.tsx  # Upload documenti
    │   ├── CallLogs.tsx       # Log chiamate
    │   ├── WhatsApp.tsx       # Conversazioni WhatsApp
    │   └── Settings.tsx       # API keys e webhook
    └── components/
        ├── Sidebar.tsx
        ├── StatusBadge.tsx
        ├── DocumentCard.tsx
        └── CallCard.tsx
```

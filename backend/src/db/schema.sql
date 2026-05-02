-- Abilita l'estensione pgvector per gli embedding
CREATE EXTENSION IF NOT EXISTS vector;

-- Configurazione agente voce
CREATE TABLE IF NOT EXISTS agent_config (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) DEFAULT 'Assistente Housetag',
  persona_prompt TEXT,
  transfer_number VARCHAR(20),
  transfer_trigger VARCHAR(500),
  language VARCHAR(10) DEFAULT 'it',
  voice_id VARCHAR(100) DEFAULT 'rachel',
  vapi_assistant_id VARCHAR(100),
  first_message TEXT DEFAULT 'Buongiorno, sono Giulia dello Studio Housetag. Come posso aiutarla?',
  end_call_message TEXT DEFAULT 'Grazie per aver contattato lo Studio Housetag. Buona giornata!',
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Documenti della knowledge base
CREATE TABLE IF NOT EXISTS documents (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255),
  original_name VARCHAR(255),
  file_type VARCHAR(20),
  content TEXT,
  chunk_count INTEGER DEFAULT 0,
  file_size INTEGER,
  uploaded_at TIMESTAMP DEFAULT NOW()
);

-- Chunk con embedding per RAG
CREATE TABLE IF NOT EXISTS document_chunks (
  id SERIAL PRIMARY KEY,
  document_id INTEGER REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER,
  content TEXT,
  embedding vector(1536),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx
  ON document_chunks USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Log chiamate
CREATE TABLE IF NOT EXISTS call_logs (
  id SERIAL PRIMARY KEY,
  vapi_call_id VARCHAR(100) UNIQUE,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  caller_number VARCHAR(30),
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  transcript TEXT,
  outcome VARCHAR(50) DEFAULT 'answered',
  transferred_to VARCHAR(30),
  summary TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS call_logs_company_idx ON call_logs (company_id);
CREATE INDEX IF NOT EXISTS call_logs_started_at_idx ON call_logs (started_at DESC);

-- Conversazioni WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_conversations (
  id SERIAL PRIMARY KEY,
  phone_number VARCHAR(30) NOT NULL UNIQUE,
  contact_name VARCHAR(100),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  last_message_at TIMESTAMP DEFAULT NOW()
);

-- Messaggi WhatsApp
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id SERIAL PRIMARY KEY,
  conversation_id INTEGER REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  direction VARCHAR(10) NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  content TEXT NOT NULL,
  message_sid VARCHAR(200),
  status VARCHAR(20) DEFAULT 'sent',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Impostazioni di sistema (chiavi API, configurazione)
CREATE TABLE IF NOT EXISTS settings (
  key VARCHAR(100) PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Inserimento configurazione agente di default
INSERT INTO agent_config (
  name,
  persona_prompt,
  transfer_trigger,
  language,
  voice_id,
  first_message,
  end_call_message
) VALUES (
  'Giulia — Assistente Housetag',
  'Sei Giulia, l''assistente virtuale dello Studio Housetag di Antonino Basso, Perito Industriale iscritto al Collegio di Milano n. 7165, con sede in Via A. Volta 48, Cesano Maderno (MB).

Rispondi in italiano con tono professionale ma cordiale.
Puoi aiutare su: certificazioni energetiche (APE), perizie immobiliari, pratiche urbanistiche e catastali, sicurezza cantieri (PSC/POS), consulenze CTU/CTP al Tribunale di Monza.

Se non conosci la risposta o la richiesta richiede valutazione diretta del professionista, proponi di trasferire la chiamata o lasciare un messaggio.

Orari studio: Lun-Ven 9:00-18:00.',
  'Non so rispondere a questa domanda, hai bisogno di parlare con il professionista, è urgente',
  'it',
  'rachel',
  'Buongiorno, sono Giulia dello Studio Housetag. Come posso aiutarla?',
  'Grazie per aver contattato lo Studio Housetag. Buona giornata!'
) ON CONFLICT DO NOTHING;

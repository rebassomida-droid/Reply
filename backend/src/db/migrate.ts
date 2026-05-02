import pool from './index';

// Migrazione eseguita all'avvio del server (idempotente)
export async function runMigrations() {
  console.log('🗄️  Running migrations...');

  // 1. Tabella companies
  await pool.query(`
    CREATE TABLE IF NOT EXISTS companies (
      id SERIAL PRIMARY KEY,
      name VARCHAR(150) NOT NULL,
      slug VARCHAR(100) NOT NULL UNIQUE,
      color VARCHAR(20) DEFAULT '#3B82F6',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // 2. Seed azienda default se non esiste nessuna
  const existing = await pool.query('SELECT COUNT(*) FROM companies');
  if (parseInt(existing.rows[0].count) === 0) {
    await pool.query(`
      INSERT INTO companies (name, slug, color) VALUES ('Housetag', 'housetag', '#3B82F6')
    `);
    console.log('   ✅ Default company "Housetag" creata (id=1)');
  }

  const defaultCompanyRes = await pool.query('SELECT id FROM companies ORDER BY id LIMIT 1');
  const defaultCompanyId = defaultCompanyRes.rows[0].id;

  // 3. Aggiungi company_id a tutte le tabelle esistenti (safe, idempotente)
  const tables = ['agent_config', 'documents', 'call_logs', 'operators', 'whatsapp_conversations'];
  for (const table of tables) {
    await pool.query(
      `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE`
    ).catch(() => {});
    await pool.query(
      `UPDATE ${table} SET company_id = $1 WHERE company_id IS NULL`, [defaultCompanyId]
    ).catch(() => {});
  }

  // 6b. Numero di telefono Vapi per company
  await pool.query(
    `ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS vapi_phone_number_id VARCHAR(100)`
  ).catch(() => {});

  // 6. Impostazioni voce avanzate su agent_config
  const voiceCols = [
    `ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS voice_speed NUMERIC(4,2) DEFAULT 1.0`,
    `ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS voice_stability NUMERIC(4,2) DEFAULT 0.5`,
    `ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS voice_similarity_boost NUMERIC(4,2) DEFAULT 0.75`,
    `ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS voice_style NUMERIC(4,2) DEFAULT 0.0`,
    `ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS voice_style_degree NUMERIC(4,2) DEFAULT 1.0`,
    `ALTER TABLE agent_config ADD COLUMN IF NOT EXISTS voice_use_speaker_boost BOOLEAN DEFAULT true`,
  ];
  for (const col of voiceCols) {
    await pool.query(col).catch(() => {});
  }

  console.log('   ✅ Migrations complete');
}

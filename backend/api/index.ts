/**
 * Entry point per Vercel Serverless Functions.
 * Le migrazioni vengono eseguite in modo lazy al primo cold-start.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import app from '../src/app';
import { runMigrations } from '../src/db/migrate';

// Viene azzerato ad ogni cold-start; le successive richieste dello stesso
// worker condividono la stessa promise → migrations eseguite una sola volta.
let initPromise: Promise<void> | null = null;

function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = runMigrations().catch((err) => {
      console.error('[Vercel] Migration error — retry al prossimo request:', err);
      initPromise = null; // reset per permettere retry
    }) as Promise<void>;
  }
  return initPromise;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await ensureInit();
  // Express gestisce req/res direttamente come request handler
  return app(req as any, res as any);
}

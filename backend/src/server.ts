// Punto di avvio per sviluppo locale e Railway.
// Su Vercel usa api/index.ts invece.
import app from './app';
import { runMigrations } from './db/migrate';

const PORT = process.env.PORT || 3001;

runMigrations()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Backend avviato su porta ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
  });

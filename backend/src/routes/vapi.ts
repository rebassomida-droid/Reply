import { Router, Response } from 'express';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { listVoices } from '../services/vapi.service';

const router = Router();
router.use(authMiddleware);

// Lista voci disponibili su Vapi/ElevenLabs
router.get('/voices', async (_req: AuthRequest, res: Response): Promise<void> => {
  try {
    const voices = await listVoices();
    res.json(voices);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Errore';
    res.status(500).json({ error: message });
  }
});

export default router;

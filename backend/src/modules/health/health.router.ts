import { Router } from 'express';
import { healthController } from './health.controller';

const router = Router();

// Liveness endpoint (độc lập với DB/MQTT)
router.get('/', (req, res, next) => healthController.getHealth(req, res, next));

// Diagnostic readiness endpoint
router.get('/ready', (req, res, next) => {
  healthController.getReadiness(req, res, next);
});

export const healthRouter = router;


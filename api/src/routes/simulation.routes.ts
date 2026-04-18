import { Router } from 'express';
import asyncHandler from 'express-async-handler';
import { runSimulation, getAvailableSimulations } from '../controllers/simulation.controller';
import { authGuard } from '../middleware/auth';

const router = Router();

router.get('/available', authGuard, getAvailableSimulations);
router.post('/run', authGuard, asyncHandler(runSimulation));

export default router;

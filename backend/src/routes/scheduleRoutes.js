import express from 'express';
import { getSchedule } from '../controllers/scheduleController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getSchedule);

export default router;

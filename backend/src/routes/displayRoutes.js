import express from 'express';
import { getDisplays, deleteDisplay, updateDisplay } from '../controllers/displayController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getDisplays);
router.delete('/:displayId', deleteDisplay);
router.put('/:displayId', updateDisplay);

export default router;

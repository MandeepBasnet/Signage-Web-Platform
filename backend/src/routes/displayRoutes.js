import express from 'express';
import { getDisplays, deleteDisplay, updateDisplay } from '../controllers/displayController.js';
import { verifyToken } from '../middleware/authMiddleware.js';
import { revalidateList } from '../middleware/cacheControl.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', revalidateList, getDisplays);
router.delete('/:displayId', deleteDisplay);
router.put('/:displayId', updateDisplay);

export default router;

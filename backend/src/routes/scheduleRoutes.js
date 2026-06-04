import express from 'express';
import {
  getSchedule,
  createScheduleEvent,
  updateScheduleEvent,
  deleteScheduleEvent,
  getDisplayGroups,
} from '../controllers/scheduleController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

router.use(verifyToken);

router.get('/', getSchedule);
router.get('/display-groups', getDisplayGroups);
router.post('/', createScheduleEvent);
router.put('/:eventId', updateScheduleEvent);
router.delete('/:eventId', deleteScheduleEvent);

export default router;

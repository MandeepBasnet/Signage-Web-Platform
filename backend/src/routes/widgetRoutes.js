import express from 'express';
import { getWidgetResource } from '../controllers/widgetController.js';
import { updateWidget } from '../controllers/layoutController.js';
import { verifyToken } from '../middleware/authMiddleware.js';

const router = express.Router();

/**
 * Widget Routes
 * Handles API routes for widget-related operations
 */

/**
 * GET /api/widgets/resource/:regionId/:widgetId
 * Get widget resource HTML for iframe embedding
 * Query params: preview (default: 1), isEditor (default: 1)
 */
router.get('/resource/:regionId/:widgetId', getWidgetResource);

/**
 * PUT /api/widgets/:widgetId
 * Update widget properties (e.g., replace media)
 * Body: widget properties to update (e.g., { mediaIds: [newMediaId] })
 */
router.put('/:widgetId', verifyToken, updateWidget);

export default router;


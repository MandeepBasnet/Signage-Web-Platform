import express from 'express';
import { getWidgetResource } from '../controllers/widgetController.js';

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

export default router;


import express from 'express';
import { getRegionPreview } from '../controllers/regionController.js';

const router = express.Router();

/**
 * Region Routes
 * Handles API routes for region-related operations
 */

/**
 * GET /api/regions/preview/:regionId
 * Get preview HTML for a specific region
 * Query params: width, height, seq (optional)
 */
router.get('/preview/:regionId', getRegionPreview);

export default router;


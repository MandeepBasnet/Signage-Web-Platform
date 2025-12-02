import { xiboRequest } from "../utils/xiboClient.js";

/**
 * Region Controller
 * Handles region preview requests by proxying to Xibo CMS
 */

/**
 * Get region preview HTML
 * GET /api/regions/preview/:regionId
 * 
 * Fetches the preview HTML for a specific region from Xibo CMS
 * This HTML is used to render the region preview in the layout canvas
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getRegionPreview = async (req, res) => {
  try {
    const { regionId } = req.params;
    const { width, height, seq = 1 } = req.query;

    // Validate required parameters
    if (!regionId) {
      return res.status(400).json({
        success: false,
        message: 'Region ID is required',
      });
    }

    if (!width || !height) {
      return res.status(400).json({
        success: false,
        message: 'Width and height parameters are required',
      });
    }

    // Get user's auth token from request
    const userToken = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!userToken) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    // Build query parameters for Xibo API
    const queryParams = new URLSearchParams({
      width: width,
      height: height,
      seq: seq,
    });

    // Fetch region preview from Xibo CMS
    const response = await xiboRequest(
      `/region/preview/${regionId}?${queryParams.toString()}`,
      'GET',
      null,
      userToken
    );

    // Return the preview data
    return res.json(response);

  } catch (error) {
    console.error('Error fetching region preview:', error.message);
    
    // Handle specific error cases
    if (error.response) {
      return res.status(error.response.status).json({
        success: false,
        message: error.response.data?.message || 'Failed to fetch region preview from Xibo',
        error: error.response.data,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error while fetching region preview',
      error: error.message,
    });
  }
};


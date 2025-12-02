import { xiboRequest } from '../utils/xiboClient.js';

/**
 * Widget Controller
 * Handles widget resource requests by proxying to Xibo CMS
 */

/**
 * Get widget resource HTML/content for iframe embedding
 * GET /api/widgets/resource/:regionId/:widgetId
 * 
 * Fetches the full HTML document for a widget from Xibo CMS
 * This content is embedded in iframes for dataset, embedded, and other complex widget types
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const getWidgetResource = async (req, res) => {
  try {
    const { regionId, widgetId } = req.params;
    const { preview = '1', isEditor = '1' } = req.query;

    // Validate required parameters
    if (!regionId || !widgetId) {
      return res.status(400).json({
        success: false,
        message: 'Region ID and Widget ID are required',
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
      preview: preview,
      isEditor: isEditor,
    });

    // Fetch widget resource from Xibo CMS
    const response = await xiboRequest(
      `/playlist/widget/resource/${regionId}/${widgetId}?${queryParams.toString()}`,
      'GET',
      null,
      userToken
    );

    // The response should be HTML content
    // Set appropriate headers for iframe embedding
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    
    // Add CORS headers to allow iframe embedding
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Content-Security-Policy', "frame-ancestors 'self'");
    
    // Return the HTML content directly
    return res.send(response.data);

  } catch (error) {
    console.error('Error fetching widget resource:', error.message);
    
    // Handle specific error cases
    if (error.response) {
      // For HTML errors, return a simple error page
      if (error.response.status === 404) {
        return res.status(404).send(`
          <!DOCTYPE html>
          <html>
            <head><title>Widget Not Found</title></head>
            <body style="display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; background: #1f2937; color: #9ca3af;">
              <div style="text-align: center;">
                <h2>Widget Not Found</h2>
                <p>The requested widget could not be loaded.</p>
              </div>
            </body>
          </html>
        `);
      }

      return res.status(error.response.status).send(`
        <!DOCTYPE html>
        <html>
          <head><title>Error Loading Widget</title></head>
          <body style="display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; background: #1f2937; color: #9ca3af;">
            <div style="text-align: center;">
              <h2>Error Loading Widget</h2>
              <p>${error.response.data?.message || 'Failed to load widget from Xibo'}</p>
            </div>
          </body>
        </html>
      `);
    }

    return res.status(500).send(`
      <!DOCTYPE html>
      <html>
        <head><title>Server Error</head>
        <body style="display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; font-family: sans-serif; background: #1f2937; color: #9ca3af;">
          <div style="text-align: center;">
            <h2>Server Error</h2>
            <p>An error occurred while loading the widget.</p>
          </div>
        </body>
      </html>
    `);
  }
};

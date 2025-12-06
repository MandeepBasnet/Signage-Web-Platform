import { xiboRequest } from "../utils/xiboClient.js";
import {
  getUserContext,
  handleControllerError,
} from "../utils/xiboDataHelpers.js";

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
    const { preview = "1", isEditor = "1" } = req.query;

    // Validate required parameters
    if (!regionId || !widgetId) {
      return res.status(400).json({
        success: false,
        message: "Region ID and Widget ID are required",
      });
    }

    // Get user's auth token from request
    const userToken = req.header("Authorization")?.replace("Bearer ", "");

    if (!userToken) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
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
      "GET",
      null,
      userToken
    );

    // The response should be HTML content
    // Set appropriate headers for iframe embedding
    res.setHeader("Content-Type", "text/html; charset=utf-8");

    // Add CORS headers to allow iframe embedding
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");

    // Return the HTML content directly
    return res.send(response.data);
  } catch (error) {
    console.error("Error fetching widget resource:", error.message);

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
              <p>${
                error.response.data?.message ||
                "Failed to load widget from Xibo"
              }</p>
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

/**
 * Update widget elements (for canvas/global widgets)
 * PUT /api/playlists/widgets/:widgetId/elements
 *
 * This endpoint handles updating the elements array within a widget
 * Used primarily for text editing in canvas widgets
 *
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const updateWidgetElements = async (req, res) => {
  const { widgetId } = req.params;
  const { elements } = req.body;

  try {
    const { token } = getUserContext(req);

    if (!widgetId) {
      return res.status(400).json({ message: "Widget ID is required" });
    }

    if (!elements) {
      return res.status(400).json({ message: "Elements data is required" });
    }

    console.log(`[updateWidgetElements] Updating widget ${widgetId}`);
    console.log(
      `[updateWidgetElements] Request Content-Type:`,
      req.headers["content-type"]
    );
    console.log(`[updateWidgetElements] Elements type:`, typeof elements);
    console.log(`[updateWidgetElements] Elements length:`, elements?.length);

    // ✅ ENHANCED: Log data preview for debugging
    console.log(
      `[updateWidgetElements] Elements preview:`,
      typeof elements === "string"
        ? elements.substring(0, 300) + (elements.length > 300 ? "..." : "")
        : JSON.stringify(elements).substring(0, 300) + "..."
    );

    // ✅ IMPROVED: Log what we're sending to Xibo API
    console.log(`[updateWidgetElements] Preparing to send to Xibo API:`);
    console.log(`  - Endpoint: /playlist/widget/${widgetId}/elements`);
    console.log(`  - Method: PUT`);
    console.log(`  - Data keys:`, Object.keys({ elements }));

    // Xibo API expects form-urlencoded data
    // xiboRequest handles the conversion for PUT requests automatically
    // Send as form-urlencoded (Xibo API expects this for PUT requests)
    const result = await xiboRequest(
      `/playlist/widget/${widgetId}/elements`,
      "PUT",
      { elements }, // Pass as object - xiboClient will convert to form data
      token
      // Don't force JSON - let it use form-urlencoded for PUT
    );

    console.log(
      `[updateWidgetElements] ✓ Successfully updated widget ${widgetId}`
    );
    console.log(`[updateWidgetElements] Xibo response:`, result);
    res.json(result);
  } catch (err) {
    console.error(
      `[updateWidgetElements] ✗ Error updating widget ${widgetId}:`,
      err.message
    );

    // ✅ ENHANCED: Log full error details for debugging
    if (err.response) {
      console.error(
        `[updateWidgetElements] Response status:`,
        err.response.status
      );
      console.error(
        `[updateWidgetElements] Response statusText:`,
        err.response.statusText
      );
      console.error(
        `[updateWidgetElements] Response data (first 500 chars):`,
        typeof err.response.data === "string"
          ? err.response.data.substring(0, 500)
          : JSON.stringify(err.response.data).substring(0, 500)
      );
      console.error(`[updateWidgetElements] Response headers:`, {
        contentType: err.response.headers["content-type"],
        contentLength: err.response.headers["content-length"],
      });
    } else {
      console.error(
        `[updateWidgetElements] No response received:`,
        err.code || "Unknown error"
      );
      console.error(`[updateWidgetElements] Request config:`, {
        url: err.config?.url,
        method: err.config?.method,
        dataType: typeof err.config?.data,
      });
    }

    handleControllerError(res, err, "Failed to update widget elements");
  }
};

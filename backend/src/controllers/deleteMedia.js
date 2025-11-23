import { xiboRequest } from "../utils/xiboClient.js";
import {
  getUserContext,
  HttpError,
  handleControllerError,
} from "../utils/xiboDataHelpers.js";

export const deleteMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const { token } = getUserContext(req);

    if (!mediaId) {
      throw new HttpError(400, "Media ID is required");
    }

    console.log(`Deleting media ${mediaId}`);

    // Call DELETE /library/{mediaId} to delete the media
    // We do NOT use forceDelete so that we get an error if it's in use
    const formData = new URLSearchParams();
    
    await xiboRequest(`/library/${mediaId}`, "DELETE", formData, token);

    console.log(`Successfully deleted media ${mediaId}`);

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting media:", err.message);
    
    // Check if it's a 409 Conflict or 422 Unprocessable Entity which often means "in use"
    if (err.response && (err.response.status === 409 || err.response.status === 422 || err.response.status === 400)) {
        // Try to extract a meaningful message from Xibo response
        const xiboMessage = err.response.data?.message || err.response.data?.error?.message;
        
        if (xiboMessage && (xiboMessage.includes("used") || xiboMessage.includes("assigned") || xiboMessage.includes("playlist") || xiboMessage.includes("layout"))) {
             return res.status(409).json({
                 message: "This media is currently in use in a playlist or layout and cannot be deleted.",
                 details: xiboMessage
             });
        }
    }
    
    handleControllerError(res, err, "Failed to delete media");
  }
};

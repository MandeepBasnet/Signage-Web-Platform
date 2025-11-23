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
    // We use forceDelete=1 to ensure it's deleted even if used in layouts (user should be warned in UI if possible, but for now we follow the request)
    const formData = new URLSearchParams();
    formData.append("forceDelete", "1");

    await xiboRequest(`/library/${mediaId}`, "DELETE", formData, token);

    console.log(`Successfully deleted media ${mediaId}`);

    res.status(204).send();
  } catch (err) {
    console.error("Error deleting media:", err.message);
    handleControllerError(res, err, "Failed to delete media");
  }
};

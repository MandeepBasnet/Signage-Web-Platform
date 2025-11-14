import axios from "axios";
import FormData from "form-data";
import path from "path";
import { Readable } from "stream";
import { getAccessToken, xiboRequest } from "../utils/xiboClient.js";
import {
  fetchUserScopedCollection,
  handleControllerError,
  HttpError,
} from "../utils/xiboDataHelpers.js";

const isNumeric = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "" &&
  !Number.isNaN(Number(value));

// Extract the display name field that Xibo uses for duplicate checking
// Xibo checks the "name" field (display name), not fileName
const extractMediaName = (item) => {
  // Only check the name field - this is what Xibo uses for duplicate detection
  return item?.name || item?.mediaName || item?.media_name || null;
};

const ensureExtension = (desiredName, fallbackName) => {
  const fallbackExt = path.extname(fallbackName || "");
  if (!fallbackExt) return desiredName;
  return path.extname(desiredName || "")
    ? desiredName
    : `${desiredName}${fallbackExt}`;
};

const generateUniqueMediaName = async (req, desiredName) => {
  const target = desiredName?.trim();
  if (!target) return desiredName;

  try {
    const userXiboToken = req.user?.xiboToken;
    const userXiboUserId = req.user?.id || req.user?.userId;

    if (!userXiboToken || !userXiboUserId) {
      console.warn(
        "User Xibo token or ID missing for duplicate checking. Skipping pre-check."
      );
      // Return with timestamp to ensure uniqueness
      const ext = path.extname(target);
      const base =
        target.substring(0, target.length - ext.length).trim() || "Media";
      const timestamp = Date.now();
      return `${base}_${timestamp}${ext}`;
    }

    // Query ONLY the user's own media using ownerId filter
    // Include retired/hidden media by not filtering them out
    // Use pagination to get all media
    const ownedMediaResponse = await xiboRequest(
      `/library?length=10000&ownerId=${userXiboUserId}&retired=`,
      "GET",
      null,
      userXiboToken
    );

    // Handle different response formats from Xibo
    let mediaList = [];
    if (Array.isArray(ownedMediaResponse)) {
      mediaList = ownedMediaResponse;
    } else if (
      ownedMediaResponse?.data &&
      Array.isArray(ownedMediaResponse.data)
    ) {
      mediaList = ownedMediaResponse.data;
    }

    console.log(
      `Duplicate check: Found ${mediaList.length} media items (including retired) owned by user ${userXiboUserId}`
    );

    // Extract all existing media names (case-insensitive comparison as Xibo does)
    const existingNames = new Set(
      mediaList
        .map((item) => extractMediaName(item))
        .filter((name) => typeof name === "string" && name.trim().length)
        .map((name) => name.trim().toLowerCase())
    );

    const targetLower = target.toLowerCase();

    // If name doesn't exist in user's media, use it as-is (preserve user's requested name)
    if (!existingNames.has(targetLower)) {
      console.log(
        `Name "${target}" is unique for user. Found ${existingNames.size} existing media items owned by user.`
      );
      return target;
    }

    // Name exists in user's media, need to generate unique variant
    console.log(
      `Duplicate name detected in user's media: "${target}". Found ${existingNames.size} items. Generating unique variant...`
    );

    // Use timestamp for guaranteed uniqueness
    const ext = path.extname(target);
    const base =
      target.substring(0, target.length - ext.length).trim() || "Media";
    const timestamp = Date.now();
    const uniqueName = `${base}_${timestamp}${ext}`;

    console.log(`Generated unique name with timestamp: "${uniqueName}"`);
    return uniqueName;
  } catch (err) {
    console.warn("Failed to check existing media names:", err.message);
    // On error, use timestamp to ensure uniqueness
    const ext = path.extname(target);
    const base =
      target.substring(0, target.length - ext.length).trim() || "Media";
    const timestamp = Date.now();
    return `${base}_${timestamp}${ext}`;
  }
};

export const getLibraryMedia = async (req, res) => {
  try {
    const media = await fetchUserScopedCollection({
      req,
      endpoint: "/library",
      idKeys: ["mediaId", "media_id", "id"],
    });

    res.json({ data: media, total: media.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch library media");
  }
};

// Download/serve media file from Xibo
export const downloadMedia = async (req, res) => {
  try {
    const { mediaId } = req.params;
    const token = await getAccessToken();

    if (!mediaId) {
      return res.status(400).json({ message: "Media ID is required" });
    }

    // Get media download URL from Xibo API
    const xiboApiUrl = process.env.XIBO_API_URL;
    const downloadUrl = `${xiboApiUrl}/library/download/${mediaId}`;

    // Fetch the media file from Xibo
    const response = await axios.get(downloadUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
      responseType: "stream",
    });

    // Set appropriate headers
    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "application/octet-stream"
    );
    res.setHeader(
      "Content-Disposition",
      response.headers["content-disposition"] ||
        `attachment; filename="media-${mediaId}"`
    );

    // Pipe the response to the client
    response.data.pipe(res);
  } catch (err) {
    console.error("Error downloading media:", err);
    handleControllerError(res, err, "Failed to download media file");
  }
};

export const getLibraryFolders = async (req, res) => {
  try {
    const folders = await xiboRequest("/folders", "GET");
    res.json({ folders });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch folders");
  }
};

export const uploadMedia = async (req, res) => {
  try {
    // Use user's Xibo token instead of app token to ensure correct ownership
    const userXiboToken = req.user?.xiboToken;
    if (!userXiboToken) {
      throw new HttpError(
        401,
        "User Xibo token not found. Please login again."
      );
    }

    const file = req.file;
    const {
      folderId = 1,
      name,
      duration = 10,
      tags,
      enableStat,
      retired,
      ownerId,
    } = req.body || {};

    if (!file) {
      throw new HttpError(400, "Media file is required");
    }

    // Get user's Xibo userId from token
    const userXiboUserId = req.user?.id || req.user?.userId;
    if (!userXiboUserId) {
      throw new HttpError(
        401,
        "User ID not found in token. Please login again."
      );
    }

    console.log("Upload request:", {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      folderId,
      duration,
      name: name || file.originalname,
      userId: userXiboUserId,
    });

    // Use user's requested name, or fallback to filename
    const requestedName =
      typeof name === "string" && name.trim().length
        ? name.trim()
        : file.originalname;
    const desiredName = ensureExtension(requestedName, file.originalname);

    // Check for duplicates and generate unique name if needed
    // This preserves the user's requested name unless a duplicate exists
    const uniqueName = await generateUniqueMediaName(req, desiredName);

    if (uniqueName !== desiredName) {
      console.log(
        `Name modified due to duplicate: "${desiredName}" -> "${uniqueName}"`
      );
    } else {
      console.log(`Using user's requested name: "${uniqueName}"`);
    }

    // Always use the logged-in user's ID as owner
    // Only override if explicitly provided and different
    const resolvedOwnerId =
      ownerId !== undefined && ownerId !== null && String(ownerId).length
        ? String(ownerId)
        : String(userXiboUserId);

    // Helper function to attempt upload with a given name
    const attemptUpload = async (nameToUse) => {
      const uploadFormData = new FormData();
      // Create a new stream from the buffer for each attempt
      const fileStream = Readable.from(file.buffer);

      uploadFormData.append("files[]", fileStream, {
        filename: file.originalname,
        contentType: file.mimetype,
        knownLength: file.size,
      });

      uploadFormData.append("folderId", String(folderId));
      uploadFormData.append("duration", String(duration));
      uploadFormData.append("forceDuplicateCheck", "1");
      // Don't set ownerId - let Xibo assign it to the authenticated user
      // uploadFormData.append("ownerId", resolvedOwnerId);
      uploadFormData.append("name", nameToUse);
      if (tags) uploadFormData.append("tags", String(tags));
      if (enableStat !== undefined)
        uploadFormData.append("enableStat", String(enableStat));
      if (retired !== undefined)
        uploadFormData.append("retired", String(retired));

      try {
        const response = await axios.post(
          `${process.env.XIBO_API_URL}/library`,
          uploadFormData,
          {
            headers: {
              Authorization: `Bearer ${userXiboToken}`,
              ...uploadFormData.getHeaders(),
            },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
            validateStatus: (status) => {
              // Don't throw on 400 - we'll handle it in the retry logic
              return status < 500;
            },
          }
        );

        // Check if response has error status
        if (response.status >= 400) {
          const errorData = response.data;
          const errorMessage =
            errorData?.message || errorData?.error || "Upload failed";
          const error = new Error(errorMessage);
          error.response = response;
          throw error;
        }

        return response.data;
      } catch (err) {
        // Re-throw to be handled by retry logic
        throw err;
      }
    };

    // Try upload with the unique name (single attempt since we use timestamps)
    let uploadResult;

    try {
      console.log(`Uploading to Xibo CMS with name "${uniqueName}"`);

      uploadResult = await attemptUpload(uniqueName);

      // Check for errors in the files array
      if (uploadResult?.files && Array.isArray(uploadResult.files)) {
        const fileErrors = uploadResult.files
          .filter((file) => file?.error)
          .map((file) => file.error);

        if (fileErrors.length > 0) {
          const errorMessage = fileErrors[0];
          throw new HttpError(400, errorMessage);
        }

        // Success!
        const uploadedFile = uploadResult.files[0];
        if (uploadedFile && uploadedFile.mediaId) {
          console.log("Upload successful:", {
            mediaId: uploadedFile.mediaId,
            name: uploadedFile.name,
            size: uploadedFile.fileSize,
          });
        }
      } else {
        // No files array, assume success
        console.log("Upload completed successfully");
      }
    } catch (err) {
      // Check if it's a duplicate error in the response
      const errorData = err.response?.data;
      const errorMessage =
        errorData?.message ||
        errorData?.error ||
        (typeof errorData === "string" ? errorData : "") ||
        err.message ||
        "";

      console.error("Upload error:", {
        status: err.response?.status,
        errorMessage,
        errorData,
      });

      throw err;
    }

    res.status(201).json({
      success: true,
      data: uploadResult,
      message: "Media uploaded successfully",
    });
  } catch (err) {
    console.error("Error uploading media:", {
      message: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    handleControllerError(res, err, "Failed to upload media");
  }
};

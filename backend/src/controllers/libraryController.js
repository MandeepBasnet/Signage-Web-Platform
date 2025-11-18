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

const checkMediaNameAvailability = async (req, desiredName) => {
  const target = desiredName?.trim();
  if (!target) {
    return {
      hasConflict: false,
      originalName: desiredName,
      suggestedName: desiredName,
    };
  }

  try {
    const userXiboToken = req.user?.xiboToken;
    const userXiboUserId = req.user?.id || req.user?.userId;

    if (!userXiboToken || !userXiboUserId) {
      console.warn(
        "User Xibo token or ID missing for duplicate checking. Skipping pre-check."
      );
      return {
        hasConflict: false,
        originalName: target,
        suggestedName: target,
      };
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

    if (!existingNames.has(targetLower)) {
      console.log(
        `Name "${target}" is unique for user. Found ${existingNames.size} existing media items owned by user.`
      );
      return {
        hasConflict: false,
        originalName: target,
        suggestedName: target,
      };
    }

    console.log(
      `Duplicate name detected in user's media: "${target}". Found ${existingNames.size} items.`
    );

    const ext = path.extname(target);
    const base =
      target.substring(0, target.length - ext.length).trim() || "Media";
    const timestamp = Date.now();
    const uniqueName = `${base}_${timestamp}${ext}`;

    console.log(`Suggested unique media name: "${uniqueName}"`);
    return {
      hasConflict: true,
      originalName: target,
      suggestedName: uniqueName,
    };
  } catch (err) {
    console.warn("Failed to check existing media names:", err.message);
    return {
      hasConflict: false,
      originalName: target,
      suggestedName: target,
    };
  }
};

export const validateMediaName = async (req, res) => {
  try {
    const { name } = req.body || {};
    if (!name || !name.trim()) {
      throw new HttpError(400, "Media name is required for validation");
    }

    const normalizedName = ensureExtension(name.trim(), name.trim());
    const availability = await checkMediaNameAvailability(req, normalizedName);

    if (availability.hasConflict) {
      return res.status(409).json({
        success: false,
        message: `A media named '${availability.originalName}' already exists in your library. Please choose another name.`,
        nameInfo: {
          originalName: availability.originalName,
          suggestedName: availability.suggestedName,
          wasChanged: true,
          changeReason: `The name "${availability.originalName}" is already in use. Suggested alternative: "${availability.suggestedName}".`,
        },
      });
    }

    return res.json({
      success: true,
      nameInfo: {
        originalName: availability.originalName,
        suggestedName: availability.originalName,
        wasChanged: false,
        changeReason: null,
      },
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to validate media name");
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

    // Always set the name field to the actual filename unless the user specifies otherwise
    let requestedName = file.originalname;
    if (typeof name === "string" && name.trim().length) {
      requestedName = name.trim();
    }
    const desiredName = ensureExtension(requestedName, file.originalname);

    console.log("Upload request:", {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      folderId,
      duration,
      name: desiredName,
      userId: userXiboUserId,
    });

    // Check for duplicates before attempting upload
    const availability = await checkMediaNameAvailability(req, desiredName);

    if (availability.hasConflict) {
      return res.status(409).json({
        success: false,
        message: `A media named '${availability.originalName}' already exists in your library. Please choose another name.`,
        nameInfo: {
          originalName: availability.originalName,
          suggestedName: availability.suggestedName,
          wasChanged: true,
          changeReason: `The name "${availability.originalName}" is already in use. Suggested alternative: "${availability.suggestedName}".`,
        },
      });
    }

    console.log(`Using user's requested name: "${availability.originalName}"`);

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

    let uploadResult;

    try {
      console.log(
        `Uploading to Xibo CMS with name "${availability.originalName}"`
      );

      uploadResult = await attemptUpload(availability.originalName);

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

      if (
        err.response?.status === 400 &&
        typeof errorMessage === "string" &&
        errorMessage.toLowerCase().includes("already own media")
      ) {
        const fallbackSuggestion = await checkMediaNameAvailability(
          req,
          availability.originalName
        );

        return res.status(409).json({
          success: false,
          message: errorMessage,
          nameInfo: {
            originalName: fallbackSuggestion.originalName,
            suggestedName: fallbackSuggestion.suggestedName,
            wasChanged: true,
            changeReason: `The name "${fallbackSuggestion.originalName}" is already in use. Suggested alternative: "${fallbackSuggestion.suggestedName}".`,
          },
        });
      }

      throw err;
    }

    // CRITICAL: Transfer ownership to authenticated user (same as playlist creation)
    // When uploading with user token, Xibo may still assign ownership to app account
    // We need to explicitly transfer ownership to the authenticated user
    if (uploadResult?.files && Array.isArray(uploadResult.files)) {
      const uploadedFile = uploadResult.files[0];
      const mediaId = uploadedFile?.mediaId || uploadedFile?.media_id;

      if (mediaId && userXiboUserId) {
        try {
          console.log(
            `Transferring media ${mediaId} ownership to user ${userXiboUserId}`
          );

          // Try the permissions endpoint with different entity names
          // Xibo uses different entity names for permissions: Playlist, Layout, etc.
          // For media/library, try "Media" first (not "Library")
          let ownershipTransferred = false;
          const entityNames = ["Media", "LibraryMedia", "Library"];

          for (const entityName of entityNames) {
            try {
              console.log(
                `Attempting ownership transfer with entity: ${entityName}`
              );
              await xiboRequest(
                `/user/permissions/${entityName}/${mediaId}`,
                "POST",
                {
                  ownerId: String(userXiboUserId),
                },
                userXiboToken
              );
              console.log(
                `Media ${mediaId} ownership successfully transferred using ${entityName}`
              );
              ownershipTransferred = true;
              break;
            } catch (err) {
              console.warn(
                `Ownership transfer failed with entity ${entityName}:`,
                err.message
              );
              // Try next entity name
            }
          }

          if (!ownershipTransferred) {
            console.warn(
              `Could not transfer ownership for media ${mediaId} using any entity name`
            );
          }
        } catch (ownershipErr) {
          console.warn(
            `Error during ownership transfer for media ${mediaId}:`,
            ownershipErr.message
          );
          // Continue anyway - media is uploaded even if ownership transfer fails
        }
      }
    }

    res.status(201).json({
      success: true,
      data: uploadResult,
      message: "Media uploaded successfully",
      nameInfo: {
        originalName: availability.originalName,
        finalName: availability.originalName,
        wasChanged: false,
        changeReason: null,
      },
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

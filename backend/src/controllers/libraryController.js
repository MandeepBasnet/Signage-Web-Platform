import axios from "axios";
import FormData from "form-data";
import path from "path";
import { Readable } from "stream";
import { getAccessToken, xiboRequest } from "../utils/xiboClient.js";
import {
  fetchUserScopedCollection,
  fetchLibraryCollection,
  handleControllerError,
  HttpError,
} from "../utils/xiboDataHelpers.js";

// Extract the display name field that Xibo uses for duplicate checking
// Xibo checks the "name" field (display name), not fileName
export const extractMediaName = (item) => {
  // Only check the name field - this is what Xibo uses for duplicate detection
  // Also handle cases where name might be null or empty string
  const mediaName = item?.name || item?.mediaName || item?.media_name || null;
  // Return null for empty strings to avoid false positives
  return typeof mediaName === "string" && mediaName.trim()
    ? mediaName.trim()
    : null;
};

export const ensureExtension = (desiredName, fallbackName) => {
  const fallbackExt = path.extname(fallbackName || "");
  if (!fallbackExt) return desiredName;
  return path.extname(desiredName || "")
    ? desiredName
    : `${desiredName}${fallbackExt}`;
};

export const checkMediaNameAvailability = async (req, desiredName) => {
  const target = desiredName?.trim();

  // Validate name length before checking duplicates
  // Xibo API requires 1-100 characters
  if (!target || target.length === 0 || target.length > 100) {
    console.warn(
      `Invalid name length: "${desiredName}" (${
        target?.length || 0
      } chars). Must be 1-100 characters.`
    );
    return {
      hasConflict: true,
      originalName: desiredName,
      suggestedName: `Media_${Date.now()}`,
      error: `Name must be between 1 and 100 characters`,
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
    // Xibo checks duplicates per user, not globally
    // Include retired media in the check
    // Use DataTables format for pagination
    let mediaList = [];
    let totalItemsFetched = 0;
    let pageSize = 1000;
    let pageNum = 0;
    let fetchedAll = false;

    while (!fetchedAll && pageNum < 50) {
      const start = pageNum * pageSize;
      const queryStr = `/library?start=${start}&length=${pageSize}&draw=${
        pageNum + 1
      }&ownerId=${userXiboUserId}`;

      console.log(
        `Fetching user media page ${pageNum} with query: ${queryStr}`
      );

      try {
        const pageResponse = await xiboRequest(
          queryStr,
          "GET",
          null,
          userXiboToken
        );

        // Handle different response formats from Xibo
        let pageItems = [];
        if (Array.isArray(pageResponse)) {
          pageItems = pageResponse;
        } else if (pageResponse?.data && Array.isArray(pageResponse.data)) {
          pageItems = pageResponse.data;
        } else if (pageResponse && typeof pageResponse === "object") {
          // Handle DataTables response format
          pageItems = Array.isArray(pageResponse) ? pageResponse : [];
        }

        console.log(`Page ${pageNum}: Fetched ${pageItems.length} items`);

        if (!pageItems.length) {
          fetchedAll = true;
          break;
        }

        mediaList.push(...pageItems);
        totalItemsFetched += pageItems.length;
        pageNum++;

        // Stop if we got fewer items than page size
        if (pageItems.length < pageSize) {
          fetchedAll = true;
        }
      } catch (pageErr) {
        console.error(
          `Error fetching page ${pageNum} of user media:`,
          pageErr.message
        );
        // Continue with what we have
        fetchedAll = true;
      }
    }

    console.log(
      `Fetched ${totalItemsFetched} media items across ${pageNum} pages`
    );

    console.log(
      `Duplicate check: Found ${mediaList.length} media items owned by user ${userXiboUserId}`
    );

    // Extract all existing media names (case-insensitive comparison as Xibo does)
    // Check the primary "name" field which Xibo uses for duplicate detection
    const existingNames = new Set();
    const extractedNames = [];
    const failedToExtract = [];

    mediaList.forEach((item, index) => {
      const mediaName = extractMediaName(item);
      if (mediaName) {
        existingNames.add(mediaName.toLowerCase());
        extractedNames.push(mediaName);
      } else {
        // Track items where name extraction failed
        failedToExtract.push({
          index,
          item: {
            mediaId: item?.mediaId,
            ownerId: item?.ownerId,
            name: item?.name,
            mediaName: item?.mediaName,
            media_name: item?.media_name,
            fileName: item?.fileName,
          },
        });
      }
    });

    console.log(`Existing media names details:`, {
      totalItems: mediaList.length,
      totalUnique: existingNames.size,
      successfullyExtracted: extractedNames.length,
      failedToExtract: failedToExtract.length,
      allNames: extractedNames,
      failedItems: failedToExtract.slice(0, 5), // Show first 5 failures
    });

    const targetLower = target.toLowerCase();

    if (!existingNames.has(targetLower)) {
      console.log(
        `Name "${target}" is unique for user ${userXiboUserId}. Found ${existingNames.size} existing names.`
      );
      return {
        hasConflict: false,
        originalName: target,
        suggestedName: target,
      };
    }

    console.log(
      `Duplicate name detected in user's media: "${target}". Existing items: ${existingNames.size}`
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
    // Don't fail the upload if duplicate check fails
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

export const getAllLibraryMedia = async (req, res) => {
  try {
    const media = await fetchLibraryCollection({
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

/**
 * Update media name after upload using PUT /library/{mediaId}
 * This ensures the name is explicitly set as Xibo may ignore the name during upload
 * Returns the actual stored name from Xibo to detect any truncation
 */
export const updateMediaName = async (
  mediaId,
  desiredName,
  duration,
  userXiboToken
) => {
  try {
    console.log(`Updating media ${mediaId} name to: "${desiredName}"`);

    // Validate name before sending
    const trimmedName = desiredName?.trim();
    if (!trimmedName || trimmedName.length > 100) {
      throw new Error(
        `Invalid name: "${desiredName}" (${
          trimmedName?.length || 0
        } chars). Must be 1-100 characters.`
      );
    }

    // Use xiboRequest with proper form-data format
    // According to Xibo API, PUT /library/{id} requires: name, duration, retired
    const updateData = {
      name: trimmedName,
      duration: String(duration || 10),
      retired: "0",
    };

    console.log(`Sending PUT request for media ${mediaId}:`, {
      name: updateData.name,
      nameLength: updateData.name.length,
      duration: updateData.duration,
      hasUserToken: !!userXiboToken,
    });

    const response = await xiboRequest(
      `/library/${mediaId}`,
      "PUT",
      updateData,
      userXiboToken
    );

    // Properly extract the stored name from the response
    // Xibo may return the full object or just an empty success response
    const storedName =
      response?.name ||
      response?.mediaName ||
      response?.media_name ||
      response?.fileName ||
      null;

    console.log(`Media ${mediaId} name update response:`, {
      requestedName: desiredName,
      storedName: storedName || "not provided in response",
      fullResponse: response,
    });

    // Return object with both requested and stored names for comparison
    return {
      requestedName: desiredName,
      storedName: storedName,
      name: storedName, // Alias for backwards compatibility
      fileName: storedName, // Alias for backwards compatibility
      mediaName: storedName, // Alias for backwards compatibility
      ...response, // Include full response
    };
  } catch (err) {
    console.error(`Failed to update media ${mediaId} name:`, {
      error: err.message,
      response: err.response?.data,
      status: err.response?.status,
    });
    throw err;
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

      // CRITICAL: Always set a proper name
      // Xibo may use only the first character if name is not set properly
      // Name is optional for POST but must be valid if provided
      if (nameToUse && nameToUse.trim().length > 0) {
        const trimmedName = nameToUse.trim();
        console.log(
          `Adding name to FormData: "${trimmedName}" (${trimmedName.length} chars)`
        );
        uploadFormData.append("name", trimmedName);
      } else {
        console.warn("No name provided for upload, using file originalname");
        uploadFormData.append("name", file.originalname);
      }
      if (tags) uploadFormData.append("tags", String(tags));
      if (enableStat !== undefined)
        uploadFormData.append("enableStat", String(enableStat));
      if (retired !== undefined)
        uploadFormData.append("retired", String(retired));

      try {
        console.log(`Uploading file with name: "${nameToUse}"`);
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
              // Accept all statuses and handle them explicitly
              return true;
            },
          }
        );

        // Log the full response for debugging
        console.log(`Upload response status: ${response.status}`, {
          statusCode: response.status,
          dataKeys: Object.keys(response.data || {}),
          responsePreview: JSON.stringify(response.data).substring(0, 200),
        });

        // Check if response has error status
        if (response.status >= 400) {
          const errorData = response.data;
          const errorMessage =
            errorData?.message || errorData?.error || "Upload failed";
          console.error(`Upload returned error status ${response.status}:`, {
            message: errorMessage,
            fullResponse: errorData,
          });
          const error = new Error(errorMessage);
          error.response = response;
          error.status = response.status;
          throw error;
        }

        return response.data;
      } catch (err) {
        // Ensure error object has response attached
        if (!err.response && err.status) {
          err.response = { status: err.status };
        }
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
        console.log(
          `Duplicate detected during upload. Pre-check returned: ${availability.originalName}, Suggested: ${availability.suggestedName}`
        );

        // If our pre-check missed a duplicate, try with the suggested name
        if (availability.suggestedName !== availability.originalName) {
          console.log(
            `Retrying upload with suggested name: "${availability.suggestedName}"`
          );
          try {
            uploadResult = await attemptUpload(availability.suggestedName);
            console.log(
              `Retry successful with suggested name: "${availability.suggestedName}"`
            );

            // Check for errors in retry
            if (uploadResult?.files && Array.isArray(uploadResult.files)) {
              const fileErrors = uploadResult.files
                .filter((file) => file?.error)
                .map((file) => file.error);

              if (fileErrors.length === 0) {
                // Retry succeeded - continue with normal flow
                // Don't throw, let it proceed to ownership/name update
              } else {
                // Retry also failed
                throw new HttpError(400, fileErrors[0]);
              }
            }
          } catch (retryErr) {
            // Retry failed - return error to user
            const retryErrorMessage =
              retryErr.response?.data?.message ||
              retryErr.response?.data?.error ||
              retryErr.message ||
              "Upload failed with both original and suggested name";

            console.error("Retry failed:", retryErrorMessage);

            // Get a new suggestion
            const newSuggestion = await checkMediaNameAvailability(
              req,
              availability.suggestedName
            );

            return res.status(409).json({
              success: false,
              message: `Upload failed: ${retryErrorMessage}. Please try again with a different name.`,
              nameInfo: {
                originalName: availability.originalName,
                suggestedName: newSuggestion.suggestedName,
                wasChanged: true,
                changeReason: `The name "${availability.originalName}" and the suggested alternative "${availability.suggestedName}" are both unavailable. Please try: "${newSuggestion.suggestedName}".`,
              },
            });
          }
        } else {
          // Already using suggested name, can't retry further
          const newSuggestion = await checkMediaNameAvailability(
            req,
            availability.originalName
          );

          return res.status(409).json({
            success: false,
            message: errorMessage,
            nameInfo: {
              originalName: newSuggestion.originalName,
              suggestedName: newSuggestion.suggestedName,
              wasChanged: true,
              changeReason: `The name "${newSuggestion.originalName}" is already in use. Suggested alternative: "${newSuggestion.suggestedName}".`,
            },
          });
        }
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

    // CRITICAL: Explicitly update the media name after upload
    // Xibo's upload endpoint may ignore or truncate the name field
    // We must use PUT /library/{mediaId} to ensure the name is correctly set
    let finalStoredName = availability.originalName;
    let finalNameChanged = false;

    if (uploadResult?.files && Array.isArray(uploadResult.files)) {
      const uploadedFile = uploadResult.files[0];
      const mediaId = uploadedFile?.mediaId || uploadedFile?.media_id;

      if (mediaId) {
        try {
          console.log(
            `Explicitly updating media ${mediaId} name to: "${availability.originalName}"`
          );

          // Call PUT /library/{mediaId} to explicitly set the name
          const updateResponse = await updateMediaName(
            mediaId,
            availability.originalName,
            duration,
            userXiboToken
          );

          // Extract the actual stored name from the update response
          // updateMediaName returns object with storedName
          const confirmedName =
            updateResponse?.storedName ||
            updateResponse?.name ||
            updateResponse?.fileName ||
            updateResponse?.mediaName ||
            null;

          if (confirmedName && confirmedName.trim()) {
            finalStoredName = confirmedName.trim();
            // Only mark as changed if different from requested
            if (
              finalStoredName.toLowerCase() !==
              availability.originalName.toLowerCase()
            ) {
              console.warn(
                `Media name mismatch: requested "${availability.originalName}", stored as "${finalStoredName}"`
              );
              finalNameChanged = true;
            } else {
              console.log(
                `Media ${mediaId} name confirmed as: "${finalStoredName}"`
              );
            }
          } else {
            // Response didn't include name - try to get from upload response
            const uploadedName =
              uploadedFile?.name ||
              uploadedFile?.fileName ||
              uploadedFile?.mediaName ||
              null;
            if (uploadedName && uploadedName.trim()) {
              finalStoredName = uploadedName.trim();
              if (
                finalStoredName.toLowerCase() !==
                availability.originalName.toLowerCase()
              ) {
                finalNameChanged = true;
              }
            }
          }
        } catch (nameUpdateErr) {
          console.error(
            `Failed to update media ${mediaId} name:`,
            nameUpdateErr.message
          );
          // Don't fail the upload - just log the error
          // Try to get the name from the upload response
          const storedName =
            uploadedFile?.name ||
            uploadedFile?.fileName ||
            uploadedFile?.mediaName ||
            null;
          if (storedName && storedName.trim()) {
            finalStoredName = storedName.trim();
            if (
              finalStoredName.toLowerCase() !==
              availability.originalName.toLowerCase()
            ) {
              finalNameChanged = true;
            }
          }
        }
      }
    }

    res.status(201).json({
      success: true,
      data: uploadResult,
      message: "Media uploaded successfully",
      nameInfo: {
        originalName: availability.originalName,
        finalName: finalStoredName,
        wasChanged: finalNameChanged,
        changeReason: finalNameChanged
          ? `Xibo saved this media as "${finalStoredName}" instead of "${availability.originalName}".`
          : null,
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

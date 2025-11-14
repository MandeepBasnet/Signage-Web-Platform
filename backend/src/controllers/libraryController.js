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

const extractMediaName = (item) =>
  item?.name ||
  item?.mediaName ||
  item?.media_name ||
  item?.fileName ||
  item?.filename ||
  item?.originalFilename ||
  null;

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
    const media = await fetchUserScopedCollection({
      req,
      endpoint: "/library",
      idKeys: ["mediaId", "media_id", "id"],
    });

    const existingNames = new Set(
      media
        .map((item) => extractMediaName(item))
        .filter((name) => typeof name === "string" && name.trim().length)
        .map((name) => name.trim().toLowerCase())
    );

    if (!existingNames.has(target.toLowerCase())) {
      return target;
    }

    const ext = path.extname(target);
    const base =
      target.substring(0, target.length - ext.length).trim() || "Media";

    let counter = 1;
    let candidate = `${base} (${counter})${ext}`;
    while (existingNames.has(candidate.toLowerCase()) && counter < 1000) {
      counter += 1;
      candidate = `${base} (${counter})${ext}`;
    }

    return candidate;
  } catch (err) {
    console.warn("Failed to check existing media names:", err.message);
    return target;
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
    const token = await getAccessToken();
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

    console.log("Upload request:", {
      filename: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      folderId,
      duration,
      name: name || file.originalname,
    });

    const requestedName =
      typeof name === "string" && name.trim().length
        ? name.trim()
        : file.originalname;
    const desiredName = ensureExtension(requestedName, file.originalname);
    const uniqueName = await generateUniqueMediaName(req, desiredName);

    // Create FormData for Xibo upload
    const formData = new FormData();

    // Convert buffer to stream for axios/form-data
    const fileStream = Readable.from(file.buffer);

    // Append file with proper options
    formData.append("files[]", fileStream, {
      filename: uniqueName,
      contentType: file.mimetype,
      knownLength: file.size, // Important for proper upload
    });

    // Add required parameters
    formData.append("folderId", String(folderId));
    formData.append("duration", String(duration));
    formData.append("forceDuplicateCheck", "0"); // Required by Xibo API

    // Get user's ownerId
    const userOwnerId = isNumeric(req.user?.id)
      ? String(req.user.id)
      : isNumeric(req.user?.userId)
      ? String(req.user.userId)
      : null;

    const resolvedOwnerId =
      ownerId !== undefined && ownerId !== null && String(ownerId).length
        ? ownerId
        : userOwnerId;

    if (resolvedOwnerId !== null) {
      formData.append("ownerId", String(resolvedOwnerId));
    }

    // Add optional parameters
    formData.append("name", uniqueName);
    if (tags) formData.append("tags", String(tags));
    if (enableStat !== undefined)
      formData.append("enableStat", String(enableStat));
    if (retired !== undefined) formData.append("retired", String(retired));

    console.log(
      "Uploading to Xibo CMS:",
      `${process.env.XIBO_API_URL}/library`
    );

    // Upload to Xibo
    const response = await axios.post(
      `${process.env.XIBO_API_URL}/library`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    console.log("Xibo response:", response.data);

    const uploadResult = response.data;

    // Check for errors in the files array
    if (uploadResult?.files && Array.isArray(uploadResult.files)) {
      const fileErrors = uploadResult.files
        .filter((file) => file?.error)
        .map((file) => file.error);

      if (fileErrors.length > 0) {
        console.error("Upload errors:", fileErrors);
        throw new HttpError(400, fileErrors[0]);
      }

      // Extract uploaded media info
      const uploadedFile = uploadResult.files[0];
      if (uploadedFile && uploadedFile.mediaId) {
        console.log("Upload successful:", {
          mediaId: uploadedFile.mediaId,
          name: uploadedFile.name,
          size: uploadedFile.fileSize,
        });
      }
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

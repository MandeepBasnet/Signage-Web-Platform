import axios from "axios";
import FormData from "form-data";
import {
  fetchUserScopedCollection,
  handleControllerError,
  getUserContext,
} from "../utils/xiboDataHelpers.js";
import { xiboRequest } from "../utils/xiboClient.js";

export const createPlaylist = async (req, res) => {
  try {
    const { name, description } = req.body;
    const { token, userId } = getUserContext(req);

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Playlist name is required" });
    }

    const playlistName = name.trim();

    // Check if a playlist with the same name already exists for THIS USER
    let nameWasChanged = false;
    let finalPlaylistName = playlistName;
    let nameExists = false;

    try {
      // Query ONLY playlists owned by the current user
      const existingParams = new URLSearchParams({
        length: "10000",
        ownerId: String(userId), // Only get playlists owned by this user
      });

      const existingPlaylists = await xiboRequest(
        `/playlist?${existingParams.toString()}`,
        "GET",
        null,
        token
      );

      // Handle different response formats
      let playlistList = [];
      if (Array.isArray(existingPlaylists)) {
        playlistList = existingPlaylists;
      } else if (
        existingPlaylists?.data &&
        Array.isArray(existingPlaylists.data)
      ) {
        playlistList = existingPlaylists.data;
      }

      // Check if any of user's playlists match this name (case-insensitive)
      nameExists = playlistList.some(
        (p) =>
          p.name && p.name.trim().toLowerCase() === playlistName.toLowerCase()
      );

      if (nameExists) {
        // Generate unique name with timestamp
        const timestamp = Date.now();
        finalPlaylistName = `${playlistName}_${timestamp}`;
        nameWasChanged = true;
        console.log(
          `Playlist name duplicate detected: "${playlistName}" → "${finalPlaylistName}"`
        );
      }
    } catch (checkErr) {
      // If check fails, continue with original name
      console.warn("Could not check for existing playlists:", checkErr.message);
    }

    if (nameExists && nameWasChanged) {
      return res.status(409).json({
        success: false,
        message: `A playlist named '${playlistName}' already exists in your library.`,
        nameInfo: {
          originalName: playlistName,
          suggestedName: finalPlaylistName,
          changeReason: `A playlist with the name "${playlistName}" already exists for your account. Would you like to save as "${finalPlaylistName}" instead?`,
        },
      });
    }

    const playlistData = {
      name: finalPlaylistName,
      description: description?.trim() || "",
      isDynamic: 0, // Create as static playlist by default
    };

    const response = await xiboRequest(
      "/playlist",
      "POST",
      playlistData,
      token
    );

    // CRITICAL: Set ownership to authenticated user
    // Since we use app token to create, Xibo assigns it to app account
    // We need to change ownership to the actual user
    if (response && (response.playlistId || response.id)) {
      const playlistId = response.playlistId || response.id;

      try {
        // Set ownership by changing owner via permissions API
        // POST /user/permissions/{entity}/{objectId}
        // We pass ownerId to transfer ownership to authenticated user
        await xiboRequest(
          `/user/permissions/Playlist/${playlistId}`,
          "POST",
          {
            ownerId: String(userId), // Transfer ownership to authenticated user
          },
          token
        );
        console.log(`Playlist ${playlistId} ownership set to user ${userId}`);
      } catch (ownershipErr) {
        console.warn(
          `Could not set ownership for playlist ${playlistId}:`,
          ownershipErr.message
        );
        // Continue anyway - playlist is created even if ownership change fails
      }
    }

    res.status(201).json({
      success: true,
      message: "Playlist created successfully",
      playlist: response,
      nameInfo: nameWasChanged
        ? {
            originalName: playlistName,
            finalName: finalPlaylistName,
            wasChanged: true,
            changeReason: `A playlist named "${playlistName}" already exists in your library. This playlist has been saved as "${finalPlaylistName}"`,
          }
        : {
            originalName: playlistName,
            finalName: finalPlaylistName,
            wasChanged: false,
            changeReason: null,
          },
    });
  } catch (err) {
    // Handle 409 Conflict error from Xibo API
    if (err.message && err.message.includes("409")) {
      return res.status(409).json({
        success: false,
        message:
          "A playlist with this name already exists. Please choose another name.",
      });
    }
    handleControllerError(res, err, "Failed to create playlist");
  }
};

export const getPlaylists = async (req, res) => {
  try {
    const playlists = await fetchUserScopedCollection({
      req,
      endpoint: "/playlist",
      idKeys: ["playlistId", "playlist_id", "id"],
    });

    res.json({ data: playlists, total: playlists.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch playlists");
  }
};

const isNumeric = (value) =>
  value !== undefined &&
  value !== null &&
  String(value).trim() !== "" &&
  !Number.isNaN(Number(value));

export const addMediaToPlaylist = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { mediaIds, duration, useDuration, displayOrder } = req.body || {};
    const { token } = getUserContext(req);

    if (!playlistId) {
      return res.status(400).json({ message: "Playlist ID is required" });
    }

    if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
      return res
        .status(400)
        .json({ message: "At least one mediaId is required" });
    }

    const formData = new FormData();
    mediaIds.forEach((mediaId) => {
      if (mediaId !== undefined && mediaId !== null) {
        formData.append("media[]", String(mediaId));
      }
    });

    if (isNumeric(duration)) {
      formData.append("duration", String(duration));
      formData.append("useDuration", "1");
    } else if (useDuration !== undefined) {
      formData.append("useDuration", useDuration ? "1" : "0");
    }

    if (isNumeric(displayOrder)) {
      formData.append("displayOrder", String(displayOrder));
    }

    const response = await axios.post(
      `${process.env.XIBO_API_URL}/playlist/library/assign/${playlistId}`,
      formData,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          ...formData.getHeaders(),
        },
      }
    );

    res.status(201).json({
      success: true,
      message: "Media added to playlist",
      data: response.data,
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to add media to playlist");
  }
};

// Get playlist details with media items
export const getPlaylistDetails = async (req, res) => {
  try {
    const { playlistId } = req.params;
    const { token } = getUserContext(req);

    if (!playlistId) {
      return res.status(400).json({ message: "Playlist ID is required" });
    }

    const EMBED_FIELDS = "widgets,widget_validity,tags,permissions";

    // Get the playlist by searching the list
    // Xibo playlists are retrieved via filtered list queries with embed params
    let playlist;
    try {
      // Try with playlistId filter first
      const params = new URLSearchParams({
        playlistId: String(playlistId),
        embed: EMBED_FIELDS,
      });

      let response;
      try {
        response = await xiboRequest(
          `/playlist?${params.toString()}`,
          "GET",
          null,
          token
        );
      } catch (filterError) {
        // If filtering fails, get all playlists and find the one we need
        console.warn(
          "Filter search failed, fetching all playlists:",
          filterError.message
        );
        response = await xiboRequest(
          `/playlist?embed=${encodeURIComponent(EMBED_FIELDS)}`,
          "GET",
          null,
          token
        );
      }

      // Handle different response formats
      let playlists = [];
      if (Array.isArray(response)) {
        playlists = response;
      } else if (response?.data && Array.isArray(response.data)) {
        playlists = response.data;
      } else if (response?.data && !Array.isArray(response.data)) {
        playlists = [response.data];
      } else if (response) {
        playlists = [response];
      }

      // Find the playlist with matching ID
      playlist = playlists.find(
        (p) =>
          String(p.playlistId || p.playlist_id || p.id) === String(playlistId)
      );

      if (!playlist) {
        return res.status(404).json({ message: "Playlist not found" });
      }
    } catch (searchError) {
      console.error("Error searching for playlist:", searchError);
      throw new Error("Failed to fetch playlist details");
    }

    // Extract widgets from the playlist (widgets contain media information)
    const widgets = playlist.widgets || [];
    const mediaItems = [];

    console.log(
      `Processing ${widgets.length} widgets for playlist ${playlistId}`
    );

    // Process widgets to extract media information
    for (const widget of widgets) {
      try {
        const widgetId = widget.widgetId || widget.id || widget.widget_id;
        const widgetType = widget.type || widget.widgetType || "";

        console.log(`Processing widget ${widgetId} of type ${widgetType}`);

        // Helper function to extract mediaId from various structures
        const extractMediaId = (obj) => {
          if (!obj) return null;
          return (
            obj.mediaId ||
            obj.media_id ||
            obj.media?.mediaId ||
            obj.media?.media_id ||
            obj.id // Sometimes the id in widget data is the mediaId
          );
        };

        // Helper function to extract media info
        const extractMediaInfo = (item, sourceWidget) => {
          const mediaId = extractMediaId(item);
          if (!mediaId) return null;

          return {
            mediaId: mediaId,
            name:
              item.name ||
              item.fileName ||
              item.mediaName ||
              item.media?.name ||
              item.media?.fileName ||
              sourceWidget.name ||
              `Media ${mediaId}`,
            description:
              item.description ||
              item.media?.description ||
              sourceWidget.description,
            mediaType:
              item.mediaType ||
              item.type ||
              item.media?.mediaType ||
              item.media?.type ||
              sourceWidget.type,
            fileSize:
              item.fileSize || item.media?.fileSize || sourceWidget.fileSize,
            duration:
              item.duration || item.media?.duration || sourceWidget.duration,
            modifiedDt:
              item.modifiedDt ||
              item.media?.modifiedDt ||
              sourceWidget.modifiedDt,
            widgetId: widgetId,
            widgetType: widgetType,
            ...item,
          };
        };

        // First, check if widget itself has media info
        const directMediaId = extractMediaId(widget);
        if (directMediaId) {
          console.log(
            `Found direct mediaId ${directMediaId} in widget ${widgetId}`
          );
          const mediaInfo = extractMediaInfo(widget, widget);
          if (mediaInfo) {
            mediaItems.push(mediaInfo);
            continue;
          }
        }

        // Always fetch widget data to get complete information
        if (widgetId) {
          try {
            console.log(`Fetching widget data for widget ${widgetId}`);
            const widgetData = await xiboRequest(
              `/playlist/widget/data/${widgetId}`,
              "GET",
              null,
              token
            );

            console.log(
              `Widget data for ${widgetId}:`,
              JSON.stringify(widgetData).substring(0, 200)
            );

            // Extract media information from widget data
            if (widgetData) {
              // Case 1: Widget data is a single object with mediaId
              const singleMediaId = extractMediaId(widgetData);
              if (singleMediaId) {
                console.log(`Found mediaId ${singleMediaId} in widget data`);
                const mediaInfo = extractMediaInfo(widgetData, widget);
                if (mediaInfo) {
                  mediaItems.push(mediaInfo);
                  continue;
                }
              }

              // Case 2: Widget data is an array
              if (Array.isArray(widgetData)) {
                console.log(
                  `Widget data is an array with ${widgetData.length} items`
                );
                widgetData.forEach((item, index) => {
                  const itemMediaId = extractMediaId(item);
                  if (itemMediaId) {
                    console.log(
                      `Found mediaId ${itemMediaId} in array item ${index}`
                    );
                    const mediaInfo = extractMediaInfo(item, widget);
                    if (mediaInfo) {
                      mediaItems.push(mediaInfo);
                    }
                  }
                });
                continue;
              }

              // Case 3: Widget data has a data property that's an array
              if (widgetData.data && Array.isArray(widgetData.data)) {
                console.log(
                  `Widget data has data array with ${widgetData.data.length} items`
                );
                widgetData.data.forEach((item, index) => {
                  const itemMediaId = extractMediaId(item);
                  if (itemMediaId) {
                    console.log(
                      `Found mediaId ${itemMediaId} in data array item ${index}`
                    );
                    const mediaInfo = extractMediaInfo(item, widget);
                    if (mediaInfo) {
                      mediaItems.push(mediaInfo);
                    }
                  }
                });
                continue;
              }

              // Case 4: Widget data has nested structures
              // Check for common nested patterns
              const nestedMediaId =
                widgetData.media?.mediaId ||
                widgetData.media?.media_id ||
                widgetData.item?.mediaId ||
                widgetData.item?.media_id;
              if (nestedMediaId) {
                console.log(`Found nested mediaId ${nestedMediaId}`);
                const mediaInfo = extractMediaInfo(widgetData, widget);
                if (mediaInfo) {
                  mediaItems.push(mediaInfo);
                  continue;
                }
              }

              console.warn(
                `Could not extract mediaId from widget data for widget ${widgetId}`
              );
            }
          } catch (widgetDataError) {
            console.warn(
              `Could not fetch data for widget ${widgetId}:`,
              widgetDataError.message
            );
            // If widget data fetch fails but widget has basic info, include it
            if (widget.name || widget.type) {
              console.log(`Including widget ${widgetId} with basic info`);
              mediaItems.push({
                ...widget,
                widgetId: widgetId,
                widgetType: widgetType,
              });
            }
          }
        } else {
          console.warn(`Widget has no ID, skipping:`, widget);
        }
      } catch (widgetError) {
        console.warn(`Error processing widget:`, widgetError.message);
        // Continue processing other widgets
      }
    }

    console.log(
      `Extracted ${mediaItems.length} media items from ${widgets.length} widgets`
    );

    res.json({
      playlist,
      media: mediaItems,
      total: mediaItems.length,
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch playlist details");
  }
};

import {
  fetchLibraryCollection,
  filterOwnedOrShared,
  resolveUserIdentity,
  handleControllerError,
  getUserContext,
} from "../utils/xiboDataHelpers.js";
import { xiboRequest } from "../utils/xiboClient.js";
import { withSignedMediaUrls } from "../utils/mediaUrlSigner.js";

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
        token,
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
          p.name && p.name.trim().toLowerCase() === playlistName.toLowerCase(),
      );

      if (nameExists) {
        // Generate unique name with timestamp
        const timestamp = Date.now();
        finalPlaylistName = `${playlistName}_${timestamp}`;
        nameWasChanged = true;
        console.log(
          `Playlist name duplicate detected: "${playlistName}" → "${finalPlaylistName}"`,
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
      token,
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
          token,
        );
        console.log(`Playlist ${playlistId} ownership set to user ${userId}`);
      } catch (ownershipErr) {
        console.warn(
          `Could not set ownership for playlist ${playlistId}:`,
          ownershipErr.message,
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
    // All Xibo calls use the shared super-admin app token, so /playlist returns
    // every playlist in the CMS. Scope here to playlists the user OWNS *or* that
    // are permission-shared with one of their groups (an owner-only filter hid
    // shared-but-editable playlists). Mirrors the layouts fix.
    const [identity, raw] = await Promise.all([
      resolveUserIdentity(req),
      fetchLibraryCollection({
        req,
        endpoint: "/playlist",
        idKeys: ["playlistId", "playlist_id", "id"],
        pageSize: 500,
        maxPages: 20,
        queryParams: { embed: "permissions,groupsWithPermissions" },
      }),
    ]);

    const playlists = filterOwnedOrShared(raw, identity);

    res.json({ data: playlists, total: playlists.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch playlists");
  }
};

// Get playlist details with media items
// Note: addMediaToPlaylist has been moved to addMediaPlaylistController.js
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
          token,
        );
      } catch (filterError) {
        // If filtering fails, get all playlists and find the one we need
        console.warn(
          "Filter search failed, fetching all playlists:",
          filterError.message,
        );
        response = await xiboRequest(
          `/playlist?embed=${encodeURIComponent(EMBED_FIELDS)}`,
          "GET",
          null,
          token,
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
          String(p.playlistId || p.playlist_id || p.id) === String(playlistId),
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
      `Processing ${widgets.length} widgets for playlist ${playlistId}`,
    );

    // Resolve a single widget into its media items (0, 1, or many). Each
    // widget needs one Xibo call for its data; running these per-widget in a
    // sequential loop was the N+1 bottleneck, so widgets are processed in
    // bounded-concurrency batches below. Returns an array so ordering is
    // preserved when the batch results are flattened.
    const processWidget = async (widget) => {
      const out = [];
      try {
        const widgetId = widget.widgetId || widget.id || widget.widget_id;
        const widgetType = widget.type || widget.widgetType || "";

        // Helper function to extract mediaId from various structures
        const extractMediaId = (obj) => {
          if (!obj) return null;
          return (
            obj.mediaId ||
            obj.media_id ||
            // Media widgets (notably video) carry the id only in the plural
            // `mediaIds` array — without this, the item gets no singular id, so
            // withSignedMediaUrls attaches no thumbnailUrl and the UI shows an
            // icon instead of the (Xibo-provided) poster.
            (Array.isArray(obj.mediaIds) ? obj.mediaIds[0] : undefined) ||
            (Array.isArray(obj.media_ids) ? obj.media_ids[0] : undefined) ||
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
          const mediaInfo = extractMediaInfo(widget, widget);
          if (mediaInfo) {
            out.push(mediaInfo);
            return out;
          }
        }

        // Always fetch widget data to get complete information
        if (widgetId) {
          try {
            const widgetData = await xiboRequest(
              `/playlist/widget/data/${widgetId}`,
              "GET",
              null,
              token,
            );

            // Extract media information from widget data
            if (widgetData) {
              // Case 1: Widget data is a single object with mediaId
              const singleMediaId = extractMediaId(widgetData);
              if (singleMediaId) {
                const mediaInfo = extractMediaInfo(widgetData, widget);
                if (mediaInfo) {
                  out.push(mediaInfo);
                  return out;
                }
              }

              // Case 2: Widget data is an array
              if (Array.isArray(widgetData)) {
                widgetData.forEach((item) => {
                  const itemMediaId = extractMediaId(item);
                  if (itemMediaId) {
                    const mediaInfo = extractMediaInfo(item, widget);
                    if (mediaInfo) {
                      out.push(mediaInfo);
                    }
                  }
                });
                return out;
              }

              // Case 3: Widget data has a data property that's an array
              if (widgetData.data && Array.isArray(widgetData.data)) {
                widgetData.data.forEach((item) => {
                  const itemMediaId = extractMediaId(item);
                  if (itemMediaId) {
                    const mediaInfo = extractMediaInfo(item, widget);
                    if (mediaInfo) {
                      out.push(mediaInfo);
                    }
                  }
                });
                return out;
              }

              // Case 4: Widget data has nested structures
              // Check for common nested patterns
              const nestedMediaId =
                widgetData.media?.mediaId ||
                widgetData.media?.media_id ||
                widgetData.item?.mediaId ||
                widgetData.item?.media_id;
              if (nestedMediaId) {
                const mediaInfo = extractMediaInfo(widgetData, widget);
                if (mediaInfo) {
                  out.push(mediaInfo);
                  return out;
                }
              }

              console.warn(
                `Could not extract mediaId from widget data for widget ${widgetId}`,
              );
            }
          } catch (widgetDataError) {
            // Suppress 405 Method Not Allowed errors as some widgets don't support data retrieval
            if (
              widgetDataError.message &&
              widgetDataError.message.includes("405")
            ) {
              console.log(
                `Widget ${widgetId} does not support data retrieval (405). Using basic info.`,
              );
            } else {
              console.warn(
                `Could not fetch data for widget ${widgetId}:`,
                widgetDataError.message,
              );
            }

            // If widget data fetch fails but widget has basic info, include it
            if (widget.name || widget.type) {
              out.push({
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
      return out;
    };

    // Process widgets in bounded-concurrency batches (was a sequential N+1
    // loop). Order is preserved: batches run in sequence and each batch's
    // results are flattened in widget order.
    const WIDGET_FETCH_CONCURRENCY = 20;
    for (let i = 0; i < widgets.length; i += WIDGET_FETCH_CONCURRENCY) {
      const batch = widgets.slice(i, i + WIDGET_FETCH_CONCURRENCY);
      const batchResults = await Promise.all(batch.map(processWidget));
      for (const items of batchResults) mediaItems.push(...items);
    }

    console.log(
      `Extracted ${mediaItems.length} media items from ${widgets.length} widgets`,
    );

    res.json({
      playlist,
      media: withSignedMediaUrls(mediaItems),
      total: mediaItems.length,
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch playlist details");
  }
};

/**
 * Update widget expiry dates in playlist
 *
 * XIBO API Reference:
 * PUT /playlist/widget/{widgetId}/expiry
 *
 * Path Parameters:
 * - widgetId (integer, required): The Widget ID
 *
 * Form Data:
 * - fromDt (string): Start date (Y-m-d H:i:s)
 * - toDt (string): End date (Y-m-d H:i:s)
 * - deleteOnExpiry (integer): Auto-delete on expiry? (0 or 1)
 */
export const updatePlaylistWidgetItemExpiry = async (req, res) => {
  try {
    const { playlistId, widgetId } = req.params;
    const { fromDt, toDt, deleteOnExpiry } = req.body;
    const { token } = getUserContext(req);

    if (!widgetId) {
      return res.status(400).json({ message: "Widget ID is required" });
    }

    console.log(
      `Updating expiry for widget ${widgetId} in playlist ${playlistId}`,
      { fromDt, toDt, deleteOnExpiry },
    );

    const updateData = {};
    if (fromDt !== undefined) updateData.fromDt = fromDt;
    if (toDt !== undefined) updateData.toDt = toDt;
    if (deleteOnExpiry !== undefined)
      updateData.deleteOnExpiry = deleteOnExpiry ? 1 : 0;

    const response = await xiboRequest(
      `/playlist/widget/${widgetId}/expiry`,
      "PUT",
      updateData,
      token,
    );

    res.json({
      success: true,
      message: "Widget expiry updated successfully",
      data: response,
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to update widget expiry");
  }
};

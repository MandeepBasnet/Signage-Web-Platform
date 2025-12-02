import axios from "axios";
import { xiboRequest, getAccessToken } from "../utils/xiboClient.js";
import {
  fetchUserScopedCollection,
  getUserContext,
  handleControllerError,
  HttpError,
} from "../utils/xiboDataHelpers.js";

const LAYOUT_EMBED_FIELDS =
  "regions,playlists,widgets,widget_validity,tags,permissions,actions";

export const getLayouts = async (req, res) => {
  try {
    const layouts = await fetchUserScopedCollection({
      req,
      endpoint: "/layout",
      idKeys: ["layoutId", "layout_id", "id"],
      queryParams: {
        embed: LAYOUT_EMBED_FIELDS,
      },
    });

    res.json({ data: layouts, total: layouts.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch layouts");
  }
};

export const publishLayout = async (req, res) => {
  const { layoutId } = req.params;

  try {
    const { token } = getUserContext(req);

    const result = await xiboRequest(
      `/layout/publish/${layoutId}`,
      "PUT",
      null,
      token
    );

    res.json(result);
  } catch (err) {
    handleControllerError(res, err, "Failed to publish layout");
  }
};

export const checkoutLayout = async (req, res) => {
  const { layoutId } = req.params;

  try {
    const { token } = getUserContext(req);

    // Xibo API: PUT /layout/checkout/{layoutId}
    const result = await xiboRequest(
      `/layout/checkout/${layoutId}`,
      "PUT",
      null,
      token
    );

    res.json(result);
  } catch (err) {
    handleControllerError(res, err, "Failed to checkout layout");
  }
};

export const getLayoutDetails = async (req, res) => {
  try {
    const { layoutId } = req.params;
    const { token } = getUserContext(req);

    if (!layoutId) {
      return res.status(400).json({ message: "Layout ID is required" });
    }

    const params = new URLSearchParams({
      layoutId: String(layoutId),
      embed: LAYOUT_EMBED_FIELDS,
    });

    let response;
    try {
      response = await xiboRequest(
        `/layout?${params.toString()}`,
        "GET",
        null,
        token
      );
    } catch (filterError) {
      console.warn(
        "Layout filtered request failed, falling back to full list",
        filterError.message
      );
      response = await xiboRequest(
        `/layout?embed=${encodeURIComponent(LAYOUT_EMBED_FIELDS)}`,
        "GET",
        null,
        token
      );
    }

    let layouts = [];
    if (Array.isArray(response)) {
      layouts = response;
    } else if (Array.isArray(response?.data)) {
      layouts = response.data;
    } else if (response?.data) {
      layouts = [response.data];
    } else if (response) {
      layouts = [response];
    }

    const layout =
      layouts.find(
        (item) =>
          String(item.layoutId || item.layout_id || item.id) ===
          String(layoutId)
      ) || null;

    if (!layout) {
      return res.status(404).json({ message: "Layout not found" });
    }

    const normalizeWidgets = (widgets = []) =>
      (widgets || []).map((widget) => {
        const widgetId = widget.widgetId || widget.widget_id || widget.id;
        const mediaIds =
          widget.mediaIds ||
          widget.media_ids ||
          (widget.mediaId || widget.media_id
            ? [widget.mediaId || widget.media_id]
            : []);

        return {
          ...widget,
          widgetId,
          mediaIds,
        };
      });

    const normalizedRegions = (layout.regions || []).map((region) => {
      const playlist =
        region.regionPlaylist ||
        region.playlist ||
        (layout.playlists || []).find(
          (pl) =>
            String(pl.regionId || pl.region_id) ===
            String(region.regionId || region.region_id)
        );

      const widgetsFromRegion =
        region.widgets || playlist?.widgets || playlist?.regionWidgets || [];

      return {
        ...region,
        regionId: region.regionId || region.region_id,
        playlist,
        widgets: normalizeWidgets(widgetsFromRegion),
      };
    });

    const normalizedLayout = {
      ...layout,
      layoutId: layout.layoutId || layout.id,
      regions: normalizedRegions,
      playlists:
        layout.playlists ||
        normalizedRegions.map((region) => region.playlist).filter(Boolean),
      thumbnail:
        layout.thumbnail || `/layout/thumbnail/${layout.layoutId || layoutId}`,
    };

    res.json({
      layout: normalizedLayout,
      preview: {
        thumbnailEndpoint: `/layouts/${layoutId}/thumbnail`,
        thumbnailPath: normalizedLayout.thumbnail,
        previewPath: `/layout/preview/${layoutId}`,
      },
    });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch layout details");
  }
};

export const getLayoutThumbnail = async (req, res) => {
  try {
    const { layoutId } = req.params;
    let { token } = getUserContext(req);

    if (!token) {
        token = await getAccessToken();
    }

    if (!layoutId) {
      throw new HttpError(400, "Layout ID is required");
    }

    const xiboApiUrl = process.env.XIBO_API_URL;
    // Use the API URL directly, similar to libraryController
    const url = `${xiboApiUrl}/layout/thumbnail/${layoutId}`;

    console.log(`[getLayoutThumbnail] Fetching from: ${url}`);

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "*/*", 
      },
      responseType: "arraybuffer",
    });

    const contentType = response.headers["content-type"] || "image/png";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(Buffer.from(response.data, "binary"));
  } catch (err) {
    console.error("Error fetching layout thumbnail:", err.message);
    if (err.response && err.response.status === 404) {
        return res.status(404).send("Thumbnail not found");
    }
    handleControllerError(res, err, "Failed to fetch layout thumbnail");
  }
};



export const getLayoutPreview = async (req, res) => {
    try {
        const { layoutId } = req.params;
        let { token } = getUserContext(req);

        if (!token) {
            token = await getAccessToken();
        }

        // Try to export/download the layout
        // Based on user hint: "preview of a layout should be made that is via download"
        // We will try /layout/export/{layoutId} which is the standard Xibo export endpoint
        const xiboApiUrl = process.env.XIBO_API_URL;
        const url = `${xiboApiUrl}/layout/export/${layoutId}`;

        console.log(`[getLayoutPreview] Fetching from: ${url}`);

        const response = await axios.get(url, {
            headers: {
                Authorization: `Bearer ${token}`,
            },
            responseType: 'stream'
        });

        // Set appropriate headers for download
        res.setHeader(
            "Content-Type",
            response.headers["content-type"] || "application/octet-stream"
        );
        res.setHeader(
            "Content-Disposition",
            response.headers["content-disposition"] || `attachment; filename="layout-${layoutId}.zip"`
        );

        response.data.pipe(res);

    } catch (err) {
        console.error("Error fetching layout preview/download:", err.message);
        // Extract safe error information to avoid circular reference issues
        const safeError = {
            message: err.message,
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data
        };
        console.error("Error details:", safeError);
        
        // Send error response
        const statusCode = err.response?.status || 500;
        res.status(statusCode).json({
            success: false,
            message: "Failed to download layout preview",
            error: err.message
        });
    }
};
export const updateWidget = async (req, res) => {
  const { widgetId } = req.params;
  const widgetData = req.body;

  try {
    const { token } = getUserContext(req);

    // Xibo API expects PUT /playlist/widget/{widgetId}
    const result = await xiboRequest(
      `/playlist/widget/${widgetId}`,
      "PUT",
      widgetData,
      token
    );

    res.json(result);
  } catch (err) {
    handleControllerError(res, err, "Failed to update widget");
  }
};

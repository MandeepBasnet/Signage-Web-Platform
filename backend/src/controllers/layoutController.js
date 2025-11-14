import axios from "axios";
import { xiboRequest } from "../utils/xiboClient.js";
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
    const { token } = getUserContext(req);

    if (!layoutId) {
      throw new HttpError(400, "Layout ID is required");
    }

    const xiboApiUrl = process.env.XIBO_API_URL;
    const thumbnailPath = `/layout/thumbnail/${layoutId}`;
    const url = `${xiboApiUrl}${thumbnailPath}`;

    const response = await axios.get(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "image/*",
      },
      responseType: "arraybuffer",
    });

    res.setHeader(
      "Content-Type",
      response.headers["content-type"] || "image/png"
    );
    res.setHeader("Cache-Control", "private, max-age=60");
    res.send(Buffer.from(response.data, "binary"));
  } catch (err) {
    console.error("Error fetching layout thumbnail:", err.message);

    if (err.response) {
      const status = err.response.status || 500;
      const contentType = err.response.headers?.["content-type"];
      let message =
        err.response.statusText || "Failed to fetch layout thumbnail";

      if (
        contentType &&
        contentType.includes("application/json") &&
        err.response.data
      ) {
        try {
          const json =
            typeof err.response.data === "string"
              ? JSON.parse(err.response.data)
              : err.response.data;
          message =
            json?.message ||
            json?.error ||
            json?.errors?.join?.(", ") ||
            message;
        } catch {
          // ignore JSON parse errors
        }
      }

      return res.status(status).json({
        message,
        error: err.message,
      });
    }

    handleControllerError(res, err, "Failed to fetch layout thumbnail");
  }
};

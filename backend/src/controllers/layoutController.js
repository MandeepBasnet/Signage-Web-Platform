import { xiboRequest } from "../utils/xiboClient.js";

export const getLayouts = async (req, res) => {
  try {
    const token = req.user?.xiboToken;
    const userId = req.user?.id;
    const username = req.user?.username;

    if (!token) {
      return res
        .status(401)
        .json({ message: "User Xibo token not found. Please login again." });
    }

    if (!userId && !username) {
      return res
        .status(401)
        .json({
          message:
            "User ID or username not found in token. Please login again.",
        });
    }

    const normalizeLayouts = (response) => {
      if (!response) return { layouts: [], total: undefined };
      if (Array.isArray(response))
        return { layouts: response, total: response.length };

      const { data, recordsTotal, recordsFiltered } = response;
      const total = recordsFiltered ?? recordsTotal;

      if (Array.isArray(data)) return { layouts: data, total };
      if (data?.data && Array.isArray(data.data)) {
        return {
          layouts: data.data,
          total: data.recordsFiltered ?? data.recordsTotal ?? total,
        };
      }
      if (data) return { layouts: [data], total: total ?? 1 };

      return { layouts: [], total };
    };

    const pageSize = 100;
    const maxPages = 50;
    const collectedLayouts = [];
    let start = 0;
    let page = 0;
    let totalAvailable;

    while (page < maxPages) {
      const params = new URLSearchParams({
        start: String(start),
        length: String(pageSize),
        draw: String(page + 1),
        "order[0][column]": "modifiedDt",
        "order[0][dir]": "desc",
      });

      if (userId) {
        params.append("ownerId", userId);
        params.append("userId", userId);
      }

      const { layouts, total } = normalizeLayouts(
        await xiboRequest(`/layout?${params.toString()}`, "GET", null, token)
      );

      if (!layouts.length) break;

      collectedLayouts.push(...layouts);
      start += pageSize;
      page += 1;
      if (totalAvailable === undefined && total !== undefined)
        totalAvailable = total;
      if (total !== undefined && collectedLayouts.length >= total) break;
    }

    const dedupedLayouts = Array.from(
      collectedLayouts.reduce((acc, layout) => {
        const id = layout?.layoutId ?? layout?.layout_id;
        if (id !== undefined && !acc.has(id)) acc.set(id, layout);
        return acc;
      }, new Map())
    ).map(([, layout]) => layout);

    const lowerUsername = username?.toLowerCase();
    const userLayouts = dedupedLayouts.filter((layout) => {
      const ownerId = parseInt(layout.ownerId ?? layout.owner_id, 10);
      if (Number.isInteger(ownerId) && ownerId === userId) return true;

      if (layout.owner && lowerUsername) {
        const owner = layout.owner.toLowerCase().trim();
        return (
          owner === lowerUsername ||
          owner === lowerUsername.replace(/_/g, "-") ||
          owner === lowerUsername.replace(/-/g, "_")
        );
      }

      return false;
    });

    res.json({ data: userLayouts, total: userLayouts.length });
  } catch (err) {
    console.error("Get layouts error:", err.message);
    if (err.response) {
      return res
        .status(err.response.status || 500)
        .json({
          message: err.response.data?.message || "Failed to fetch layouts",
          error: err.message,
        });
    }
    res.status(500).json({ message: err.message });
  }
};

export const publishLayout = async (req, res) => {
  const { layoutId } = req.params;
  try {
    // Use the user's Xibo token from JWT
    const userXiboToken = req.user?.xiboToken;
    if (!userXiboToken) {
      return res.status(401).json({
        message: "User Xibo token not found. Please login again.",
      });
    }

    const result = await xiboRequest(
      `/layout/publish/${layoutId}`,
      "PUT",
      null,
      userXiboToken
    );
    res.json(result);
  } catch (err) {
    console.error("Publish layout error:", err.message);
    if (err.response) {
      return res.status(err.response.status || 500).json({
        message: err.response.data?.message || "Failed to publish layout",
        error: err.message,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

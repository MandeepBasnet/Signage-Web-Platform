import { xiboRequest } from "../utils/xiboClient.js";

export const getPlaylists = async (req, res) => {
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
      return res.status(401).json({
        message: "User ID or username not found in token. Please login again.",
      });
    }

    const normalizePlaylists = (response) => {
      if (!response) return { playlists: [], total: undefined };
      if (Array.isArray(response))
        return { playlists: response, total: response.length };

      const { data, recordsTotal, recordsFiltered } = response || {};
      const total = recordsFiltered ?? recordsTotal;

      if (Array.isArray(data)) return { playlists: data, total };
      if (data?.data && Array.isArray(data.data)) {
        return {
          playlists: data.data,
          total: data.recordsFiltered ?? data.recordsTotal ?? total,
        };
      }
      if (data) return { playlists: [data], total: total ?? 1 };

      return { playlists: [], total };
    };

    const pageSize = 100;
    const maxPages = 50;
    const collected = [];
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

      const { playlists, total } = normalizePlaylists(
        await xiboRequest(`/playlist?${params.toString()}`, "GET", null, token)
      );

      if (!playlists.length) break;

      collected.push(...playlists);
      start += pageSize;
      page += 1;
      if (totalAvailable === undefined && total !== undefined)
        totalAvailable = total;
      if (total !== undefined && collected.length >= total) break;
    }

    const deduped = Array.from(
      collected.reduce((acc, item) => {
        const id = item?.playlistId ?? item?.playlist_id;
        if (id !== undefined && !acc.has(id)) acc.set(id, item);
        return acc;
      }, new Map())
    ).map(([, item]) => item);

    const lowerUsername = username?.toLowerCase();
    const userPlaylists = deduped.filter((p) => {
      const ownerId = parseInt(p.ownerId ?? p.owner_id, 10);
      if (Number.isInteger(ownerId) && ownerId === userId) return true;

      if (p.owner && lowerUsername) {
        const owner = String(p.owner).toLowerCase().trim();
        return (
          owner === lowerUsername ||
          owner === lowerUsername.replace(/_/g, "-") ||
          owner === lowerUsername.replace(/-/g, "_")
        );
      }
      return false;
    });

    res.json({ data: userPlaylists, total: userPlaylists.length });
  } catch (err) {
    console.error("Get playlists error:", err.message);
    if (err.response) {
      return res.status(err.response.status || 500).json({
        message: err.response.data?.message || "Failed to fetch playlists",
        error: err.message,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

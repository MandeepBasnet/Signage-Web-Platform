import { xiboRequest } from "../utils/xiboClient.js";

export const getLibraryMedia = async (req, res) => {
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

    const normalizeMedia = (response) => {
      if (!response) return { media: [], total: undefined };
      if (Array.isArray(response))
        return { media: response, total: response.length };

      const { data, recordsTotal, recordsFiltered } = response || {};
      const total = recordsFiltered ?? recordsTotal;

      if (Array.isArray(data)) return { media: data, total };
      if (data?.data && Array.isArray(data.data)) {
        return {
          media: data.data,
          total: data.recordsFiltered ?? data.recordsTotal ?? total,
        };
      }
      if (data) return { media: [data], total: total ?? 1 };

      return { media: [], total };
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

      const { media, total } = normalizeMedia(
        await xiboRequest(`/library?${params.toString()}`, "GET", null, token)
      );

      if (!media.length) break;

      collected.push(...media);
      start += pageSize;
      page += 1;
      if (totalAvailable === undefined && total !== undefined)
        totalAvailable = total;
      if (total !== undefined && collected.length >= total) break;
    }

    const deduped = Array.from(
      collected.reduce((acc, item) => {
        const id = item?.mediaId ?? item?.media_id ?? item?.id;
        if (id !== undefined && !acc.has(id)) acc.set(id, item);
        return acc;
      }, new Map())
    ).map(([, item]) => item);

    const lowerUsername = username?.toLowerCase();
    const userMedia = deduped.filter((m) => {
      const ownerId = parseInt(m.ownerId ?? m.owner_id, 10);
      if (Number.isInteger(ownerId) && ownerId === userId) return true;

      if (m.owner && lowerUsername) {
        const owner = String(m.owner).toLowerCase().trim();
        return (
          owner === lowerUsername ||
          owner === lowerUsername.replace(/_/g, "-") ||
          owner === lowerUsername.replace(/-/g, "_")
        );
      }
      return false;
    });

    res.json({ data: userMedia, total: userMedia.length });
  } catch (err) {
    console.error("Get library media error:", err.message);
    if (err.response) {
      return res.status(err.response.status || 500).json({
        message: err.response.data?.message || "Failed to fetch library media",
        error: err.message,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

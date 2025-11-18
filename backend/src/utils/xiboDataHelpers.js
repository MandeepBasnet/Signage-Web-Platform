import { xiboRequest } from "./xiboClient.js";

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "HttpError";
  }
}

function normalizeListResponse(response) {
  if (!response) {
    return { items: [], total: undefined };
  }

  if (Array.isArray(response)) {
    return { items: response, total: response.length };
  }

  const { data, recordsTotal, recordsFiltered } = response || {};
  const total = recordsFiltered ?? recordsTotal;

  if (Array.isArray(data)) {
    return { items: data, total };
  }

  if (data?.data && Array.isArray(data.data)) {
    return {
      items: data.data,
      total: data.recordsFiltered ?? data.recordsTotal ?? total,
    };
  }

  if (data) {
    return { items: [data], total: total ?? 1 };
  }

  return { items: [], total };
}

function dedupeById(items, idKeys = []) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const seen = new Set();
  const deduped = [];

  items.forEach((item, index) => {
    const id =
      idKeys
        .map((key) => {
          if (typeof key === "function") return key(item);
          return item?.[key];
        })
        .find(
          (value) => value !== undefined && value !== null && value !== ""
        ) ?? `__idx_${index}`;

    const dedupeKey = String(id);
    if (!seen.has(dedupeKey)) {
      seen.add(dedupeKey);
      deduped.push(item);
    }
  });

  return deduped;
}

function filterOwnedByUser(items, userId, username) {
  if (!Array.isArray(items) || items.length === 0) {
    return [];
  }

  const normalizedUserId =
    userId !== undefined && userId !== null ? String(userId) : null;
  const normalizedUsername =
    typeof username === "string" && username.length > 0
      ? username.toLowerCase()
      : null;

  if (!normalizedUserId && !normalizedUsername) {
    return [];
  }

  return items.filter((item) => {
    const ownerCandidates = [
      item?.ownerId,
      item?.owner_id,
      item?.owner?.id,
      item?.owner,
    ]
      .filter((value) => value !== undefined && value !== null)
      .map((value) => String(value).toLowerCase());

    if (normalizedUserId) {
      const hasMatchingId = ownerCandidates.some(
        (value) => value === normalizedUserId.toLowerCase()
      );
      if (hasMatchingId) {
        return true;
      }
    }

    if (normalizedUsername && item?.owner) {
      const owner = String(item.owner).toLowerCase().trim();
      if (
        owner === normalizedUsername ||
        owner === normalizedUsername.replace(/_/g, "-") ||
        owner === normalizedUsername.replace(/-/g, "_")
      ) {
        return true;
      }
    }

    return false;
  });
}

function getUserContext(req) {
  const token = req.user?.xiboToken;
  const userId = req.user?.id ?? req.user?.userId;
  const username = req.user?.username ?? req.user?.userName;

  if (!token) {
    throw new HttpError(401, "User Xibo token not found. Please login again.");
  }

  if (userId === undefined && (username === undefined || username === null)) {
    throw new HttpError(
      401,
      "User ID or username not found in token. Please login again."
    );
  }

  return { token, userId, username };
}

async function fetchUserScopedCollection({
  req,
  endpoint,
  idKeys,
  orderColumn = "modifiedDt",
  orderDirection = "desc",
  pageSize = 100,
  maxPages = 50,
  queryParams = {},
}) {
  const { token, userId, username } = getUserContext(req);

  const collected = [];
  let start = 0;
  let totalAvailable;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      start: String(start),
      length: String(pageSize),
      draw: String(page + 1),
      "order[0][column]": orderColumn,
      "order[0][dir]": orderDirection,
    });

    if (userId !== undefined && userId !== null) {
      params.append("ownerId", String(userId));
      params.append("userId", String(userId));
    }

    Object.entries(queryParams || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      params.append(key, String(value));
    });

    const { items, total } = normalizeListResponse(
      await xiboRequest(`${endpoint}?${params.toString()}`, "GET", null, token)
    );

    if (!items.length) {
      break;
    }

    collected.push(...items);
    start += pageSize;

    if (totalAvailable === undefined && total !== undefined) {
      totalAvailable = total;
    }

    if (total !== undefined && collected.length >= total) {
      break;
    }
  }

  const deduped = dedupeById(collected, idKeys);
  return filterOwnedByUser(deduped, userId, username);
}

async function fetchLibraryCollection({
  req,
  endpoint,
  idKeys,
  orderColumn = "modifiedDt",
  orderDirection = "desc",
  pageSize = 100,
  maxPages = 50,
  queryParams = {},
}) {
  const { token } = getUserContext(req);

  const collected = [];
  let start = 0;
  let totalAvailable;

  for (let page = 0; page < maxPages; page += 1) {
    const params = new URLSearchParams({
      start: String(start),
      length: String(pageSize),
      draw: String(page + 1),
      "order[0][column]": orderColumn,
      "order[0][dir]": orderDirection,
    });

    Object.entries(queryParams || {}).forEach(([key, value]) => {
      if (value === undefined || value === null) {
        return;
      }
      params.append(key, String(value));
    });

    const { items, total } = normalizeListResponse(
      await xiboRequest(`${endpoint}?${params.toString()}`, "GET", null, token)
    );

    if (!items.length) {
      break;
    }

    collected.push(...items);
    start += pageSize;

    if (totalAvailable === undefined && total !== undefined) {
      totalAvailable = total;
    }

    if (total !== undefined && collected.length >= total) {
      break;
    }
  }

  return dedupeById(collected, idKeys);
}

function handleControllerError(res, err, fallbackMessage) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  console.error(fallbackMessage, err.message);

  if (err?.response) {
    const status = err.response.status || 500;
    return res.status(status).json({
      message: err.response.data?.message || fallbackMessage,
      error: err.message,
      details: err.response.data ?? undefined,
    });
  }

  return res.status(500).json({
    message: fallbackMessage,
    error: err.message,
  });
}

export {
  HttpError,
  dedupeById,
  fetchUserScopedCollection,
  fetchLibraryCollection,
  filterOwnedByUser,
  getUserContext,
  handleControllerError,
  normalizeListResponse,
};

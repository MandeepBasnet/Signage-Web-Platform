import { xiboRequest, getAccessToken } from "./xiboClient.js";

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

  // We allow token to be missing (it will fall back to App Token in xiboRequest)
  // But we still need user identity
  if (userId === undefined && (username === undefined || username === null)) {
    throw new HttpError(
      401,
      "User ID or username not found in token. Please login again."
    );
  }

  return { token, userId, username };
}

// Resolve a usable Xibo token for the request: the per-user token when present,
// otherwise fall back to the shared backend app token. Returns the same
// { token, userId, username } shape as getUserContext, but with a non-empty
// token guaranteed. Consolidates the getUserContext()+getAccessToken() fallback
// that was repeated across controllers.
async function getOrCreateToken(req) {
  const context = getUserContext(req);
  return {
    ...context,
    token: context.token || (await getAccessToken()),
  };
}

// Page through a Xibo DataTables-style collection, accumulating items across
// pages (bounded by maxPages). Shared core behind fetchUserScopedCollection and
// fetchLibraryCollection; the two differ only in whether results are owner-scoped.
async function fetchCollection({
  req,
  endpoint,
  idKeys,
  orderColumn = "modifiedDt",
  orderDirection = "desc",
  pageSize,
  maxPages,
  queryParams = {},
  // When true, inject ownerId/userId filter params and filter the merged result
  // to items the user owns. When false, return the deduped result as-is.
  scopeToOwner = false,
  // When set, warn (tagged with this label) if we stop on the page cap with the
  // reported total unreached, so a truncated list isn't mistaken for the full set.
  warnLabel,
}) {
  const { token, userId, username } = getUserContext(req);

  const collected = [];
  let start = 0;
  let totalAvailable;
  let lastPage = 0;

  for (let page = 0; page < maxPages; page += 1) {
    lastPage = page;
    const params = new URLSearchParams({
      start: String(start),
      length: String(pageSize),
      draw: String(page + 1),
      "order[0][column]": orderColumn,
      "order[0][dir]": orderDirection,
    });

    if (scopeToOwner && userId !== undefined && userId !== null) {
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

  if (
    warnLabel &&
    lastPage === maxPages - 1 &&
    totalAvailable !== undefined &&
    collected.length < totalAvailable
  ) {
    console.warn(
      `[${warnLabel}] Hit maxPages (${maxPages}) for ${endpoint}: ` +
        `collected ${collected.length} of ${totalAvailable} reported items. List may be truncated.`
    );
  }

  const deduped = dedupeById(collected, idKeys);
  return scopeToOwner ? filterOwnedByUser(deduped, userId, username) : deduped;
}

// Owner-scoped collection (layouts, playlists, displays): larger page size = far
// fewer serial round trips; lower cap so a misbehaving owner filter can't trigger
// dozens of serial calls.
async function fetchUserScopedCollection({
  pageSize = 500,
  maxPages = 10,
  ...options
}) {
  return fetchCollection({
    ...options,
    pageSize,
    maxPages,
    scopeToOwner: true,
    warnLabel: "fetchUserScopedCollection",
  });
}

// Library/folder collection: not owner-filtered (the caller scopes by folder),
// so use a smaller page size and a higher page cap.
async function fetchLibraryCollection({
  pageSize = 100,
  maxPages = 50,
  ...options
}) {
  return fetchCollection({ ...options, pageSize, maxPages, scopeToOwner: false });
}

function handleControllerError(res, err, fallbackMessage) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ message: err.message });
  }

  // Always log the full detail server-side for debugging.
  console.error(fallbackMessage, {
    message: err?.message,
    status: err?.response?.status,
    data: err?.response?.data,
  });

  const isProd = process.env.NODE_ENV === "production";
  const status = err?.response?.status || 500;
  const message = err?.response?.data?.message || fallbackMessage;

  // In production, return only a safe message — never the raw error string
  // (can contain internal hosts/IPs) or the upstream response body (schemas,
  // internal URLs). In development, include them to aid debugging.
  if (isProd) {
    return res.status(status).json({ message });
  }
  return res.status(status).json({
    message,
    error: err?.message,
    details: err?.response?.data ?? undefined,
  });
}

export {
  HttpError,
  dedupeById,
  fetchUserScopedCollection,
  fetchLibraryCollection,
  filterOwnedByUser,
  getUserContext,
  getOrCreateToken,
  handleControllerError,
  normalizeListResponse,
};

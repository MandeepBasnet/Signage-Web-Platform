// Mark a read-only list response as cacheable-but-always-revalidated.
//
// The browser stores the body and sends If-None-Match on the next request;
// Express answers with a 304 (no body) when its auto-generated ETag is
// unchanged, so large list payloads (media, layouts, playlists, displays) are
// not re-transferred on every tab revisit. Because the browser revalidates on
// every request, data is never served stale — a fresh upload/delete is
// reflected immediately (unlike `max-age`, which could mask it for the window).
//
// `private` keeps the response out of shared/proxy caches since list data is
// scoped to the authenticated user.
export const revalidateList = (req, res, next) => {
  res.set("Cache-Control", "private, no-cache");
  next();
};

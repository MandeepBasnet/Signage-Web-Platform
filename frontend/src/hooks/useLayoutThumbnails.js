import { useCallback, useEffect, useRef, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";
import { API_BASE_URL } from "../config/api.js";

// Loads layout thumbnails as object URLs, cached in a Map keyed by layout id.
// Each id is fetched at most once; ids already cached are skipped; and every
// blob URL we create is revoked on unmount. Pass an AbortSignal (via the second
// arg) for reactive callers that need to cancel in-flight fetches when their
// input changes.
export function useLayoutThumbnails() {
  const [thumbs, setThumbs] = useState(new Map());
  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;

  // Revoke any blob URLs we created on unmount.
  useEffect(() => {
    return () => {
      thumbsRef.current.forEach((url) => {
        if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const loadThumbnails = useCallback((ids, { signal } = {}) => {
    (async () => {
      for (const id of ids) {
        if (!id || thumbsRef.current.has(id)) continue;
        try {
          const res = await fetch(`${API_BASE_URL}/layouts/thumbnail/${id}`, {
            headers: { ...getAuthHeaders() },
            signal,
          });
          if (!res.ok || signal?.aborted) continue;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (signal?.aborted) {
            URL.revokeObjectURL(url);
            return;
          }
          setThumbs((prev) => {
            if (prev.has(id)) {
              URL.revokeObjectURL(url);
              return prev;
            }
            return new Map(prev).set(id, url);
          });
        } catch {
          /* aborted or failed — leave placeholder */
        }
      }
    })();
  }, []);

  return { thumbs, loadThumbnails };
}

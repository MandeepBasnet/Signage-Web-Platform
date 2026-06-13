"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

const PAGE_SIZE = 20;

export default function LayoutContent() {
  const navigate = useNavigate();
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [thumbs, setThumbs] = useState(new Map());
  const thumbsRef = useRef(thumbs);
  thumbsRef.current = thumbs;

  useEffect(() => {
    fetchLayouts();
    // Revoke any blob URLs we created on unmount.
    return () => {
      thumbsRef.current.forEach((url) => {
        if (url && url.startsWith("blob:")) URL.revokeObjectURL(url);
      });
    };
  }, []);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`${API_BASE_URL}/layouts`, {
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
      });
      if (!res.ok) throw new Error(`Failed to fetch layouts: ${res.status}`);
      const data = await res.json();
      const list = data?.data || [];
      // Newest first.
      list.sort((a, b) => (b.modifiedDt || "").localeCompare(a.modifiedDt || ""));
      setLayouts(list);
    } catch (err) {
      console.error("Error fetching layouts:", err);
      setError(err.message || "Failed to load layouts");
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return layouts;
    return layouts.filter((l) =>
      String(l.layout || l.name || "").toLowerCase().includes(q)
    );
  }, [layouts, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = useMemo(
    () => filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE),
    [filtered, safePage]
  );

  // Reset to first page whenever the search changes.
  useEffect(() => setPage(0), [search]);

  // Lazy-load thumbnails for the rows currently on screen.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      for (const layout of pageRows) {
        const id = layout.layoutId;
        if (!id || thumbsRef.current.has(id)) continue;
        try {
          const res = await fetch(`${API_BASE_URL}/layouts/thumbnail/${id}`, {
            headers: { ...getAuthHeaders() },
          });
          if (!res.ok || cancelled) continue;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (cancelled) {
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
          /* leave placeholder */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pageRows]);

  const formatDuration = (s) => {
    const n = Number(s) || 0;
    const h = Math.floor(n / 3600);
    const m = Math.floor((n % 3600) / 60);
    const sec = n % 60;
    const pad = (x) => String(x).padStart(2, "0");
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`;
  };

  const formatDate = (d) => {
    if (!d) return "—";
    try {
      return new Date(d).toLocaleString();
    } catch {
      return d;
    }
  };

  const open = (layout) => navigate(`/layout/designer/${layout.layoutId}`);

  const statusBadge = (l) => {
    const s = (l.publishedStatus || "").toLowerCase();
    const cls =
      s === "published"
        ? "bg-green-100 text-green-800"
        : s === "draft"
        ? "bg-yellow-100 text-yellow-800"
        : "bg-gray-100 text-gray-600";
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${cls}`}>
        {l.publishedStatus || "—"}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
        <p className="font-semibold">Error loading layouts</p>
        <p>{error}</p>
        <button
          onClick={fetchLayouts}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5 p-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Layouts</h2>
          <p className="text-sm text-gray-500 mt-1">
            {filtered.length} {filtered.length === 1 ? "layout" : "layouts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search layouts…"
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
          <button
            onClick={fetchLayouts}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="overflow-x-auto scrollbar-hide rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              {["Thumbnail", "ID", "Name", "Status", "Duration", "Dimensions", "Owner", "Modified"].map(
                (h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {pageRows.map((l) => {
              const thumb = thumbs.get(l.layoutId);
              return (
                <tr
                  key={l.layoutId}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => open(l)}
                >
                  <td className="px-4 py-2">
                    <div className="w-28 h-16 bg-gray-100 rounded overflow-hidden flex items-center justify-center border border-gray-200">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={l.layout}
                          className="w-full h-full object-contain bg-black"
                          loading="lazy"
                        />
                      ) : (
                        <span className="text-2xl text-gray-300">🖼️</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-2 text-gray-500">{l.layoutId}</td>
                  <td className="px-4 py-2 font-medium text-gray-900 whitespace-nowrap">
                    {l.layout || l.name}
                  </td>
                  <td className="px-4 py-2">{statusBadge(l)}</td>
                  <td className="px-4 py-2 text-gray-500">{formatDuration(l.duration)}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {l.width}×{l.height}
                  </td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{l.owner || "—"}</td>
                  <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                    {formatDate(l.modifiedDt)}
                  </td>
                </tr>
              );
            })}
            {pageRows.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                  No layouts found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pageCount > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-600">
          <span>
            Showing {safePage * PAGE_SIZE + 1}–
            {Math.min((safePage + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={safePage === 0}
              className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-2">
              {safePage + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={safePage >= pageCount - 1}
              className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

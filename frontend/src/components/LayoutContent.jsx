"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Image as ImageIcon } from "lucide-react";

import SearchBar from "./SearchBar.jsx";
import { useLayoutThumbnails } from "../hooks/useLayoutThumbnails.js";
import { useLayouts, PAGE_SIZE } from "../hooks/queries/useLayouts.js";

const EMPTY_LAYOUTS = [];

export default function LayoutContent() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);
  const { thumbs, loadThumbnails } = useLayoutThumbnails();

  // Cached, server-paginated layouts. Switching tabs and paging reuse the cache;
  // keepPreviousData keeps rows on screen while the next page/search loads.
  const { data, isLoading: loading, error, refetch } = useLayouts({
    page,
    search: debouncedSearch,
  });
  const layouts = data?.layouts ?? EMPTY_LAYOUTS;
  const total = data?.total ?? 0;

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Debounce the search box — searching is done server-side.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  // A new search starts back at the first page.
  useEffect(() => {
    setPage(0);
  }, [debouncedSearch]);

  // Lazy-load thumbnails for the rows currently on screen; cancel in-flight
  // fetches when the page changes.
  useEffect(() => {
    const controller = new AbortController();
    loadThumbnails(
      layouts.map((l) => l.layoutId),
      { signal: controller.signal }
    );
    return () => controller.abort();
  }, [layouts, loadThumbnails]);

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

  // Only take over the whole panel on the first load; paging/searching keeps the
  // existing rows visible until the next page arrives (no spinner flash).
  if (loading && layouts.length === 0) {
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
        <p>{error?.message || "Failed to load layouts"}</p>
        <button
          onClick={() => refetch()}
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
            {total} {total === 1 ? "layout" : "layouts"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search layouts…"
            className="px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 w-56"
          />
          <button
            onClick={() => refetch()}
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
            {layouts.map((l) => {
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
                        <ImageIcon className="w-6 h-6 text-gray-300" />
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
            {layouts.length === 0 && (
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
            Showing {page * PAGE_SIZE + 1}–
            {Math.min((page + 1) * PAGE_SIZE, total)} of {total}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-md bg-gray-100 hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-2">
              {page + 1} / {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={page >= pageCount - 1}
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

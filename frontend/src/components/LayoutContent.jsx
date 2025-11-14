"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function LayoutContent() {
  const [layouts, setLayouts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchLayouts();
  }, []);

  const fetchLayouts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/layouts`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || `Failed to fetch layouts: ${response.status}`
        );
      }

      const data = await response.json();
      setLayouts(data?.data || []);
    } catch (err) {
      console.error("Error fetching layouts:", err);
      setError(err.message || "Failed to load layouts");
    } finally {
      setLoading(false);
    }
  };

  const getLayoutId = (layout) => {
    return layout.layoutId || layout.layout_id || layout.id;
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <section className="flex flex-col gap-5 relative p-4">
        <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-gray-600">Loading layouts...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flex flex-col gap-5 relative p-4">
        <div className="rounded-lg border border-red-200 p-6 bg-red-50 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <div>
              <h3 className="font-semibold text-red-800 mb-1">Error</h3>
              <p className="text-red-700">{error}</p>
            </div>
          </div>
          <button
            onClick={fetchLayouts}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 relative p-4">
      <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Layouts</h2>
            <p className="text-sm text-gray-500 mt-1">
              {layouts.length} {layouts.length === 1 ? "layout" : "layouts"}{" "}
              found
            </p>
          </div>
          <button
            onClick={fetchLayouts}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>

        {layouts.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No layouts found</p>
            <p className="text-gray-400 text-sm mt-2">
              Your layouts will appear here once they are created.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {layouts.map((layout) => {
              const layoutId = getLayoutId(layout);
              const regions = layout.regions || [];
              const regionCount = regions.length;
              const widgets = regions.flatMap((r) => r.widgets || []);
              const widgetCount = widgets.length;

              return (
                <div
                  key={layoutId}
                  className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white flex flex-col"
                >
                  {/* Layout Visual Representation */}
                  <div
                    className="w-full bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center overflow-hidden"
                    style={{ minHeight: "200px", maxHeight: "300px" }}
                  >
                    <div className="flex flex-col items-center justify-center p-8 text-gray-600">
                      <span className="text-6xl mb-3">📄</span>
                      <div className="text-center">
                        <p className="font-semibold text-lg mb-1">
                          {layout.name || layout.layoutName || "Layout"}
                        </p>
                        {regionCount > 0 && (
                          <p className="text-sm text-gray-500">
                            {regionCount}{" "}
                            {regionCount === 1 ? "region" : "regions"}
                            {widgetCount > 0 &&
                              ` • ${widgetCount} ${
                                widgetCount === 1 ? "widget" : "widgets"
                              }`}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Layout Info */}
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-gray-900 text-base truncate flex-1">
                        {layout.name || layout.layoutName || "Unnamed Layout"}
                      </h3>
                    </div>
                    {layout.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {layout.description}
                      </p>
                    )}
                    <div className="flex flex-col gap-1 text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                      {layout.status && (
                        <span className="capitalize">
                          Status: {layout.status}
                        </span>
                      )}
                      {layout.width && layout.height && (
                        <span>
                          Size: {layout.width} × {layout.height}
                        </span>
                      )}
                      {layout.duration && (
                        <span>Duration: {layout.duration}s</span>
                      )}
                      {layout.modifiedDt && (
                        <span>Modified: {formatDate(layout.modifiedDt)}</span>
                      )}
                      {layout.createdDt && (
                        <span>Created: {formatDate(layout.createdDt)}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

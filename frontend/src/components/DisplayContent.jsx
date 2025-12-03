"use client";

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function DisplayContent() {
  const navigate = useNavigate();
  const [displays, setDisplays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [layoutThumbs, setLayoutThumbs] = useState(new Map());
  const [editingDisplay, setEditingDisplay] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [menuOpenId, setMenuOpenId] = useState(null);

  useEffect(() => {
    fetchDisplays();
  }, []);

  useEffect(() => {
    return () => {
      layoutThumbs.forEach((url) => {
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [layoutThumbs]);

  const fetchDisplays = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${API_BASE_URL}/displays`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || `Failed to fetch displays: ${response.status}`
        );
      }

      const data = await response.json();
      const fetchedDisplays = data?.data || [];
      setDisplays(fetchedDisplays);
      
      // Preload thumbnails for the layouts associated with displays
      const layoutsToLoad = fetchedDisplays
        .flatMap(d => [d.layout, ...(d.scheduledLayouts || [])])
        .filter(l => l !== null && l !== undefined);
      preloadThumbnails(layoutsToLoad);

    } catch (err) {
      console.error("Error fetching displays:", err);
      setError(err.message || "Failed to load displays");
    } finally {
      setLoading(false);
    }
  };

  const preloadThumbnails = async (layoutList) => {
    for (const layout of layoutList) {
      const layoutId = layout.layoutId || layout.layout_id || layout.id;
      if (!layoutId) continue;
      if (layoutThumbs.has(layoutId)) continue;

      try {
        const response = await fetch(
          `${API_BASE_URL}/layouts/thumbnail/${layoutId}`,
          {
            headers: {
              ...getAuthHeaders(),
            },
          }
        );

        if (!response.ok) continue;

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);

        setLayoutThumbs((prev) => {
          if (prev.has(layoutId)) {
            URL.revokeObjectURL(blobUrl);
            return prev;
          }
          const next = new Map(prev);
          next.set(layoutId, blobUrl);
          return next;
        });
      } catch (thumbErr) {
        console.warn(`Failed to load layout thumbnail ${layoutId}:`, thumbErr);
      }
    }
  };

  const getThumbnailUrl = (layoutId) => {
    if (!layoutId) return null;
    return layoutThumbs.get(layoutId);
  };

  const formatDate = (dateString) => {
    if (!dateString) return "Unknown";
    try {
      if (typeof dateString === 'number') {
          return new Date(dateString * 1000).toLocaleString();
      }
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const handleDelete = async (displayId) => {
    if (!window.confirm("Are you sure you want to delete this display?")) return;

    try {
      const response = await fetch(`${API_BASE_URL}/displays/${displayId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) throw new Error("Failed to delete display");

      setDisplays(displays.filter((d) => d.id !== displayId));
    } catch (err) {
      console.error("Error deleting display:", err);
      alert("Failed to delete display");
    }
  };

  const handleEdit = (display) => {
    setEditingDisplay(display);
    setShowEditModal(true);
    setMenuOpenId(null);
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const updates = {
        display: formData.get('name'),
        description: formData.get('description')
    };

    try {
        const response = await fetch(`${API_BASE_URL}/displays/${editingDisplay.id}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                ...getAuthHeaders()
            },
            body: JSON.stringify(updates)
        });

        if (!response.ok) throw new Error("Failed to update display");

        setShowEditModal(false);
        setEditingDisplay(null);
        fetchDisplays(); // Refresh list
    } catch (err) {
        console.error("Error updating display:", err);
        alert("Failed to update display");
    }
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
        <p className="font-semibold">Error loading displays</p>
        <p>{error}</p>
        <button
          onClick={fetchDisplays}
          className="mt-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-8 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Displays</h2>
          <p className="text-sm text-gray-500 mt-1">
            {displays.length} {displays.length === 1 ? "display" : "displays"} found
          </p>
        </div>
        <button
          onClick={fetchDisplays}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
        >
          Refresh
        </button>
      </div>

      {displays.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg border border-gray-200">
          <p className="text-gray-500 text-lg">No displays found</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {displays.map((display) => {
            const layout = display.layout;
            const layoutId = layout?.layoutId || layout?.layout_id || layout?.id;
            const layoutName = layout?.layout || layout?.name || display.layoutName || "Default Layout";
            const previewUrl = getThumbnailUrl(layoutId);
            
            return (
              <div key={display.id} className="flex flex-col gap-4">
                {/* Display Name Heading */}
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xl font-bold text-gray-800">
                    {display.name}
                  </h3>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${display.loggedIn ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="text-gray-600">{display.loggedIn ? 'Online' : 'Offline'}</span>
                    </div>
                    <div className="text-gray-500">
                      Last Checked: {formatDate(display.lastAccessed)}
                    </div>
                  </div>
                </div>

                {/* Scheduled Layouts Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full">
                  {display.scheduledLayouts && display.scheduledLayouts.length > 0 ? (
                    display.scheduledLayouts.map((layout) => {
                      const layoutId = layout.layoutId || layout.id;
                      const layoutName = layout.name || layout.campaign || "Unknown Layout";
                      const previewUrl = getThumbnailUrl(layoutId);
                      
                      return (
                        <div 
                            key={layout.id || Math.random()} 
                            className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white flex flex-col group cursor-pointer"
                            onClick={() => navigate(`/layout/designer/${layoutId}`)}
                        >
                          {/* Visual Representation */}
                          <div
                            className="w-full bg-gray-100 flex items-center justify-center overflow-hidden relative"
                            style={{ minHeight: "200px", maxHeight: "250px" }}
                          >
                            {previewUrl ? (
                              <img
                                src={previewUrl}
                                alt={`${layoutName} preview`}
                                className="w-full h-full object-contain bg-black"
                                loading="lazy"
                              />
                            ) : (
                              <div className="flex flex-col items-center justify-center p-8 text-gray-600 text-center">
                                <span className="text-5xl mb-3">📄</span>
                                <p className="font-semibold text-base mb-1">{layoutName}</p>
                              </div>
                            )}
                            
                            {/* Status Badge (if available or mocked) */}
                            <div className="absolute top-2 right-2">
                                <span className="px-2 py-1 text-xs font-semibold bg-green-100 text-green-800 rounded-full">
                                    Active
                                </span>
                            </div>
                            
                            {/* Hover Overlay for Edit Hint */}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-all">
                                    Open Designer
                                </span>
                            </div>
                          </div>

                          {/* Layout Info */}
                          <div className="p-4 flex-1 flex flex-col">
                            <div className="flex items-start justify-between mb-2">
                              <h4 className="font-semibold text-gray-900 text-base truncate flex-1">
                                {layoutName}
                              </h4>
                            </div>
                            <div className="flex flex-col gap-1 text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                               {layout.isAlways ? (
                                 <span>Duration: Always</span>
                               ) : (
                                 <span>
                                   {formatDate(layout.fromDt)} - {formatDate(layout.toDt)}
                                 </span>
                               )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                     <div className="col-span-full border border-gray-200 rounded-lg p-6 bg-gray-50 text-center text-gray-500">
                        No scheduled layouts found.
                     </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editingDisplay && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h3 className="text-xl font-semibold mb-4">Edit Display</h3>
                <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <input 
                            type="text" 
                            name="name" 
                            defaultValue={editingDisplay.name}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea 
                            name="description" 
                            defaultValue={editingDisplay.description}
                            className="w-full border border-gray-300 rounded-md px-3 py-2"
                        />
                    </div>
                    <div className="flex justify-end gap-2 mt-2">
                        <button 
                            type="button"
                            onClick={() => setShowEditModal(false)}
                            className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
                        >
                            Cancel
                        </button>
                        <button 
                            type="submit"
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                        >
                            Save Changes
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </section>
  );
}

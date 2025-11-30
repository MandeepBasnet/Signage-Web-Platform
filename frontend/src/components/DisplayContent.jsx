"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function DisplayContent() {
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
      preloadThumbnails(fetchedDisplays);
    } catch (err) {
      console.error("Error fetching displays:", err);
      setError(err.message || "Failed to load displays");
    } finally {
      setLoading(false);
    }
  };

  const preloadThumbnails = async (displayList) => {
    for (const display of displayList) {
      const layoutId = display.layoutId;
      if (!layoutId) continue;
      if (layoutThumbs.has(layoutId)) continue;

      try {
        const response = await fetch(
          `${API_BASE_URL}/layouts/${layoutId}/thumbnail`,
          {
            headers: {
              ...getAuthHeaders(),
            },
          }
        );

        if (!response.ok) {
          continue;
        }

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
      // Handle unix timestamp if necessary, but Xibo usually returns YYYY-MM-DD HH:mm:ss
      // If it's a number (timestamp), convert it
      if (typeof dateString === 'number') {
          return new Date(dateString * 1000).toLocaleString();
      }
      return new Date(dateString).toLocaleString();
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
              <p className="text-gray-600">Loading displays...</p>
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
            onClick={fetchDisplays}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </section>
    );
  }



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

  return (
    <section className="flex flex-col gap-5 relative p-4">
      <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Screens</h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage your digital displays and their settings
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchDisplays}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {displays.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No displays found</p>
            <p className="text-gray-400 text-sm mt-2">
              Connect a player to see it here.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displays.map((display) => {
              const previewUrl = getThumbnailUrl(display.layoutId);
              const isActive = display.loggedIn; 
              
              return (
                <div
                  key={display.id}
                  className="border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow bg-white flex flex-col"
                >
                  {/* Display Visual Representation (Layout Thumbnail) */}
                  <div className="relative w-full bg-black aspect-video flex items-center justify-center overflow-hidden group">
                     {/* Status Badge */}
                    <div className={`absolute top-3 right-3 px-2 py-1 rounded-full text-xs font-medium z-10 ${isActive ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}>
                        {isActive ? 'Active' : 'Inactive'}
                    </div>
                    {/* Red dot indicator */}
                    <div className="absolute top-3 left-3 w-3 h-3 rounded-full bg-red-500 z-10 border-2 border-white"></div>

                    {previewUrl ? (
                      <img
                        src={previewUrl}
                        alt={`${display.layoutName} preview`}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <span className="text-4xl mb-2">📺</span>
                        <span className="text-sm">No Preview</span>
                      </div>
                    )}
                    
                    {/* Overlay with Layout Name */}
                     <div className="absolute bottom-3 left-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-3 py-2 rounded-md flex items-center gap-2">
                        <span className="truncate flex-1">{display.layoutName || "Default Layout"}</span>
                     </div>
                  </div>

                  {/* Display Info */}
                  <div className="p-4 flex-1 flex flex-col gap-3 relative">
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-gray-900 text-lg truncate flex-1">
                        {display.name}
                      </h3>
                      <div className="relative">
                        <button 
                            className="text-gray-400 hover:text-gray-600 p-1"
                            onClick={() => setMenuOpenId(menuOpenId === display.id ? null : display.id)}
                        >
                            ⋮
                        </button>
                        {menuOpenId === display.id && (
                            <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-20 py-1">
                                <button 
                                    className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                    onClick={() => handleEdit(display)}
                                >
                                    Edit
                                </button>
                                <button 
                                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100"
                                    onClick={() => handleDelete(display.id)}
                                >
                                    Delete
                                </button>
                            </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <span className="text-blue-500">📄</span>
                        <span className="truncate">{display.layoutName || "No Layout Assigned"}</span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2 text-xs text-gray-500 mt-2">
                        <div className="flex flex-col">
                            <span className="text-gray-400">Connection</span>
                            <span className={display.loggedIn ? "text-green-600" : "text-red-500"}>
                                {display.loggedIn ? "Connected" : "Disconnected"}
                            </span>
                        </div>
                        <div className="flex flex-col text-right">
                             <span className="text-gray-400">Last Checked</span>
                             <span>{display.lastAccessed ? formatDate(display.lastAccessed) : "Never"}</span>
                        </div>
                         <div className="flex flex-col">
                            <span className="text-gray-400">Browser</span>
                            <span>{display.clientType || "Unknown"} {display.clientVersion || ""}</span>
                        </div>
                    </div>
                    
                    <div className="mt-auto pt-4 flex items-center justify-between border-t border-gray-100">
                        <span className="text-sm font-medium text-gray-700">Accept Ads</span>
                        <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                            <input type="checkbox" name="toggle" id={`toggle-${display.id}`} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer"/>
                            <label htmlFor={`toggle-${display.id}`} className="toggle-label block overflow-hidden h-5 rounded-full bg-gray-300 cursor-pointer"></label>
                        </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

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

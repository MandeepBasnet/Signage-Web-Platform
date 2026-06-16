"use client";

import { Fragment, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../utils/auth.js";

import { API_BASE_URL } from "../config/api.js";
import { useLayoutThumbnails } from "../hooks/useLayoutThumbnails.js";
import { useDisplays } from "../hooks/queries/useDisplays.js";

export default function DisplayContent() {
  const navigate = useNavigate();
  // Displays come from the React Query cache, so switching tabs and returning
  // reuses the data instead of re-fetching. `fetchDisplays` (refetch) is still
  // wired to the Retry/Refresh buttons for an explicit reload. Thumbnails are
  // preloaded lazily when a display row is expanded (see toggleExpand).
  const {
    data: displays = [],
    isLoading: loading,
    error,
    refetch: fetchDisplays,
  } = useDisplays();
  const { thumbs: layoutThumbs, loadThumbnails } = useLayoutThumbnails();
  const [expandedId, setExpandedId] = useState(null);

  // Checkout Layout State
  const [checkingOut, setCheckingOut] = useState(false);

  const getThumbnailUrl = (layoutId) => {
    if (!layoutId) return null;
    return layoutThumbs.get(layoutId);
  };

  const toggleExpand = (display) => {
    const id = display.id;
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    // Lazy-load this display's layout thumbnails the first time it's expanded
    const layoutsToLoad = [display.layout, ...(display.scheduledLayouts || [])].filter(
      (l) => l !== null && l !== undefined
    );
    loadThumbnails(
      layoutsToLoad.map((l) => l.layoutId || l.layout_id || l.id)
    );
  };

  // Xibo colors the Status by media inventory state (1=up-to-date, 2=downloading,
  // 3=out-of-date). loggedIn is shown separately.
  const getStatusStyle = (display) => {
    switch (Number(display.mediaInventoryStatus)) {
      case 1:
        return { label: "Up to date", className: "bg-green-100 text-green-800" };
      case 2:
        return { label: "Downloading", className: "bg-yellow-100 text-yellow-800" };
      case 3:
        return { label: "Out of date", className: "bg-red-100 text-red-800" };
      default:
        return { label: "Unknown", className: "bg-gray-100 text-gray-600" };
    }
  };

  const YesNo = ({ value }) =>
    value ? (
      <span className="text-green-600 font-semibold">✓</span>
    ) : (
      <span className="text-red-500 font-semibold">✗</span>
    );

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

  // Helper to handle layout clicks
  const handleLayoutClick = (layout) => {
    const layoutId = layout.layoutId || layout.layout_id || layout.id;
    navigate(`/layout/designer/${layoutId}`);
  };

  // eslint-disable-next-line no-unused-vars
  const handleAutoCheckout = async (publishedLayoutId) => {
    try {
      setCheckingOut(true);
      
      console.log(
        `[Auto-Checkout] START: Checking out published layout ${publishedLayoutId}...`
      );

      const checkoutUrl = `${API_BASE_URL}/layouts/checkout/${publishedLayoutId}`;
      console.log(`[Auto-Checkout] Request: PUT ${checkoutUrl}`);

      const response = await fetch(
        checkoutUrl,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            ...getAuthHeaders(),
          },
        }
      );

      console.log(`[Auto-Checkout] Response Status: ${response.status}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error(`[Auto-Checkout] Error Response Body:`, errorData);
        const errorMsg =
          errorData.message || errorData.error || `HTTP ${response.status}`;

        // Check for "already checked out" in error message or status code
        if (
          response.status === 422 ||
          errorMsg.toLowerCase().includes("already checked out")
        ) {
          console.log(
            "[Auto-Checkout] Layout already checked out (422), searching for existing draft..."
          );
          await findAndNavigateToDraft(publishedLayoutId);
          return;
        }

        throw new Error(errorMsg);
      }

      const data = await response.json();
      console.log(`[Auto-Checkout] Success Response Body:`, JSON.stringify(data, null, 2));

      let draftLayoutId = null;
      if (data.data?.layoutId) draftLayoutId = data.data.layoutId;
      else if (data.layoutId) draftLayoutId = data.layoutId;
      else if (data.layout?.layoutId) draftLayoutId = data.layout.layoutId;
      else if (data.id) draftLayoutId = data.id;

      if (!draftLayoutId) {
        throw new Error(
          "No draft layout ID returned from checkout. Response: " +
            JSON.stringify(data)
        );
      }

      console.log(
        `[Auto-Checkout] Successfully created draft layout ID: ${draftLayoutId} (Derived from response)`
      );

      // ✅ Redirect to draft layout URL
      console.log(`[Auto-Checkout] Navigating to: /layout/designer/${draftLayoutId}`);
      navigate(`/layout/designer/${draftLayoutId}`);
    } catch (err) {
      console.error("[Auto-Checkout] Error during auto-checkout:", err);
      
      if (
        err.message?.includes("ALREADY_CHECKED_OUT") ||
        err.message?.includes("already checked out") ||
        err.message?.includes("422")
      ) {
         await findAndNavigateToDraft(publishedLayoutId);
         return;
      }
      
      alert(`Failed to checkout layout: ${err.message}`);
    } finally {
      setCheckingOut(false);
    }
  };

  const findAndNavigateToDraft = async (parentId) => {
      try {
          console.log(`[Auto-Checkout] Searching for existing draft for parent ${parentId}...`);
          const url = `${API_BASE_URL}/layouts?parentId=${parentId}&publishedStatusId=2&embed=regions,playlists,widgets`;
          console.log(`[Auto-Checkout] Search URL: ${url}`);

          const draftsResponse = await fetch(
            url,
            {
              headers: getAuthHeaders(),
            }
          );
          
          console.log(`[Auto-Checkout] Search Status: ${draftsResponse.status}`);

          if (draftsResponse.ok) {
            const draftsData = await draftsResponse.json();
            console.log(`[Auto-Checkout] Search Result:`, JSON.stringify(draftsData, null, 2));

            const drafts = Array.isArray(draftsData.data)
              ? draftsData.data
              : [];

            const existingDraft = drafts.find(
              (d) => String(d.parentId) === String(parentId)
            );

            if (existingDraft) {
               const draftId = existingDraft.layoutId || existingDraft.layout_id || existingDraft.id;
               console.log(`[Auto-Checkout] Found existing draft (ID: ${draftId}), navigating...`);
               console.log(`[Auto-Checkout] Navigating to: /layout/designer/${draftId}`);
               navigate(`/layout/designer/${draftId}`);
               return;
            } else {
                console.warn("[Auto-Checkout] No draft found with parentId", parentId);
                alert("Could not find the draft for this layout. Please try manually.");
            }
          }
      } catch (searchErr) {
          console.error("[Auto-Checkout] Failed to find existing draft:", searchErr);
          alert("Failed to find existing draft.");
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
        <p>{error?.message || "Failed to load displays"}</p>
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
      {checkingOut && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
              <div className="bg-white p-6 rounded-lg shadow-xl flex flex-col items-center gap-4">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="text-gray-700 font-medium">Checking out layout...</p>
              </div>
          </div>
      )}

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
        <div className="overflow-x-auto scrollbar-hide rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-8 px-2 py-3"></th>
                {["ID", "Display", "Type", "Status", "Authorised", "Logged In",
                  "Last Accessed", "Version", "IP Address", "MAC Address"].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500 whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {displays.map((display) => {
                const isExpanded = expandedId === display.id;
                const statusStyle = getStatusStyle(display);
                const layouts = display.scheduledLayouts || [];

                return (
                  <Fragment key={display.id}>
                    <tr
                      className={`hover:bg-gray-50 cursor-pointer ${isExpanded ? "bg-blue-50/50" : ""}`}
                      onClick={() => toggleExpand(display)}
                    >
                      <td className="px-2 py-3 text-center text-gray-400">
                        <span className={`inline-block transition-transform ${isExpanded ? "rotate-90" : ""}`}>
                          ▶
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{display.displayId}</td>
                      <td className="px-4 py-3 font-medium text-gray-900 whitespace-nowrap">
                        {display.name}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {display.clientType || "—"}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap w-44">
                        <span className={`inline-block text-center min-w-[110px] px-3 py-1 rounded-full text-xs font-semibold ${statusStyle.className}`}>
                          {statusStyle.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center"><YesNo value={display.authorised} /></td>
                      <td className="px-4 py-3 text-center"><YesNo value={display.loggedIn} /></td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(display.lastAccessed)}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {display.clientVersion || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {display.clientAddress || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {display.macAddress || "—"}
                      </td>
                    </tr>

                    {isExpanded && (
                      <tr className="bg-gray-50/60">
                        <td colSpan={12} className="px-6 py-5">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">
                            Scheduled Layouts
                          </h4>
                          {layouts.length > 0 ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                              {layouts.map((layout) => {
                                const layoutId = layout.layoutId || layout.id;
                                const layoutName = layout.name || layout.campaign || "Unknown Layout";
                                const previewUrl = getThumbnailUrl(layoutId);

                                return (
                                  <div
                                    key={layout.id || layoutId}
                                    className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white flex flex-col group cursor-pointer"
                                    onClick={() => handleLayoutClick(layout)}
                                  >
                                    <div
                                      className="w-full bg-gray-100 flex items-center justify-center overflow-hidden relative"
                                      style={{ minHeight: "180px", maxHeight: "220px" }}
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
                                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 flex items-center justify-center transition-colors">
                                        <span className="opacity-0 group-hover:opacity-100 bg-white/90 text-gray-800 px-3 py-1 rounded-full text-sm font-medium shadow-sm transform translate-y-2 group-hover:translate-y-0 transition-all">
                                          Open Designer
                                        </span>
                                      </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col">
                                      <h5 className="font-semibold text-gray-900 text-base truncate mb-2">
                                        {layoutName}
                                      </h5>
                                      <div className="text-xs text-gray-500 mt-auto pt-3 border-t border-gray-100">
                                        {layout.isAlways ? (
                                          <span>Duration: Always</span>
                                        ) : (
                                          <span>{formatDate(layout.fromDt)} - {formatDate(layout.toDt)}</span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <div className="border border-gray-200 rounded-lg p-6 bg-white text-center text-gray-500">
                              No scheduled layouts found.
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

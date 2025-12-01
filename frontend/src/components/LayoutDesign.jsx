"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAuthHeaders, getStoredToken } from "../utils/auth.js";
import MediaPreviewModal from "./MediaPreviewModal";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function LayoutDesign() {
  const { layoutId } = useParams();
  const navigate = useNavigate();
  
  // State
  const [layout, setLayout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [scale, setScale] = useState(1);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [bgImageUrl, setBgImageUrl] = useState(null);
  
  // Preview Modal State
  const [previewModalOpen, setPreviewModalOpen] = useState(false);
  const [previewMedia, setPreviewMedia] = useState(null);

  // Playlist & Dataset Data State
  const [playlistData, setPlaylistData] = useState(new Map());
  const [datasetData, setDatasetData] = useState(new Map());
  const [loadingWidgetData, setLoadingWidgetData] = useState(new Set());

  // Delete Media State
  const [deleteHoveredMediaId, setDeleteHoveredMediaId] = useState(null);
  const [deletingMediaId, setDeletingMediaId] = useState(null);

  // Publish Layout State
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState(null);
  const [publishSuccess, setPublishSuccess] = useState(false);

  // Refs
  const containerRef = useRef(null);

  // Helper to extract option value from widgetOptions array
  const getOptionValue = (widget, optionName) => {
    if (!widget?.widgetOptions || !Array.isArray(widget.widgetOptions)) return null;
    const option = widget.widgetOptions.find(o => o.option === optionName);
    return option ? option.value : null;
  };

  // Helper to extract Playlist ID
  const getPlaylistId = (widget) => {
    // 1. Check for subPlaylists option (JSON string)
    const subPlaylistsStr = getOptionValue(widget, 'subPlaylists');
    if (subPlaylistsStr) {
      try {
        const subs = JSON.parse(subPlaylistsStr);
        if (Array.isArray(subs) && subs.length > 0 && subs[0].playlistId) {
          return subs[0].playlistId;
        }
      } catch (e) {
        console.warn('Failed to parse subPlaylists JSON', e);
      }
    }
    
    // 2. Fallback to direct playlistId if it's NOT the region's playlist ID (heuristic)
    if (widget.playlistId) return widget.playlistId;
    
    return null;
  };

  // Helper to extract Dataset ID
  const getDatasetId = (widget) => {
    return getOptionValue(widget, 'dataSetId');
  };

  // Helper to format file size
  const formatFileSize = (bytes) => {
    if (!bytes) return "Unknown size";
    const kb = bytes / 1024;
    const mb = kb / 1024;
    if (mb >= 1) return `${mb.toFixed(2)} MB`;
    return `${kb.toFixed(2)} KB`;
  };

  // Helper to extract text elements from Canvas/Global widgets
  const extractTextElements = (widget) => {
    const elementsOption = getOptionValue(widget, 'elements');
    if (!elementsOption) return [];
    
    try {
      const elementsData = JSON.parse(elementsOption);
      const textElements = [];
      
      // Navigate through the elements structure
      if (Array.isArray(elementsData)) {
        elementsData.forEach(page => {
          if (page.elements && Array.isArray(page.elements)) {
            page.elements.forEach(element => {
              // Check if this is a text element
              if (element.id === 'text' || element.type === 'text' || 
                  (element.properties && element.properties.some(p => p.id === 'text'))) {
                // Extract text value from properties
                const textProp = element.properties?.find(p => p.id === 'text');
                if (textProp && textProp.value) {
                  textElements.push({
                    text: textProp.value.trim(),
                    elementId: element.elementId,
                    elementName: element.elementName || 'Text Element',
                    fontSize: element.properties?.find(p => p.id === 'fontSize')?.value || '12',
                    fontColor: element.properties?.find(p => p.id === 'fontColor')?.value || '#000000',
                    position: { left: element.left, top: element.top, width: element.width, height: element.height }
                  });
                }
              }
            });
          }
        });
      }
      
      return textElements;
    } catch (e) {
      console.error('Failed to parse elements JSON:', e);
      return [];
    }
  };

  // Fetch Layout Details
  useEffect(() => {
    fetchLayoutDetails();
  }, [layoutId]);

  // Dynamic Scaling
  useEffect(() => {
    if (!layout || !containerSize.width || !containerSize.height) return;
    
    const padding = 60; 
    const availableWidth = containerSize.width - padding;
    const availableHeight = containerSize.height - padding;
    
    const scaleX = availableWidth / layout.width;
    const scaleY = availableHeight / layout.height;
    
    setScale(Math.min(scaleX, scaleY)); 
  }, [layout, containerSize]);

  // Fetch Background Image
  useEffect(() => {
    if (layout?.backgroundImageId) {
      fetchBackgroundImage(layout.backgroundImageId);
    }
  }, [layout]);

  // Auto-fetch Playlist and Dataset data when layout loads
  useEffect(() => {
    if (!layout?.regions) return;
    
    const playlistIds = new Set();
    const datasetIds = new Set();
    
    layout.regions.forEach(region => {
      region.widgets?.forEach(widget => {
        const moduleName = widget.moduleName?.toLowerCase();
        
        // Check for playlist types
        if (moduleName === 'playlist' || moduleName === 'subplaylist') {
          const plId = getPlaylistId(widget);
          if (plId) playlistIds.add(plId);
        } 
        // Check for dataset types
        else if (moduleName === 'dataset') {
          const dsId = getDatasetId(widget);
          if (dsId) datasetIds.add(dsId);
        }
      });
    });
    
    console.log(`Found ${playlistIds.size} playlists and ${datasetIds.size} datasets to fetch`);
    
    playlistIds.forEach(id => fetchPlaylistMedia(id));
    datasetIds.forEach(id => fetchDatasetData(id));
  }, [layout]);

  // Resize Observer for Container
  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const fetchLayoutDetails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/layouts/${layoutId}`, {
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        throw new Error("Failed to fetch layout details");
      }

      const data = await response.json();
      setLayout(data.layout);
    } catch (err) {
      console.error("Error fetching layout:", err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBackgroundImage = async (mediaId) => {
    try {
      const response = await fetch(`${API_BASE_URL}/library/${mediaId}/download`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        setBgImageUrl(url);
      }
    } catch (err) {
      console.error("Failed to fetch background image", err);
    }
  };

  const fetchPlaylistMedia = async (playlistId, forceRefresh = false) => {
    if (!playlistId || (!forceRefresh && playlistData.has(playlistId))) return;
    
    setLoadingWidgetData(prev => new Set(prev).add(`playlist-${playlistId}`));
    console.log(`Fetching playlist media for ID: ${playlistId}`);
    
    try {
      const response = await fetch(`${API_BASE_URL}/playlists/${playlistId}`, {
        headers: getAuthHeaders(),
      });
      
      if (!response.ok) throw new Error(`Failed to fetch playlist: ${response.statusText}`);
      
      const data = await response.json();
      
      setPlaylistData(prev => new Map(prev).set(String(playlistId), {
        playlist: data.playlist,
        media: data.media || []
      }));
      
      console.log(`Fetched ${data.media?.length || 0} media items for playlist ${playlistId}`);
    } catch (err) {
      console.error(`Failed to fetch playlist ${playlistId}:`, err);
    } finally {
      setLoadingWidgetData(prev => {
        const next = new Set(prev);
        next.delete(`playlist-${playlistId}`);
        return next;
      });
    }
  };

  const fetchDatasetData = async (dataSetId) => {
    if (!dataSetId || datasetData.has(dataSetId)) return;
    
    setLoadingWidgetData(prev => new Set(prev).add(`dataset-${dataSetId}`));
    console.log(`Fetching dataset data for ID: ${dataSetId}`);
    
    try {
      const [colResponse, dataResponse] = await Promise.all([
        fetch(`${API_BASE_URL}/datasets/${dataSetId}/column`, {
          headers: getAuthHeaders(),
        }),
        fetch(`${API_BASE_URL}/datasets/data/${dataSetId}`, {
          headers: getAuthHeaders(),
        })
      ]);
      
      if (!colResponse.ok || !dataResponse.ok) throw new Error('Failed to fetch dataset');
      
      const colData = await colResponse.json();
      const rowData = await dataResponse.json();
      
      setDatasetData(prev => new Map(prev).set(String(dataSetId), {
        columns: colData.data || [],
        rows: rowData.data || []
      }));
      
      console.log(`Fetched dataset ${dataSetId}: ${colData.data?.length || 0} columns, ${rowData.data?.length || 0} rows`);
    } catch (err) {
      console.error(`Failed to fetch dataset ${dataSetId}:`, err);
    } finally {
      setLoadingWidgetData(prev => {
        const next = new Set(prev);
        next.delete(`dataset-${dataSetId}`);
        return next;
      });
    }
  };

  const handleWidgetClick = (widget) => {
    console.log("Widget clicked:", widget);
    const moduleName = widget.moduleName?.toLowerCase();
    
    // Handle media widgets
    if (widget.mediaIds && widget.mediaIds.length > 0) {
        const mediaId = widget.mediaIds[0];
        const token = getStoredToken();
        const mediaUrl = `${API_BASE_URL}/library/${mediaId}/download?token=${token}`;
        
        setPreviewMedia({
            url: mediaUrl,
            type: widget.moduleName,
            name: widget.name || `Media ${mediaId}`
        });
        setPreviewModalOpen(true);
    }
    // Handle playlist widgets
    else if (moduleName === 'playlist' || moduleName === 'subplaylist') {
      const plId = getPlaylistId(widget);
      
      if (!plId) {
        alert(`Playlist widget has no playlist ID.\n\nDebug Info:\nModule: ${widget.moduleName}\nType: ${widget.type}\nOptions: ${JSON.stringify(widget.widgetOptions)}`);
        return;
      }
      
      const plData = playlistData.get(String(plId));
      
      if (!plData) {
        alert(`Loading playlist data for ID ${plId}...`);
        fetchPlaylistMedia(plId);
        return;
      }
      
      // Show playlist with media items
      const mediaList = plData.media.map((m, idx) => 
        `${idx + 1}. ${m.name || 'Unnamed'} (${m.mediaType || 'unknown'})`
      ).join('\n');
      
      alert(`Playlist: ${widget.name || plData.playlist.name}\nID: ${plId}\n\nMedia Items (${plData.media.length}):\n${mediaList || 'No media items'}\n\nNote: Thumbnails visible in sidebar`);
    }
    // Handle dataset widgets
    else if (moduleName === 'dataset') {
      const dsId = getDatasetId(widget);
      
      if (!dsId) {
        alert(`Dataset widget has no dataset ID.\n\nDebug Info:\nModule: ${widget.moduleName}\nType: ${widget.type}\nOptions: ${JSON.stringify(widget.widgetOptions)}`);
        return;
      }
      
      const dsData = datasetData.get(String(dsId));
      
      if (!dsData) {
        alert(`Loading dataset data for ID ${dsId}...`);
        fetchDatasetData(dsId);
        return;
      }
      
      const columnList = dsData.columns.map(col => col.heading).join(', ');
      const rowPreview = dsData.rows.slice(0, 3).map((row, idx) => {
        const rowData = dsData.columns.map(col => 
          row[col.heading] || row[`col_${col.dataSetColumnId}`] || '-'
        ).join(' | ');
        return `Row ${idx + 1}: ${rowData}`;
      }).join('\n');
      
      alert(`Dataset Widget: ${widget.name}\nID: ${dsId}\n\nColumns (${dsData.columns.length}): ${columnList}\n\nRows: ${dsData.rows.length}\n\nPreview:\n${rowPreview}${dsData.rows.length > 3 ? '\n...' : ''}`);
    }
    // Handle other widgets
    else {
        let details = `Type: ${widget.moduleName}\nName: ${widget.name}`;
        if (widget.widgetOptions) {
            details += `\nOptions (Count): ${widget.widgetOptions.length}`;
        }
        alert(details);
    }
  };

  const handleMediaPreview = (item) => {
    const mediaId = item.mediaIds?.[0] || item.mediaId || item.media_id || item.id;
    const token = localStorage.getItem("auth_token");
    const previewUrl = `${API_BASE_URL}/library/${mediaId}/download?preview=1&token=${token}`;
    
    setPreviewMedia({
      url: previewUrl,
      type: item.type || item.moduleName || item.mediaType,
      name: item.name || `Media ${mediaId}`
    });
    setPreviewModalOpen(true);
  };

  const handleDeletePlaylistMedia = async (playlistId, widgetId, mediaName) => {
    if (!confirm(`Are you sure you want to remove "${mediaName}" from the playlist?`)) {
      return;
    }

    try {
      setDeletingMediaId(widgetId);
      const response = await fetch(
        `${API_BASE_URL}/playlists/${playlistId}/media/${widgetId}`,
        {
          method: "DELETE",
          headers: {
            ...getAuthHeaders(),
          },
        }
      );

      if (response.status === 403) {
        alert("You don't have permission to modify this playlist.");
        return;
      }

      if (response.status === 404) {
        alert("Media or playlist not found. It may have already been deleted.");
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to delete media");
      }

      // Refresh playlist data
      await fetchPlaylistMedia(playlistId, true);
      
      // Reload the entire layout to ensure consistency
      await fetchLayoutDetails();
      
      console.log(`Successfully removed media from playlist ${playlistId}`);
      alert("Media deleted successfully and layout updated.");
    } catch (err) {
      console.error("Error deleting media from playlist:", err);
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert(`Failed to delete media: ${err.message}`);
      }
    } finally {
      setDeletingMediaId(null);
    }
  };

  const handlePublishLayout = async () => {
    if (!confirm("Are you sure you want to publish this layout? This will make it live.")) {
      return;
    }

    try {
      setPublishing(true);
      setPublishError(null);
      setPublishSuccess(false);

      const response = await fetch(
        `${API_BASE_URL}/layouts/publish/${layoutId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            publishNow: 1
          }),
        }
      );

      if (response.status === 403) {
        throw new Error("You don't have permission to publish this layout.");
      }

      if (response.status === 404) {
        throw new Error("Layout not found.");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Failed to publish layout");
      }

      const data = await response.json();
      setPublishSuccess(true);
      
      // Refresh layout data to show updated status
      await fetchLayoutDetails();
      
      // Show success message
      alert("Layout published successfully!");
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setPublishSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Error publishing layout:", err);
      setPublishError(err.message);
      
      if (err.message.includes("Failed to fetch") || err.message.includes("NetworkError")) {
        alert("Network error. Please check your connection and try again.");
      } else {
        alert(`Failed to publish layout: ${err.message}`);
      }
    } finally {
      setPublishing(false);
    }
  };

  const getRegionSummary = (widgets) => {
      if (!widgets || widgets.length === 0) return "Empty";
      
      const counts = widgets.reduce((acc, widget) => {
          const type = widget.moduleName;
          acc[type] = (acc[type] || 0) + 1;
          return acc;
      }, {});

      return Object.entries(counts)
          .map(([type, count]) => `${count} ${type.charAt(0).toUpperCase() + type.slice(1)}`)
          .join(", ");
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-900 text-white">
        <div className="flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-400 animate-pulse">Loading Layout Designer...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900 text-white">
        <div className="p-8 bg-gray-800 rounded-lg border border-red-500/30 shadow-xl max-w-md text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Failed to Load Layout</h2>
          <p className="text-gray-400 mb-6">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!layout) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium group"
          >
            <div className="p-1 rounded-md group-hover:bg-gray-800 transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
            </div>
            Back
          </button>
          <div className="h-6 w-px bg-gray-800 mx-2"></div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight flex items-center gap-2">
                {layout.layout}
                <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">v{layout.version || 1}</span>
            </h1>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                </svg>
                {layout.width}x{layout.height}
              </span>
              <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
              <span className="flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {layout.duration}s
              </span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
             <div className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-medium border border-indigo-500/20 flex items-center gap-2">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                </span>
                Designer Mode
            </div>
            
            {/* Publish Layout Button */}
            <button
              onClick={handlePublishLayout}
              disabled={publishing}
              className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
                publishSuccess
                  ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                  : publishing
                  ? 'bg-gray-700 text-gray-400 border border-gray-600 cursor-not-allowed'
                  : 'bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30'
              }`}
            >
              {publishing ? (
                <>
                  <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Publishing...
                </>
              ) : publishSuccess ? (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Published
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  Publish Layout
                </>
              )}
            </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Visual Layout Canvas */}
        <main 
            className="flex-1 bg-gray-950 relative overflow-hidden flex items-center justify-center p-8"
            ref={containerRef}
        >
            {/* Grid Background Pattern */}
            <div className="absolute inset-0 opacity-[0.03]" 
                style={{ 
                    backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', 
                    backgroundSize: '20px 20px' 
                }} 
            />

            {/* Canvas Wrapper for Centering and Scaling */}
            <div 
                style={{
                    width: layout.width,
                    height: layout.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1)'
                }}
                className="relative bg-black shadow-2xl ring-1 ring-gray-800 overflow-hidden"
            >
                {/* Background Image */}
                {bgImageUrl ? (
                    <div 
                        className="absolute inset-0 bg-cover bg-center z-0"
                        style={{ backgroundImage: `url(${bgImageUrl})` }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gray-900 z-0" style={{ backgroundColor: layout.backgroundColor }} />
                )}

                {/* Regions */}
                {layout.regions && layout.regions.map((region, idx) => (
                    <div
                        key={region.regionId}
                        className="absolute border border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400 transition-all duration-200 group z-10 overflow-hidden"
                        style={{
                            top: region.top,
                            left: region.left,
                            width: region.width,
                            height: region.height,
                            zIndex: region.zIndex + 10
                        }}
                    >
                        {/* Region Header/Label Overlay - Always visible but subtle, pops on hover */}
                        <div className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/80 to-transparent p-2 opacity-70 group-hover:opacity-100 transition-opacity z-20">
                            <div className="flex items-center justify-between">
                                <span className="text-[10px] font-bold text-blue-200 uppercase tracking-wider truncate">
                                    {region.name || `Region ${idx + 1}`}
                                </span>
                                <span className="text-[9px] text-gray-400 bg-black/50 px-1 rounded">
                                    {region.width}x{region.height}
                                </span>
                            </div>
                            {/* Widget Summary in Overlay */}
                            <div className="text-[10px] text-white font-medium mt-0.5 truncate">
                                {getRegionSummary(region.widgets)}
                            </div>
                        </div>
                        
                        {/* Widgets Visual Representation */}
                        <div className="w-full h-full p-8 overflow-hidden flex flex-col gap-1 content-start flex-wrap">
                            {region.widgets && region.widgets.length > 0 ? (
                                region.widgets.map((widget, wIdx) => (
                                    <div 
                                        key={widget.widgetId} 
                                        className="bg-black/60 backdrop-blur-sm text-white text-[10px] px-2 py-1 rounded border border-white/10 cursor-pointer hover:bg-blue-600/80 hover:border-blue-400 transition-all flex items-center gap-2 max-w-full shadow-sm"
                                        title={`${widget.moduleName} - ${widget.name}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleWidgetClick(widget);
                                        }}
                                    >
                                        <span className="text-blue-300 font-bold">{wIdx + 1}.</span>
                                        
                                        {/* Icon based on type */}
                                        {['image', 'localvideo', 'video'].includes(widget.moduleName?.toLowerCase()) ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-green-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                                            </svg>
                                        ) : widget.moduleName?.toLowerCase() === 'text' ? (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path fillRule="evenodd" d="M3 5a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zM3 15a1 1 0 011-1h6a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                                            </svg>
                                        ) : (
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-purple-400" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                                            </svg>
                                        )}
                                        
                                        <span className="truncate max-w-[100px]">{widget.name || widget.moduleName}</span>
                                    </div>
                                ))
                            ) : (
                                <div className="flex items-center justify-center h-full w-full opacity-20">
                                    <span className="text-[40px] font-thin text-white">+</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Zoom Info */}
            <div className="absolute bottom-6 right-6 bg-gray-900/90 backdrop-blur text-white text-xs px-3 py-1.5 rounded-full border border-gray-700 shadow-lg flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                </svg>
                {Math.round(scale * 100)}%
            </div>
        </main>

        {/* Right Panel: Layout Details Sidebar */}
        <aside className="w-96 bg-gray-900 border-l border-gray-800 overflow-y-auto flex flex-col shadow-xl z-10">
            <div className="p-5 border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
                <h2 className="font-semibold text-white text-lg">Layout Structure</h2>
                <p className="text-xs text-gray-400 mt-1">Regions & Widgets Configuration</p>
            </div>
            
            <div className="flex-1 p-4 space-y-8">
                {layout.regions && layout.regions.map((region, rIdx) => (
                    <div key={region.regionId} className="space-y-3">
                        {/* Region Header */}
                        <div className="flex items-center justify-between text-sm text-gray-200 font-medium border-b border-gray-800 pb-2">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center text-xs font-bold">
                                    {rIdx + 1}
                                </div>
                                <span>{region.name || `Region ${rIdx + 1}`}</span>
                            </div>
                            <span className="text-xs text-gray-500 font-mono bg-gray-800 px-1.5 py-0.5 rounded">{region.width}x{region.height}</span>
                        </div>
                        
                        {/* Widgets List */}
                        <div className="space-y-3 pl-2">
                            {region.widgets && region.widgets.length > 0 ? (
                                region.widgets.map((widget, wIdx) => {
                                    const moduleName = widget.moduleName?.toLowerCase();
                                    return (
                                    <div 
                                        key={widget.widgetId}
                                        className="bg-gray-800/40 hover:bg-gray-800 rounded-lg p-3 cursor-pointer transition-all border border-gray-700/50 hover:border-blue-500/30 group relative overflow-hidden"
                                        onClick={() => handleWidgetClick(widget)}
                                    >
                                        <div className="flex gap-3">
                                            {/* Left: Thumbnail or Icon */}
                                            <div className="shrink-0 w-16 h-16 bg-gray-900 rounded-md border border-gray-700 flex items-center justify-center overflow-hidden">
                                                {widget.mediaIds?.length > 0 ? (
                                                    <img 
                                                        src={`${API_BASE_URL}/library/${widget.mediaIds[0]}/thumbnail?width=100&height=100&token=${getStoredToken()}`}
                                                        alt={widget.name}
                                                        className="w-full h-full object-cover"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                            e.target.nextSibling.style.display = 'flex';
                                                        }}
                                                    />
                                                ) : null}
                                                
                                                {/* Fallback Icon (shown if no image or error) */}
                                                <div className={`w-full h-full flex items-center justify-center ${widget.mediaIds?.length > 0 ? 'hidden' : 'flex'}`}>
                                                    {moduleName === 'text' ? (
                                                        <span className="text-2xl">T</span>
                                                    ) : moduleName === 'dataset' ? (
                                                        <span className="text-2xl">📊</span>
                                                    ) : moduleName === 'playlist' || moduleName === 'subplaylist' ? (
                                                        <span className="text-2xl">📑</span>
                                                    ) : (
                                                        <span className="text-2xl">📄</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Right: Details */}
                                            <div className="flex-1 min-w-0 flex flex-col justify-center">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider ${
                                                        moduleName === 'text' ? 'bg-yellow-500/10 text-yellow-400' :
                                                        moduleName === 'dataset' ? 'bg-purple-500/10 text-purple-400' :
                                                        'bg-blue-500/10 text-blue-400'
                                                    }`}>
                                                        {widget.moduleName}
                                                    </span>
                                                    <span className="text-gray-500 text-xs ml-auto flex items-center gap-1">
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                                        </svg>
                                                        {widget.duration}s
                                                    </span>
                                                </div>
                                                
                                                <h4 className="text-sm font-medium text-gray-200 truncate" title={widget.name}>
                                                    {widget.name || "Untitled Widget"}
                                                </h4>
                                                
                                                {/* Extra Info based on type */}
                                                <div className="text-xs text-gray-500 mt-1">
                                                    {moduleName === 'text' ? (
                                                        <span className="truncate">{getOptionValue(widget, 'text')?.replace(/<[^>]*>/g, '') || "Text Content"}</span>
                                                    ) : moduleName === 'playlist' || moduleName === 'subplaylist' ? (() => {
                                                        const plId = getPlaylistId(widget);
                                                        const plData = playlistData.get(String(plId));
                                                        const isLoading = loadingWidgetData.has(`playlist-${plId}`);
                                                        
                                                        if (isLoading) return <span>Loading media...</span>;
                                                        if (!plData) return <span>Playlist ID: {plId}</span>;
                                                        
                                                        // Helper to robustly get media ID
                                                        const getMediaId = (item) => {
                                                            // Check mediaIds array first (primary field in API response)
                                                            if (item.mediaIds && Array.isArray(item.mediaIds) && item.mediaIds.length > 0) {
                                                                return item.mediaIds[0];
                                                            }
                                                            // Fallback to other possible field names
                                                            return (
                                                              item.mediaId ||
                                                              item.media_id ||
                                                              item.id ||
                                                              item.media?.mediaId ||
                                                              item.media?.media_id ||
                                                              item.media?.id
                                                            );
                                                        };

                                                        // Robust media type checkers from MediaContent.jsx
                                                        const isImage = (mediaType) => {
                                                            const type = (mediaType || '').toLowerCase();
                                                            return (
                                                              type.includes("image") ||
                                                              type.includes("jpg") ||
                                                              type.includes("jpeg") ||
                                                              type.includes("png") ||
                                                              type.includes("gif") ||
                                                              type.includes("webp") ||
                                                              type.includes("svg")
                                                            );
                                                        };

                                                        const isVideo = (mediaType) => {
                                                            const type = (mediaType || '').toLowerCase();
                                                            return (
                                                              type.includes("video") ||
                                                              type.includes("mp4") ||
                                                              type.includes("webm") ||
                                                              type.includes("ogg") ||
                                                              type.includes("mov") ||
                                                              type.includes("avi")
                                                            );
                                                        };

                                                        return (
                                                            <div className="mt-2 space-y-2">
                                                                <div className="text-xs font-semibold text-gray-400 border-b border-gray-700 pb-1">
                                                                    {plData.playlist.name || `Playlist ${plId}`} - {plData.media.length} items
                                                                </div>
                                                                {/* Increased max-height as requested */}
                                                                <div className="space-y-1 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                                                                    {plData.media.map((media, idx) => {
                                                                        const mediaId = getMediaId(media);
                                                                        const mediaType = media.mediaType || media.type || '';
                                                                        const hasThumbnail = isImage(mediaType) || isVideo(mediaType);
                                                                        
                                                                        return (
                                                                            <div 
                                                                                key={idx} 
                                                                                className="flex items-center gap-2 bg-gray-900/50 p-1.5 rounded border border-gray-800 hover:bg-gray-800 transition-colors group relative"
                                                                            >
                                                                                {/* Thumbnail - Clickable for preview */}
                                                                                <div 
                                                                                    className="w-8 h-8 bg-gray-800 rounded overflow-hidden shrink-0 border border-gray-700 flex items-center justify-center relative cursor-pointer"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleMediaPreview(media);
                                                                                    }}
                                                                                    title={`Click to preview: ${media.name}`}
                                                                                >
                                                                                    {hasThumbnail && mediaId ? (
                                                                                        <img 
                                                                                            src={`${API_BASE_URL}/library/${mediaId}/thumbnail?preview=1&width=50&height=50&token=${getStoredToken()}`}
                                                                                            className="w-full h-full object-cover absolute inset-0"
                                                                                            alt={media.name}
                                                                                            onError={(e) => {
                                                                                                // Hide image and show fallback
                                                                                                e.target.style.display = 'none';
                                                                                                if (e.target.nextSibling) e.target.nextSibling.style.display = 'flex';
                                                                                            }}
                                                                                        />
                                                                                    ) : null}
                                                                                    
                                                                                    {/* Fallback Icon */}
                                                                                    <div 
                                                                                        className={`w-full h-full flex items-center justify-center bg-gray-800 text-gray-500 ${hasThumbnail && mediaId ? 'hidden' : 'flex'}`}
                                                                                    >
                                                                                        {isVideo(mediaType) ? '🎬' : '📄'}
                                                                                    </div>
                                                                                </div>
                                                                                
                                                                                {/* Details - Clickable for preview */}
                                                                                <div 
                                                                                    className="min-w-0 flex-1 cursor-pointer"
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        handleMediaPreview(media);
                                                                                    }}
                                                                                    title={`Click to preview: ${media.name}`}
                                                                                >
                                                                                    <div className="text-[10px] text-gray-300 truncate font-medium" title={media.name}>{media.name}</div>
                                                                                    <div className="text-[9px] text-gray-500 flex justify-between">
                                                                                        <span>{formatFileSize(media.fileSize)}</span>
                                                                                        <span>{media.duration}s</span>
                                                                                    </div>
                                                                                </div>
                                                                                
                                                                                {/* Delete Button - Inline */}
                                                                                <button
                                                                                    onClick={(e) => {
                                                                                        e.stopPropagation();
                                                                                        const widgetId = media.widgetId || media.widget_id || media.id;
                                                                                        handleDeletePlaylistMedia(plId, widgetId, media.name);
                                                                                    }}
                                                                                    disabled={deletingMediaId === (media.widgetId || media.widget_id || media.id)}
                                                                                    className={`shrink-0 p-1 rounded transition-colors ${
                                                                                        deletingMediaId === (media.widgetId || media.widget_id || media.id)
                                                                                            ? 'text-gray-500 cursor-not-allowed'
                                                                                            : 'text-gray-500 hover:text-red-400 hover:bg-red-500/10'
                                                                                    }`}
                                                                                    title={`Delete ${media.name}`}
                                                                                >
                                                                                    {deletingMediaId === (media.widgetId || media.widget_id || media.id) ? (
                                                                                        <svg className="animate-spin h-3.5 w-3.5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                                                                        </svg>
                                                                                    ) : (
                                                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                                                        </svg>
                                                                                    )}
                                                                                </button>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        );
                                                    })() : moduleName === 'dataset' ? (() => {
                                                        const dsId = getDatasetId(widget);
                                                        const dsData = datasetData.get(String(dsId));
                                                        const isLoading = loadingWidgetData.has(`dataset-${dsId}`);
                                                        
                                                        if (isLoading) return <span>Loading dataset...</span>;
                                                        if (!dsData) return <span>Dataset ID: {dsId || 'N/A'}</span>;
                                                        
                                                        return (
                                                            <div className="mt-2 space-y-2">
                                                                <div className="text-xs font-semibold text-gray-400 border-b border-gray-700 pb-1">
                                                                    Dataset: {dsData.columns.length} columns × {dsData.rows.length} rows
                                                                </div>
                                                                {/* Dataset Table - Increased max-height for better visibility */}
                                                                <div className="max-h-96 overflow-auto pr-1 custom-scrollbar">
                                                                    <table className="w-full text-[10px] border-collapse">
                                                                        <thead className="sticky top-0 bg-gray-900 z-10">
                                                                            <tr>
                                                                                <th className="px-1.5 py-1 text-left font-semibold text-gray-300 border-b border-gray-700 bg-gray-800">#</th>
                                                                                {dsData.columns.map((col, idx) => (
                                                                                    <th 
                                                                                        key={idx} 
                                                                                        className="px-1.5 py-1 text-left font-semibold text-gray-300 border-b border-gray-700 bg-gray-800 truncate max-w-[100px]"
                                                                                        title={col.heading}
                                                                                    >
                                                                                        {col.heading}
                                                                                    </th>
                                                                                ))}
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody>
                                                                            {dsData.rows.map((row, rowIdx) => (
                                                                                <tr 
                                                                                    key={rowIdx} 
                                                                                    className="hover:bg-gray-800/50 transition-colors border-b border-gray-800/50"
                                                                                >
                                                                                    <td className="px-1.5 py-1.5 text-gray-500 font-mono">{rowIdx + 1}</td>
                                                                                    {dsData.columns.map((col, colIdx) => {
                                                                                        const cellValue = row[col.heading] || row[`col_${col.dataSetColumnId}`] || '-';
                                                                                        return (
                                                                                            <td 
                                                                                                key={colIdx} 
                                                                                                className="px-1.5 py-1.5 text-gray-300 truncate max-w-[100px]"
                                                                                                title={cellValue}
                                                                                            >
                                                                                                {cellValue}
                                                                                            </td>
                                                                                        );
                                                                                    })}
                                                                                </tr>
                                                                            ))}
                                                                        </tbody>
                                                                    </table>
                                                                    {dsData.rows.length === 0 && (
                                                                        <div className="text-center py-4 text-gray-500 text-xs italic">
                                                                            No data rows available
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })() : moduleName === 'canvas' || moduleName === 'global' ? (() => {
                                                        const textElements = extractTextElements(widget);
                                                        const elementsOption = getOptionValue(widget, 'elements');
                                                        let mediaElements = [];
                                                        
                                                        // Extract media elements from the elements JSON
                                                        if (elementsOption) {
                                                            try {
                                                                const elementsData = JSON.parse(elementsOption);
                                                                if (Array.isArray(elementsData)) {
                                                                    elementsData.forEach(page => {
                                                                        if (page.elements && Array.isArray(page.elements)) {
                                                                            page.elements.forEach(element => {
                                                                                // Check for image/media elements
                                                                                if (element.mediaId || element.id?.includes('image') || element.id?.includes('video')) {
                                                                                    mediaElements.push({
                                                                                        mediaId: element.mediaId,
                                                                                        elementId: element.elementId,
                                                                                        elementName: element.elementName || element.id || 'Media Element',
                                                                                        type: element.id?.includes('video') ? 'video' : 'image',
                                                                                        position: { left: element.left, top: element.top, width: element.width, height: element.height }
                                                                                    });
                                                                                }
                                                                            });
                                                                        }
                                                                    });
                                                                }
                                                            } catch (e) {
                                                                console.error('Failed to parse elements for media:', e);
                                                            }
                                                        }
                                                        
                                                        const totalElements = mediaElements.length + textElements.length;
                                                        
                                                        if (totalElements === 0) {
                                                            return <span>No elements found</span>;
                                                        }
                                                        
                                                        return (
                                                            <div className="mt-2 space-y-2">
                                                                <div className="text-xs font-semibold text-gray-400 border-b border-gray-700 pb-1">
                                                                    Canvas Elements: {totalElements}
                                                                </div>
                                                                <div className="space-y-2 max-h-96 overflow-y-auto pr-1 custom-scrollbar">
                                                                    {/* Media Elements */}
                                                                    {mediaElements.map((mediaEl, idx) => (
                                                                        <div 
                                                                            key={`media-${idx}`} 
                                                                            className="bg-gray-900/50 p-2 rounded border border-gray-800 hover:bg-gray-800 transition-colors cursor-pointer"
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                if (mediaEl.mediaId) {
                                                                                    handleMediaPreview({
                                                                                        mediaId: mediaEl.mediaId,
                                                                                        name: mediaEl.elementName,
                                                                                        type: mediaEl.type
                                                                                    });
                                                                                }
                                                                            }}
                                                                            title={mediaEl.mediaId ? `Click to preview: ${mediaEl.elementName}` : mediaEl.elementName}
                                                                        >
                                                                            <div className="flex items-center gap-2">
                                                                                {/* Media Thumbnail */}
                                                                                <div className="shrink-0 w-12 h-12 bg-gray-800 rounded overflow-hidden border border-gray-700 flex items-center justify-center">
                                                                                    {mediaEl.mediaId ? (
                                                                                        <img 
                                                                                            src={`${API_BASE_URL}/library/${mediaEl.mediaId}/thumbnail?width=100&height=100&token=${getStoredToken()}`}
                                                                                            alt={mediaEl.elementName}
                                                                                            className="w-full h-full object-cover"
                                                                                            onError={(e) => {
                                                                                                e.target.style.display = 'none';
                                                                                                e.target.nextSibling.style.display = 'flex';
                                                                                            }}
                                                                                        />
                                                                                    ) : null}
                                                                                    <div className={`w-full h-full flex items-center justify-center text-gray-500 ${mediaEl.mediaId ? 'hidden' : 'flex'}`}>
                                                                                        {mediaEl.type === 'video' ? '🎬' : '🖼️'}
                                                                                    </div>
                                                                                </div>
                                                                                {/* Media Details */}
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-center gap-2">
                                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-green-500/10 text-green-400">
                                                                                            {mediaEl.type}
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="text-[11px] text-gray-300 font-medium truncate mt-0.5">
                                                                                        {mediaEl.elementName}
                                                                                    </div>
                                                                                    {mediaEl.mediaId && (
                                                                                        <div className="text-[9px] text-gray-500 mt-0.5">
                                                                                            Media ID: {mediaEl.mediaId}
                                                                                        </div>
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                    
                                                                    {/* Text Elements */}
                                                                    {textElements.map((textEl, idx) => (
                                                                        <div 
                                                                            key={`text-${idx}`} 
                                                                            className="bg-gray-900/50 p-2 rounded border border-gray-800 hover:bg-gray-800 transition-colors"
                                                                        >
                                                                            <div className="flex items-start gap-2">
                                                                                {/* Text Icon */}
                                                                                <div className="shrink-0 w-12 h-12 bg-yellow-500/10 rounded flex items-center justify-center text-yellow-400 text-lg font-bold border border-gray-700">
                                                                                    T
                                                                                </div>
                                                                                {/* Text Content */}
                                                                                <div className="flex-1 min-w-0">
                                                                                    <div className="flex items-center gap-2 mb-1">
                                                                                        <span className="text-[10px] px-1.5 py-0.5 rounded uppercase font-bold tracking-wider bg-yellow-500/10 text-yellow-400">
                                                                                            TEXT
                                                                                        </span>
                                                                                    </div>
                                                                                    <div className="text-[11px] text-gray-300 font-medium break-words">
                                                                                        {textEl.text}
                                                                                    </div>
                                                                                    <div className="text-[9px] text-gray-500 mt-1 flex items-center gap-2 flex-wrap">
                                                                                        <span className="flex items-center gap-1">
                                                                                            <span className="w-3 h-3 rounded-sm border border-gray-600" style={{ backgroundColor: textEl.fontColor }}></span>
                                                                                            {textEl.fontColor}
                                                                                        </span>
                                                                                        <span>•</span>
                                                                                        <span>Size: {textEl.fontSize}px</span>
                                                                                    </div>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        );
                                                    })() : widget.mediaIds?.length > 0 ? (
                                                        <span className="truncate">Media ID: {widget.mediaIds[0]}</span>
                                                    ) : (
                                                        <span>No media attached</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )})
                            ) : (
                                <div className="text-xs text-gray-600 italic pl-1 py-2 border-l-2 border-gray-800 ml-1">
                                    No widgets in this region
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </aside>
      </div>
      
      {/* Media Preview Modal */}
      <MediaPreviewModal
        isOpen={previewModalOpen}
        onClose={() => setPreviewModalOpen(false)}
        mediaUrl={previewMedia?.url}
        mediaType={previewMedia?.type}
        mediaName={previewMedia?.name}
      />
    </div>
  );
}

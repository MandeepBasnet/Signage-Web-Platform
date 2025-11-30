"use client";

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../utils/auth.js";

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

  // Fetch Layout Details
  useEffect(() => {
    fetchLayoutDetails();
  }, [layoutId]);

  // Dynamic Scaling
  useEffect(() => {
    if (!layout || !containerSize.width) return;
    
    const padding = 40;
    const availableWidth = containerSize.width - padding;
    const availableHeight = containerSize.height - padding;
    
    const scaleX = availableWidth / layout.width;
    const scaleY = availableHeight / layout.height;
    
    // Use the smaller scale to ensure it fits entirely
    setScale(Math.min(scaleX, scaleY, 1)); 
  }, [layout, containerSize]);

  // Fetch Background Image
  useEffect(() => {
    if (layout?.backgroundImageId) {
      fetchBackgroundImage(layout.backgroundImageId);
    }
  }, [layout]);

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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">Error</h2>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => navigate(-1)}
          className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-md"
        >
          Go Back
        </button>
      </div>
    );
  }

  if (!layout) return null;

  return (
    <div className="h-screen flex flex-col bg-gray-900 text-white overflow-hidden">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 py-3 flex items-center justify-between shadow-md z-10 shrink-0">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => navigate(-1)}
            className="text-gray-400 hover:text-white transition-colors flex items-center gap-1 text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back
          </button>
          <div className="h-6 w-px bg-gray-700 mx-2"></div>
          <div>
            <h1 className="text-lg font-semibold text-white leading-tight">{layout.layout}</h1>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span>{layout.width}x{layout.height}</span>
              <span>•</span>
              <span>{layout.duration}s</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
             <div className="px-3 py-1 bg-blue-600/20 text-blue-400 rounded text-xs font-medium border border-blue-600/30">
                Designer Mode
            </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Main Canvas Area */}
        <main 
            className="flex-1 bg-gray-900 relative overflow-hidden flex items-center justify-center p-8"
            ref={(el) => {
                if (el && (el.clientWidth !== containerSize.width || el.clientHeight !== containerSize.height)) {
                    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
                }
            }}
        >
            {/* Canvas Wrapper for Centering and Scaling */}
            <div 
                style={{
                    width: layout.width,
                    height: layout.height,
                    transform: `scale(${scale})`,
                    transformOrigin: 'center center',
                    transition: 'transform 0.2s ease-out'
                }}
                className="relative bg-black shadow-2xl ring-1 ring-gray-700"
            >
                {/* Background Image */}
                {bgImageUrl ? (
                    <div 
                        className="absolute inset-0 bg-cover bg-center z-0"
                        style={{ backgroundImage: `url(${bgImageUrl})` }}
                    />
                ) : (
                    <div className="absolute inset-0 bg-gray-800 z-0" style={{ backgroundColor: layout.backgroundColor }} />
                )}

                {/* Regions */}
                {layout.regions && layout.regions.map(region => (
                    <div
                        key={region.regionId}
                        className="absolute border border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10 hover:border-blue-400 transition-colors group z-10"
                        style={{
                            top: region.top,
                            left: region.left,
                            width: region.width,
                            height: region.height,
                            zIndex: region.zIndex + 10 // Ensure regions are above background
                        }}
                    >
                        {/* Region Label */}
                        <div className="absolute top-0 left-0 bg-blue-600 text-white text-[10px] px-1.5 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                            {region.name || `Region ${region.regionId}`} ({region.width}x{region.height})
                        </div>
                        
                        {/* Widgets List inside Region */}
                        <div className="w-full h-full overflow-hidden p-1">
                            {region.widgets && region.widgets.length > 0 ? (
                                <div className="flex flex-col gap-0.5">
                                    {region.widgets.map((widget, idx) => (
                                        <div 
                                            key={widget.widgetId} 
                                            className="bg-black/60 backdrop-blur-sm text-white text-[10px] px-1 py-0.5 truncate rounded-sm border border-white/10"
                                            title={`${widget.moduleName} - ${widget.name}`}
                                        >
                                            <span className="text-blue-300 font-bold mr-1">{idx + 1}.</span>
                                            {widget.moduleName === 'image' || widget.moduleName === 'localvideo' ? (
                                                <div className="flex items-center gap-2">
                                                    {widget.mediaIds && widget.mediaIds.length > 0 && (
                                                        <img 
                                                            src={`${API_BASE_URL}/library/${widget.mediaIds[0]}/thumbnail?width=200&height=200`}
                                                            alt={widget.name}
                                                            className="w-4 h-4 object-cover rounded-sm"
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                            }}
                                                        />
                                                    )}
                                                    <span className="truncate">{widget.moduleName}</span>
                                                </div>
                                            ) : (
                                                <span>{widget.moduleName}</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="flex items-center justify-center h-full">
                                    <span className="text-white/20 text-[10px] uppercase tracking-wider font-medium">Empty</span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Zoom Info */}
            <div className="absolute bottom-4 right-4 bg-gray-800/80 backdrop-blur text-white text-xs px-2 py-1 rounded border border-gray-700">
                {Math.round(scale * 100)}%
            </div>
        </main>
      </div>
    </div>
  );
}

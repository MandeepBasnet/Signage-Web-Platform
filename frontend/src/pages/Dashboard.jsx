"use client";

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import PlaylistContent from "../components/PlaylistContent";
import MediaContent from "../components/MediaContent";
import { clearAuth } from "../utils/auth.js";

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState("library-playlist");
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div className="flex min-h-screen w-screen bg-gray-100 overflow-hidden md:flex-row flex-col">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar currentPage={currentPage} onLogout={handleLogout} />
        <div className="flex-1 overflow-y-auto p-5 bg-gray-100">
          {currentPage === "library-playlist" && <PlaylistContent />}
          {currentPage === "library-media" && <MediaContent />}
          {currentPage === "design-layout" && (
            <div className="flex items-center justify-center h-full text-2xl text-gray-400 bg-white rounded-lg">
              Design Layout Page
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

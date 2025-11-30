"use client";

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import PlaylistContent from "../components/PlaylistContent";
import MediaContent from "../components/MediaContent";
import DisplayContent from "../components/DisplayContent";
import LayoutContent from "../components/LayoutContent";
import DatasetContent from "../components/DatasetContent";
import ScheduleContent from "../components/ScheduleContent";
import { clearAuth } from "../utils/auth.js";

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState("display");
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login", { replace: true });
  }, [navigate]);

  const renderContent = () => {
    switch (currentPage) {
      case "playlist":
        return <PlaylistContent />;
      case "library":
        return <MediaContent />;
      // case "layout":
      //   return <LayoutContent />;
      case "dataset":
        return <DatasetContent />;
      case "display":
        return <DisplayContent />;
      case "schedule":
        return <ScheduleContent />;
      default:
        return <DisplayContent />;
    }
  };

  return (
    <div className="flex min-h-screen w-screen bg-gray-100 overflow-hidden md:flex-row flex-col">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar currentPage={currentPage} onLogout={handleLogout} />
        <div className="flex-1 overflow-y-auto p-5 bg-gray-100">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}

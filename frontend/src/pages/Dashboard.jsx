"use client";

import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Topbar from "../components/Topbar";
import LibraryContent from "../components/LibraryContent";
import "../styles/Dashboard.css";
import { clearAuth } from "../utils/auth.js";

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState("library-playlist");
  const navigate = useNavigate();

  const handleLogout = useCallback(() => {
    clearAuth();
    navigate("/login", { replace: true });
  }, [navigate]);

  return (
    <div className="dashboard-container">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="dashboard-main">
        <Topbar currentPage={currentPage} onLogout={handleLogout} />
        <div className="dashboard-content">
          {currentPage === "library-playlist" && <LibraryContent />}
          {currentPage === "library-media" && <LibraryContent />}
          {currentPage === "design-layout" && (
            <div className="page-placeholder">Design Layout Page</div>
          )}
        </div>
      </div>
    </div>
  );
}

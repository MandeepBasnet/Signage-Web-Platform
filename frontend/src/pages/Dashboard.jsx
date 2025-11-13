"use client";

import { useState } from "react";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";
import LibraryContent from "../components/LibraryContent";
import "../styles/Dashboard.css";

export default function Dashboard() {
  const [currentPage, setCurrentPage] = useState("library-media");

  return (
    <div className="dashboard-container">
      <Sidebar currentPage={currentPage} setCurrentPage={setCurrentPage} />
      <div className="dashboard-main">
        <TopBar currentPage={currentPage} />
        <div className="dashboard-content">
          {currentPage === "library-media" && <LibraryContent />}
          {currentPage === "design-layout" && (
            <div className="page-placeholder">Design Layout Page</div>
          )}
          {currentPage === "library-playlist" && (
            <div className="page-placeholder">Playlist Page</div>
          )}
        </div>
      </div>
    </div>
  );
}

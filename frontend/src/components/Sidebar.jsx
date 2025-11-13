"use client";

import "../styles/Sidebar.css";

const menuItems = [
  {
    section: "DESIGN",
    items: [{ id: "design-layout", label: "Layouts", icon: "📐" }],
  },
  {
    section: "LIBRARY",
    items: [
      { id: "library-playlist", label: "Playlists", icon: "🎵" },
      { id: "library-media", label: "Media", icon: "📹" },
    ],
  },
];

export default function Sidebar({ currentPage, setCurrentPage }) {
  return (
    <aside className="sidebar">
      {/* Logo */}
      <div className="sidebar-logo">
        <img src="/logo.png" alt="Logo" />
      </div>

      {/* Navigation */}
      <nav className="sidebar-nav">
        {menuItems.map((section) => (
          <div key={section.section} className="nav-section">
            <h3 className="nav-section-title">{section.section}</h3>
            <ul className="nav-items">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    className={`nav-item ${
                      currentPage === item.id ? "active" : ""
                    }`}
                    onClick={() => setCurrentPage(item.id)}
                  >
                    <span className="nav-icon">{item.icon}</span>
                    <span className="nav-label">{item.label}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* User Profile */}
      <div className="sidebar-user">
        <div className="user-avatar">M</div>
        <div className="user-info">
          <p className="user-name">mandeep_basnet</p>
          <p className="user-email">mandeep@gmail...</p>
        </div>
      </div>
    </aside>
  );
}

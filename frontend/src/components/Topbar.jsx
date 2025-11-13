/* eslint-disable no-unused-vars */
import "../styles/TopBar.css";

export default function TopBar({ currentPage }) {
  return (
    <div className="topbar">
      <h2 className="page-title">Dashboard</h2>

      <div className="topbar-logo">
        <img src="/logo.png" alt="sigma logo" />
      </div>

      <div className="topbar-user-profile">
        <div className="profile-avatar">M</div>
        <div className="profile-info">
          <p className="profile-name">mandeep_basnet</p>
          <p className="profile-time">15:21 +0545</p>
        </div>
      </div>
    </div>
  );
}

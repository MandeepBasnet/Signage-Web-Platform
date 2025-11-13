"use client";

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/Login.css";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Simulate validation
    if (!username) {
      setError("Username not found");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Please enter your password");
      setLoading(false);
      return;
    }

    // Simulate login delay
    setTimeout(() => {
      setLoading(false);
      // Navigate to dashboard
      try {
        localStorage.setItem("auth", "1");
      } catch (e) {
        void e;
      }
      navigate("/dashboard");
    }, 1500);
  };

  return (
    <div className="login-page">
      {/* Loading Overlay */}
      {loading && (
        <div className="login-loading-overlay">
          <div className="login-loading-message">
            <div className="spinner"></div>
            <p>Just a moment, logging you in...</p>
          </div>
        </div>
      )}

      <div className="login-card">
        {/* Left Section - Form */}
        <div className="login-form-section">
          <div className="login-content">
            <img src="/logo.png" alt="SigmaDS Logo" className="login-logo" />

            <div className="login-form-wrapper">
              <h1 className="login-title">Login to your Account</h1>
              <p className="login-subtitle">
                Please enter your details to login
              </p>

              <form onSubmit={handleLogin} className="login-form">
                {/* Username Field */}
                <div className="form-group">
                  <label htmlFor="username" className="form-label">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => {
                      setUsername(e.target.value);
                      if (error) setError("");
                    }}
                    className={`form-input ${error ? "input-error" : ""}`}
                  />
                  {error && <p className="error-message">{error}</p>}
                </div>

                {/* Password Field */}
                <div className="form-group">
                  <label htmlFor="password" className="form-label">
                    Password
                  </label>
                  <div className="password-input-wrapper">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="form-input"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="password-toggle"
                    >
                      {showPassword ? "👁️" : "👁️"}
                    </button>
                  </div>
                </div>

                {/* Checkbox and Link */}
                <div className="form-footer">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                    />
                    <span>Remember Me</span>
                  </label>
                  <a href="#" className="forgot-password-link">
                    Forgot Password?
                  </a>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  className="login-button"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Section - Promotional */}
        <div className="login-promo-section">
          <img
            src="/login_sideimg.png"
            alt="Promotional - Trust the Process"
            className="promo-image"
          />
        </div>
      </div>
    </div>
  );
}

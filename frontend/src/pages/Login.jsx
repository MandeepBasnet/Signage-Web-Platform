"use client";

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { clearAuth, saveAuth } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function Login() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);

  const loginBody = useMemo(
    () => ({
      username: username.trim(),
      password,
    }),
    [username, password]
  );

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");

    if (!loginBody.username) {
      setError("Please enter your username or email.");
      return;
    }

    if (!loginBody.password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      clearAuth();

      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(loginBody),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message =
          data?.message ||
          (response.status === 401
            ? "Invalid username or password."
            : "Unable to login. Please try again.");
        throw new Error(message);
      }

      if (!data?.token) {
        throw new Error("Login succeeded but no token was returned.");
      }

      saveAuth(data.token, data.user ?? null);

      if (!rememberMe) {
        window.addEventListener(
          "beforeunload",
          () => {
            clearAuth();
          },
          { once: true }
        );
      }

      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-stretch justify-center bg-white font-[Inter,system-ui,-apple-system,BlinkMacSystemFont,'Segoe_UI',sans-serif]">
      {/* Loading Overlay */}
      {loading && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]">
          <div className="flex flex-col items-center gap-4 bg-white p-10 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.2)]">
            <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-900 rounded-full animate-spin"></div>
            <p className="text-base text-[#1a1a1a] font-medium">
              Just a moment, logging you in...
            </p>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-screen w-full bg-white rounded-none overflow-hidden border-none shadow-none flex-col md:flex-row">
        {/* Left Section - Form */}
        <div className="flex-[0_0_42%] max-w-full md:max-w-[42%] flex items-center justify-center bg-white px-8 py-12 md:px-16 md:py-[72px] order-2 md:order-1">
          <div className="w-full max-w-[360px]">
            <img
              src="/logo.png"
              alt="SigmaDS Logo"
              className="h-10 md:h-12 mb-9 md:mb-12 object-contain"
            />

            <div className="mt-6">
              <h1 className="text-[22px] md:text-[26px] font-semibold text-[#171717] mb-3 leading-[1.3]">
                Login to your Account
              </h1>
              <p className="text-sm md:text-[15px] text-gray-500 mb-9 leading-[1.5]">
                Please enter your details to login
              </p>

              <form
                onSubmit={handleLogin}
                className="flex flex-col gap-4 md:gap-5"
              >
                {/* Username Field */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="username"
                    className="text-sm font-medium text-[#1a1a1a]"
                  >
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
                    className={`p-3 border rounded-md text-[15px] transition-all duration-200 bg-white focus:outline-none focus:border-blue-900 focus:bg-blue-50 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)] ${
                      error ? "border-red-600 bg-red-50" : "border-gray-300"
                    }`}
                  />
                  {error && (
                    <p className="text-[13px] text-red-600 -mt-0.5 flex items-center gap-1">
                      <span>⚠️</span>
                      {error}
                    </p>
                  )}
                </div>

                {/* Password Field */}
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-[#1a1a1a]"
                  >
                    Password
                  </label>
                  <div className="relative flex items-center">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="flex-1 p-3 pr-10 border border-gray-300 rounded-md text-[15px] transition-all duration-200 bg-white focus:outline-none focus:border-blue-900 focus:bg-blue-50 focus:shadow-[0_0_0_4px_rgba(59,130,246,0.1)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 bg-none border-none cursor-pointer text-lg text-gray-400 p-0 transition-colors duration-200 hover:text-gray-600"
                    >
                      {showPassword ? "👁️" : "👁️"}
                    </button>
                  </div>
                </div>

                {/* Checkbox and Link */}
                <div className="flex justify-between items-center mt-2.5 flex-wrap gap-3">
                  <label className="flex items-center gap-2 text-sm cursor-pointer text-[#1a1a1a]">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="cursor-pointer w-4 h-4 accent-blue-900"
                    />
                    <span>Remember Me</span>
                  </label>
                  <a
                    href="#"
                    className="text-sm text-blue-900 underline cursor-pointer transition-colors duration-200 hover:text-blue-800"
                  >
                    Forgot Password?
                  </a>
                </div>

                {/* Login Button */}
                <button
                  type="submit"
                  className="p-3 bg-gradient-to-br from-blue-700 to-blue-900 text-white border-none rounded-md text-sm font-semibold cursor-pointer transition-all duration-200 mt-5 md:mt-6 shadow-[0_12px_24px_rgba(30,58,138,0.25)] hover:bg-gradient-to-br hover:from-blue-600 hover:to-blue-800 hover:shadow-[0_16px_32px_rgba(30,58,138,0.35)] active:translate-y-px disabled:opacity-65 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
                  disabled={loading}
                >
                  {loading ? "Logging in..." : "Login"}
                </button>
              </form>
            </div>
          </div>
        </div>

        {/* Right Section - Promotional */}
        <div className="flex-1 bg-white flex items-center justify-center relative overflow-hidden p-6 md:p-12 h-[300px] md:h-auto order-1 md:order-2">
          <img
            src="/login_sideimg.png"
            alt="Promotional - Trust the Process"
            className="w-full h-full object-cover object-center"
          />
        </div>
      </div>
    </div>
  );
}

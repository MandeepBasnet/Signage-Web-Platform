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
                    className={`p-3 border rounded-md text-[15px] text-gray-900 transition-all duration-200 bg-white focus:outline-none focus:border-gray-500 focus:bg-gray-50 focus:shadow-[0_0_0_4px_rgba(107,114,128,0.1)] ${
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
                      className="flex-1 p-3 pr-10 border border-gray-300 rounded-md text-[15px] text-gray-900 transition-all duration-200 bg-white focus:outline-none focus:border-gray-500 focus:bg-gray-50 focus:shadow-[0_0_0_4px_rgba(107,114,128,0.1)]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 bg-none border-none cursor-pointer text-lg text-gray-400 p-0 transition-colors duration-200 hover:text-gray-600"
                    >
                      {showPassword ? (
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                        </svg>
                      ) : (
                        <svg
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          className="w-5 h-5"
                        >
                          <path d="M12 7c2.76 0 5 2.24 5 5 0 .65-.13 1.26-.36 1.83l2.92 2.92c1.51-1.26 2.7-2.89 3.45-4.75-1.73-4.39-6-7.5-11-7.5-1.4 0-2.74.25-3.98.7l2.16 2.16C10.74 7.13 11.35 7 12 7zM2 4.27l2.28 2.28.46.46A11.804 11.804 0 001 12c1.73 4.39 6 7.5 11 7.5 1.55 0 3.03-.3 4.38-.84l.42.42L19.73 22 21 20.73 3.27 3 2 4.27zM7.53 9.8l1.55 1.55c-.05.21-.08.43-.08.65 0 1.66 1.34 3 3 3 .22 0 .44-.03.65-.08l1.55 1.55c-.67.33-1.41.53-2.2.53-2.76 0-5-2.24-5-5 0-.79.2-1.53.53-2.2zm4.31-.78l3.15 3.15.02-.16c0-1.66-1.34-3-3-3l-.17.01z" />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>

                  {/* Checkbox */}
                  <div className="flex items-center mt-2.5">
                    <label className="flex items-center gap-2 text-sm cursor-pointer text-[#1a1a1a]">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="cursor-pointer w-4 h-4 accent-blue-900"
                      />
                      <span>Remember Me</span>
                    </label>
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
        <div className="flex-1 bg-white flex flex-col items-center justify-center relative overflow-hidden p-6 md:p-12 h-[300px] md:h-auto order-1 md:order-2">
          {/* Content above the background image */}
          <div className="flex flex-col items-center justify-center gap-6 z-10 relative">
            {/* Logo */}
            <img
              className="logo-img w-32 md:w-40 h-auto"
              src="/logo.png"
              alt="SigmaDS Logo"
            />

            {/* Screens/Cover Image */}
            <img
              className="screens w-full max-w-md md:max-w-lg h-auto"
              src="/coverImage.png"
              alt="Screens"
            />

            {/* Trust Text */}
            <p className="text-sm md:text-base text-gray-600 font-medium">
              Trusted by 1000+ customers globally
            </p>

            {/* Partner Container */}
            <div className="partner-container w-full max-w-2xl mt-4">
              {/* First Partner Row */}
              <div className="partner-row flex items-center justify-center gap-4 md:gap-6 flex-wrap mb-4">
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/amazon.svg"
                  alt="Amazon"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/deca.svg"
                  alt="Deca"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/bosch.svg"
                  alt="Bosch"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/uni.svg"
                  alt="Uni"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/para.svg"
                  alt="Para"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
              </div>

              {/* Second Partner Row */}
              <div className="partner-row flex items-center justify-center gap-4 md:gap-6 flex-wrap">
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/etisalat.svg"
                  alt="Etisalat"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/uber.svg"
                  alt="Uber"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/benz.svg"
                  alt="Benz"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/tt.svg"
                  alt="TT"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
                <img
                  src="https://d2qf6k8jfqd09k.cloudfront.net/login/ap.svg"
                  alt="AP"
                  className="h-8 md:h-10 w-auto opacity-70 hover:opacity-100 transition-opacity"
                  style={{ transform: "scale(1)" }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

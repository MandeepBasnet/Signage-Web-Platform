import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient.js";
import { isTokenValid } from "./utils/auth.js";
import ToastProvider from "./components/ui/ToastProvider.jsx";
import ConfirmProvider from "./components/ui/ConfirmProvider.jsx";
import "./App.css";

// Route-level code splitting: each page loads on demand, so the heavy
// LayoutDesign editor isn't in the initial bundle.
const Login = lazy(() => import("./pages/Login.jsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.jsx"));
const LayoutDesign = lazy(() => import("./components/LayoutDesign.jsx"));

function RequireAuth({ children }) {
  const authed = isTokenValid();
  return authed ? children : <Navigate to="/login" replace />;
}

function PageLoader() {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-white">
      <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      {/* Both providers sit OUTSIDE BrowserRouter deliberately: their state must
          survive a route change, so a toast raised just before navigate() — the
          publish flow does exactly this — is still on screen after the move. */}
      <ToastProvider>
        <ConfirmProvider>
          <BrowserRouter>
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/" element={<Navigate to="/login" replace />} />
                <Route path="/login" element={<Login />} />
                <Route
                  path="/dashboard"
                  element={
                    <RequireAuth>
                      <Dashboard />
                    </RequireAuth>
                  }
                />
                <Route
                  path="/layout/designer/:layoutId"
                  element={
                    <RequireAuth>
                      <LayoutDesign />
                    </RequireAuth>
                  }
                />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}

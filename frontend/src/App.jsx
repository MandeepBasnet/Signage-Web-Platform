import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { isTokenValid } from "./utils/auth.js";
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
  );
}

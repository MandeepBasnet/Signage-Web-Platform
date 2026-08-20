import { createContext } from "react";

// Split from ToastProvider.jsx so the provider file only exports a component —
// keeps react-refresh happy and lets non-component modules import the context.
export const ToastContext = createContext(null);

import { useContext } from "react";
import { ToastContext } from "../lib/toastContext.js";

// Returns { success, error, info }. Each takes (title, body?) — the title is the
// outcome in a few words, the optional body is the detail or the fix.
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

import { useContext } from "react";
import { ConfirmContext } from "../lib/confirmContext.js";

// Returns confirmDialog(options) -> Promise<boolean>, a drop-in replacement for
// the native window.confirm dialog that resolves instead of blocking:
//
//   if (!(await confirmDialog({ title, body, destructive: true }))) return;
//
// Options: { title, body?, confirmLabel?, cancelLabel?, destructive? }
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error("useConfirm must be used inside <ConfirmProvider>");
  }
  return ctx;
}

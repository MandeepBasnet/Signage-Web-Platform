import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, HelpCircle } from "lucide-react";
import { ConfirmContext } from "../../lib/confirmContext.js";
import { useFocusTrap } from "../../hooks/useFocusTrap.js";

const CLOSED = { open: false, options: null };

export default function ConfirmProvider({ children }) {
  const [state, setState] = useState(CLOSED);
  const resolverRef = useRef(null);
  const panelRef = useRef(null);
  const initialFocusRef = useRef(null);

  const settle = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setState(CLOSED);
    resolve?.(result);
  }, []);

  const confirmDialog = useCallback(
    (options) =>
      new Promise((resolve) => {
        // Two dialogs at once shouldn't be reachable, but if it happens the
        // caller waiting on the older promise must not be left hanging.
        resolverRef.current?.(false);
        resolverRef.current = resolve;
        setState({ open: true, options: options || {} });
      }),
    []
  );

  const cancel = useCallback(() => settle(false), [settle]);
  useFocusTrap(state.open, panelRef, cancel);

  // Focus lands on Cancel for destructive actions so a stray Enter can't delete
  // anything; on Confirm otherwise, where the dialog is just a checkpoint.
  useEffect(() => {
    if (state.open) initialFocusRef.current?.focus();
  }, [state.open]);

  const api = useMemo(() => confirmDialog, [confirmDialog]);

  const {
    title = "Are you sure?",
    body,
    confirmLabel = "Confirm",
    cancelLabel = "Cancel",
    destructive = false,
  } = state.options || {};

  const Icon = destructive ? AlertTriangle : HelpCircle;

  return (
    <ConfirmContext.Provider value={api}>
      {children}
      {state.open &&
        createPortal(
          <div
            className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4"
            onMouseDown={(e) => {
              // Only a press that starts on the backdrop dismisses — a drag that
              // ends there (selecting the body text) must not.
              if (e.target === e.currentTarget) cancel();
            }}
          >
            <div
              ref={panelRef}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby="confirm-title"
              aria-describedby={body ? "confirm-body" : undefined}
              className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-2xl motion-safe:animate-[dialog-in_150ms_ease-out]"
            >
              <div className="flex items-start gap-4">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                    destructive ? "bg-red-100" : "bg-blue-100"
                  }`}
                >
                  <Icon
                    className={`h-5 w-5 ${destructive ? "text-red-600" : "text-blue-600"}`}
                    aria-hidden="true"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <h2
                    id="confirm-title"
                    className="text-lg font-semibold text-gray-900"
                  >
                    {title}
                  </h2>
                  {body && (
                    <p
                      id="confirm-body"
                      className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-gray-600"
                    >
                      {body}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  ref={destructive ? initialFocusRef : null}
                  onClick={cancel}
                  className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                >
                  {cancelLabel}
                </button>
                <button
                  type="button"
                  ref={destructive ? null : initialFocusRef}
                  onClick={() => settle(true)}
                  className={`rounded-lg border-0 px-4 py-2 text-sm font-medium text-white transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
                    destructive
                      ? "bg-red-600 hover:bg-red-700 focus-visible:ring-red-500"
                      : "bg-blue-600 hover:bg-blue-700 focus-visible:ring-blue-500"
                  }`}
                >
                  {confirmLabel}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmContext.Provider>
  );
}

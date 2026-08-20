import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";
import { ToastContext } from "../../lib/toastContext.js";

// Errors get longer on screen than confirmations: a success message only has to
// be noticed, an error has to be read and acted on.
const DURATION = { success: 4000, info: 5000, error: 8000 };

// Older toasts drop off the top rather than growing an unbounded column.
const MAX_VISIBLE = 4;

const TONE = {
  success: {
    Icon: CheckCircle2,
    accent: "border-l-green-500",
    iconColor: "text-green-600",
  },
  error: {
    Icon: AlertCircle,
    accent: "border-l-red-500",
    iconColor: "text-red-600",
  },
  info: {
    Icon: Info,
    accent: "border-l-blue-500",
    iconColor: "text-blue-600",
  },
};

function Toast({ toast, onDismiss }) {
  const { id, tone, title, body } = toast;
  const { Icon, accent, iconColor } = TONE[tone];

  const timerRef = useRef(null);
  const remainingRef = useRef(DURATION[tone]);
  const startedAtRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const resume = useCallback(() => {
    clearTimer();
    startedAtRef.current = Date.now();
    timerRef.current = setTimeout(() => onDismiss(id), remainingRef.current);
  }, [clearTimer, id, onDismiss]);

  // Hovering or focusing holds the toast open — otherwise a long error message
  // can time out while it is being read.
  const pause = useCallback(() => {
    if (!timerRef.current) return;
    clearTimer();
    remainingRef.current = Math.max(
      0,
      remainingRef.current - (Date.now() - startedAtRef.current)
    );
  }, [clearTimer]);

  useEffect(() => {
    resume();
    return clearTimer;
  }, [resume, clearTimer]);

  return (
    <div
      // role="alert" is implicitly assertive and "status" implicitly polite, so
      // each toast is its own live region and the wrapper must not be one too.
      role={tone === "error" ? "alert" : "status"}
      onMouseEnter={pause}
      onMouseLeave={resume}
      onFocusCapture={pause}
      onBlurCapture={resume}
      className={`pointer-events-auto w-[22rem] max-w-[calc(100vw-2rem)] rounded-lg border border-gray-200 border-l-4 ${accent} bg-white p-4 shadow-lg motion-safe:animate-[toast-in_150ms_ease-out]`}
    >
      <div className="flex items-start gap-3">
        <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${iconColor}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          {body && (
            <p className="mt-1 break-words text-sm leading-snug text-gray-600">
              {body}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => onDismiss(id)}
          aria-label="Dismiss notification"
          className="-m-1 shrink-0 rounded border-0 bg-transparent p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

export default function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((tone, title, body) => {
    const id = nextId.current++;
    setToasts((current) => [...current, { id, tone, title, body }].slice(-MAX_VISIBLE));
    return id;
  }, []);

  const api = useMemo(
    () => ({
      success: (title, body) => push("success", title, body),
      error: (title, body) => push("error", title, body),
      info: (title, body) => push("info", title, body),
      dismiss,
    }),
    [push, dismiss]
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {createPortal(
        // Portalled to body: the dashboard shell is overflow-hidden, which would
        // otherwise clip a fixed child.
        <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2">
          {toasts.map((toast) => (
            <Toast key={toast.id} toast={toast} onDismiss={dismiss} />
          ))}
        </div>,
        document.body
      )}
    </ToastContext.Provider>
  );
}

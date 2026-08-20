import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";

const GAP = 8;
const WIDTH = 272;

// A small "(i)" that explains one control. Deliberately rare: an info icon is
// usually a patch for a label that doesn't explain itself, so prefer renaming
// the label and keep these for concepts that genuinely can't be compressed
// into a few words.
//
// Opens on hover AND click — hover-only is invisible on touch, which is how a
// lot of signage admins work. A click pins it open so the text can be read
// without holding the pointer still.
export default function InfoHint({ label, children }) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [pos, setPos] = useState(null);
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const id = useId();

  const close = useCallback(() => {
    setOpen(false);
    setPinned(false);
  }, []);

  // Position against the viewport rather than a positioned ancestor: several of
  // these live inside modals and scrolling panels that would otherwise clip the
  // popover.
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({
      left: Math.min(
        Math.max(GAP, r.left + r.width / 2 - WIDTH / 2),
        window.innerWidth - WIDTH - GAP
      ),
      top: r.bottom + GAP,
      anchorTop: r.top,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
  }, [open, place]);

  // Flip above the trigger when there isn't room below.
  useLayoutEffect(() => {
    if (!open || !pos || !popRef.current) return;
    const h = popRef.current.offsetHeight;
    if (pos.top + h > window.innerHeight - GAP && pos.anchorTop - h - GAP > 0) {
      setPos((p) => (p.flipped ? p : { ...p, top: p.anchorTop - h - GAP, flipped: true }));
    }
  }, [open, pos]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        // Deliberately does NOT move focus to the trigger. The popover is not
        // focusable, so focus never left; calling focus() here would fire
        // onFocus and reopen the hint the instant Escape closed it.
        close();
      }
    };
    const onDocDown = (e) => {
      if (
        !triggerRef.current?.contains(e.target) &&
        !popRef.current?.contains(e.target)
      ) {
        close();
      }
    };
    const reposition = () => place();
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("mousedown", onDocDown);
    window.addEventListener("scroll", reposition, true);
    window.addEventListener("resize", reposition);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("mousedown", onDocDown);
      window.removeEventListener("scroll", reposition, true);
      window.removeEventListener("resize", reposition);
    };
  }, [open, close, place]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? id : undefined}
        onClick={(e) => {
          e.stopPropagation();
          // Hover has usually opened it already, so a click pins it open; a
          // second click unpins and closes.
          const next = !pinned;
          setPinned(next);
          setOpen(next);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => !pinned && setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => !pinned && setOpen(false)}
        className="ml-1 inline-flex shrink-0 items-center justify-center rounded-full border-0 bg-transparent p-0.5 align-middle text-gray-400 transition-colors hover:text-blue-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
      </button>

      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            id={id}
            role="tooltip"
            style={{ left: pos.left, top: pos.top, width: WIDTH }}
            className="fixed z-[110] rounded-lg border border-gray-200 bg-white p-3 text-left text-xs font-normal normal-case leading-relaxed tracking-normal text-gray-600 shadow-lg motion-safe:animate-[toast-in_120ms_ease-out]"
          >
            {children}
          </div>,
          document.body
        )}
    </>
  );
}

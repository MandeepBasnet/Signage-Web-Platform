import { useEffect } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled]):not([type=hidden])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

// Keeps Tab inside `containerRef` while `active`, routes Escape to `onEscape`,
// locks body scroll, and restores focus to whatever was focused before.
//
// Written as a standalone hook because the app has four other modals
// (UploadMedia, MediaPicker, MediaPreview, AddRow) that need exactly this and
// currently have none of it.
export function useFocusTrap(active, containerRef, onEscape) {
  useEffect(() => {
    if (!active) return undefined;

    const previouslyFocused = document.activeElement;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onEscape?.();
        return;
      }
      if (event.key !== "Tab") return;

      const node = containerRef.current;
      if (!node) return;

      // Re-query each time: the dialog's buttons can change between renders.
      const items = Array.from(node.querySelectorAll(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      );
      if (items.length === 0) {
        event.preventDefault();
        return;
      }

      const first = items[0];
      const last = items[items.length - 1];
      const activeEl = document.activeElement;

      // Wrap at both ends, and pull focus back in if it escaped the container.
      if (event.shiftKey && (activeEl === first || !node.contains(activeEl))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeEl === last || !node.contains(activeEl))) {
        event.preventDefault();
        first.focus();
      }
    };

    // Capture phase so the dialog wins Escape over any handler underneath it.
    document.addEventListener("keydown", handleKeyDown, true);

    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      document.body.style.overflow = overflow;
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, [active, containerRef, onEscape]);
}

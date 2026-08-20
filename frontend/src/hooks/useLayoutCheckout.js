import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAuthHeaders } from "../utils/auth.js";
import { API_BASE_URL } from "../config/api.js";
import { useToast } from "./useToast.js";
import { useConfirm } from "./useConfirm.js";

// Xibo's draft/live model, in one place.
//
// A live layout is read-only. To change it you take an editable copy (Xibo
// calls this "checkout"), edit that, then push it live ("publish"), which
// promotes the copy over its parent. The two requests are asymmetric in a way
// that is easy to get wrong: checkout acts on the layout you are looking at,
// but publish must target the PARENT id when the current layout is a copy.
//
// `onRefetch` is only used on the fallback path where checkout succeeds but
// the response carries no new layout id.
export function useLayoutCheckout({ layoutId, layout, onRefetch }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirmDialog = useConfirm();

  const [publishing, setPublishing] = useState(false);
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState(false);

  // Held in a ref so the caller can pass an inline arrow without this hook
  // re-subscribing anything on every render.
  const onRefetchRef = useRef(onRefetch);
  onRefetchRef.current = onRefetch;

  // Xibo's own guidance is to wait for the publish confirmation before leaving
  // the page — closing the tab mid-request can leave the layout in a broken
  // half-published state. Warn while the request is in flight.
  useEffect(() => {
    if (!publishing) return undefined;
    const warn = (event) => {
      event.preventDefault();
      // Browsers ignore the message and show their own, but returnValue must be
      // set for the prompt to appear at all.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [publishing]);

  const publishLayout = async () => {
    const ok = await confirmDialog({
      title: "Push this layout live?",
      body: "Every screen scheduled to show it will pick up your changes at its next check-in.",
      confirmLabel: "Push live",
    });
    if (!ok) return;

    try {
      setPublishing(true);
      setPublishSuccess(false);

      // Publishing a copy targets its parent; publishing an original targets
      // itself. Xibo rejects the other way round.
      const publishId =
        layout && layout.parentId && layout.parentId !== 0
          ? layout.parentId
          : layoutId;

      console.log(
        `[Publish] Publishing Layout. Current ID: ${layoutId}, Parent ID: ${layout?.parentId}, Target Publish ID: ${publishId}`
      );

      const response = await fetch(
        `${API_BASE_URL}/layouts/publish/${publishId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({ publishNow: 1 }),
        }
      );

      if (response.status === 403) {
        throw new Error("You don't have permission to push this layout live.");
      }
      if (response.status === 404) {
        throw new Error("Layout not found.");
      }
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "The layout could not be sent to your screens"
        );
      }

      await response.json();
      setPublishSuccess(true);

      // The toast outlives this navigation — ToastProvider is mounted above the
      // router in App.jsx.
      toast.success(
        "Pushed live",
        "Screens will pick it up at their next check-in."
      );
      navigate("/dashboard", { replace: true });
    } catch (err) {
      console.error("Error publishing layout:", err);
      if (
        err.message.includes("Failed to fetch") ||
        err.message.includes("NetworkError")
      ) {
        toast.error(
          "Network problem",
          "Nothing was sent to your screens. Check your connection and try again."
        );
      } else {
        toast.error("Couldn't push this layout live", err.message);
      }
    } finally {
      setPublishing(false);
    }
  };

  const checkoutLayout = async () => {
    try {
      setCheckingOut(true);
      setCheckoutSuccess(false);

      const response = await fetch(
        `${API_BASE_URL}/layouts/checkout/${layoutId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || "An editable copy could not be created"
        );
      }

      const data = await response.json();
      setCheckoutSuccess(true);

      // The controller returns the result of POST /layout/copy, i.e. the new
      // layout object. Its id has appeared under three different keys.
      const newLayoutId =
        data.layoutId || data.id || (data.layout && data.layout.layoutId);

      if (newLayoutId) {
        console.log(`[Checkout] Redirecting to new draft: ${newLayoutId}`);
        navigate(`/layout/designer/${newLayoutId}`, { replace: true });
      } else {
        console.warn("[Checkout] No new layout ID found in response", data);
        // Unlikely to help if the id really did change, but safer than nothing.
        await onRefetchRef.current?.();
      }

      toast.success("Ready to edit", "You're now working on an editable copy.");

      setTimeout(() => {
        setCheckoutSuccess(false);
      }, 3000);
    } catch (err) {
      console.error("Error checking out layout:", err);
      toast.error("Couldn't open this layout for editing", err.message);
    } finally {
      setCheckingOut(false);
    }
  };

  return {
    publishing,
    publishSuccess,
    publishLayout,
    checkingOut,
    checkoutSuccess,
    checkoutLayout,
  };
}

"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { X } from "lucide-react";
import { getAuthHeaders } from "../utils/auth.js";
import DatePicker from "./DatePicker.jsx";

import { API_BASE_URL } from "../config/api.js";
import { useSchedule } from "../hooks/queries/useSchedule.js";
import { useScheduleOptions } from "../hooks/queries/useScheduleOptions.js";
import { useToast } from "../hooks/useToast.js";
import { useConfirm } from "../hooks/useConfirm.js";

// datetime-local gives "YYYY-MM-DDTHH:mm"; Xibo wants "YYYY-MM-DD HH:mm:ss".
const toXiboDate = (local) => (local ? `${local.replace("T", " ")}:00` : "");

// Epoch (seconds) or string → "YYYY-MM-DDTHH:mm" for a datetime-local input.
const toLocalInput = (value) => {
  if (!value) return "";
  const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
  if (Number.isNaN(ms)) return "";
  const d = new Date(ms);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(
    d.getHours()
  )}:${p(d.getMinutes())}`;
};

const EMPTY_ARRAY = [];

export default function ScheduleContent() {
  const queryClient = useQueryClient();
  const toast = useToast();
  const confirmDialog = useConfirm();

  // Add/edit modal state
  const [showAdd, setShowAdd] = useState(false);
  const [editingEvent, setEditingEvent] = useState(null); // null = create mode
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);

  const [contentType, setContentType] = useState("playlist"); // 'playlist' | 'layout'
  const [contentId, setContentId] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState([]);
  const [isAlways, setIsAlways] = useState(true);
  const [fromDt, setFromDt] = useState("");
  const [toDt, setToDt] = useState("");
  const [isPriority, setIsPriority] = useState(false);
  const [eventName, setEventName] = useState("");

  // Date range for the events list (defaults: today → +30 days).
  const [rangeFrom, setRangeFrom] = useState(
    () => new Date().toISOString().split("T")[0]
  );
  const [rangeTo, setRangeTo] = useState(
    () => new Date(Date.now() + 30 * 86400000).toISOString().split("T")[0]
  );

  // Cached schedule events for the selected range (refetches when range changes).
  const {
    data: events = EMPTY_ARRAY,
    isLoading: loading,
    error,
    refetch: refetchSchedule,
  } = useSchedule({ from: rangeFrom, to: rangeTo });

  // Picker lists, loaded (and cached) while the Add/Edit modal is open.
  const { data: options, error: optionsError } = useScheduleOptions(showAdd);
  const playlists = options?.playlists ?? EMPTY_ARRAY;
  const layouts = options?.layouts ?? EMPTY_ARRAY;
  const displayGroups = options?.displayGroups ?? EMPTY_ARRAY;

  const openAddModal = (event = null) => {
    setFormError(null);
    setShowAdd(true);
    // Start the content picker fresh ("" = pick for create / keep-current for edit).
    setContentType("playlist");
    setContentId("");
    setEventName("");

    // Edit mode only when given a real schedule event (guards against a stray
    // click-event object being passed in as the argument).
    if (event && event.eventId) {
      // Edit mode: prefill name / targeting / timing / priority from the event.
      setEditingEvent(event);
      setEventName(event.name || "");
      const groupIds = (event.displayGroups || [])
        .map((dg) => dg.displayGroupId || dg.id)
        .filter(Boolean);
      setSelectedGroupIds(groupIds);
      // Use the event's own isAlways flag — daypart ids vary per instance.
      const always = !!event.isAlways;
      setIsAlways(always);
      setFromDt(always ? "" : toLocalInput(event.fromDt));
      setToDt(always ? "" : toLocalInput(event.toDt));
      setIsPriority(!!event.isPriority);
    } else {
      setEditingEvent(null);
    }

    // Picker lists are loaded by useScheduleOptions (enabled while the modal is
    // open) and cached across opens.
  };

  const closeAddModal = () => {
    setShowAdd(false);
    setEditingEvent(null);
    setContentId("");
    setEventName("");
    setSelectedGroupIds([]);
    setIsAlways(true);
    setFromDt("");
    setToDt("");
    setIsPriority(false);
    setFormError(null);
  };

  const toggleGroup = (id) => {
    setSelectedGroupIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (!editingEvent && !contentId) {
      setFormError(`Please select a ${contentType}.`);
      return;
    }
    if (selectedGroupIds.length === 0) {
      setFormError("Please select at least one display group.");
      return;
    }
    if (!isAlways && (!fromDt || !toDt)) {
      setFormError("Please set both a start and end time, or choose 'Always'.");
      return;
    }

    const common = {
      name: eventName.trim(),
      displayGroupIds: selectedGroupIds,
      isAlways,
      isPriority,
      fromDt: isAlways ? undefined : toXiboDate(fromDt),
      toDt: isAlways ? undefined : toXiboDate(toDt),
    };

    let url = `${API_BASE_URL}/schedule`;
    let method = "POST";
    let body;

    if (editingEvent) {
      url = `${API_BASE_URL}/schedule/${editingEvent.eventId}`;
      method = "PUT";
      body = {
        ...common,
        eventTypeId: editingEvent.eventTypeId || 1,
        displayOrder: editingEvent.displayOrder ?? 0,
      };
      if (contentId) {
        // Replace the scheduled content (playlist auto-wraps server-side).
        body.contentType = contentType;
        body.contentId = contentId;
        if (contentType === "layout") {
          const layout = layouts.find(
            (l) => String(l.layoutId || l.id) === String(contentId)
          );
          body.campaignId = layout?.campaignId; // backend resolves if omitted
        }
      } else {
        // Keep the event's existing content.
        body.campaignId = editingEvent.campaignId;
      }

      // Preserve fields the form doesn't manage. Xibo's PUT is a full replace,
      // so omitting these wipes them (e.g. recurrence on a recurring event). The
      // name comes from the editable field above (`common.name`).
      body.maxPlaysPerHour = editingEvent.maxPlaysPerHour ?? 0;
      if (editingEvent.recurrenceType) {
        body.recurrenceType = editingEvent.recurrenceType;
        body.recurrenceDetail = editingEvent.recurrenceDetail ?? "";
        body.recurrenceRange = editingEvent.recurrenceRange ?? "";
        body.recurrenceRepeatsOn = editingEvent.recurrenceRepeatsOn ?? "";
        body.recurrenceMonthlyRepeatsOn =
          editingEvent.recurrenceMonthlyRepeatsOn ?? 0;
      }
    } else {
      // Create: resolve content (playlist auto-wraps server-side).
      let campaignId;
      if (contentType === "layout") {
        const layout = layouts.find(
          (l) => String(l.layoutId || l.id) === String(contentId)
        );
        campaignId = layout?.campaignId;
      }
      body = { ...common, contentType, contentId, campaignId };
    }

    try {
      setSubmitting(true);
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            `Failed to ${editingEvent ? "update" : "create"} event: ${response.status}`
        );
      }

      closeAddModal();
      refetchSchedule();
    } catch (err) {
      console.error("Error saving schedule event:", err);
      setFormError(err.message || "Failed to save schedule event");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (eventId) => {
    if (!eventId) return;
    const ok = await confirmDialog({
      title: "Delete this scheduled event?",
      body: "Screens will stop playing it from their next check-in. The layout or playlist itself is not deleted.",
      confirmLabel: "Delete event",
      destructive: true,
    });
    if (!ok) return;

    try {
      const response = await fetch(`${API_BASE_URL}/schedule/${eventId}`, {
        method: "DELETE",
        headers: { ...getAuthHeaders() },
      });
      if (!response.ok && response.status !== 204) {
        throw new Error(`Failed to delete event: ${response.status}`);
      }
      queryClient.setQueryData(["schedule", rangeFrom, rangeTo], (old) =>
        (old || []).filter((ev) => ev.eventId !== eventId)
      );
    } catch (err) {
      console.error("Error deleting schedule event:", err);
      toast.error("Couldn't delete the event", err.message);
    }
  };

  const formatEpoch = (value) => {
    if (!value) return "—";
    const ms = typeof value === "number" ? value * 1000 : Date.parse(value);
    if (Number.isNaN(ms)) return String(value);
    // Match Xibo's grid format (YYYY-MM-DD HH:mm) instead of the locale string.
    const d = new Date(ms);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
      d.getDate()
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  if (loading) {
    return (
      <section className="flex flex-col gap-5 relative p-4">
        <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
          <div className="flex items-center justify-center py-12">
            <div className="flex flex-col items-center gap-4">
              <div className="w-10 h-10 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
              <p className="text-gray-600">Loading schedule...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-5 relative p-4">
      <div className="rounded-lg border border-gray-200 p-6 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold text-gray-900">Schedule</h2>
            <p className="text-sm text-gray-500 mt-1">
              Manage your content schedule
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-sm text-gray-600">
              <span className="text-xs text-gray-500">From</span>
              <DatePicker value={rangeFrom} max={rangeTo} onChange={setRangeFrom} />
              <span className="text-xs text-gray-500 ml-1">To</span>
              <DatePicker value={rangeTo} min={rangeFrom} onChange={setRangeTo} />
            </div>
            <button
              onClick={() => openAddModal()}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors"
            >
              Add Event
            </button>
            <button
              onClick={() => refetchSchedule()}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>

        {error ? (
          <div className="text-center py-12 text-red-600">
            <p>{error?.message || "Failed to load schedule"}</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No scheduled events found</p>
            <p className="text-gray-400 text-sm mt-2">
              Use “Add Event” to schedule a playlist or layout onto a display.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-sm font-medium text-gray-700">Name</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700">Event</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700">Start</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700">End</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700">Display/Group</th>
                  <th className="px-4 py-3 text-sm font-medium text-gray-700 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event) => (
                  <tr
                    key={event.eventId}
                    className="border-b border-gray-100 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {event.name || <span className="text-gray-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {event.campaign || event.name || "Untitled Event"}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {event.isAlways ? "Always" : formatEpoch(event.fromDt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {event.isAlways ? "Always" : formatEpoch(event.toDt)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {event.displayGroups?.map((dg) => dg.displayGroup).join(", ") ||
                        "None"}
                    </td>
                    <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                      <button
                        onClick={() => openAddModal(event)}
                        className="text-blue-600 hover:text-blue-800 mr-3"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(event.eventId)}
                        className="text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-lg bg-white shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">
                {editingEvent ? "Edit Schedule Event" : "Add Schedule Event"}
              </h3>
              <button
                onClick={closeAddModal}
                className="text-gray-500 hover:text-gray-700"
                disabled={submitting}
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form className="px-6 py-4 space-y-4" onSubmit={handleSubmit}>
              {/* Schedule name (optional) — distinct from the layout/playlist. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Schedule Name{" "}
                  <span className="text-gray-400 font-normal">(optional)</span>
                </label>
                <input
                  type="text"
                  value={eventName}
                  onChange={(e) => setEventName(e.target.value)}
                  placeholder="A label for this schedule, e.g. Femina Ramat Aviv Night"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  disabled={submitting}
                />
              </div>

              {/* Content */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Content
                </label>
                <div className="flex gap-2 mb-2">
                  {["playlist", "layout"].map((t) => (
                    <button
                      type="button"
                      key={t}
                      onClick={() => {
                        setContentType(t);
                        setContentId("");
                      }}
                      className={`px-3 py-1.5 text-sm rounded-md border capitalize ${
                        contentType === t
                          ? "bg-blue-600 text-white border-blue-600"
                          : "bg-white text-gray-700 border-gray-300"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
                <select
                  value={contentId}
                  onChange={(e) => setContentId(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="">
                    {editingEvent
                      ? `Keep current (${editingEvent.campaign || editingEvent.name || "current content"})`
                      : `Select a ${contentType}…`}
                  </option>
                  {(contentType === "playlist" ? playlists : layouts).map((item) => {
                    const id =
                      contentType === "playlist"
                        ? item.playlistId || item.id
                        : item.layoutId || item.id;
                    const label =
                      contentType === "playlist"
                        ? item.name || `Playlist ${id}`
                        : item.layout || item.name || `Layout ${id}`;
                    return (
                      <option key={id} value={id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
                {editingEvent && (
                  <p className="text-xs text-gray-400 mt-1">
                    Pick a {contentType} to replace the scheduled content, or leave
                    as “Keep current”.
                  </p>
                )}
              </div>

              {/* Display groups */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Display Group(s)
                </label>
                <div className="max-h-40 overflow-y-auto rounded-md border border-gray-300 p-2 space-y-1">
                  {displayGroups.length === 0 ? (
                    <p className="text-sm text-gray-400">No display groups found.</p>
                  ) : (
                    displayGroups.map((dg) => {
                      const id = dg.displayGroupId || dg.id;
                      return (
                        <label
                          key={id}
                          className="flex items-center gap-2 text-sm text-gray-700"
                        >
                          <input
                            type="checkbox"
                            checked={selectedGroupIds.includes(id)}
                            onChange={() => toggleGroup(id)}
                          />
                          {dg.displayGroup || `Group ${id}`}
                          {dg.isDisplaySpecific === 1 && (
                            <span className="text-xs text-gray-400">(display)</span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* When */}
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input
                    type="checkbox"
                    checked={isAlways}
                    onChange={(e) => setIsAlways(e.target.checked)}
                  />
                  Always (run continuously)
                </label>
                {!isAlways && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">From</label>
                      <input
                        type="datetime-local"
                        value={fromDt}
                        onChange={(e) => setFromDt(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">To</label>
                      <input
                        type="datetime-local"
                        value={toDt}
                        onChange={(e) => setToDt(e.target.value)}
                        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                      />
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isPriority}
                  onChange={(e) => setIsPriority(e.target.checked)}
                />
                High priority
              </label>

              {(formError || optionsError) && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  {formError ||
                    "Failed to load playlists / layouts / display groups."}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-70"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving…"
                    : editingEvent
                    ? "Save Changes"
                    : "Schedule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}

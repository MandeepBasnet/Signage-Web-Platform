"use client";

import { useEffect, useState } from "react";
import { getAuthHeaders } from "../utils/auth.js";

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export default function ScheduleContent() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSchedule();
  }, []);

  const fetchSchedule = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch schedule for the next 30 days by default
      // Note: Xibo API requires fromDt and toDt for schedule
      const now = new Date();
      const nextMonth = new Date();
      nextMonth.setDate(now.getDate() + 30);

      const fromDt = now.toISOString().split('T')[0] + ' 00:00:00';
      const toDt = nextMonth.toISOString().split('T')[0] + ' 23:59:59';

      const response = await fetch(`${API_BASE_URL}/schedule?fromDt=${fromDt}&toDt=${toDt}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });

      if (!response.ok) {
        // If 404, it might mean the route doesn't exist yet, which is expected as we haven't created it.
        // But we will create it.
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message || `Failed to fetch schedule: ${response.status}`
        );
      }

      const data = await response.json();
      setEvents(data?.data || []);
    } catch (err) {
      console.error("Error fetching schedule:", err);
      setError(err.message || "Failed to load schedule");
    } finally {
      setLoading(false);
    }
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
          <button
            onClick={fetchSchedule}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>

        {error ? (
             <div className="text-center py-12 text-red-600">
                <p>{error}</p>
                <p className="text-sm text-gray-500 mt-2">Make sure the backend route /api/schedule is implemented.</p>
             </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 text-lg">No scheduled events found</p>
            <p className="text-gray-400 text-sm mt-2">
              Add events to your schedule to display content.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
                <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="px-4 py-3 text-sm font-medium text-gray-700">Event</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-700">Start</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-700">End</th>
                        <th className="px-4 py-3 text-sm font-medium text-gray-700">Display/Group</th>
                    </tr>
                </thead>
                <tbody>
                    {events.map((event) => (
                        <tr key={event.eventId} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-4 py-3 text-sm text-gray-900">{event.campaign || "Unknown Event"}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{new Date(event.fromDt * 1000).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{new Date(event.toDt * 1000).toLocaleString()}</td>
                            <td className="px-4 py-3 text-sm text-gray-600">{event.displayGroups?.map(dg => dg.displayGroup).join(', ') || "None"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

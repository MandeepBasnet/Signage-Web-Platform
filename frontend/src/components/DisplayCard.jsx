import { ChevronDown, FileText, Wifi, WifiOff } from "lucide-react";
import InfoHint from "./ui/InfoHint.jsx";

// One screen, led by what a customer actually came to find out: is it alive,
// and what is on it right now. The telemetry the old table opened with — MAC,
// IP, client version — lives behind "Technical details".
export default function DisplayCard({
  display,
  expanded,
  onToggle,
  thumbUrl,
  statusStyle,
  formatDate,
  onLayoutClick,
}) {
  const online = !!display.loggedIn;
  const scheduled = display.scheduledLayouts || [];
  const nowPlaying = display.layoutName;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-lg border bg-white transition-shadow ${
        expanded ? "border-blue-300 shadow-md" : "border-gray-200 hover:shadow-md"
      }`}
    >
      {/* What's on the screen right now */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="group relative block w-full border-0 bg-black p-0 text-left"
      >
        <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-gray-900">
          {thumbUrl ? (
            <img
              src={thumbUrl}
              alt={`${nowPlaying} — currently playing on ${display.name}`}
              className="h-full w-full object-contain"
              loading="lazy"
            />
          ) : (
            <div className="flex flex-col items-center gap-2 p-6 text-center text-gray-500">
              <FileText className="h-8 w-8" aria-hidden="true" />
              <span className="text-xs">No preview</span>
            </div>
          )}
        </div>

        <span
          className={`absolute left-2 top-2 inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold ${
            online ? "bg-green-100 text-green-800" : "bg-gray-200 text-gray-700"
          }`}
        >
          {online ? (
            <Wifi className="h-3 w-3" aria-hidden="true" />
          ) : (
            <WifiOff className="h-3 w-3" aria-hidden="true" />
          )}
          {online ? "Online" : "Offline"}
        </span>
      </button>

      {/* Identity + what's playing */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="min-w-0">
          <h3 className="truncate font-semibold text-gray-900" title={display.name}>
            {display.name}
          </h3>
          <p className="mt-0.5 truncate text-sm text-gray-500" title={nowPlaying}>
            {online ? "Playing" : "Last showing"}: {nowPlaying || "—"}
          </p>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-2 text-xs">
          <span
            className={`rounded-full px-2 py-1 font-semibold ${statusStyle.className}`}
          >
            {statusStyle.label}
          </span>
          <span className="text-gray-500">
            {scheduled.length}{" "}
            {scheduled.length === 1 ? "scheduled item" : "scheduled items"}
          </span>
          {!online && display.lastAccessed && (
            <span className="text-gray-400">
              Last seen {formatDate(display.lastAccessed)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="-mx-1 flex items-center gap-1 rounded border-0 bg-transparent px-1 py-1 text-left text-xs font-medium text-blue-600 transition-colors hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        >
          <ChevronDown
            className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
          {expanded ? "Hide details" : "Scheduled content & details"}
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-200 bg-gray-50 p-4">
          <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-500">
            Scheduled content
          </h4>
          {scheduled.length > 0 ? (
            <ul className="mb-5 space-y-2">
              {scheduled.map((layout) => {
                const layoutId = layout.layoutId || layout.id;
                return (
                  <li key={layout.id || layoutId}>
                    <button
                      type="button"
                      onClick={() => onLayoutClick(layout)}
                      className="w-full rounded-md border border-gray-200 bg-white px-3 py-2 text-left transition-colors hover:border-blue-300 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                      <span className="block truncate text-sm font-medium text-gray-900">
                        {layout.name || layout.campaign || "Untitled"}
                      </span>
                      <span className="block text-xs text-gray-500">
                        {layout.isAlways
                          ? "Always"
                          : `${formatDate(layout.fromDt)} – ${formatDate(layout.toDt)}`}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mb-5 text-sm text-gray-500">Nothing scheduled on this screen.</p>
          )}

          <h4 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wider text-gray-500">
            Technical details
            <InfoHint label="About technical details">
              Useful when installing or troubleshooting a screen. You can safely
              ignore these day to day.
            </InfoHint>
          </h4>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {[
              ["Screen ID", display.displayId],
              ["Approved", display.authorised ? "Yes" : "No"],
              ["Player", display.clientType || "—"],
              ["Version", display.clientVersion || "—"],
              ["IP address", display.clientAddress || "—"],
              ["MAC address", display.macAddress || "—"],
              ["Last check-in", formatDate(display.lastAccessed)],
            ].map(([term, value]) => (
              <div key={term} className="min-w-0">
                <dt className="text-gray-500">{term}</dt>
                <dd className="truncate font-medium text-gray-900" title={String(value)}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

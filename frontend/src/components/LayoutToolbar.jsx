import CheckoutButton from "./CheckoutButton.jsx";
import PublishButton from "./PublishButton.jsx";
import InfoHint from "./ui/InfoHint.jsx";

// The designer's top bar: what layout you are on, whether it is live or your
// own copy, and the two actions that move it between those states.
export default function LayoutToolbar({
  layout,
  onBack,
  checkoutLayout,
  checkingOut,
  checkoutSuccess,
  publishLayout,
  publishing,
  publishSuccess,
}) {
  return (
    <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between shadow-sm z-20 shrink-0">
      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-gray-400 hover:text-white transition-colors flex items-center gap-2 text-sm font-medium group"
        >
          <div className="p-1 rounded-md group-hover:bg-gray-800 transition-colors">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </div>
          Back
        </button>
        <div className="h-6 w-px bg-gray-800 mx-2"></div>
        <div>
          <h1 className="text-lg font-semibold text-white leading-tight flex items-center gap-2">
            {layout.layout}
            <span className="text-xs font-normal text-gray-500 bg-gray-800 px-2 py-0.5 rounded-full border border-gray-700">
              v{layout.version || 1}
            </span>
          </h1>
          <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
            <span className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                />
              </svg>
              {layout.width}x{layout.height}
            </span>
            <span className="w-1 h-1 bg-gray-600 rounded-full"></span>
            <span className="flex items-center gap-1">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-3 w-3"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              {layout.duration}s
            </span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="px-3 py-1.5 bg-indigo-500/10 text-indigo-400 rounded-full text-xs font-medium border border-indigo-500/20 flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
          </span>
          Designer Mode
        </div>

        {/* Draft Badge - Show if layout is a draft (publishedStatusId === 2) */}
        {layout.publishedStatusId === 2 && (
          <div className="px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-full text-xs font-bold border border-yellow-500/20 flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
              />
            </svg>
            YOUR COPY
          </div>
        )}

        {/* Checkout Layout Button - Show if Published (status 1) */}
        {layout.publishedStatusId === 1 && (
          <CheckoutButton
            onClick={checkoutLayout}
            checkingOut={checkingOut}
            checkoutSuccess={checkoutSuccess}
          />
        )}

        {/* Publish Layout Button */}
        <div className="flex items-center">
          <PublishButton
            onClick={publishLayout}
            publishing={publishing}
            publishSuccess={publishSuccess}
          />
          <InfoHint label="About pushing a layout live">
            Sends this layout to every screen it&rsquo;s scheduled on. Screens
            pick up the change the next time they check in &mdash; usually
            within a minute.
          </InfoHint>
        </div>
      </div>
    </header>
  );
}

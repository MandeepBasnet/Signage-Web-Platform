// Presentational publish button with idle / pushing / live states. The label
// avoids Xibo's "publish" vocabulary — what the user is doing is sending the
// layout to the screens that show it.
export default function PublishButton({ onClick, publishing, publishSuccess }) {
  return (
    <button
      onClick={onClick}
      disabled={publishing}
      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 ${
        publishSuccess
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : publishing
            ? "bg-gray-700 text-gray-400 border border-gray-600 cursor-not-allowed"
            : "bg-green-500/10 text-green-400 border border-green-500/20 hover:bg-green-500/20 hover:border-green-500/30"
      }`}
    >
      {publishing ? (
        <>
          <svg
            className="animate-spin h-3 w-3"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            ></circle>
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            ></path>
          </svg>
          Pushing to screens…
        </>
      ) : publishSuccess ? (
        <>
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
              d="M5 13l4 4L19 7"
            />
          </svg>
          Live on screens
        </>
      ) : (
        <>
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
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          Push live to screens
        </>
      )}
    </button>
  );
}

// Presentational button for taking an editable copy of a live layout.
// Xibo calls this "checkout"; the user is just making a copy to edit.
export default function CheckoutButton({ onClick, checkingOut, checkoutSuccess }) {
  return (
    <button
      onClick={onClick}
      disabled={checkingOut}
      className={`px-4 py-1.5 rounded-md text-xs font-medium transition-all flex items-center gap-2 mr-2 ${
        checkoutSuccess
          ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
          : checkingOut
            ? "bg-gray-700 text-gray-400 border border-gray-600 cursor-not-allowed"
            : "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 hover:border-blue-500/30"
      }`}
    >
      {checkingOut ? (
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
          Preparing…
        </>
      ) : checkoutSuccess ? (
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
          Editing a copy
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
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
          Edit a copy
        </>
      )}
    </button>
  );
}

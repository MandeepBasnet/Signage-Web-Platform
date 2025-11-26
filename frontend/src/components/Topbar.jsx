import { getStoredUser } from "../utils/auth.js";

export default function Topbar({ currentPage, onLogout }) {
  const user = getStoredUser();
  const title = (currentPage || "dashboard").replace("-", " ");

  return (
    <header className="w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <h1 className="text-xl font-semibold capitalize">{title}</h1>
        <div className="flex items-center gap-4">
          {user?.username && (
            <div className="text-sm text-gray-600">
              Signed in as{" "}
              <span className="font-medium text-gray-900">{user.username}</span>
            </div>
          )}
          <button
            type="button"
            onClick={() => onLogout?.()}
            className="flex items-center gap-2 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-all hover:bg-gray-50 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-4 w-4"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"
              />
            </svg>
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

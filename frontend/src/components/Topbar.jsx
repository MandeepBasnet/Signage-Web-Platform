import { getStoredUser } from "../utils/auth.js";

export default function Topbar({ currentPage, onLogout }) {
  const user = getStoredUser();
  const title = (currentPage || "dashboard").replace("-", " ");

  return (
    <header className="w-full border-b bg-white">
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
            className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

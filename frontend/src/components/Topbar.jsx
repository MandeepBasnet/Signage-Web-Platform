export default function Topbar({ currentPage }) {
  return (
    <header className="w-full border-b bg-white">
      <div className="mx-auto max-w-7xl px-4 py-3">
        <h1 className="text-xl font-semibold capitalize">
          {(currentPage || "dashboard").replace("-", " ")}
        </h1>
      </div>
    </header>
  );
}

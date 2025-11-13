"use client";

const menuItems = [
  {
    section: "DESIGN",
    items: [{ id: "design-layout", label: "Layouts", icon: "📄" }],
  },
  {
    section: "LIBRARY",
    items: [
      { id: "library-playlist", label: "Playlists", icon: "🎵" },
      { id: "library-media", label: "Media", icon: "📹" },
    ],
  },
];

export default function Sidebar({ currentPage, setCurrentPage }) {
  return (
    <aside className="w-[200px] md:w-[200px] sm:w-[70px] bg-white border-r border-gray-200 flex flex-col overflow-y-auto overflow-x-hidden">
      {/* Logo */}
      <div className="p-5 md:p-5 sm:p-[15px] border-b border-[#2a3442] flex items-center justify-center">
        <img
          src="/logo.png"
          alt="Logo"
          className="h-8 md:h-8 sm:h-6 object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((section) => (
          <div key={section.section} className="px-3 pb-4">
            <h3 className="text-[11px] font-semibold uppercase text-gray-500 tracking-wider mb-2 px-2 md:block sm:hidden">
              {section.section}
            </h3>
            <ul className="list-none p-0 m-0 flex flex-col gap-1">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    className={`flex items-center gap-3 md:gap-3 sm:gap-2 p-2.5 md:px-3 md:py-2.5 sm:p-2.5 bg-transparent border-none rounded-md cursor-pointer text-sm transition-all duration-200 w-full font-[inherit] ${
                      currentPage === item.id
                        ? "bg-blue-600 text-white font-semibold"
                        : "text-gray-600 hover:bg-blue-50 hover:text-gray-800"
                    }`}
                    onClick={() => setCurrentPage(item.id)}
                  >
                    <span className="text-base">{item.icon}</span>
                    <span className="flex-1 text-left md:block sm:hidden">
                      {item.label}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

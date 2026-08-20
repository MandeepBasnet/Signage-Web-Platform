"use client";

import {
  MonitorPlay,
  Palette,
  CalendarDays,
  FolderOpen,
  ListVideo,
} from "lucide-react";
import { PAGE_LABELS } from "../config/nav.js";

const menuItems = [
  {
    section: "DESIGN",
    items: [
      { id: "display", label: PAGE_LABELS.display, icon: MonitorPlay },
      { id: "layout", label: PAGE_LABELS.layout, icon: Palette },
      { id: "schedule", label: PAGE_LABELS.schedule, icon: CalendarDays },
    ],
  },
  {
    section: "LIBRARY",
    items: [
      { id: "library", label: PAGE_LABELS.library, icon: FolderOpen },
      { id: "playlist", label: PAGE_LABELS.playlist, icon: ListVideo },
    ],
  },
];

export default function Sidebar({ currentPage, setCurrentPage }) {
  return (
    <aside className="w-[200px] md:w-[200px] sm:w-[70px] bg-white border-r border-gray-200 flex flex-col overflow-y-auto overflow-x-hidden">
      {/* Logo */}
      <div className="p-5 md:p-5 sm:p-[15px] border-b border-[#2a3442] flex items-center justify-center">
        <img
          src="/ModusLogo.png"
          alt="Modus"
          className="h-8 md:h-8 sm:h-6 object-contain"
        />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        {menuItems.map((section) => (
          <div key={section.section} className="px-3 pb-4">
            <h3 className="text-base font-semibold uppercase text-gray-500 tracking-wider mb-2 px-2 md:block sm:hidden">
              {section.section}
            </h3>
            <ul className="list-none p-0 m-0 flex flex-col gap-1 pl-4 md:pl-4 sm:pl-0">
              {section.items.map((item) => (
                <li key={item.id}>
                  <button
                    // No bg-* in the base classes: `bg-transparent` and
                    // `bg-blue-600` have equal specificity, so the winner is
                    // decided by Tailwind's emission order, not by the order
                    // written here — transparent won and the active state
                    // never painted. White (not black) on blue-600 is 5.2:1;
                    // black would be 4.1:1 and fail AA.
                    className={`flex items-center gap-3 md:gap-3 sm:gap-2 p-2.5 md:px-3 md:py-2.5 sm:p-2.5 border-none rounded-md cursor-pointer text-sm transition-all duration-200 w-full font-[inherit] ${
                      currentPage === item.id
                        ? "bg-blue-600 text-white font-semibold"
                        : "bg-transparent text-gray-600 hover:bg-blue-50 hover:text-gray-800"
                    }`}
                    onClick={() => setCurrentPage(item.id)}
                  >
                    <item.icon className="w-5 h-5 shrink-0" aria-hidden="true" />
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

import { X } from "lucide-react";

// Reusable search input. `onChange` receives the new string value.
//
// Pass `onClear` to render a clear button (shown only when there's a value),
// wrapped in a positioned container. Without `onClear`, only the bare input is
// rendered — so callers that don't need a clear button keep identical markup.
export default function SearchBar({
  value,
  onChange,
  placeholder,
  className,
  onClear,
}) {
  const input = (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
    />
  );

  if (!onClear) return input;

  return (
    <div className="relative">
      {input}
      {value && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center justify-center w-5 h-5 p-0 m-0 bg-transparent border-0 rounded-full text-gray-400 hover:text-gray-600"
          title="Clear search"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

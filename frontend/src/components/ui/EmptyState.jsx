// A list view with nothing in it is the most common place a new user gets
// stranded, so every empty state names one specific next action. Two shapes:
//
//   nothing here yet  → explain what this thing is for, offer the create action
//   nothing matched   → offer to clear the search
//
// They are different problems and must not share copy.
export default function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  secondaryAction,
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      {Icon && (
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-gray-100">
          <Icon className="h-7 w-7 text-gray-400" aria-hidden="true" />
        </div>
      )}

      <h3 className="text-lg font-semibold text-gray-900">{title}</h3>

      {body && (
        <p className="mt-2 max-w-md text-sm leading-relaxed text-gray-500">
          {body}
        </p>
      )}

      {(action || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {action && (
            <button
              type="button"
              onClick={action.onClick}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {action.label}
            </button>
          )}
          {secondaryAction && (
            <button
              type="button"
              onClick={secondaryAction.onClick}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

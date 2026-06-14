// Pure helpers for reading playlist widget/media items, extracted from
// PlaylistContent. They depend only on their arguments (no component state).

// Resolve a media id from a playlist item / widget, checking the various shapes
// Xibo returns it in.
export function getMediaId(item) {
  return (
    item.mediaId ||
    item.media_id ||
    item.id ||
    item.media?.mediaId ||
    item.media?.media_id ||
    item.media?.id
  );
}

// Resolve a widget id from a playlist item / widget.
export function getWidgetId(item) {
  return (
    item.widgetId ||
    item.widget_id ||
    item.widget?.widgetId ||
    item.widget?.widget_id
  );
}

// Normalize a playlist's media items into a consistent shape for rendering.
// Prefers the provided mediaItems list; otherwise derives items from the
// playlist's widgets.
export function normalizeMediaItems(playlist, mediaItems = []) {
  const widgets = playlist?.widgets || [];
  const hasValidMedia = mediaItems?.some((item) => getMediaId(item));

  if (hasValidMedia) {
    return mediaItems.map((item) => {
      const widgetId = getWidgetId(item);
      const mediaId = getMediaId(item);
      return {
        ...item,
        mediaId,
        widgetId,
        mediaType:
          item.mediaType ||
          item.type ||
          item.widgetType ||
          item.moduleName ||
          "",
        name:
          item.name ||
          item.mediaName ||
          item.media?.name ||
          item.fileName ||
          (widgetId ? `Widget ${widgetId}` : "Playlist Item"),
      };
    });
  }

  const derivedItems = [];
  widgets.forEach((widget) => {
    const widgetId = widget.widgetId || widget.widget_id || widget.id;
    const baseInfo = {
      widgetId,
      mediaType:
        widget.type ||
        widget.moduleName ||
        widget.mediaType ||
        widget.media?.mediaType,
      name:
        widget.name ||
        widget.media?.name ||
        (widgetId ? `Widget ${widgetId}` : "Playlist Widget"),
      duration: widget.duration,
      displayOrder: widget.displayOrder,
      widget,
    };

    const widgetMediaIds = widget.mediaIds || widget.media_ids || [];
    const ids =
      widgetMediaIds.length > 0
        ? widgetMediaIds
        : [widget.mediaId || widget.media_id].filter(Boolean);

    if (!ids.length) {
      derivedItems.push({
        ...baseInfo,
        mediaId: null,
      });
      return;
    }

    ids.forEach((mediaId, idx) => {
      derivedItems.push({
        ...baseInfo,
        mediaId,
        orderIndex: idx,
      });
    });
  });

  return derivedItems;
}

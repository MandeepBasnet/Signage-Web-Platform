# Xibo Portal Analysis & Documentation

## Overview
This document details the functionality of the Xibo Portal (specifically Layouts, Displays, and Schedules) based on exploration of `https://portal.signage-lab.com/` and API documentation.

## 1. Layouts
### Functionality
- **Listing**: Layouts are displayed in a grid/list with thumbnails.
- **Thumbnails**: Fetched via `/layout/thumbnail/{layoutId}`.
- **Preview**: 
    - The portal uses a web-based preview accessible at `/layout/preview/{layoutId}`.
    - This is a standard web route, not a pure API endpoint, and likely relies on the user's active session (cookies) for authentication and asset loading.
    - It renders the layout in the browser using HTML/CSS/JS.
- **Editing**: Layouts are edited via a dedicated designer interface (likely `/layout/designer/{layoutId}`).

### API Endpoints
- **List Layouts**: `GET /api/layout`
- **Thumbnail**: `GET /layout/thumbnail/{layoutId}` (Note: Base URL, not /api)
- **Preview Data**: `GET /api/layout/preview/{layoutId}` (Returns HTML representation)
- **Export/Download**: `GET /api/layout/export/{layoutId}` (Returns ZIP file)

### Preview Implementation Strategy
The official portal preview requires a session. Replicating this via API (stateless) is challenging because:
1.  **Token in URL**: Appending `?access_token={token}` to the preview URL (`/layout/preview/{layoutId}`) redirects to the login page. It does not authenticate the request.
2.  **Asset Auth**: Fetching static assets (scripts, CSS) referenced in the preview HTML using the API token also fails (404/500), likely because these assets are served by the CMS which doesn't accept API tokens for these paths.

**Conclusion**: The "Download" approach (using `/api/layout/export/{layoutId}`) is the most reliable method for an external application to provide a preview without replicating the entire CMS session/auth mechanism.

## 2. Displays
### Functionality
- **Listing**: Displays are listed in a table view (`/display/view`).
- **Management**: Options to Edit, Delete, Screenshot, Wake on LAN, etc.
- **Status**: Shows connection status (Logged In, Last Accessed).

### API Endpoints
- **List Displays**: `GET /api/display`
- **Edit Display**: `PUT /api/display/{displayId}`
- **Delete Display**: `DELETE /api/display/{displayId}`
- **Request Screenshot**: `POST /api/display/request/screenshot/{displayId}`

## 3. Schedules
### Functionality
- **View**: Calendar view (`/schedule/view`) showing scheduled events.
- **Add Event**: Modal to add events (Layouts, Campaigns, Overlays) to displays/groups.

### API Endpoints
- **List Schedule**: `GET /api/schedule`
- **Add Event**: `POST /api/schedule`

## Implementation Plan
Based on this research, the following improvements will be made:
1.  **Displays**: Enhance `DisplayContent.jsx` to include "Edit" and "Delete" functionality, matching the portal's capabilities.
2.  **Schedules**: Create a new `ScheduleContent.jsx` component to list scheduled events (and potentially add new ones).
3.  **Layouts**: Keep the "Download" preview as it is the robust solution, but ensure the UI clearly indicates it.

## References
- Xibo API Documentation: `XIBO_API_DOCUMENTATION.md`
- Xibo Manual: `https://xibosignage.com/manual/api/`

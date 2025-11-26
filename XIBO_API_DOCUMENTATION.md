# Xibo CMS Complete API Documentation v4.0

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Miscellaneous](#miscellaneous)
4. [Schedule](#schedule)
5. [Notifications](#notifications)
6. [Layouts](#layouts)
7. [Regions](#regions)
8. [Playlists](#playlists)
9. [Widgets](#widgets)
10. [Campaigns](#campaigns)
11. [Templates](#templates)
12. [Resolutions](#resolutions)
13. [Library (Media)](#library-media)
14. [Display Management](#display-management)
15. [Display Groups](#display-groups)
16. [Display Profiles](#display-profiles)
17. [DataSets](#datasets)
18. [Folders](#folders)
19. [Statistics](#statistics)
20. [Users](#users)
21. [User Groups](#user-groups)
22. [Modules](#modules)
23. [Commands](#commands)
24. [Dayparting](#dayparting)
25. [Player Software](#player-software)
26. [Tags](#tags)
27. [Menu Boards](#menu-boards)
28. [Actions](#actions)
29. [Fonts](#fonts)
30. [Sync Groups](#sync-groups)
31. [Data Models](#data-models)

---

## Overview

**Base URL**: `/api`  
**API Version**: 4.0 (OAS 2.0)  
**Request Format**: HTTP formData requests  
**Content Type**: All PUT requests require `Content-Type: application/x-www-form-urlencoded` header  
**License**: AGPLv3 or later  
**Terms of Service**: https://xibosignage.com/terms  
**Documentation**: https://xibosignage.com/manual/  
**Swagger JSON**: https://xibosignage.com/manual/swagger.json

### Supported Schemes
- HTTP

---

## Authentication

### Getting Started
1. Authenticate with Xibo CMS to receive JWT token
2. Include token in all API requests using Bearer format
3. Token format: `Authorization: Bearer {your_jwt_token}`

### Authentication Flow
```
POST /oauth/access_token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id={CLIENT_ID}&client_secret={CLIENT_SECRET}
```

**Response:**
```json
{
  "access_token": "string",
  "token_type": "Bearer",
  "expires_in": 3600
}
```

---

## Miscellaneous

### Get Current CMS Time
```
GET /clock
```
**Description**: Returns the current CMS server time.

**Response**: `200 OK`
```json
{
  "currentTime": "2025-11-22 14:30:00",
  "timezone": "UTC"
}
```

### Get CMS Information
```
GET /about
```
**Description**: Returns information about the CMS installation.

**Response**: `200 OK`
```json
{
  "version": "4.0.0",
  "environment": "production"
}
```

---

## Schedule

### Get Calendar Events
```
GET /schedule/data/events
```
**Description**: Generates the calendar data for event display.

**Query Parameters**:
- `from` (integer): From date timestamp
- `to` (integer): To date timestamp
- `displayGroupIds` (array): Filter by display group IDs

**Response**: `200 OK`
```json
[
  {
    "eventId": 1,
    "displayOrder": 1,
    "fromDt": 1732291200,
    "toDt": 1732377600,
    "layoutId": 5,
    "campaignId": 3
  }
]
```

### Get Display Schedule Events
```
GET /schedule/{displayGroupId}/events
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Query Parameters**:
- `from` (integer): From date timestamp
- `to` (integer): To date timestamp

**Response**: `200 OK`

### Search Schedules
```
GET /schedule
```
**Query Parameters**:
- `eventId` (integer): Filter by Event ID
- `fromDt` (integer): From date timestamp
- `toDt` (integer): To date timestamp
- `campaignId` (integer): Filter by Campaign ID
- `displayGroupIds` (array): Filter by Display Group IDs

**Response**: `200 OK`

### Add Schedule Event
```
POST /schedule
```
**Form Data**:
- `eventTypeId` (integer, required): 1=Campaign, 2=Command, 3=Overlay
- `campaignId` (integer): Campaign ID (for eventTypeId=1)
- `commandId` (integer): Command ID (for eventTypeId=2)
- `displayOrder` (integer): Display order
- `isPriority` (integer): Priority flag (0 or 1)
- `displayGroupIds` (array, required): Array of Display Group IDs
- `dayPartId` (integer): Day part ID
- `fromDt` (string): Start date (Y-m-d H:i:s)
- `toDt` (string): End date (Y-m-d H:i:s)
- `recurrenceType` (string): Empty, Minute, Hour, Day, Week, Month, Year
- `recurrenceDetail` (integer): Recurrence interval
- `recurrenceRange` (string): Date range for recurrence (Y-m-d H:i:s)
- `recurrenceRepeatsOn` (string): Days for weekly recurrence (comma-separated)
- `syncTimezone` (integer): Sync to Display timezone? (0 or 1)
- `syncEvent` (integer): Sync event flag (0 or 1)
- `shareOfVoice` (integer): Share of voice percentage
- `isGeoAware` (integer): Geo-aware scheduling? (0 or 1)
- `geoLocation` (string): Geo location JSON

**Response**: `201 Created`
```
Headers:
Location: /schedule/{eventId}
```

### Edit Schedule Event
```
PUT /schedule/{eventId}
```
**Path Parameters**:
- `eventId` (integer, required): The Event ID

**Form Data**: Same as Add Schedule Event

**Response**: `200 OK`

### Delete Schedule Event
```
DELETE /schedule/{eventId}
```
**Path Parameters**:
- `eventId` (integer, required): The Event ID

**Response**: `204 No Content`

### Delete Recurring Event
```
DELETE /schedulerecurrence/{eventId}
```
**Path Parameters**:
- `eventId` (integer, required): The Event ID

**Response**: `204 No Content`

---

## Notifications

### Search Notifications
```
GET /notification
```
**Query Parameters**:
- `notificationId` (integer): Filter by Notification ID
- `subject` (string): Filter by subject
- `embed` (string): Embed related data

**Response**: `200 OK`
```json
[
  {
    "notificationId": 1,
    "subject": "System Alert",
    "body": "Display offline",
    "createDt": "2025-11-22 10:00:00",
    "releaseDt": "2025-11-22 10:05:00",
    "isEmail": 1,
    "isInterrupt": 0,
    "userId": 1
  }
]
```

### Add Notification
```
POST /notification
```
**Form Data**:
- `subject` (string, required): Notification subject
- `body` (string, required): Notification body
- `date` (string): Release date (Y-m-d H:i:s)
- `isEmail` (integer): Send email? (0 or 1)
- `isInterrupt` (integer): Interrupt display? (0 or 1)
- `displayGroupIds` (array): Target display groups
- `userGroupIds` (array): Target user groups

**Response**: `201 Created`

### Edit Notification
```
PUT /notification/{notificationId}
```
**Path Parameters**:
- `notificationId` (integer, required): The Notification ID

**Form Data**: Same as Add Notification

**Response**: `200 OK`

### Delete Notification
```
DELETE /notification/{notificationId}
```
**Path Parameters**:
- `notificationId` (integer, required): The Notification ID

**Response**: `204 No Content`

---

## Layouts

### Search Layouts
```
GET /layout
```
**Query Parameters**:
- `layoutId` (integer): Filter by Layout ID
- `parentId` (integer): Filter by parent ID
- `showDrafts` (integer): Show drafts? (0 or 1)
- `layout` (string): Filter by partial Layout name
- `userId` (integer): Filter by user ID
- `retired` (integer): Filter by retired flag (0 or 1)
- `tags` (string): Filter by tags (comma-separated)
- `exactTags` (integer): Exact tag match? (0 or 1)
- `logicalOperator` (string): Tag operator (AND or OR)
- `ownerUserGroupId` (integer): Filter by user group ID
- `publishedStatusId` (integer): 1=Published, 2=Draft
- `embed` (string): Embed data (regions, playlists, widgets, tags, campaigns, permissions)
- `campaignId` (integer): Filter by Campaign ID
- `folderId` (integer): Filter by Folder ID

**Response**: `200 OK`
```json
[
  {
    "layoutId": 1,
    "ownerId": 1,
    "campaignId": 5,
    "parentId": 0,
    "publishedStatusId": 1,
    "publishedStatus": "Published",
    "publishedDate": "2025-11-15 10:00:00",
    "backgroundImageId": 10,
    "schemaVersion": 4,
    "layout": "Main Layout",
    "description": "Primary display layout",
    "backgroundColor": "#000000",
    "createdDt": "2025-11-01 09:00:00",
    "modifiedDt": "2025-11-15 10:00:00",
    "status": 1,
    "retired": 0,
    "backgroundzIndex": 0,
    "width": 1920,
    "height": 1080,
    "orientation": "landscape",
    "displayOrder": 1,
    "duration": 60,
    "statusMessage": "",
    "enableStat": 1,
    "autoApplyTransitions": 1,
    "code": "MAIN_001",
    "isLocked": false,
    "regions": [],
    "tags": [],
    "folderId": 1,
    "permissionsFolderId": 1
  }
]
```

### Add Layout
```
POST /layout
```
**Form Data**:
- `name` (string, required): Layout name
- `description` (string): Layout description
- `layoutId` (integer): Template Layout ID to copy from
- `resolutionId` (integer): Resolution ID (if not using template)
- `returnDraft` (boolean): Return draft or published? (default: false)
- `code` (string): Code identifier
- `folderId` (integer): Folder ID

**Response**: `201 Created`
```
Headers:
Location: /layout/{layoutId}
```

### Edit Layout
```
PUT /layout/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `name` (string, required): Layout name
- `description` (string): Layout description
- `tags` (string): Comma-separated tags
- `retired` (integer): Retired flag (0 or 1)
- `enableStat` (integer): Enable statistics? (0 or 1)
- `code` (string): Code identifier
- `folderId` (integer): Folder ID

**Response**: `200 OK`

### Clear Layout Canvas
```
POST /layout/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID (must be draft)

**Description**: Clears all widgets and elements from a draft layout canvas.

**Response**: `201 Created`

### Delete Layout
```
DELETE /layout/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Response**: `204 No Content`

### Edit Layout Background
```
PUT /layout/background/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `backgroundColor` (string, required): HEX color code (e.g., #FF0000)
- `backgroundImageId` (integer): Media ID for background image
- `backgroundzIndex` (integer, required): Layer number for background
- `resolutionId` (integer): Resolution ID

**Response**: `200 OK`

### Apply Template to Layout
```
PUT /layout/applyTemplate/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `templateId` (integer): Template Layout ID

**Response**: `204 No Content`

### Retire Layout
```
PUT /layout/retire/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Description**: Retires a Layout so it isn't available to schedule. Existing schedules will continue.

**Response**: `204 No Content`

### Unretire Layout
```
PUT /layout/unretire/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Response**: `204 No Content`

### Enable Layout Statistics
```
PUT /layout/setenablestat/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `enableStat` (integer, required): Enable flag (0 or 1)

**Response**: `204 No Content`

### Copy Layout
```
POST /layout/copy/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID to copy

**Form Data**:
- `name` (string, required): Name for the new Layout
- `description` (string): Description for the new Layout
- `copyMediaFiles` (integer, required): Copy media files? (0 or 1)

**Response**: `201 Created`

### Tag Layout
```
POST /layout/{layoutId}/tag
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `tag` (array[string], required): Array of tags

**Response**: `200 OK`

### Untag Layout
```
POST /layout/{layoutId}/untag
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `tag` (array[string], required): Array of tags to remove

**Response**: `200 OK`

### Get Layout Status
```
GET /layout/status/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Description**: Calculates and returns the Layout status including validation.

**Response**: `200 OK`

### Checkout Layout
```
PUT /layout/checkout/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Description**: Creates a draft copy for editing. Original continues to play.

**Response**: `200 OK`

### Publish Layout
```
PUT /layout/publish/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `publishNow` (integer): Publish immediately? (0 or 1)
- `publishDate` (string): Scheduled publish date (Y-m-d H:i:s)

**Description**: Publishes a draft Layout, discarding the original.

**Response**: `200 OK`

### Discard Layout Draft
```
PUT /layout/discard/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Description**: Discards draft changes and restores the original.

**Response**: `200 OK`

### Add Full Screen Layout
```
POST /layout/fullscreen
```
**Form Data**:
- `id` (integer, required): Media or Playlist ID
- `type` (string, required): Type: "media" or "playlist"
- `resolutionId` (integer): Resolution ID (defaults to 1080p)
- `backgroundColor` (string): HEX color (default: #000000)
- `layoutDuration` (boolean): Use media duration for one loop?

**Response**: `201 Created`

---

## Regions

### Edit Region
```
PUT /region/{id}
```
**Path Parameters**:
- `id` (integer, required): The Region ID

**Form Data**:
- `width` (integer): Width (default: 250)
- `height` (integer): Height
- `top` (integer): Top coordinate
- `left` (integer): Left coordinate
- `zIndex` (integer): Layer number
- `transitionType` (string): Transition type code
- `transitionDuration` (integer): Transition duration (ms)
- `transitionDirection` (string): Transition direction
- `loop` (integer, required): Loop single media? (0 or 1)

**Response**: `200 OK`

### Add Region to Layout
```
POST /region/{id}
```
**Path Parameters**:
- `id` (integer, required): The Layout ID

**Form Data**:
- `type` (string): Region type: zone, frame, playlist, canvas (default: frame)
- `width` (integer): Width (default: 250)
- `height` (integer): Height
- `top` (integer): Top coordinate
- `left` (integer): Left coordinate

**Response**: `201 Created`

### Delete Region
```
DELETE /region/{regionId}
```
**Path Parameters**:
- `regionId` (integer, required): The Region ID

**Response**: `204 No Content`

### Position All Regions
```
PUT /region/position/all/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `regions` (array[string], required): Array of JSON objects with regionId, top, left, width, height

**Example**:
```json
[
  "{\"regionId\":1,\"top\":0,\"left\":0,\"width\":960,\"height\":540}",
  "{\"regionId\":2,\"top\":0,\"left\":960,\"width\":960,\"height\":540}"
]
```

**Response**: `200 OK`

### Save Drawer
```
PUT /region/drawer/{id}
```
**Path Parameters**:
- `id` (integer, required): The Drawer ID

**Form Data**:
- `width` (integer): Width (default: 250)
- `height` (integer): Height

**Response**: `200 OK`

### Add Drawer Region
```
POST /region/drawer/{id}
```
**Path Parameters**:
- `id` (integer, required): The Layout ID

**Description**: Adds an interactive drawer region to a Layout.

**Response**: `201 Created`

---

## Playlists

### Search Playlists
```
GET /playlist
```
**Query Parameters**:
- `playlistId` (integer): Filter by Playlist ID
- `name` (string): Filter by partial name
- `userId` (integer): Filter by user ID
- `tags` (string): Filter by tags (comma-separated)
- `exactTags` (integer): Exact tag match? (0 or 1)
- `logicalOperator` (string): Tag operator (AND or OR)
- `ownerUserGroupId` (integer): Filter by user group
- `embed` (string): Embed data (widgets, permissions, tags)
- `folderId` (integer): Filter by Folder ID

**Response**: `200 OK`
```json
[
  {
    "playlistId": 1,
    "ownerId": 1,
    "name": "Main Playlist",
    "regionId": 0,
    "isDynamic": 0,
    "filterMediaName": "",
    "filterMediaNameLogicalOperator": "AND",
    "filterMediaTags": "",
    "filterExactTags": 0,
    "filterMediaTagsLogicalOperator": "AND",
    "filterFolderId": 0,
    "maxNumberOfItems": 0,
    "createdDt": "2025-11-01 09:00:00",
    "modifiedDt": "2025-11-15 10:00:00",
    "duration": 120,
    "requiresDurationUpdate": 0,
    "enableStat": "Inherit",
    "tags": [],
    "widgets": [],
    "permissions": [],
    "folderId": 1,
    "permissionsFolderId": 1
  }
]
```

### Add Playlist
```
POST /playlist
```
**Form Data**:
- `name` (string, required): Playlist name
- `tags` (string): Comma-separated tags
- `isDynamic` (integer, required): Dynamic playlist? (0 or 1)
- `filterMediaName` (string): Media name filter
- `logicalOperatorName` (string): Name filter operator (AND or OR)
- `filterMediaTag` (string): Media tag filter
- `exactTags` (integer): Exact tag match? (0 or 1)
- `logicalOperator` (string): Tag filter operator (AND or OR)
- `maxNumberOfItems` (integer): Max items for dynamic playlists
- `folderId` (integer): Folder ID

**Response**: `201 Created`

### Edit Playlist
```
PUT /playlist/{playlistId}
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Form Data**: Same as Add Playlist

**Response**: `204 No Content`

### Delete Playlist
```
DELETE /playlist/{playlistId}
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Response**: `204 No Content`

### Copy Playlist
```
POST /playlist/copy/{playlistId}
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Form Data**:
- `name` (string, required): Name for new Playlist
- `copyMediaFiles` (integer, required): Copy media files? (0 or 1)

**Response**: `201 Created`

### Assign Library Media to Playlist
```
POST /playlist/library/assign/{playlistId}
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Form Data**:
- `media` (array[integer], required): Array of Media IDs
- `duration` (integer): Optional duration for all media (seconds)
- `useDuration` (integer): Enable useDuration? (0 or 1)
- `displayOrder` (integer): Position in list (starting position if multiple items)

**Response**: `200 OK`

### Order Playlist Widgets
```
POST /playlist/order/{playlistId}
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Form Data**:
- `widgets` (array, required): Array of objects with widgetId and position

**Example**:
```json
[
  {"widgetId": 1, "position": 1},
  {"widgetId": 2, "position": 2},
  {"widgetId": 3, "position": 3}
]
```

**Response**: `200 OK`

### Get Playlist Usage Report
```
GET /playlist/usage/{playlistId}
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Response**: `200 OK`

### Get Playlist Usage Report (Layouts)
```
GET /playlist/usage/layouts/{playlistId}
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Response**: `200 OK`

### Enable Playlist Statistics
```
PUT /playlist/setenablestat/{playlistId}
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Form Data**:
- `enableStat` (string, required): "On", "Off", or "Inherit"

**Response**: `204 No Content`

### Select Folder for Playlist
```
PUT /playlist/{id}/selectfolder
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Form Data**:
- `folderId` (integer): Folder ID

**Response**: `204 No Content`

### Convert Playlist to Global
```
POST /playlist/{id}/convert
```
**Path Parameters**:
- `playlistId` (integer, required): The Playlist ID

**Form Data**:
- `name` (string): Optional name for global Playlist

**Description**: Creates a global playlist from an inline editor Playlist and assigns it via sub-playlist widget.

**Response**: `201 Created`

---

## Widgets

### Add Widget to Playlist
```
POST /playlist/widget/{type}/{playlistId}
```
**Path Parameters**:
- `type` (string, required): Widget type (e.g., text, image, video)
- `playlistId` (integer, required): The Playlist ID

**Form Data**:
- `displayOrder` (integer): Position in list
- `templateId` (string): Template ID if module has dataType

**Response**: `201 Created`

### Edit Widget
```
PUT /playlist/widget/{id}
```
**Path Parameters**:
- `id` (string, required): The Widget ID

**Form Data**:
- `useDuration` (integer): Use custom duration? (0 or 1)
- `duration` (integer): Duration in seconds
- `name` (string): Optional widget name
- `enableStat` (string): Statistics: On, Off, Inherit
- `isRepeatData` (integer): Repeat data to meet item count? (0 or 1)
- `showFallback` (string): Fallback mode: never, always, empty, error
- `properties` (integer): Module-specific properties

**Response**: `204 No Content`

### Delete Widget
```
DELETE /playlist/widget/{widgetId}
```
**Path Parameters**:
- `widgetId` (integer, required): The Widget ID

**Response**: `200 OK`

### Add Widget Transition
```
PUT /playlist/widget/transition/{type}/{widgetId}
```
**Path Parameters**:
- `type` (string, required): Transition type: "in" or "out"
- `widgetId` (integer, required): The Widget ID

**Form Data**:
- `transitionType` (string, required): fly, fadeIn, fadeOut
- `transitionDuration` (integer): Duration in milliseconds
- `transitionDirection` (integer): Direction: N, NE, E, SE, S, SW, W, NW

**Response**: `201 Created`

### Add/Edit Widget Audio
```
PUT /playlist/widget/{widgetId}/audio
```
**Path Parameters**:
- `widgetId` (integer, required): The Widget ID

**Form Data**:
- `mediaId` (integer): Audio file Media ID
- `volume` (integer): Volume percentage (0-100)
- `loop` (integer): Loop audio? (0 or 1)

**Response**: `200 OK`

### Delete Widget Audio
```
DELETE /playlist/widget/{widgetId}/audio
```
**Path Parameters**:
- `widgetId` (integer, required): The Widget ID

**Response**: `200 OK`

### Set Widget From/To Dates
```
PUT /playlist/widget/{widgetId}/expiry
```
**Path Parameters**:
- `widgetId` (integer, required): The Widget ID

**Form Data**:
- `fromDt` (string): Start date (Y-m-d H:i:s)
- `toDt` (string): End date (Y-m-d H:i:s)
- `deleteOnExpiry` (integer): Auto-delete on expiry? (0 or 1)

**Response**: `200 OK`

### Set Widget Target Region
```
PUT /playlist/widget/{widgetId}/region
```
**Path Parameters**:
- `widgetId` (integer, required): The Widget ID

**Form Data**:
- `targetRegionId` (string, required): Target Region ID (for Drawer widgets)

**Response**: `204 No Content`

### Save Widget Elements
```
PUT /playlist/widget/{widgetId}/elements
```
**Path Parameters**:
- `widgetId` (integer, required): The Widget ID

**Body** (JSON):
```json
{
  "elements": "JSON string representing widget elements"
}
```

**Response**: `204 No Content`

### Set Widget DataType
```
PUT /playlist/widget/{widgetId}/dataType
```
**Path Parameters**:
- `widgetId` (integer, required): The Widget ID

**Body** (JSON):
```json
{
  "dataType": "JSON representation of dataType"
}
```

**Response**: `200 OK`

### Get Widget Data
```
GET /playlist/widget/data/{id}
```
**Path Parameters**:
- `id` (integer, required): The Widget ID

**Response**: `201 Created`
```json
[
  {
    "id": 1,
    "widgetId": 5,
    "data": ["column1value", "column2value"],
    "displayOrder": 1,
    "createdDt": "2025-11-22 10:00:00",
    "modifiedDt": "2025-11-22 10:05:00"
  }
]
```

### Add Data to Widget
```
POST /playlist/widget/data/{id}
```
**Path Parameters**:
- `id` (integer, required): The Widget ID

**Form Data**:
- `data` (string, required): JSON formatted data item
- `displayOrder` (integer): Position in data list

**Response**: `201 Created`

### Edit Widget Data
```
PUT /playlist/widget/data/{id}/{dataId}
```
**Path Parameters**:
- `id` (integer, required): The Widget ID
- `dataId` (integer, required): The Data ID

**Form Data**:
- `data` (string, required): JSON formatted data item
- `displayOrder` (integer): Position in data list

**Response**: `204 No Content`

### Delete Widget Data
```
DELETE /playlist/widget/data/{id}/{dataId}
```
**Path Parameters**:
- `id` (integer, required): The Widget ID
- `dataId` (integer, required): The Data ID

**Response**: `204 No Content`

### Update Widget Data Order
```
POST /playlist/widget/data/{id}/order
```
**Path Parameters**:
- `id` (integer, required): The Widget ID
- `dataId` (integer, required): The Data ID

**Body** (JSON array):
```json
[
  {"dataId": 1, "position": 1},
  {"dataId": 2, "position": 2}
]
```

**Response**: `204 No Content`

---

## Campaigns

### Search Campaigns
```
GET /campaign
```
**Query Parameters**:
- `campaignId` (integer): Filter by Campaign ID
- `name` (string): Filter by name
- `tags` (string): Filter by tags
- `layoutId` (integer): Filter by Layout ID
- `retired` (integer): Filter by retired flag
- `totalDuration` (integer): Filter by duration

**Response**: `200 OK`

### Add Campaign
```
POST /campaign
```
**Form Data**:
- `name` (string, required): Campaign name
- `type` (string): Campaign type: list, ad, playlist, media
- `folderId` (integer): Folder ID

**Response**: `201 Created`

### Edit Campaign
```
PUT /campaign/{campaignId}
```
**Path Parameters**:
- `campaignId` (integer, required): The Campaign ID

**Form Data**:
- `name` (string, required): Campaign name
- `type` (string): Campaign type
- `folderId` (integer): Folder ID

**Response**: `200 OK`

### Delete Campaign
```
DELETE /campaign/{campaignId}
```
**Path Parameters**:
- `campaignId` (integer, required): The Campaign ID

**Response**: `204 No Content`

### Assign Layout to Campaign
```
POST /campaign/layout/assign/{campaignId}
```
**Path Parameters**:
- `campaignId` (integer, required): The Campaign ID

**Form Data**:
- `layoutId` (array[integer], required): Array of Layout IDs
- `displayOrder` (integer): Display order

**Response**: `200 OK`

### Remove Layout from Campaign
```
DELETE /campaign/layout/remove/{campaignId}
```
**Path Parameters**:
- `campaignId` (integer, required): The Campaign ID

**Form Data**:
- `layoutId` (array[integer], required): Array of Layout IDs to remove

**Response**: `200 OK`

---

## Templates

### Search Templates
```
GET /template
```
**Query Parameters**:
- `templateId` (integer): Filter by Template ID
- `tags` (string): Filter by tags
- `template` (string): Filter by name

**Response**: `200 OK`

### Add Template
```
POST /template
```
**Form Data**:
- `name` (string, required): Template name
- `tags` (string): Comma-separated tags

**Response**: `201 Created`

### Search All Templates
```
GET /template/search
```
**Description**: Returns all available templates including system templates.

**Response**: `200 OK`

### Create Template from Layout
```
POST /template/{layoutId}
```
**Path Parameters**:
- `layoutId` (integer, required): The Layout ID

**Form Data**:
- `name` (string, required): Template name
- `tags` (string): Tags
- `description` (string): Description
- `includeWidgets` (integer): Include widgets? (0 or 1)

**Response**: `201 Created`

---

## Resolutions

### Search Resolutions
```
GET /resolution
```
**Query Parameters**:
- `resolutionId` (integer): Filter by Resolution ID
- `resolution` (string): Filter by resolution name
- `enabled` (integer): Filter by enabled flag

**Response**: `200 OK`
```json
[
  {
    "resolutionId": 1,
    "resolution": "1080p HD Landscape",
    "width": 1920,
    "height": 1080,
    "designer_width": 1920,
    "designer_height": 1080,
    "enabled": 1,
    "userId": 1
  }
]
```

### Add Resolution
```
POST /resolution
```
**Form Data**:
- `resolution` (string, required): Resolution name
- `width` (integer, required): Width in pixels
- `height` (integer, required): Height in pixels

**Response**: `201 Created`

### Edit Resolution
```
PUT /resolution/{resolutionId}
```
**Path Parameters**:
- `resolutionId` (integer, required): The Resolution ID

**Form Data**:
- `resolution` (string, required): Resolution name
- `width` (integer, required): Width
- `height` (integer, required): Height
- `enabled` (integer): Enabled flag (0 or 1)

**Response**: `200 OK`

### Delete Resolution
```
DELETE /resolution/{resolutionId}
```
**Path Parameters**:
- `resolutionId` (integer, required): The Resolution ID

**Response**: `204 No Content`

---

## Library (Media)

### Search Media
```
GET /library
```
**Query Parameters**:
- `mediaId` (integer): Filter by Media ID
- `media` (string): Filter by Media name
- `type` (string): Filter by Media type
- `ownerId` (integer): Filter by owner ID
- `retired` (integer): Filter by retired flag
- `tags` (string): Filter by tags (comma-separated)
- `exactTags` (integer): Exact tag match? (0 or 1)
- `logicalOperator` (string): AND or OR
- `duration` (string): Filter format: "operator|value" (e.g., "gt|30")
- `fileSize` (string): Filter format: "operator|value"
- `ownerUserGroupId` (integer): Filter by user group
- `folderId` (integer): Filter by Folder ID
- `isReturnPublicUrls` (integer): Return public URLs? (0 or 1)

**Operators**: lt (less than), gt (greater than), lte, gte

**Response**: `200 OK`
```json
[
  {
    "mediaId": 1,
    "ownerId": 1,
    "parentId": 0,
    "name": "Company Logo",
    "mediaType": "image",
    "storedAs": "1.png",
    "fileName": "logo.png",
    "tags": [],
    "fileSize": 45632,
    "duration": 10,
    "valid": 1,
    "moduleSystemFile": 0,
    "expires": 0,
    "retired": 0,
    "isEdited": 0,
    "md5": "abc123def456",
    "owner": "admin",
    "groupsWithPermissions": "Administrators",
    "released": 1,
    "apiRef": null,
    "createdDt": "2025-11-01 09:00:00",
    "modifiedDt": "2025-11-15 10:00:00",
    "enableStat": "Inherit",
    "orientation": "landscape",
    "width": 1920,
    "height": 1080,
    "folderId": 1,
    "permissionsFolderId": 1
  }
]
```

### Upload Media
```
POST /library
```
**Form Data**:
- `files` (file, required): The uploaded file
- `name` (string): Optional Media name
- `oldMediaId` (integer): Replace existing media ID
- `updateInLayouts` (integer): Update in all layouts? (0 or 1)
- `deleteOldRevisions` (integer): Delete old revisions? (0 or 1)
- `tags` (string): Comma-separated tags
- `expires` (string): Expiry date (Y-m-d H:i:s)
- `playlistId` (integer): Add to playlist ID
- `widgetFromDt` (string): Widget start date (Y-m-d H:i:s)
- `widgetToDt` (string): Widget end date (Y-m-d H:i:s)
- `deleteOnExpiry` (integer): Delete widget on expiry? (0 or 1)
- `applyToMedia` (integer): Apply widgetFromDt to media? (0 or 1)
- `folderId` (integer): Folder ID

**Response**: `200 OK`

### Search All Library
```
GET /library/search
```
**Description**: Search all library files from local storage and connectors.

**Response**: `200 OK`

### Edit Media
```
PUT /library/{mediaId}
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Form Data**:
- `name` (string, required): Media name
- `duration` (integer, required): Duration in seconds
- `retired` (integer, required): Retired flag (0 or 1)
- `tags` (string): Comma-separated tags
- `updateInLayouts` (integer): Update in layouts? (0 or 1)
- `expires` (string): Expiry date (Y-m-d H:i:s)
- `folderId` (integer): Folder ID

**Response**: `200 OK`

### Delete Media
```
DELETE /library/{mediaId}
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Form Data**:
- `forceDelete` (integer, required): Force delete? (0 or 1)
- `purge` (integer): Add to purge list? (0 or 1)

**Response**: `204 No Content`

### Tidy Library
```
DELETE /library/tidy
```
**Form Data**:
- `tidyGenericFiles` (integer): Delete generic files? (0 or 1)

**Description**: Routine cleanup of unused library files.

**Response**: `200 OK`

### Download Media
```
GET /library/download/{mediaId}/{type}
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID
- `type` (string, required): Module type

**Response**: `200 OK` (Binary file)
**Headers**:
- `X-Sendfile`: Apache send file header
- `X-Accel-Redirect`: nginx send file header

### Download Thumbnail
```
GET /library/thumbnail/{mediaId}
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Response**: `200 OK` (Image file)

### Tag Media
```
POST /library/{mediaId}/tag
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Form Data**:
- `tag` (array[string], required): Array of tags

**Response**: `200 OK`

### Untag Media
```
POST /library/{mediaId}/untag
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Form Data**:
- `tag` (array[string], required): Array of tags to remove

**Response**: `200 OK`

### Get Media Usage Report
```
GET /library/usage/{mediaId}
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Response**: `200 OK`

### Get Media Usage Report (Layouts)
```
GET /library/usage/layouts/{mediaId}
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Response**: `200 OK`

### Copy Media
```
POST /library/copy/{mediaId}
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Form Data**:
- `name` (string, required): Name for new media
- `tags` (string): Tags for new media

**Response**: `201 Created`

### Check Media Usage
```
GET /library/{mediaId}/isused/
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Description**: Checks if media is being used in layouts/playlists.

**Response**: `200 OK`

### Upload Media from URL
```
POST /library/uploadUrl
```
**Form Data**:
- `url` (string, required): URL to media file
- `type` (string, required): Media type (image, video, etc.)
- `extension` (string): File extension
- `enableStat` (string): On, Off, or Inherit
- `optionalName` (string): Optional media name
- `expires` (string): Expiry date (Y-m-d H:i:s)
- `folderId` (integer): Folder ID

**Response**: `201 Created`

### Select Folder for Media
```
PUT /library/{id}/selectfolder
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Form Data**:
- `folderId` (integer): Folder ID

**Response**: `200 OK`

### Enable Media Statistics
```
PUT /library/setenablestat/{mediaId}
```
**Path Parameters**:
- `mediaId` (integer, required): The Media ID

**Form Data**:
- `enableStat` (string, required): On, Off, or Inherit

**Response**: `204 No Content`

---

## Display Management

### Search Displays
```
GET /display
```
**Query Parameters**:
- `displayId` (integer): Filter by Display ID
- `display` (string): Filter by Display name
- `macAddress` (string): Filter by MAC address
- `displayGroupId` (integer): Filter by Display Group
- `authorized` (integer): Filter by authorized flag
- `tags` (string): Filter by tags

**Response**: `200 OK`

### Edit Display
```
PUT /display/{displayId}
```
**Path Parameters**:
- `displayId` (integer, required): The Display ID

**Form Data**:
- `display` (string, required): Display name
- `description` (string): Description
- `tags` (string): Tags
- `defaultLayoutId` (integer): Default Layout ID
- `licensed` (integer): Licensed flag
- `license` (string): License key
- `incSchedule` (integer): Include schedule? (0 or 1)
- `emailAlert` (integer): Email alerts? (0 or 1)
- `alertTimeout` (integer): Alert timeout (seconds)

**Response**: `200 OK`

### Delete Display
```
DELETE /display/{displayId}
```
**Path Parameters**:
- `displayId` (integer, required): The Display ID

**Response**: `204 No Content`

### Request Screenshot
```
PUT /display/requestscreenshot/{displayId}
```
**Path Parameters**:
- `displayId` (integer, required): The Display ID

**Response**: `200 OK`

### Wake on LAN
```
POST /display/wol/{displayId}
```
**Path Parameters**:
- `displayId` (integer, required): The Display ID

**Description**: Sends Wake on LAN command to display.

**Response**: `200 OK`

### Toggle Display Authorization
```
PUT /display/authorise/{displayId}
```
**Path Parameters**:
- `displayId` (integer, required): The Display ID

**Form Data**:
- `authorised` (integer, required): Authorized flag (0 or 1)

**Response**: `200 OK`

### Set Default Layout
```
PUT /display/defaultlayout/{displayId}
```
**Path Parameters**:
- `displayId` (integer, required): The Display ID

**Form Data**:
- `defaultLayoutId` (integer, required): Layout ID

**Response**: `200 OK`

### Check Display License
```
PUT /display/licenceCheck/{displayId}
```
**Path Parameters**:
- `displayId` (integer, required): The Display ID

**Response**: `200 OK`

### Get Display Status
```
GET /display/status/{id}
```
**Path Parameters**:
- `id` (integer, required): The Display ID

**Response**: `200 OK`

### Purge All Display Data
```
PUT /display/purgeAll/{displayId}
```
**Path Parameters**:
- `displayId` (integer, required): The Display ID

**Description**: Purges all cached data on the display.

**Response**: `200 OK`

---

## Display Groups

### Search Display Groups
```
GET /displaygroup
```
**Query Parameters**:
- `displayGroupId` (integer): Filter by Group ID
- `displayGroup` (string): Filter by Group name
- `isDisplaySpecific` (integer): Display-specific groups?
- `forSchedule` (integer): For scheduling?
- `nested` (integer): Include nested groups?

**Response**: `200 OK`

### Add Display Group
```
POST /displaygroup
```
**Form Data**:
- `displayGroup` (string, required): Group name
- `description` (string): Description
- `isDynamic` (integer): Dynamic group? (0 or 1)
- `dynamicCriteria` (string): Dynamic criteria
- `folderId` (integer): Folder ID

**Response**: `201 Created`

### Edit Display Group
```
PUT /displaygroup/{displayGroupId}
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**: Same as Add Display Group

**Response**: `200 OK`

### Delete Display Group
```
DELETE /displaygroup/{displayGroupId}
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Response**: `204 No Content`

### Assign Display to Group
```
POST /displaygroup/{displayGroupId}/display/assign
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `displayId` (array[integer], required): Array of Display IDs

**Response**: `200 OK`

### Unassign Display from Group
```
POST /displaygroup/{displayGroupId}/display/unassign
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `displayId` (array[integer], required): Array of Display IDs

**Response**: `200 OK`

### Assign Display Group to Group
```
POST /displaygroup/{displayGroupId}/displayGroup/assign
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `displayGroupId` (array[integer], required): Array of Display Group IDs

**Response**: `200 OK`

### Unassign Display Group from Group
```
POST /displaygroup/{displayGroupId}/displayGroup/unassign
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `displayGroupId` (array[integer], required): Array of Display Group IDs

**Response**: `200 OK`

### Assign Media to Display Group
```
POST /displaygroup/{displayGroupId}/media/assign
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `mediaId` (array[integer], required): Array of Media IDs

**Response**: `200 OK`

### Unassign Media from Display Group
```
POST /displaygroup/{displayGroupId}/media/unassign
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `mediaId` (array[integer], required): Array of Media IDs

**Response**: `200 OK`

### Assign Layout to Display Group
```
POST /displaygroup/{displayGroupId}/layout/assign
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `layoutId` (array[integer], required): Array of Layout IDs

**Response**: `200 OK`

### Unassign Layout from Display Group
```
POST /displaygroup/{displayGroupId}/layout/unassign
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `layoutId` (array[integer], required): Array of Layout IDs

**Response**: `200 OK`

### Action: Collect Now
```
POST /displaygroup/{displayGroupId}/action/collectNow
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Response**: `200 OK`

### Action: Clear Stats and Logs
```
POST /displaygroup/{displayGroupId}/action/clearStatsAndLogs
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Response**: `200 OK`

### Action: Change Layout
```
POST /displaygroup/{displayGroupId}/action/changeLayout
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `layoutId` (integer, required): Layout ID
- `duration` (integer): Duration in seconds
- `downloadRequired` (integer): Download required? (0 or 1)

**Response**: `200 OK`

### Action: Revert to Schedule
```
POST /displaygroup/{displayGroupId}/action/revertToSchedule
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Response**: `200 OK`

### Action: Overlay Layout
```
POST /displaygroup/{displayGroupId}/action/overlayLayout
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `layoutId` (integer, required): Layout ID
- `duration` (integer): Duration in seconds
- `downloadRequired` (integer): Download required? (0 or 1)

**Response**: `200 OK`

### Action: Send Command
```
POST /displaygroup/{displayGroupId}/action/command
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `commandId` (integer, required): Command ID

**Response**: `200 OK`

### Action: Trigger Webhook
```
POST /displaygroup/{displayGroupId}/action/triggerWebhook
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `triggerCode` (string, required): Webhook trigger code

**Response**: `200 OK`

### Copy Display Group
```
POST /displaygroup/{displayGroupId}/copy
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `displayGroup` (string, required): Name for new group
- `description` (string): Description
- `copyMembers` (integer): Copy members? (0 or 1)

**Response**: `201 Created`

### Select Folder for Display Group
```
PUT /displaygroup/{id}/selectfolder
```
**Path Parameters**:
- `displayGroupId` (integer, required): The Display Group ID

**Form Data**:
- `folderId` (integer): Folder ID

**Response**: `204 No Content`

### Push Criteria Update
```
POST /displaygroup/criteria[/{displayGroupId}]
```
**Path Parameters**:
- `displayGroupId` (integer, optional): The Display Group ID

**Form Data**:
- `criteria` (string, required): JSON criteria

**Response**: `200 OK`

---

## Display Profiles

### Search Display Profiles
```
GET /displayprofile
```
**Query Parameters**:
- `displayProfileId` (integer): Filter by Profile ID
- `displayProfile` (string): Filter by Profile name
- `type` (string): Filter by type

**Response**: `200 OK`

### Add Display Profile
```
POST /displayprofile
```
**Form Data**:
- `name` (string, required): Profile name
- `type` (string, required): Profile type
- `isDefault` (integer): Is default? (0 or 1)

**Response**: `201 Created`

### Edit Display Profile
```
PUT /displayprofile/{displayProfileId}
```
**Path Parameters**:
- `displayProfileId` (integer, required): The Display Profile ID

**Form Data**:
- `name` (string, required): Profile name
- `type` (string, required): Profile type
- `isDefault` (integer): Is default? (0 or 1)

**Response**: `200 OK`

### Delete Display Profile
```
DELETE /displayprofile/{displayProfileId}
```
**Path Parameters**:
- `displayProfileId` (integer, required): The Display Profile ID

**Response**: `204 No Content`

### Copy Display Profile
```
POST /displayprofile/{displayProfileId}/copy
```
**Path Parameters**:
- `displayProfileId` (integer, required): The Display Profile ID

**Form Data**:
- `name` (string, required): Name for new profile

**Response**: `201 Created`

---

## DataSets

### Search DataSets
```
GET /dataset
```
**Query Parameters**:
- `dataSetId` (integer): Filter by DataSet ID
- `dataSet` (string): Filter by DataSet name
- `code` (string): Filter by code
- `userId` (integer): Filter by owner ID

**Response**: `200 OK`

### Add DataSet
```
POST /dataset
```
**Form Data**:
- `dataSet` (string, required): DataSet name
- `description` (string): Description
- `code` (string): Code identifier
- `isRemote` (integer): Is remote? (0 or 1)
- `isRealTime` (integer): Is real-time? (0 or 1)
- `folderId` (integer): Folder ID

**Response**: `201 Created`

### Edit DataSet
```
PUT /dataset/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Form Data**: Same as Add DataSet

**Response**: `200 OK`

### Delete DataSet
```
DELETE /dataset/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Response**: `204 No Content`

### Edit DataSet Data Connector
```
PUT /dataset/dataConnector/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Form Data**:
- `dataConnectorSource` (string): Connector source
- `method` (string): GET or POST
- `uri` (string): URI to fetch data
- `postData` (string): POST data
- `authentication` (string): none, digest, basic
- `username` (string): Username
- `password` (string): Password
- `refreshRate` (integer): Refresh rate (seconds)
- `clearRate` (integer): Clear rate (seconds)

**Response**: `200 OK`

### Copy DataSet
```
POST /dataset/copy/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Form Data**:
- `dataSet` (string, required): Name for new DataSet
- `description` (string): Description
- `code` (string): Code

**Response**: `201 Created`

### Import CSV to DataSet
```
POST /dataset/import/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Form Data**:
- `files` (file, required): CSV file
- `csvImport_0` (integer): Column mappings
- `overwrite` (integer): Overwrite existing? (0 or 1)
- `ignorefirstrow` (integer): Ignore first row? (0 or 1)

**Response**: `200 OK`

### Import JSON to DataSet
```
POST /dataset/importjson/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Body** (JSON):
```json
{
  "uniqueKeys": ["columnName"],
  "truncate": "0",
  "rows": [
    {"columnName": "value"}
  ]
}
```

**Response**: `200 OK`

### Export DataSet to CSV
```
GET /dataset/export/csv/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Response**: `200 OK` (CSV file)

### Search DataSet Columns
```
GET /dataset/{dataSetId}/column
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Response**: `200 OK`

### Add DataSet Column
```
POST /dataset/{dataSetId}/column
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Form Data**:
- `heading` (string, required): Column heading
- `dataTypeId` (integer, required): Data type ID
- `dataSetColumnTypeId` (integer, required): Column type ID
- `listContent` (string): List content for dropdowns
- `columnOrder` (integer): Display order
- `formula` (string): MySQL formula

**Response**: `201 Created`

### Edit DataSet Column
```
PUT /dataset/{dataSetId}/column/{dataSetColumnId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID
- `dataSetColumnId` (integer, required): The Column ID

**Form Data**: Same as Add DataSet Column

**Response**: `200 OK`

### Delete DataSet Column
```
DELETE /dataset/{dataSetId}/column/{dataSetColumnId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID
- `dataSetColumnId` (integer, required): The Column ID

**Response**: `204 No Content`

### Get DataSet Data
```
GET /dataset/data/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Response**: `200 OK`

### Add DataSet Row
```
POST /dataset/data/{dataSetId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Form Data**:
- `dataSetColumnId_{id}` (string): Value for each column

**Response**: `201 Created`

### Edit DataSet Row
```
PUT /dataset/data/{dataSetId}/{rowId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID
- `rowId` (integer, required): The Row ID

**Form Data**:
- `dataSetColumnId_{id}` (string): Value for each column

**Response**: `200 OK`

### Delete DataSet Row
```
DELETE /dataset/data/{dataSetId}/{rowId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID
- `rowId` (integer, required): The Row ID

**Response**: `204 No Content`

### Search DataSet RSS
```
GET /dataset/{dataSetId}/rss
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Response**: `200 OK`

### Add DataSet RSS
```
POST /dataset/{dataSetId}/rss
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Form Data**:
- `title` (string, required): RSS title
- `author` (string): Author
- `titleColumnId` (integer): Title column ID
- `summaryColumnId` (integer): Summary column ID
- `contentColumnId` (integer): Content column ID
- `publishedDateColumnId` (integer): Published date column ID

**Response**: `201 Created`

### Edit DataSet RSS
```
PUT /dataset/{dataSetId}/rss/{rssId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID
- `rssId` (integer, required): The RSS ID

**Form Data**: Same as Add DataSet RSS

**Response**: `200 OK`

### Delete DataSet RSS
```
DELETE /dataset/{dataSetId}/rss/{rssId}
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID
- `rssId` (integer, required): The RSS ID

**Response**: `204 No Content`

### Select Folder for DataSet
```
PUT /dataset/{id}/selectfolder
```
**Path Parameters**:
- `dataSetId` (integer, required): The DataSet ID

**Form Data**:
- `folderId` (integer): Folder ID

**Response**: `204 No Content`

---

## Folders

### Search Folders
```
GET /folders
```
**Query Parameters**:
- `folderId` (integer): Filter by Folder ID
- `text` (string): Filter by folder name

**Response**: `200 OK`
```json
[
  {
    "id": 1,
    "type": "root",
    "text": "My Folder",
    "parentId": 0,
    "isRoot": 1,
    "children": []
  }
]
```

### Add Folder
```
POST /folders
```
**Form Data**:
- `text` (string, required): Folder name
- `parentId` (integer): Parent folder ID

**Response**: `201 Created`

### Edit Folder
```
PUT /folders/{folderId}
```
**Path Parameters**:
- `folderId` (integer, required): The Folder ID

**Form Data**:
- `text` (string, required): Folder name

**Response**: `200 OK`

### Delete Folder
```
DELETE /folders/{folderId}
```
**Path Parameters**:
- `folderId` (integer, required): The Folder ID

**Response**: `204 No Content`

---

## Statistics

### Get Statistics
```
GET /stats
```
**Query Parameters**:
- `type` (string): Stats type (layout, media, widget)
- `fromDt` (string): From date (Y-m-d H:i:s)
- `toDt` (string): To date (Y-m-d H:i:s)
- `displayId` (integer): Filter by Display ID
- `layoutId` (integer): Filter by Layout ID
- `mediaId` (integer): Filter by Media ID

**Response**: `200 OK`

### Get Export Stats Count
```
GET /stats/getExportStatsCount
```
**Query Parameters**: Same as Get Statistics

**Response**: `200 OK`
```json
{
  "count": 1500
}
```

### Get Time Disconnected
```
GET /stats/timeDisconnected
```
**Query Parameters**:
- `fromDt` (string): From date (Y-m-d H:i:s)
- `toDt` (string): To date (Y-m-d H:i:s)
- `displayId` (integer): Filter by Display ID

**Response**: `200 OK`

---

## Users

### Get Current User
```
GET /user/me
```
**Description**: Returns authenticated user's details.

**Response**: `200 OK`
```json
{
  "userId": 1,
  "userName": "admin",
  "userTypeId": 1,
  "loggedIn": 1,
  "email": "admin@example.com",
  "homePageId": 1,
  "twoFactorTypeId": 0,
  "retired": 0,
  "firstName": "Admin",
  "lastName": "User",
  "phone": "",
  "ref1": "",
  "ref2": "",
  "ref3": "",
  "ref4": "",
  "ref5": "",
  "libraryQuota": 0,
  "isPasswordChangeRequired": 0,
  "isSystemNotification": 1,
  "isDisplayNotification": 1
}
```

### Search Users
```
GET /user
```
**Query Parameters**:
- `userId` (integer): Filter by User ID
- `userName` (string): Filter by username
- `userTypeId` (integer): Filter by user type
- `retired` (integer): Filter by retired flag

**Response**: `200 OK`

### Add User
```
POST /user
```
**Form Data**:
- `userName` (string, required): Username
- `email` (string, required): Email address
- `userTypeId` (integer, required): User type ID
- `homePageId` (integer): Home page ID
- `libraryQuota` (integer): Library quota (KB)
- `password` (string): Password
- `groupId` (integer): Initial group ID
- `firstName` (string): First name
- `lastName` (string): Last name
- `phone` (string): Phone number
- `ref1` (string): Reference field 1
- `ref2` (string): Reference field 2
- `ref3` (string): Reference field 3
- `ref4` (string): Reference field 4
- `ref5` (string): Reference field 5

**Response**: `201 Created`

### Edit User
```
PUT /user/{userId}
```
**Path Parameters**:
- `userId` (integer, required): The User ID

**Form Data**: Same as Add User

**Response**: `200 OK`

### Delete User
```
DELETE /user/{userId}
```
**Path Parameters**:
- `userId` (integer, required): The User ID

**Response**: `204 No Content`

### Get User Permissions
```
GET /user/permissions/{entity}/{objectId}
```
**Path Parameters**:
- `entity` (string, required): Entity type (layout, media, displaygroup, etc.)
- `objectId` (integer, required): Object ID

**Response**: `200 OK`
```json
[
  {
    "permissionId": 1,
    "entityId": 1,
    "groupId": 1,
    "objectId": 5,
    "isUser": 0,
    "entity": "layout",
    "objectIdString": "5",
    "group": "Users",
    "view": 1,
    "edit": 1,
    "delete": 1,
    "modifyPermissions": 0
  }
]
```

### Set User Permissions
```
POST /user/permissions/{entity}/{objectId}
```
**Path Parameters**:
- `entity` (string, required): Entity type
- `objectId` (integer, required): Object ID

**Form Data**:
- `groupIds` (array, required): Array of permissions with groupId as key
  - `groupIds[1][view]` (integer): View permission (0 or 1)
  - `groupIds[1][edit]` (integer): Edit permission (0 or 1)
  - `groupIds[1][delete]` (integer): Delete permission (0 or 1)
- `ownerId` (integer): Change owner (optional)

**Response**: `204 No Content`

### Get Entity Permissions
```
GET /user/permissions/{entity}
```
**Path Parameters**:
- `entity` (string, required): Entity type

**Response**: `200 OK`

### Set Multiple Permissions
```
POST /user/permissions/{entity}/multiple
```
**Path Parameters**:
- `entity` (string, required): Entity type

**Form Data**:
- `objectIds` (array, required): Array of object IDs
- `groupIds` (array, required): Permission array

**Response**: `204 No Content`

### Get User Preferences
```
GET /user/pref
```
**Query Parameters**:
- `preference` (string): Specific preference name

**Response**: `200 OK`
```json
[
  {
    "option": "language",
    "value": "en_GB"
  },
  {
    "option": "timezone",
    "value": "UTC"
  }
]
```

### Save User Preferences (PUT)
```
PUT /user/pref
```
**Form Data**:
- `preference` (array, required): Array of preference objects

**Response**: `204 No Content`

### Save User Preferences (POST)
```
POST /user/pref
```
**Form Data**:
- `preference` (array, required): Array of preference objects

**Response**: `201 Created`

---

## User Groups

### Search User Groups
```
GET /group
```
**Query Parameters**:
- `userGroupId` (integer): Filter by Group ID
- `userGroup` (string): Filter by Group name

**Response**: `200 OK`

### Add User Group
```
POST /group
```
**Form Data**:
- `group` (string, required): Group name
- `libraryQuota` (integer): Library quota (KB)
- `isSystemNotification` (integer): System notifications? (0 or 1)
- `isDisplayNotification` (integer): Display notifications? (0 or 1)

**Response**: `201 Created`

### Edit User Group
```
PUT /group/{userGroupId}
```
**Path Parameters**:
- `userGroupId` (integer, required): The User Group ID

**Form Data**: Same as Add User Group

**Response**: `200 OK`

### Delete User Group
```
DELETE /group/{userGroupId}
```
**Path Parameters**:
- `userGroupId` (integer, required): The User Group ID

**Response**: `204 No Content`

### Assign User to Group
```
POST /group/members/assign/{userGroupId}
```
**Path Parameters**:
- `userGroupId` (integer, required): The User Group ID

**Form Data**:
- `userId` (array[integer], required): Array of User IDs

**Response**: `200 OK`

### Unassign User from Group
```
POST /group/members/unassign/{userGroupId}
```
**Path Parameters**:
- `userGroupId` (integer, required): The User Group ID

**Form Data**:
- `userId` (array[integer], required): Array of User IDs

**Response**: `200 OK`

### Copy User Group
```
POST /group/{userGroupId}/copy
```
**Path Parameters**:
- `userGroupId` (integer, required): The User Group ID

**Form Data**:
- `group` (string, required): Name for new group
- `copyMembers` (integer): Copy members? (0 or 1)

**Response**: `201 Created`

---

## Modules

### Search Modules
```
GET /module
```
**Query Parameters**:
- `moduleId` (integer): Filter by Module ID
- `name` (string): Filter by Module name
- `type` (string): Filter by Module type
- `enabled` (integer): Filter by enabled flag

**Response**: `200 OK`

### Get Module Properties
```
GET /module/properties/{id}
```
**Path Parameters**:
- `id` (string, required): Module ID or type

**Response**: `200 OK`
```json
{
  "properties": [
    {
      "id": "duration",
      "title": "Duration",
      "type": "number",
      "default": 10
    }
  ]
}
```

### Search Module Templates
```
GET /module/templates/{dataType}
```
**Path Parameters**:
- `dataType` (string, required): Data type

**Response**: `200 OK`

### Get Module Template Properties
```
GET /module/template/{dataType}/properties/{id}
```
**Path Parameters**:
- `dataType` (string, required): Data type
- `id` (string, required): Template ID

**Response**: `200 OK`

---

## Commands

### Search Commands
```
GET /command
```
**Query Parameters**:
- `commandId` (integer): Filter by Command ID
- `command` (string): Filter by Command name
- `code` (string): Filter by code

**Response**: `200 OK`

### Add Command
```
POST /command
```
**Form Data**:
- `command` (string, required): Command name
- `code` (string, required): Unique code
- `description` (string): Description
- `commandString` (string, required): Command string
- `validationString` (string): Validation string

**Response**: `201 Created`

### Edit Command
```
PUT /command/{commandId}
```
**Path Parameters**:
- `commandId` (integer, required): The Command ID

**Form Data**: Same as Add Command

**Response**: `200 OK`

### Delete Command
```
DELETE /command/{commandId}
```
**Path Parameters**:
- `commandId` (integer, required): The Command ID

**Response**: `204 No Content`

---

## Dayparting

### Search Dayparts
```
GET /daypart
```
**Query Parameters**:
- `dayPartId` (integer): Filter by Daypart ID
- `name` (string): Filter by name

**Response**: `200 OK`

### Add Daypart
```
POST /daypart
```
**Form Data**:
- `name` (string, required): Daypart name
- `description` (string): Description
- `startTime` (string, required): Start time (H:i:s)
- `endTime` (string, required): End time (H:i:s)
- `exceptions` (array): Exception dates

**Response**: `201 Created`

### Edit Daypart
```
PUT /daypart/{dayPartId}
```
**Path Parameters**:
- `dayPartId` (integer, required): The Daypart ID

**Form Data**: Same as Add Daypart

**Response**: `200 OK`

### Delete Daypart
```
DELETE /daypart/{dayPartId}
```
**Path Parameters**:
- `dayPartId` (integer, required): The Daypart ID

**Response**: `204 No Content`

---

## Player Software

### Edit Player Version
```
PUT /playersoftware/{versionId}
```
**Path Parameters**:
- `versionId` (integer, required): The Version ID

**Form Data**:
- `version` (string): Version number
- `type` (string): Player type
- `playerShowVersion` (string): Display version

**Response**: `200 OK`

### Delete Player Version
```
DELETE /playersoftware/{versionId}
```
**Path Parameters**:
- `versionId` (integer, required): The Version ID

**Response**: `204 No Content`

### Upload Player Software
```
POST /playersoftware
```
**Form Data**:
- `file` (file, required): Player software file
- `type` (string, required): Player type
- `version` (string, required): Version number

**Response**: `201 Created`

### Download Player Version
```
GET /playersoftware/download/{id}
```
**Path Parameters**:
- `id` (integer, required): The Version ID

**Response**: `200 OK` (Binary file)

---

## Tags

### Search Tags
```
GET /tag
```
**Query Parameters**:
- `tagId` (integer): Filter by Tag ID
- `tag` (string): Filter by Tag name
- `options` (string): Filter by Tag options

**Response**: `200 OK`
```json
[
  {
    "tagId": 1,
    "tag": "Important",
    "value": null,
    "options": []
  }
]
```

### Add Tag
```
POST /tag
```
**Form Data**:
- `tag` (string, required): Tag name
- `value` (string): Tag value
- `options` (array): Tag options

**Response**: `201 Created`

### Edit Tag
```
PUT /tag/{tagId}
```
**Path Parameters**:
- `tagId` (integer, required): The Tag ID

**Form Data**:
- `tag` (string, required): Tag name
- `value` (string): Tag value
- `options` (array): Tag options

**Response**: `200 OK`

### Delete Tag
```
DELETE /tag/{tagId}
```
**Path Parameters**:
- `tagId` (integer, required): The Tag ID

**Response**: `204 No Content`

---

## Menu Boards

**Note**: Menu Boards are a feature preview. Not recommended for production use.

### Search Menu Boards
```
GET /menuboards
```
**Query Parameters**:
- `menuId` (integer): Filter by Menu ID
- `name` (string): Filter by name

**Response**: `200 OK`

### Add Menu Board
```
POST /menuboard
```
**Form Data**:
- `name` (string, required): Menu Board name
- `description` (string): Description
- `folderId` (integer): Folder ID

**Response**: `201 Created`

### Edit Menu Board
```
PUT /menuboard/{menuId}
```
**Path Parameters**:
- `menuId` (integer, required): The Menu ID

**Form Data**: Same as Add Menu Board

**Response**: `200 OK`

### Delete Menu Board
```
DELETE /menuboard/{menuId}
```
**Path Parameters**:
- `menuId` (integer, required): The Menu ID

**Response**: `204 No Content`

### Select Folder for Menu Board
```
PUT /menuboard/{id}/selectfolder
```
**Path Parameters**:
- `menuId` (integer, required): The Menu ID

**Form Data**:
- `folderId` (integer): Folder ID

**Response**: `204 No Content`

### Search Menu Board Categories
```
GET /menuboard/{menuId}/categories
```
**Path Parameters**:
- `menuId` (integer, required): The Menu ID

**Response**: `200 OK`

### Add Menu Board Category
```
POST /menuboard/{menuId}/category
```
**Path Parameters**:
- `menuId` (integer, required): The Menu ID

**Form Data**:
- `name` (string, required): Category name
- `mediaId` (integer): Media ID for category image

**Response**: `201 Created`

### Edit Menu Board Category
```
PUT /menuboard/{menuCategoryId}/category
```
**Path Parameters**:
- `menuCategoryId` (integer, required): The Category ID

**Form Data**:
- `name` (string, required): Category name
- `mediaId` (integer): Media ID

**Response**: `200 OK`

### Delete Menu Board Category
```
DELETE /menuboard/{menuCategoryId}/category
```
**Path Parameters**:
- `menuCategoryId` (integer, required): The Category ID

**Response**: `204 No Content`

### Search Menu Board Products
```
GET /menuboard/{menuCategoryId}/products
```
**Path Parameters**:
- `menuCategoryId` (integer, required): The Category ID

**Response**: `200 OK`

### Add Menu Board Product
```
POST /menuboard/{menuCategoryId}/product
```
**Path Parameters**:
- `menuCategoryId` (integer, required): The Category ID

**Form Data**:
- `name` (string, required): Product name
- `description` (string): Description
- `price` (number): Price
- `mediaId` (integer): Media ID for product image
- `availability` (integer): Availability (0 or 1)

**Response**: `201 Created`

### Edit Menu Board Product
```
PUT /menuboard/{menuProductId}/product
```
**Path Parameters**:
- `menuProductId` (integer, required): The Product ID

**Form Data**: Same as Add Menu Board Product

**Response**: `200 OK`

### Delete Menu Board Product
```
DELETE /menuboard/{menuProductId}/product
```
**Path Parameters**:
- `menuProductId` (integer, required): The Product ID

**Response**: `204 No Content`

---

## Actions

### Search Actions
```
GET /action
```
**Query Parameters**:
- `actionId` (integer): Filter by Action ID
- `ownerId` (integer): Filter by owner ID

**Response**: `200 OK`

### Add Action
```
POST /action
```
**Form Data**:
- `actionType` (string, required): Action type
- `source` (string, required): Source (layout, region, widget)
- `sourceId` (integer, required): Source ID
- `target` (string, required): Target type
- `targetId` (integer, required): Target ID
- `triggerType` (string, required): Trigger type
- `triggerCode` (string): Trigger code

**Response**: `201 Created`

### Delete Action
```
DELETE /action/{actionId}
```
**Path Parameters**:
- `actionId` (integer, required): The Action ID

**Response**: `204 No Content`

---

## Fonts

### Search Fonts
```
GET /fonts
```
**Query Parameters**:
- `fontId` (integer): Filter by Font ID
- `name` (string): Filter by font name

**Response**: `200 OK`

### Upload Font
```
POST /fonts
```
**Form Data**:
- `files` (file, required): Font file (TTF, OTF, WOFF, WOFF2)
- `name` (string): Optional font name

**Response**: `201 Created`

### Get Font Details
```
GET /fonts/details/{id}
```
**Path Parameters**:
- `id` (integer, required): The Font ID

**Response**: `200 OK`

### Download Font
```
GET /fonts/download/{id}
```
**Path Parameters**:
- `id` (integer, required): The Font ID

**Response**: `200 OK` (Binary file)

### Delete Font
```
DELETE /fonts/{id}/delete
```
**Path Parameters**:
- `id` (integer, required): The Font ID

**Response**: `204 No Content`

---

## Sync Groups

### Get Sync Groups
```
GET /syncgroups
```
**Query Parameters**:
- `syncGroupId` (integer): Filter by Sync Group ID
- `name` (string): Filter by name

**Response**: `200 OK`

### Add Sync Group
```
POST /syncgroup/add
```
**Form Data**:
- `name` (string, required): Sync Group name
- `leadDisplayId` (integer): Lead Display ID

**Response**: `201 Created`

### Assign Displays to Sync Group
```
POST /syncgroup/{syncGroupId}/members
```
**Path Parameters**:
- `syncGroupId` (integer, required): The Sync Group ID

**Form Data**:
- `displayId` (array[integer], required): Array of Display IDs

**Response**: `200 OK`

### Edit Sync Group
```
POST /syncgroup/{syncGroupId}/edit
```
**Path Parameters**:
- `syncGroupId` (integer, required): The Sync Group ID

**Form Data**:
- `name` (string, required): Sync Group name
- `leadDisplayId` (integer): Lead Display ID

**Response**: `200 OK`

### Delete Sync Group
```
DELETE /syncgroup/{syncGroupId}/delete
```
**Path Parameters**:
- `syncGroupId` (integer, required): The Sync Group ID

**Response**: `204 No Content`

### Get Sync Group Displays
```
GET /syncgroup/{syncGroupId}/displays
```
**Path Parameters**:
- `syncGroupId` (integer, required): The Sync Group ID

**Response**: `200 OK`

---

## Data Models

### Layout Object
```json
{
  "layoutId": 1,
  "ownerId": 1,
  "campaignId": 5,
  "parentId": 0,
  "publishedStatusId": 1,
  "publishedStatus": "Published",
  "publishedDate": "2025-11-15 10:00:00",
  "backgroundImageId": 10,
  "schemaVersion": 4,
  "layout": "Main Layout",
  "description": "Primary display layout",
  "backgroundColor": "#000000",
  "createdDt": "2025-11-01 09:00:00",
  "modifiedDt": "2025-11-15 10:00:00",
  "status": 1,
  "retired": 0,
  "backgroundzIndex": 0,
  "width": 1920,
  "height": 1080,
  "orientation": "landscape",
  "displayOrder": 1,
  "duration": 60,
  "statusMessage": "",
  "enableStat": 1,
  "autoApplyTransitions": 1,
  "code": "MAIN_001",
  "isLocked": false,
  "regions": [],
  "tags": [],
  "folderId": 1,
  "permissionsFolderId": 1
}
```

### Region Object
```json
{
  "regionId": 1,
  "layoutId": 5,
  "ownerId": 1,
  "type": "frame",
  "name": "Region 1",
  "width": 1920,
  "height": 540,
  "top": 0,
  "left": 0,
  "zIndex": 1,
  "syncKey": "",
  "regionOptions": [],
  "permissions": [],
  "duration": 30,
  "isDrawer": 0,
  "regionPlaylist": {}
}
```

### Playlist Object
```json
{
  "playlistId": 1,
  "ownerId": 1,
  "name": "Main Playlist",
  "regionId": 0,
  "isDynamic": 0,
  "filterMediaName": "",
  "filterMediaNameLogicalOperator": "AND",
  "filterMediaTags": "",
  "filterExactTags": 0,
  "filterMediaTagsLogicalOperator": "AND",
  "filterFolderId": 0,
  "maxNumberOfItems": 0,
  "createdDt": "2025-11-01 09:00:00",
  "modifiedDt": "2025-11-15 10:00:00",
  "duration": 120,
  "requiresDurationUpdate": 0,
  "enableStat": "Inherit",
  "tags": [],
  "widgets": [],
  "permissions": [],
  "folderId": 1,
  "permissionsFolderId": 1
}
```

### Widget Object
```json
{
  "widgetId": 1,
  "playlistId": 1,
  "ownerId": 1,
  "type": "text",
  "duration": 10,
  "displayOrder": 1,
  "useDuration": 1,
  "calculatedDuration": 10,
  "createdDt": "2025-11-01 09:00:00",
  "modifiedDt": "2025-11-15 10:00:00",
  "fromDt": 0,
  "toDt": 0,
  "schemaVersion": 4,
  "transitionIn": 0,
  "transitionOut": 0,
  "transitionDurationIn": 0,
  "transitionDurationOut": 0,
  "widgetOptions": [],
  "mediaIds": [],
  "audio": [],
  "permissions": [],
  "playlist": "Main Playlist"
}
```

### Media Object
```json
{
  "mediaId": 1,
  "ownerId": 1,
  "parentId": 0,
  "name": "Company Logo",
  "mediaType": "image",
  "storedAs": "1.png",
  "fileName": "logo.png",
  "tags": [],
  "fileSize": 45632,
  "duration": 10,
  "valid": 1,
  "moduleSystemFile": 0,
  "expires": 0,
  "retired": 0,
  "isEdited": 0,
  "md5": "abc123def456",
  "owner": "admin",
  "groupsWithPermissions": "Administrators",
  "released": 1,
  "apiRef": null,
  "createdDt": "2025-11-01 09:00:00",
  "modifiedDt": "2025-11-15 10:00:00",
  "enableStat": "Inherit",
  "orientation": "landscape",
  "width": 1920,
  "height": 1080,
  "folderId": 1,
  "permissionsFolderId": 1
}
```

### Permission Object
```json
{
  "permissionId": 1,
  "entityId": 1,
  "groupId": 1,
  "objectId": 5,
  "isUser": 0,
  "entity": "layout",
  "objectIdString": "5",
  "group": "Users",
  "view": 1,
  "edit": 1,
  "delete": 1,
  "modifyPermissions": 0
}
```

### Campaign Object
```json
{
  "campaignId": 1,
  "ownerId": 1,
  "type": "list",
  "campaign": "Main Campaign",
  "isLayoutSpecific": 0,
  "numberLayouts": 3,
  "totalDuration": 180,
  "tags": [],
  "folderId": 1,
  "permissionsFolderId": 1,
  "cyclePlaybackEnabled": 0,
  "playCount": 0,
  "listPlayOrder": "round",
  "targetType": "plays",
  "target": 1000,
  "startDt": 1730419200,
  "endDt": 1733097600,
  "plays": 0,
  "spend": 0,
  "impressions": 0,
  "lastPopId": 0,
  "ref1": "",
  "ref2": "",
  "ref3": "",
  "ref4": "",
  "ref5": ""
}
```

### DataSet Object
```json
{
  "dataSetId": 1,
  "dataSet": "Product Catalog",
  "description": "Product information",
  "userId": 1,
  "lastDataEdit": 1700654321,
  "owner": "admin",
  "groupsWithPermissions": "Administrators",
  "code": "PRODUCTS",
  "isLookup": 0,
  "isRemote": 1,
  "isRealTime": 0,
  "dataConnectorSource": "user-defined",
  "method": "GET",
  "uri": "https://api.example.com/products",
  "postData": "",
  "authentication": "none",
  "username": "",
  "password": "",
  "customHeaders": "",
  "userAgent": "",
  "refreshRate": 3600,
  "clearRate": 0,
  "truncateOnEmpty": 0,
  "runsAfter": 0,
  "lastSync": 1700654321,
  "lastClear": 0,
  "dataRoot": "data",
  "summarize": "",
  "summarizeField": "",
  "sourceId": 1,
  "ignoreFirstRow": 1,
  "rowLimit": 10000,
  "limitPolicy": "stop",
  "csvSeparator": ",",
  "folderId": 1,
  "permissionsFolderId": 1
}
```

### Display Object
```json
{
  "displayId": 1,
  "display": "Reception Display",
  "displayTypeId": 1,
  "displayType": "android",
  "licensed": 1,
  "loggedIn": 1,
  "lastAccessed": "2025-11-22 14:00:00",
  "incSchedule": 1,
  "emailAlert": 1,
  "alertTimeout": 0,
  "clientAddress": "192.168.1.100",
  "mediaInventoryStatus": 1,
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "defaultLayoutId": 5,
  "license": "LICENSE_KEY",
  "displayProfileId": 1,
  "screenShotRequested": 0,
  "storageAvailableSpace": 50000000000,
  "storageTotalSpace": 100000000000,
  "xmrChannel": "",
  "xmrPubKey": "",
  "lastCommandSuccess": 2,
  "deviceName": "Reception Android",
  "timeZone": "UTC",
  "latitude": 0,
  "longitude": 0,
  "venueId": 0,
  "orientation": "landscape",
  "resolution": "1920x1080",
  "commercialLicence": 0,
  "isAuditing": 0,
  "wakeOnLanEnabled": 0,
  "wakeOnLanTime": "",
  "broadCastAddress": "",
  "secureOn": "",
  "cidr": 0,
  "geoLocation": ""
}
```

### DisplayGroup Object
```json
{
  "displayGroupId": 1,
  "displayGroup": "Lobby Displays",
  "description": "All lobby displays",
  "isDisplaySpecific": 0,
  "isDynamic": 0,
  "dynamicCriteria": "",
  "userId": 1,
  "folderId": 1,
  "permissionsFolderId": 1,
  "ref1": "",
  "ref2": "",
  "ref3": "",
  "ref4": "",
  "ref5": "",
  "createdDt": "2025-11-01 09:00:00",
  "modifiedDt": "2025-11-15 10:00:00"
}
```

### Command Object
```json
{
  "commandId": 1,
  "command": "Reboot Display",
  "code": "REBOOT",
  "description": "Reboots the display device",
  "userId": 1,
  "commandString": "reboot",
  "validationString": "",
  "displayProfileId": 0,
  "commandStringDisplayProfile": "",
  "validationStringDisplayProfile": "",
  "availableOn": "android,webos",
  "createAlertOn": "success",
  "groupsWithPermissions": "Administrators"
}
```

### User Object
```json
{
  "userId": 1,
  "userName": "admin",
  "userTypeId": 1,
  "loggedIn": 1,
  "email": "admin@example.com",
  "homePageId": 1,
  "twoFactorTypeId": 0,
  "retired": 0,
  "firstName": "Admin",
  "lastName": "User",
  "phone": "",
  "ref1": "",
  "ref2": "",
  "ref3": "",
  "ref4": "",
  "ref5": "",
  "libraryQuota": 0,
  "isPasswordChangeRequired": 0,
  "isSystemNotification": 1,
  "isDisplayNotification": 1,
  "newUserWizard": 0,
  "homeFolderId": 1,
  "createdDt": "2025-01-01 00:00:00",
  "modifiedDt": "2025-11-22 10:00:00"
}
```

### UserGroup Object
```json
{
  "groupId": 1,
  "group": "Users",
  "isUserSpecific": 0,
  "isEveryone": 0,
  "libraryQuota": 0,
  "isSystemNotification": 1,
  "isDisplayNotification": 1,
  "features": [],
  "ref1": "",
  "ref2": "",
  "ref3": "",
  "ref4": "",
  "ref5": ""
}
```

### Tag Object
```json
{
  "tagId": 1,
  "tag": "Important",
  "value": null,
  "options": []
}
```

### Folder Object
```json
{
  "id": 1,
  "type": "root",
  "text": "My Folder",
  "parentId": 0,
  "isRoot": 1,
  "children": []
}
```

### Resolution Object
```json
{
  "resolutionId": 1,
  "resolution": "1080p HD Landscape",
  "width": 1920,
  "height": 1080,
  "designer_width": 1920,
  "designer_height": 1080,
  "enabled": 1,
  "userId": 1
}
```

### Notification Object
```json
{
  "notificationId": 1,
  "subject": "System Alert",
  "body": "Display offline",
  "createDt": "2025-11-22 10:00:00",
  "releaseDt": "2025-11-22 10:05:00",
  "isEmail": 1,
  "isInterrupt": 0,
  "userId": 1,
  "filename": null,
  "originalFileName": null,
  "nonusers": ""
}
```

### Schedule Object
```json
{
  "eventId": 1,
  "eventTypeId": 1,
  "campaignId": 5,
  "commandId": 0,
  "displayOrder": 1,
  "isPriority": 0,
  "userId": 1,
  "fromDt": 1732291200,
  "toDt": 1732377600,
  "recurrence_type": "",
  "recurrence_detail": 0,
  "recurrence_range": 0,
  "recurrenceRepeatsOn": "",
  "lastRecurrenceWatermark": 0,
  "dayPartId": 0,
  "shareOfVoice": 0,
  "isGeoAware": 0,
  "geoLocation": "",
  "syncTimezone": 0,
  "syncEvent": 0,
  "displayGroups": [],
  "layoutId": 0,
  "campaign": "Main Campaign"
}
```

### WidgetOption Object
```json
{
  "widgetId": 1,
  "type": "attrib",
  "option": "name",
  "value": "My Text Widget"
}
```

### WidgetAudio Object
```json
{
  "widgetId": 1,
  "mediaId": 10,
  "volume": 80,
  "loop": 1
}
```

### WidgetData Object
```json
{
  "id": 1,
  "widgetId": 5,
  "data": ["column1value", "column2value"],
  "displayOrder": 1,
  "createdDt": "2025-11-22 10:00:00",
  "modifiedDt": "2025-11-22 10:05:00"
}
```

### DataSetColumn Object
```json
{
  "dataSetColumnId": 1,
  "dataSetId": 1,
  "heading": "Product Name",
  "dataTypeId": 1,
  "dataSetColumnTypeId": 1,
  "listContent": "",
  "columnOrder": 1,
  "formula": "",
  "dataType": "String",
  "remoteField": "name",
  "showFilter": "1",
  "showSort": "1",
  "dataSetColumnType": "Value",
  "tooltip": "Enter product name",
  "isRequired": 1,
  "dateFormat": ""
}
```

### Module Object
```json
{
  "moduleId": 1,
  "module": "Text",
  "name": "Text",
  "enabled": 1,
  "regionSpecific": 1,
  "description": "Display formatted text",
  "schemaVersion": 4,
  "validExtensions": "",
  "previewEnabled": 1,
  "assignable": 1,
  "render_as": "html",
  "settings": {},
  "viewPath": "../modules",
  "class": "Xibo\\Widget\\Text",
  "defaultDuration": 10
}
```

### DayPart Object
```json
{
  "dayPartId": 1,
  "name": "Morning",
  "description": "Morning daypart 6am-12pm",
  "isRetired": 0,
  "userId": 1,
  "startTime": "06:00:00",
  "endTime": "12:00:00",
  "exceptions": []
}
```

### SyncGroup Object
```json
{
  "syncGroupId": 1,
  "name": "Lobby Sync Group",
  "ownerId": 1,
  "createdDt": "2025-11-01 09:00:00",
  "modifiedDt": "2025-11-15 10:00:00",
  "leadDisplayId": 5,
  "syncPublisherId": 0
}
```

### Font Object
```json
{
  "id": 1,
  "name": "Roboto",
  "fileName": "Roboto-Regular.ttf",
  "size": 45632,
  "md5": "abc123def456",
  "ownerId": 1,
  "isSystemFont": 0
}
```

### Action Object
```json
{
  "actionId": 1,
  "ownerId": 1,
  "actionType": "navLayout",
  "source": "layout",
  "sourceId": 5,
  "target": "layout",
  "targetId": 10,
  "triggerType": "touch",
  "triggerCode": "",
  "widgetId": 0,
  "layoutCode": "LAYOUT_001"
}
```

---

## Common Patterns and Examples

### Creating a Complete Layout

**Step 1: Create Layout**
```bash
POST /api/layout
name=My Layout&resolutionId=1&description=Test Layout
```

**Step 2: Checkout for Editing**
```bash
PUT /api/layout/checkout/{layoutId}
```

**Step 3: Add Region**
```bash
POST /api/region/{layoutId}
width=1920&height=540&top=0&left=0
```

**Step 4: Add Widget to Region Playlist**
```bash
POST /api/playlist/widget/text/{playlistId}
```

**Step 5: Configure Widget**
```bash
PUT /api/playlist/widget/{widgetId}
duration=10&name=My Text&text=Hello World
```

**Step 6: Publish Layout**
```bash
PUT /api/layout/publish/{layoutId}
publishNow=1
```

### Managing Media Library

**Upload Media**
```bash
POST /api/library
files=@/path/to/image.jpg&name=Company Logo&tags=logo,brand
```

**Assign to Playlist**
```bash
POST /api/playlist/library/assign/{playlistId}
media[]=15&duration=10&displayOrder=1
```

**Update Media Metadata**
```bash
PUT /api/library/{mediaId}
name=Updated Logo&duration=15&tags=logo,brand,2025
```

### Scheduling Content

**Create Schedule**
```bash
POST /api/schedule
eventTypeId=1&campaignId=5&displayGroupIds[]=1&fromDt=2025-11-23 00:00:00&toDt=2025-11-30 23:59:59&isPriority=0
```

**Create Recurring Schedule**
```bash
POST /api/schedule
eventTypeId=1&campaignId=5&displayGroupIds[]=1&fromDt=2025-11-23 09:00:00&toDt=2025-11-23 17:00:00&recurrenceType=Week&recurrenceDetail=1&recurrenceRepeatsOn=1,2,3,4,5
```

### Display Group Management

**Create Dynamic Display Group**
```bash
POST /api/displaygroup
displayGroup=All Lobby Displays&isDynamic=1&dynamicCriteria={"tag":"lobby"}
```

**Send Command to Group**
```bash
POST /api/displaygroup/{displayGroupId}/action/command
commandId=1
```

**Change Layout Immediately**
```bash
POST /api/displaygroup/{displayGroupId}/action/changeLayout
layoutId=10&duration=60&downloadRequired=1
```

### Working with DataSets

**Create DataSet**
```bash
POST /api/dataset
dataSet=Product List&description=Available products&code=PRODUCTS
```

**Add Columns**
```bash
POST /api/dataset/{dataSetId}/column
heading=Product Name&dataTypeId=1&dataSetColumnTypeId=1&columnOrder=1

POST /api/dataset/{dataSetId}/column
heading=Price&dataTypeId=2&dataSetColumnTypeId=1&columnOrder=2
```

**Add Data**
```bash
POST /api/dataset/data/{dataSetId}
dataSetColumnId_1=Widget A&dataSetColumnId_2=99.99
```

**Import CSV**
```bash
POST /api/dataset/import/{dataSetId}
files=@products.csv&overwrite=1&ignorefirstrow=1
```

### User and Permission Management

**Create User**
```bash
POST /api/user
userName=newuser&email=user@example.com&userTypeId=3&password=SecurePass123&groupId=2
```

**Set Permissions**
```bash
POST /api/user/permissions/layout/5
groupIds[2][view]=1&groupIds[2][edit]=1&groupIds[2][delete]=0
```

**Create User Group**
```bash
POST /api/group
group=Content Editors&libraryQuota=1048576&isSystemNotification=1
```

**Assign Users to Group**
```bash
POST /api/group/members/assign/{userGroupId}
userId[]=5&userId[]=6&userId[]=7
```

---

## Error Handling

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Successful GET or PUT request |
| 201 | Created | Successful POST request, resource created |
| 204 | No Content | Successful DELETE or PUT with no response |
| 400 | Bad Request | Invalid parameters or malformed request |
| 401 | Unauthorized | Missing or invalid authentication token |
| 403 | Forbidden | Valid token but insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | Server temporarily unavailable |

### Error Response Format

```json
{
  "success": false,
  "error": {
    "message": "Layout not found",
    "code": 404,
    "data": {
      "layoutId": 999
    }
  }
}
```

### Common Error Messages

**Authentication Errors:**
- "Access token is invalid"
- "Access token has expired"
- "No access token provided"

**Permission Errors:**
- "Access Denied"
- "You do not have permissions to access this resource"

**Validation Errors:**
- "Name is required"
- "Invalid resolution ID"
- "Duration must be a positive number"

**Resource Errors:**
- "Layout not found"
- "Media not found"
- "Display Group not found"

### Error Handling Best Practices

1. **Always check response status codes**
2. **Parse error messages for user feedback**
3. **Implement retry logic for 429 and 503 errors**
4. **Log errors for debugging**
5. **Handle token expiration gracefully**
6. **Validate input before sending requests**

---

## Rate Limiting

### Limits
- **Default**: 100 requests per minute per IP
- **Authenticated**: 300 requests per minute per user
- **Burst**: Up to 150% for short periods

### Rate Limit Headers
```
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 250
X-RateLimit-Reset: 1732377600
```

### Handling Rate Limits
```javascript
if (response.status === 429) {
  const resetTime = response.headers['X-RateLimit-Reset'];
  const waitTime = resetTime - Math.floor(Date.now() / 1000);
  // Wait and retry
  await sleep(waitTime * 1000);
  // Retry request
}
```

---

## Best Practices

### Authentication
1. Store tokens securely (never in client-side code)
2. Refresh tokens before expiration
3. Use HTTPS for all requests
4. Implement token rotation

### API Usage
1. **Use embed parameter** to reduce API calls
2. **Batch operations** when possible
3. **Cache frequently accessed data**
4. **Implement exponential backoff** for retries
5. **Use filters** to reduce response size
6. **Monitor rate limits**

### Data Management
1. **Use folders** to organize content
2. **Tag resources** for easy filtering
3. **Set expiry dates** on time-sensitive content
4. **Clean up unused media** regularly
5. **Use dynamic playlists** for automated content

### Performance
1. **Compress images** before upload
2. **Optimize video encoding**
3. **Use appropriate resolutions**
4. **Minimize widget count** per layout
5. **Cache static content**

### Security
1. **Never expose API tokens** in client code
2. **Implement proper permission controls**
3. **Validate all user input**
4. **Use HTTPS exclusively**
5. **Audit user actions** regularly
6. **Rotate credentials** periodically

### Development
1. **Use staging environment** for testing
2. **Version control** API integration code
3. **Document custom implementations**
4. **Monitor API errors** and logs
5. **Keep Xibo CMS updated**

---

## Integration Examples

### JavaScript/Node.js Example

```javascript
const XiboAPI = {
  baseURL: 'https://your-cms.com/api',
  token: 'YOUR_JWT_TOKEN',
  
  async request(method, endpoint, data = null) {
    const options = {
      method,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    };
    
    if (data && (method === 'POST' || method === 'PUT')) {
      options.body = new URLSearchParams(data).toString();
    }
    
    const response = await fetch(`${this.baseURL}${endpoint}`, options);
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    return response.json();
  },
  
  // Get layouts
  async getLayouts(filters = {}) {
    const params = new URLSearchParams(filters).toString();
    return this.request('GET', `/layout?${params}`);
  },
  
  // Create layout
  async createLayout(name, resolutionId) {
    return this.request('POST', '/layout', {
      name,
      resolutionId
    });
  },
  
  // Upload media
  async uploadMedia(file, name) {
    const formData = new FormData();
    formData.append('files', file);
    formData.append('name', name);
    
    const response = await fetch(`${this.baseURL}/library`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`
      },
      body: formData
    });
    
    return response.json();
  },
  
  // Schedule content
  async scheduleContent(campaignId, displayGroupIds, fromDt, toDt) {
    return this.request('POST', '/schedule', {
      eventTypeId: 1,
      campaignId,
      'displayGroupIds[]': displayGroupIds,
      fromDt,
      toDt,
      isPriority: 0
    });
  }
};

// Usage
(async () => {
  try {
    // Get all layouts
    const layouts = await XiboAPI.getLayouts({ retired: 0 });
    console.log('Layouts:', layouts);
    
    // Create new layout
    const newLayout = await XiboAPI.createLayout('API Layout', 1);
    console.log('Created:', newLayout);
    
    // Schedule content
    const schedule = await XiboAPI.scheduleContent(
      5, 
      [1, 2], 
      '2025-11-23 00:00:00', 
      '2025-11-30 23:59:59'
    );
    console.log('Scheduled:', schedule);
    
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

### Python Example

```python
import requests
from urllib.parse import urlencode

class XiboAPI:
    def __init__(self, base_url, token):
        self.base_url = base_url
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    
    def request(self, method, endpoint, data=None, params=None):
        url = f"{self.base_url}{endpoint}"
        
        if method in ['POST', 'PUT'] and data:
            response = requests.request(
                method, url, 
                headers=self.headers,
                data=urlencode(data)
            )
        else:
            response = requests.request(
                method, url,
                headers=self.headers,
                params=params
            )
        
        response.raise_for_status()
        return response.json()
    
    def get_layouts(self, filters=None):
        return self.request('GET', '/layout', params=filters)
    
    def create_layout(self, name, resolution_id):
        return self.request('POST', '/layout', {
            'name': name,
            'resolutionId': resolution_id
        })
    
    def upload_media(self, file_path, name):
        with open(file_path, 'rb') as f:
            files = {'files': f}
            data = {'name': name}
            
            headers = {'Authorization': f'Bearer {self.token}'}
            
            response = requests.post(
                f"{self.base_url}/library",
                headers=headers,
                files=files,
                data=data
            )
            
            return response.json()
    
    def schedule_content(self, campaign_id, display_group_ids, from_dt, to_dt):
        data = {
            'eventTypeId': 1,
            'campaignId': campaign_id,
            'fromDt': from_dt,
            'toDt': to_dt,
            'isPriority': 0
        }
        
        for i, group_id in enumerate(display_group_ids):
            data[f'displayGroupIds[{i}]'] = group_id
        
        return self.request('POST', '/schedule', data)

# Usage
if __name__ == '__main__':
    api = XiboAPI('https://your-cms.com/api', 'YOUR_JWT_TOKEN')
    
    try:
        # Get layouts
        layouts = api.get_layouts({'retired': 0})
        print('Layouts:', layouts)
        
        # Create layout
        new_layout = api.create_layout('Python API Layout', 1)
        print('Created:', new_layout)
        
        # Upload media
        media = api.upload_media('/path/to/image.jpg', 'My Image')
        print('Uploaded:', media)
        
    except requests.exceptions.RequestException as e:
        print('Error:', e)
```

### PHP Example

```php
<?php

class XiboAPI {
    private $baseURL;
    private $token;
    
    public function __construct($baseURL, $token) {
        $this->baseURL = $baseURL;
        $this->token = $token;
    }
    
    private function request($method, $endpoint, $data = null) {
        $ch = curl_init();
        
        $headers = [
            'Authorization: Bearer ' . $this->token,
            'Content-Type: application/x-www-form-urlencoded'
        ];
        
        curl_setopt($ch, CURLOPT_URL, $this->baseURL . $endpoint);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $headers);
        
        if ($method === 'POST') {
            curl_setopt($ch, CURLOPT_POST, true);
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
            }
        } elseif ($method === 'PUT') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PUT');
            if ($data) {
                curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($data));
            }
        } elseif ($method === 'DELETE') {
            curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        }
        
        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        
        if ($httpCode >= 400) {
            throw new Exception("API Error: HTTP $httpCode");
        }
        
        return json_decode($response, true);
    }
    
    public function getLayouts($filters = []) {
        $query = http_build_query($filters);
        return $this->request('GET', "/layout?$query");
    }
    
    public function createLayout($name, $resolutionId) {
        return $this->request('POST', '/layout', [
            'name' => $name,
            'resolutionId' => $resolutionId
        ]);
    }
    
    public function scheduleContent($campaignId, $displayGroupIds, $fromDt, $toDt) {
        $data = [
            'eventTypeId' => 1,
            'campaignId' => $campaignId,
            'fromDt' => $fromDt,
            'toDt' => $toDt,
            'isPriority' => 0
        ];
        
        foreach ($displayGroupIds as $i => $groupId) {
            $data["displayGroupIds[$i]"] = $groupId;
        }
        
        return $this->request('POST', '/schedule', $data);
    }
}

// Usage
$api = new XiboAPI('https://your-cms.com/api', 'YOUR_JWT_TOKEN');

try {
    $layouts = $api->getLayouts(['retired' => 0]);
    print_r($layouts);
    
    $newLayout = $api->createLayout('PHP API Layout', 1);
    print_r($newLayout);
    
} catch (Exception $e) {
    echo 'Error: ' . $e->getMessage();
}

?>
```

---

## Troubleshooting

### Common Issues

**Issue: 401 Unauthorized**
- **Cause**: Invalid or expired token
- **Solution**: Refresh authentication token

**Issue: 404 Not Found**
- **Cause**: Invalid endpoint or resource ID
- **Solution**: Verify endpoint URL and resource ID

**Issue: 422 Validation Error**
- **Cause**: Invalid input data
- **Solution**: Check required fields and data types

**Issue: Layout not displaying**
- **Cause**: Not published or scheduled
- **Solution**: Publish layout and create schedule

**Issue: Media not showing**
- **Cause**: File corruption or invalid format
- **Solution**: Re-upload media in supported format

**Issue: Display offline**
- **Cause**: Network connectivity
- **Solution**: Check display network settings

### Debug Mode

Enable debug logging in API requests:
```bash
curl -X GET "https://your-cms.com/api/layout?debug=1" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Support Resources

- **Official Documentation**: https://xibosignage.com/manual/
- **Community Forum**: https://community.xibo.org.uk/
- **GitHub Issues**: https://github.com/xibosignage/xibo-cms
- **API Swagger**: https://your-cms.com/swagger

---

## Changelog

### Version 4.0
- Added full REST API support
- Improved authentication with JWT
- Enhanced permissions system
- New widget types
- DataSet improvements
- Display sync groups
- Menu boards (preview)
- Font management
- Action triggers

### Migration Notes from v3

1. **Authentication**: Update to JWT tokens
2. **Endpoints**: Some endpoints restructured
3. **Permissions**: New permission model
4. **Widgets**: Widget API updated
5. **DataSets**: Enhanced remote dataset support

---

## Appendix

### Supported Media Types

| Type | Extensions | Max Size |
|------|-----------|----------|
| Image | jpg, jpeg, png, gif, bmp, webp | 50MB |
| Video | mp4, avi, wmv, mov, webm | 2GB |
| Audio | mp3, wav, ogg, m4a | 100MB |
| Document | pdf | 50MB |
| Web | html, htm | 10MB |

### Widget Types

- text
- image
- video
- embedded
- ticker
- datasetview
- weather
- stocks
- twitter
- calendar
- clock
- countdown
- currencies
- worldclock
- shellcommand
- localvideo
- htmlpackage
- pdf
- flash
- powerpoint
- webpage
- spacer
- notification
- subplaylist
- chart
- hls
- menuboard

### Display Types

- android
- lg
- sssp
- linux
- windows
- webos
- tizen

### Transition Types

- fly
- fadeIn
- fadeOut
- fadeOutIn
- scrollVert
- scrollHorz
- flipVert
- flipHorz
- shuffle
- tileSlide
- tileBlind
- door

---

**Document Version**: 1.0  
**Last Updated**: November 22, 2025  
**API Version**: 4.0  
**Xibo CMS**: https://xibosignage.com  
**License**: AGPLv3 or later  

---

*This documentation is comprehensive and covers all major endpoints of the Xibo CMS API v4.0. For the most up-to-date information, always refer to the official Xibo documentation at https://xibosignage.com/manual/*
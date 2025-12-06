# Xibo CMS API Reference Guide

## Overview

- **Base URL**: `/api`
- **API Version**: 4.0 (OAS 2.0)
- **Request Format**: HTTP formData requests
- **Authentication**: JWT tokens via Xibo CMS
- **Important**: All PUT requests require `Content-Type: application/x-www-form-urlencoded` header

---

## Authentication

### Getting Started

1. Authenticate with Xibo CMS
2. Receive JWT token
3. Include token in all API requests
4. Use Bearer token format: `Authorization: Bearer {token}`

---

## Core Resources

### Playlists

#### List Playlists

```
GET /playlist
Query Parameters:
  - playlistId (integer): Filter by Playlist Id
  - name (string): Filter by partial Playlist name
  - userId (integer): Filter by user Id
  - tags (string): Filter by tags (comma-separated)
  - exactTags (integer): Exact tag match flag
  - logicalOperator (string): AND|OR for multiple tags
  - ownerUserGroupId (integer): Filter by user group
  - embed (string): Embed related data (widgets, permissions, tags)
  - folderId (integer): Filter by Folder ID

Response: Array of Playlist objects
```

#### Create Playlist

```
POST /playlist
Form Data (required parameters marked with *):
  - name*: The Name for this Playlist
  - isDynamic*: Is this Playlist Dynamic? (0 or 1)
  - tags: Comma-separated tags
  - filterMediaName: Add Library Media matching name filter
  - logicalOperatorName: AND|OR for name filtering
  - filterMediaTag: Add Library Media matching tag filter
  - exactTags: Use exact tag matching (0 or 1)
  - logicalOperator: AND|OR for tag filtering
  - maxNumberOfItems: Max items for dynamic playlists
  - folderId: Folder ID for organization

Response: Created Playlist object (201)
Headers: Location header with new record path
```

#### Get Playlist Details

```
GET /playlist/{playlistId}
Path Parameters:
  - playlistId (integer): The Playlist ID

Response: Playlist object with widgets
```

#### Edit Playlist

```
PUT /playlist/{playlistId}
Path Parameters:
  - playlistId*: The PlaylistId to Edit

Form Data (same as create):
  - name*: The Name for this Playlist
  - tags: Tags
  - isDynamic*: Is this Playlist Dynamic?
  - filterMediaName: Media name filter
  - logicalOperatorName: AND|OR for names
  - filterMediaTag: Media tag filter
  - exactTags: Exact tag match flag
  - logicalOperator: AND|OR for tags
  - maxNumberOfItems: Max items (dynamic only)
  - folderId: Folder ID

Response: 204 No Content
```

#### Delete Playlist

```
DELETE /playlist/{playlistId}
Path Parameters:
  - playlistId*: The PlaylistId to delete

Response: 204 No Content
```

#### Copy Playlist

```
POST /playlist/copy/{playlistId}
Path Parameters:
  - playlistId*: The Playlist ID to Copy

Form Data:
  - name*: The name for the new Playlist
  - copyMediaFiles*: Copy media files? (0 or 1)

Response: Created Playlist object (201)
```

#### Assign Media to Playlist

```
POST /playlist/library/assign/{playlistId}
Path Parameters:
  - playlistId*: The Playlist ID to assign to

Form Data:
  - media*: Array of Media IDs to assign
  - duration: Optional duration for all Media
  - useDuration: Enable useDuration field? (0 or 1)
  - displayOrder: Position in list for assignment

Response: Updated Playlist object
```

#### Order Widgets in Playlist

```
POST /playlist/order/{playlistId}
Path Parameters:
  - playlistId*: The Playlist ID to Order

Form Data:
  - widgets*: Array of widgetIds and positions
    All playlist widgets must be included with their positions

Response: Updated Playlist object
```

#### Get Playlist Usage Report

``
GET /playlist/usage/{playlistId}
Path Parameters:

- playlistId\*: The Playlist Id

Response: Usage report data

```

#### Get Playlist Usage Report (Layouts)

```

GET /playlist/usage/layouts/{playlistId}
Path Parameters:

- playlistId\*: The Playlist Id

Response: Usage report data for layouts

```

#### Enable Stats Collection

```

PUT /playlist/setenablestat/{playlistId}
Path Parameters:

- playlistId\*: The Playlist ID

Form Data:

- enableStat\*: On, Off, or Inherit

Response: 204 No Content

```

---

### Widgets

#### Add Widget to Playlist

```

POST /playlist/widget/{type}/{playlistId}
Path Parameters:

- type\*: Widget type (e.g., 'text', 'image', etc.)
- playlistId\*: The Playlist ID

Form Data:

- displayOrder: Position in list
- templateId: If module has dataType, provide template ID

Response: 201 Created
Headers: Location header with new widget path

```

#### Edit Widget

```

PUT /playlist/widget/{id}
Path Parameters:

- id\*: The ID of the Widget

Form Data:

- useDuration: Use duration flag (0 or 1)
- duration: Duration in seconds
- name: Optional widget name
- enableStat: On|Off|Inherit
- isRepeatData: Repeat data to meet item count? (0 or 1)
- showFallback: never|always|empty|error
- properties: Additional module properties

Response: 204 No Content

```

#### Delete Widget

```

DELETE /playlist/widget/{widgetId}
Path Parameters:

- widgetId\*: The widget ID to delete

Response: 200 OK

```

#### Add Widget Transition

```

PUT /playlist/widget/transition/{type}/{widgetId}
Path Parameters:

- type\*: Transition type (in or out)
- widgetId\*: The widget ID

Form Data:

- transitionType\*: fly|fadeIn|fadeOut
- transitionDuration: Duration in milliseconds
- transitionDirection: N|NE|E|SE|S|SW|W|NW

Response: 201 Created
Headers: Location header with new widget

```

#### Add Audio to Widget

```

PUT /playlist/widget/{widgetId}/audio
Path Parameters:

- widgetId\*: Widget ID

Form Data:

- mediaId: Audio file ID in library
- volume: Volume percentage (0-100)
- loop: Loop if finishes before widget? (0 or 1)

Response: 200 OK

```

#### Delete Audio from Widget

```

DELETE /playlist/widget/{widgetId}/audio
Path Parameters:

- widgetId\*: Widget ID to remove audio from

Response: 200 OK

```

#### Set Widget Region

```

PUT /playlist/widget/{widgetId}/region
Path Parameters:

- widgetId\*: Widget ID

Form Data:

- targetRegionId\*: The target regionId

Response: 204 No Content

```

#### Save Widget Elements

```

PUT /playlist/widget/{widgetId}/elements
Path Parameters:

- widgetId\*: Widget ID

Body (JSON):

- elements\*: JSON representing elements assigned to widget

Response: 204 No Content

```

#### Set Widget DataType

```

PUT /playlist/widget/{widgetId}/dataType
Path Parameters:

- widgetId\*: Widget ID

Body (JSON):

- dataType\*: JSON representation of your dataType

Response: 200 OK

```

#### Get Widget Data

```

GET /playlist/widget/data/{id}
Path Parameters:

- id\*: The Widget ID

Response: Array of widget data objects (201)

```

#### Add Data to Widget

```

POST /playlist/widget/data/{id}
Path Parameters:

- id\*: The Widget ID

Form Data:

- data\*: JSON formatted string for widget data type
- displayOrder: Position if multiple items

Response: 201 Created
Headers: Location header

```

#### Edit Widget Data

```

PUT /playlist/widget/data/{id}/{dataId}
Path Parameters:

- id\*: The Widget ID
- dataId\*: The data ID to edit

Form Data:

- data\*: JSON formatted string
- displayOrder: Position

Response: 204 No Content

```

#### Delete Widget Data

```

DELETE /playlist/widget/data/{id}/{dataId}
Path Parameters:

- id\*: The Widget ID
- dataId\*: The data ID to delete

Response: 204 No Content

```

#### Update Widget Data Order

```

POST /playlist/widget/data/{id}/order
Path Parameters:

- id\*: The Widget ID
- dataId\*: The data ID

Body (JSON array):

- order\*: Array of widget data records to reorder

Response: 204 No Content

```

---

### Layouts

#### List Layouts

```

GET /layout
Query Parameters:

- layoutId (integer): Filter by Layout Id
- parentId (integer): Filter by parent Id
- showDrafts (integer): Show drafts? (0 or 1)
- layout (string): Filter by partial Layout name
- userId (integer): Filter by user Id
- retired (integer): Filter by retired flag
- tags (string): Filter by Tags (comma-separated)
- exactTags (integer): Exact tag match
- logicalOperator (string): AND|OR for tags
- ownerUserGroupId (integer): Filter by user group
- publishedStatusId (integer): 1=Published, 2=Draft
- embed (string): Embed regions, playlists, widgets, tags, campaigns, permissions
- campaignId (integer): Get all Layouts for campaign
- folderId (integer): Filter by Folder ID

Response: Array of Layout objects

```

#### Create Layout

```

POST /layout
Form Data:

- name\*: The layout name
- description: Layout description
- tags: Comma-separated tags
- retired: Is retired? (0 or 1)
- enableStat: Enable stat collection? (0 or 1)
- code: Code identifier
- folderId: Folder ID

Response: Created Layout object (201)

```

#### Edit Layout

```

PUT /layout/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID

Form Data:

- name\*: The Layout Name
- description: The Layout Description
- tags: Comma-separated tags
- retired: Retired flag (0 or 1)
- enableStat: Enable stats? (0 or 1)
- code: Code identifier
- folderId: Folder ID

Response: 200 OK

```

#### Delete Layout

```

DELETE /layout/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID

Response: 204 No Content

```

#### Clear Layout (Draft Only)

```

POST /layout/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID (must be a draft)

Description: Clear all widgets from draft layout

Response: 201 Created

```

#### Edit Layout Background

```

PUT /layout/background/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID

Form Data:

- backgroundColor\*: HEX color for background
- backgroundImageId: Media ID for background image
- backgroundzIndex\*: Layer number
- resolutionId: Resolution ID

Response: 200 OK

```

#### Checkout Layout

```

PUT /layout/checkout/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID

Description: Checkout a Layout for editing. Original still plays.

Response: 200 OK

```

#### Publish Layout

```

PUT /layout/publish/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID

Response: 200 OK

```

#### Discard Layout Changes

```

PUT /layout/discard/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID

Response: 200 OK

```

#### Get Layout Status

```

GET /layout/status/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID

Response: Layout status data

```

---

### Regions

#### Edit Region

```

PUT /region/{id}
Path Parameters:

- id\*: The Region ID to Edit

Form Data:

- width: Width (default 250)
- height: Height
- top: Top coordinate
- left: Left coordinate
- zIndex: Layer number
- transitionType: Valid transition code
- transitionDuration: Duration in milliseconds
- transitionDirection: Transition direction
- loop\*: Loop if 1 media item? (0 or 1)

Response: 200 OK

```

#### Add Region to Layout

```

POST /region/{id}
Path Parameters:

- id\*: The Layout ID to add Region to

Form Data:

- type: zone|frame|playlist|canvas (default: frame)
- width: Width (default 250)
- height: Height
- top: Top coordinate
- left: Left coordinate

Response: 201 Created
Headers: Location header

```

#### Delete Region

```

DELETE /region/{regionId}
Path Parameters:

- regionId\*: The Region ID to Delete

Response: 204 No Content

```

#### Position All Regions

```

PUT /region/position/all/{layoutId}
Path Parameters:

- layoutId\*: The Layout ID

Form Data:

- regions\*: Array of regions with regionId, top, left, width, height

Response: 200 OK

```

#### Add Drawer Region

```

POST /region/drawer/{id}
Path Parameters:

- id\*: The Layout ID to add Region to

Response: 201 Created
Headers: Location header

```

#### Edit Drawer Region

```

PUT /region/drawer/{id}
Path Parameters:

- id\*: The Drawer ID to Save

Form Data:

- width: Width (default 250)
- height: Height

Response: 200 OK

```

---

### Library (Media)

#### List Media

```

GET /library
Query Parameters:

- mediaId (integer): Filter by Media Id
- media (string): Filter by Media Name
- type (string): Filter by Media Type
- ownerId (integer): Filter by Owner Id
- retired (integer): Filter by Retired
- tags (string): Filter by Tags (comma-separated)
- exactTags (integer): Exact tag match
- logicalOperator (string): AND|OR for tags
- duration (string): Filter by duration (format: operator|value)
- fileSize (string): Filter by file size (format: operator|value)
- ownerUserGroupId (integer): Filter by user group
- folderId (integer): Filter by Folder ID
- isReturnPublicUrls (integer): Return authenticated S3 URLs

Response: Array of Media objects

```

#### Upload Media

```

POST /library
Form Data:

- files\*: The Uploaded File
- name: Optional Media Name
- oldMediaId: Id of existing media to replace
- updateInLayouts: Update in all layouts? (0 or 1)
- deleteOldRevisions: Remove old revisions? (0 or 1)
- tags: Comma-separated tags
- expires: Expiry date (Y-m-d H:i:s format)
- playlistId: Playlist ID to add to
- widgetFromDt: Widget start date (Y-m-d H:i:s)
- widgetToDt: Widget end date (Y-m-d H:i:s)
- deleteOnExpiry: Remove widget on expiry? (0 or 1)
- applyToMedia: Apply widgetFromDt as media expiry? (0 or 1)
- folderId: Folder ID

Response: 200 OK

```

#### Edit Media

```

PUT /library/{mediaId}
Path Parameters:

- mediaId\*: The Media ID to Edit

Form Data:

- name\*: Media Item Name
- duration\*: Duration in seconds
- retired\*: Is retired? (0 or 1)
- tags: Comma-separated tags
- updateInLayouts: Update duration in layouts? (0 or 1)
- expires: Expiry date (Y-m-d H:i:s)
- folderId: Folder ID

Response: 200 OK (Media object)

```

#### Delete Media

```

DELETE /library/{mediaId}
Path Parameters:

- mediaId\*: The Media ID to Delete

Form Data:

- forceDelete\*: Force remove from items using it? (0 or 1)
- purge: Add to Purge List for all Displays? (0 or 1)

Response: 204 No Content

```

#### Tag Media

```

POST /library/{mediaId}/tag
Path Parameters:

- mediaId\*: The Media Id to Tag

Form Data:

- tag\*: Array of tags

Response: 200 OK (Media object)

```

#### Untag Media

```

POST /library/{mediaId}/untag
Path Parameters:

- mediaId\*: The Media Id to Untag

Response: 200 OK

```

#### Copy Media

```

POST /library/copy/{mediaId}
Path Parameters:

- mediaId\*: The Media ID to Copy

Response: 201 Created

```

#### Download Media

```

GET /library/download/{mediaId}/{type}
Path Parameters:

- mediaId\*: The Media ID to Download
- type\*: The Module Type of the Download

Response: 200 OK (Binary file)
Headers: X-Sendfile or X-Accel-Redirect (if enabled)

```

#### Download Thumbnail

```

GET /library/thumbnail/{mediaId}
Path Parameters:

- mediaId\*: The Media ID to Download

Response: 200 OK (Image file)
Headers: X-Sendfile or X-Accel-Redirect (if enabled)

```

#### Enable Stats Collection

```

PUT /library/setenablestat/{mediaId}
Path Parameters:

- mediaId\*: The Media ID

Form Data:

- enableStat\*: Stats option (e.g., "On", "Off")

Response: 204 No Content

```

#### Get Library Usage Report

```

GET /library/usage/{mediaId}
Path Parameters:

- mediaId\*: The Media Id

Response: Usage report data

```

#### Get Library Usage Report (Layouts)

```

GET /library/usage/layouts/{mediaId}
Path Parameters:

- mediaId\*: The Media Id

Response: Usage report for layouts

```

#### Tidy Library

```

DELETE /library/tidy
Form Data:

- tidyGenericFiles: Also delete generic files? (0 or 1)

Response: 200 OK

```

---

### Campaigns

#### List Campaigns

```

GET /campaign
Query Parameters: Similar to layouts and playlists

Response: Array of Campaign objects

```

#### Create Campaign

```

POST /campaign
Form Data:

- campaign\*: Campaign name
- description: Campaign description

Response: 201 Created

```

#### Edit Campaign

```

PUT /campaign/{campaignId}
Path Parameters:

- campaignId\*: The Campaign ID

Form Data:

- campaign\*: Campaign name
- description: Campaign description

Response: 201 Created

```

#### Delete Campaign

```

DELETE /campaign/{campaignId}
Path Parameters:

- campaignId\*: The Campaign ID

Response: 204 No Content

```

#### Assign Layout to Campaign

```

POST /campaign/layout/assign/{campaignId}
Path Parameters:

- campaignId\*: The Campaign ID

Form Data:

- layoutId\*: Layout ID to assign

Response: 200 OK

```

#### Remove Layout from Campaign

```

DELETE /campaign/layout/remove/{campaignId}
Path Parameters:

- campaignId\*: The Campaign ID

Form Data:

- layoutId\*: Layout ID to remove

Response: 200 OK

```

---

### Display Groups

#### List Display Groups

```

GET /displaygroup
Query Parameters: Standard filter parameters

Response: Array of DisplayGroup objects

```

#### Create Display Group

```

POST /displaygroup
Form Data:

- displayGroup\*: Group name
- description: Group description
- isDynamic: Dynamic group? (0 or 1)

Response: 201 Created

```

#### Edit Display Group

```

PUT /displaygroup/{displayGroupId}
Path Parameters:

- displayGroupId\*: The Display Group ID

Form Data: Same as create

Response: 201 Created

```

#### Delete Display Group

```

DELETE /displaygroup/{displayGroupId}
Path Parameters:

- displayGroupId\*: The Display Group ID

Response: 204 No Content

```

#### Assign Display to Group

```

POST /displaygroup/{displayGroupId}/display/assign
Path Parameters:

- displayGroupId\*: The Display Group ID

Form Data:

- displayIds\*: Array of Display IDs

Response: 200 OK

```

#### Unassign Display from Group

```

POST /displaygroup/{displayGroupId}/display/unassign
Path Parameters:

- displayGroupId\*: The Display Group ID

Form Data:

- displayIds\*: Array of Display IDs

Response: 200 OK

```

#### Assign Media to Group

```

POST /displaygroup/{displayGroupId}/media/assign
Path Parameters:

- displayGroupId\*: The Display Group ID

Form Data:

- mediaIds\*: Array of Media IDs

Response: 200 OK

```

#### Unassign Media from Group

```

POST /displaygroup/{displayGroupId}/media/unassign
Path Parameters:

- displayGroupId\*: The Display Group ID

Form Data:

- mediaIds\*: Array of Media IDs

Response: 200 OK

```

#### Assign Layout to Group

```

POST /displaygroup/{displayGroupId}/layout/assign
Path Parameters:

- displayGroupId\*: The Display Group ID

Form Data:

- layoutIds\*: Array of Layout IDs

Response: 200 OK

```

#### Unassign Layout from Group

```

POST /displaygroup/{displayGroupId}/layout/unassign
Path Parameters:

- displayGroupId\*: The Display Group ID

Form Data:

- layoutIds\*: Array of Layout IDs

Response: 200 OK

```

---

### User

#### Get Current User

```

GET /user/me
Description: Get authenticated user's details

Response: 200 OK (User object with all properties)

```

#### List Users

```

GET /user
Query Parameters:

- userId (integer): Filter by User Id
- userName (string): Filter by User Name
- userTypeId (integer): Filter by UserType Id
- retired (integer): Filter by Retired

Response: Array of User objects

```

#### Get User Permissions

```

GET /user/permissions/{entity}/{objectId}
Path Parameters:

- entity\*: The Entity type
- objectId\*: The ID of the Object

Response: Array of Permission objects

```

#### Set User Permissions

```

POST /user/permissions/{entity}/{objectId}
Path Parameters:

- entity\*: The Entity type
- objectId\*: The ID of the Object

Form Data:

- groupIds\*: Array of permissions with groupId as key
- ownerId: Change owner (optional)

Response: 204 No Content

````

---

## Data Models

### Playlist Object

```javascript
{
  playlistId: number,
  ownerId: number,
  name: string,
  regionId: number,
  isDynamic: number,
  filterMediaName: string,
  filterMediaNameLogicalOperator: string,
  filterMediaTags: string,
  filterExactTags: number,
  filterMediaTagsLogicalOperator: string,
  filterFolderId: number,
  maxNumberOfItems: number,
  createdDt: string,
  modifiedDt: string,
  duration: number,
  requiresDurationUpdate: number,
  enableStat: string,
  tags: Tag[],
  widgets: Widget[],
  permissions: Permission[],
  folderId: number,
  permissionsFolderId: number
}
````

### Widget Object

```javascript
{
  widgetId: number,
  playlistId: number,
  ownerId: number,
  type: string,
  duration: number,
  displayOrder: number,
  useDuration: number,
  calculatedDuration: number,
  createdDt: string,
  modifiedDt: string,
  fromDt: number,
  toDt: number,
  schemaVersion: number,
  transitionIn: number,
  transitionOut: number,
  transitionDurationIn: number,
  transitionDurationOut: number,
  widgetOptions: WidgetOption[],
  mediaIds: number[],
  audio: WidgetAudio[],
  permissions: Permission[],
  playlist: string
}
```

### Media Object

```javascript
{
  mediaId: number,
  ownerId: number,
  parentId: number,
  name: string,
  mediaType: string,
  storedAs: string,
  fileName: string,
  tags: Tag[],
  fileSize: number,
  duration: number,
  valid: number,
  moduleSystemFile: number,
  expires: number,
  retired: number,
  isEdited: number,
  md5: string,
  owner: string,
  groupsWithPermissions: string,
  released: number,
  apiRef: string,
  createdDt: string,
  modifiedDt: string,
  enableStat: string,
  orientation: string,
  width: number,
  height: number,
  folderId: number,
  permissionsFolderId: number
}
```

### Permission Object

```javascript
{
  permissionId: number,
  entityId: number,
  groupId: number,
  objectId: number,
  isUser: number,
  entity: string,
  objectIdString: string,
  group: string,
  view: number,
  edit: number,
  delete: number,
  modifyPermissions: number
}
```

---

## Common Query Patterns

### Filter by Tags

```
GET /playlist?tags=tag1,tag2&logicalOperator=AND
GET /playlist?tags=tag1&exactTags=1
```

### Embed Related Data

```
GET /layout?embed=regions,playlists,widgets,tags,campaigns,permissions
GET /playlist?embed=widgets,permissions,tags
```

### Pagination/Sorting

Most endpoints support:

- `start`: Starting position
- `length`: Number of records to return
- `draw`: Draw count for DataTables

---

## Error Handling

**Common Response Codes:**

- **200**: OK - Successful GET or PUT
- **201**: Created - Successful POST or resource creation
- **204**: No Content - Successful DELETE or PUT with no response body
- **400**: Bad Request - Invalid parameters
- **401**: Unauthorized - Missing or invalid authentication
- **404**: Not Found - Resource doesn't exist
- **500**: Internal Server Error

---

## Best Practices

1. **Authentication**: Always include JWT token in Authorization header
2. **Form Data**: Use `application/x-www-form-urlencoded` for PUT requests
3. **Embed Data**: Use embed parameter to reduce API calls
4. **Filtering**: Combine filters to get specific results
5. **Pagination**: Use start/length for large result sets
6. **Error Handling**: Always check response status codes
7. **Rate Limiting**: Be mindful of API rate limits
8. **Caching**: Cache frequently accessed data locally

---

## Useful Endpoints Summary

| Operation       | Method | Endpoint                       | Status |
| --------------- | ------ | ------------------------------ | ------ |
| List Playlists  | GET    | `/playlist`                    | 200    |
| Create Playlist | POST   | `/playlist`                    | 201    |
| Get Playlist    | GET    | `/playlist/{id}`               | 200    |
| Update Playlist | PUT    | `/playlist/{id}`               | 204    |
| Delete Playlist | DELETE | `/playlist/{id}`               | 204    |
| Add Widget      | POST   | `/playlist/widget/{type}/{id}` | 201    |
| Update Widget   | PUT    | `/playlist/widget/{id}`        | 204    |
| Delete Widget   | DELETE | `/playlist/widget/{id}`        | 200    |
| Upload Media    | POST   | `/library`                     | 200    |
| Get Media       | GET    | `/library`                     | 200    |
| Update Media    | PUT    | `/library/{id}`                | 200    |
| Delete Media    | DELETE | `/library/{id}`                | 204    |
| List Layouts    | GET    | `/layout`                      | 200    |
| Create Layout   | POST   | `/layout`                      | 201    |
| Update Layout   | PUT    | `/layout/{id}`                 | 200    |
| Delete Layout   | DELETE | `/layout/{id}`                 | 204    |

---

## Notes for Frontend Integration

- All API calls use `/api` base path
- Use `fetch()` with proper headers for CORS
- Include JWT token in all requests
- Handle loading states during API calls
- Implement proper error handling and user feedback
- Cache responses to reduce server load
- Use query parameters for filtering and sorting
- Support pagination for large datasets

---

**Last Updated**: November 17, 2025
**API Version**: 4.0 (OAS 2.0)
**Xibo CMS Manual**: <https://xibosignage.com/manual/>
**Swagger JSON**: <https://xibosignage.com/manual/swagger.json>

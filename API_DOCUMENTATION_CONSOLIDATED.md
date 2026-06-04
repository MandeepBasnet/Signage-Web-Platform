# Signage Platform — Consolidated API Documentation

> **Single source of truth.** Merges and reconciles the previously separate docs
> (`XIBO_API_DOCUMENTATION.md`, `XIBO_API_REFERENCE.md`, `API_Documentation`,
> `report_publish_workflow.md.resolved`, `HowPublishWorks`,
> `HowOnClickLayoutShouldWork`), and is verified against:
> - the **actual backend code** in [backend/src](backend/src), and
> - the **official Xibo OpenAPI spec** `swagger.json` (Xibo API v4.0, OAS 2.0,
>   229 operations / 174 paths) at
>   <https://account.xibosignage.com/manual/swagger.json> (the machine-readable
>   source behind <https://account.xibosignage.com/manual/api/>).
>
> Two API layers are documented:
> 1. **This platform's API** — the Express backend at `/api/*` the React frontend
>    calls ([§3](#3-platform-backend-api)).
> 2. **The upstream Xibo CMS API** — what the backend proxies ([§4](#4-xibo-cms-api-reference)).

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Authentication](#2-authentication)
3. [Platform Backend API](#3-platform-backend-api)
4. [Xibo CMS API Reference](#4-xibo-cms-api-reference) — **all 25 resource groups**
5. [Key Workflows](#5-key-workflows)
6. [Conventions](#6-conventions)
7. [Data Models](#7-data-models)
8. [Reconciled Discrepancies](#8-reconciled-discrepancies)

---

## 1. Architecture Overview

```
┌──────────────┐   Authorization:Bearer  ┌─────────────────────┐   Bearer app token  ┌──────────────┐
│ React (Vite) │ ──── <platform JWT> ───▶ │  Express backend    │ ──────────────────▶ │  Xibo CMS    │
│  frontend    │                          │  (this repo) proxy  │   OAuth2            │  REST API /api│
└──────────────┘ ◀─────── JSON ────────── │  + business logic   │ ◀────────────────── └──────────────┘
                                          └─────────────────────┘
```

- **Frontend** ([frontend/src](frontend/src)): pages + content components
  (`MediaContent`, `PlaylistContent`, `LayoutDesign`, `DatasetContent`,
  `DisplayContent`, `ScheduleContent`, …). Calls only the platform backend at
  `VITE_API_BASE_URL` (default `http://localhost:5000/api`).
- **Backend** ([backend/src/server.js](backend/src/server.js)): mounts routers
  under `/api/*`, verifies platform JWTs, calls Xibo via
  [xiboClient.js](backend/src/utils/xiboClient.js) /
  [xiboDataHelpers.js](backend/src/utils/xiboDataHelpers.js).
- **Why proxy?** Hides Xibo OAuth creds, adds per-user scoping & de-dup,
  normalizes Xibo's DataTables responses to `{ data: [...] }`, streams/caches
  media thumbnails.

**Backend env vars:** `XIBO_API_URL` (e.g. `https://portal.signage-lab.com/api`),
`XIBO_CLIENT_ID`, `XIBO_CLIENT_SECRET`, `JWT_SECRET`, `PORT`, `NODE_ENV`.

**Spec facts (from swagger.json):** `title: Xibo API`, `version: 4.0`,
`basePath: /api`, `schemes: [http]`, `produces: [application/json]`.

---

## 2. Authentication

Two **distinct** mechanisms — don't conflate them.

### 2.1 Platform auth (frontend ⇄ backend)
The frontend gets a **platform JWT** from the backend, stored in `localStorage`
as `auth_token`, sent as `Authorization: Bearer <jwt>` (or `?token=<jwt>` on
`<img>`/`<video>` URLs). Verified by
[verifyToken](backend/src/middleware/authMiddleware.js).

| Method | Endpoint | Body |
|--------|----------|------|
| POST | `/api/auth/register` | `{ username, password, … }` |
| POST | `/api/auth/login` | `{ username, password }` → `{ access_token, user }` |

### 2.2 Upstream Xibo auth (backend ⇄ Xibo)
Xibo uses **OAuth2**. The spec's `securityDefinitions` declares:
```
auth (oauth2):
  flow:            accessCode            # authorization_code
  authorizationUrl: /api/authorize
  tokenUrl:         /api/authorize/access_token
  scopes:           read:all, write:all
```
Global security applies `auth: [write:all, read:all]` to every endpoint.

**This platform uses the `client_credentials` grant** (machine-to-machine), which
hits the same token URL. From [getAccessToken](backend/src/utils/xiboClient.js):
```
POST {XIBO_API_URL}/authorize/access_token        # multipart/form-data
client_id={CLIENT_ID}&client_secret={CLIENT_SECRET}&grant_type=client_credentials
→ { "access_token": "...", "token_type": "Bearer", "expires_in": 3600 }
```
The token is cached in memory until expiry and sent as `Authorization: Bearer …`.

> ⚠️ Legacy docs said `POST /oauth/access_token`. **Correct path** is
> `/authorize/access_token` (relative to `/api`). See [§8](#8-reconciled-discrepancies).

**Proxy password verification.** A client_credentials token can't verify a user's
password. So login does a **web-proxy check**
([verifyXiboPassword](backend/src/utils/xiboClient.js)): GET the Xibo `/login`
page, scrape `csrfToken`, POST credentials, treat a `302` away from `/login` as
success. The user is then looked up via `GET /user?userName=…`.

All proxied calls go through
[xiboRequest()](backend/src/utils/xiboClient.js) — auto-retries once on `401`
with a refreshed token; uses `application/x-www-form-urlencoded` for `PUT`.

---

## 3. Platform Backend API

Endpoints the frontend actually calls. All require the platform JWT unless noted.
Base path `/api`. Each maps to one or more Xibo calls (see [§4](#4-xibo-cms-api-reference)).

### 3.1 Auth — [authRoutes.js](backend/src/routes/authRoutes.js)
`POST /api/auth/register` · `POST /api/auth/login`

### 3.2 Library / Media — [libraryRoutes.js](backend/src/routes/libraryRoutes.js)
| Method | Path | → Xibo |
|--------|------|--------|
| GET | `/api/library` | `GET /library` (paged, owner-scoped via [fetchUserScopedCollection](backend/src/utils/xiboDataHelpers.js)); returns `{ data, total }` |
| GET | `/api/library/all` | `GET /library` (all) |
| GET | `/api/library/folders` | `GET /folders` |
| POST | `/api/library/validate-name` | `GET /library?ownerId=` (dup pre-check) |
| POST | `/api/library/upload` | `POST /library` + `PUT /library/{id}` + `POST /user/permissions/...` |
| GET | `/api/library/:mediaId/download` | `GET /library/download/{id}` (stream; `?token=`) |
| GET | `/api/library/:mediaId/thumbnail` | `GET /library/thumbnail/{id}` — **in-memory LRU cached**; `?width&height&preview&token` |
| DELETE | `/api/library/:mediaId` | `DELETE /library/{id}` (409 if in use) |

### 3.3 Layouts — [layoutRoutes.js](backend/src/routes/layoutRoutes.js)
| Method | Path | → Xibo |
|--------|------|--------|
| GET | `/api/layouts` | `GET /layout` |
| GET | `/api/layouts/:layoutId` | `GET /layout/{id}?embed=…` |
| GET | `/api/layouts/thumbnail/:layoutId` | layout preview image |
| GET | `/api/layouts/:layoutId/preview` | layout preview HTML |
| PUT | `/api/layouts/checkout/:layoutId` | `PUT /layout/checkout/{id}` |
| PUT | `/api/layouts/publish/:layoutId` | `PUT /layout/publish/{id}` (`publishNow=1`) |
| PUT | `/api/layouts/widgets/:widgetId` | `PUT /playlist/widget/{id}` |

### 3.4 Playlists & Widgets — [playlistRoutes.js](backend/src/routes/playlistRoutes.js)
`GET/POST /api/playlists` · `GET/DELETE /api/playlists/:playlistId` ·
`POST /api/playlists/:playlistId/media` (→ `POST /playlist/library/assign/{id}`) ·
`GET /api/playlists/:playlistId/available-media` ·
`DELETE /api/playlists/:playlistId/media/:widgetId` ·
`PUT …/media/:widgetId/duration` · `PUT …/media/:widgetId/expiry` ·
`POST /api/playlists/:playlistId/upload` (multipart `media`) ·
`GET /api/playlists/media/:mediaId/preview` ·
`PUT /api/playlists/widgets/:widgetId/elements`

### 3.5 Datasets — [datasetRoutes.js](backend/src/routes/datasetRoutes.js)
`GET /api/datasets` · `GET /api/datasets/:id/column` ·
`GET/POST /api/datasets/data/:id` · `DELETE /api/datasets/data/:id/:rowId`

### 3.6 Displays — [displayRoutes.js](backend/src/routes/displayRoutes.js)
`GET /api/displays` · `PUT /api/displays/:displayId` · `DELETE /api/displays/:displayId`

### 3.7 Schedule — [scheduleRoutes.js](backend/src/routes/scheduleRoutes.js)
`GET /api/schedule`

### 3.8 Regions & Widget resources — [regionRoutes.js](backend/src/routes/regionRoutes.js), [widgetRoutes.js](backend/src/routes/widgetRoutes.js)
`GET /api/regions/preview/:regionId` (`?width&height&seq`) ·
`GET /api/widgets/resource/:regionId/:widgetId` (`?preview&isEditor`) ·
`PUT /api/widgets/:widgetId`

---

## 4. Xibo CMS API Reference

Complete upstream reference — **all 25 resource groups, 229 operations**. Base URL
`{XIBO_API_URL}` (`…/api`). `PUT` requires `Content-Type: application/x-www-form-urlencoded`.
`Authorization: Bearer <app_token>`. `*` = required. ✅ = proxied by this platform today.

### 4.1 Misc (`misc`)
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/about` | CMS version/environment |
| GET | `/clock` | Current CMS time |

### 4.2 Layouts (`layout`) — 24 ops
| Method | Endpoint | Key params |
|--------|----------|------------|
| GET | `/layout` ✅ | `layoutId, parentId, showDrafts, layout, userId, retired, tags, exactTags, logicalOperator, ownerUserGroupId, publishedStatusId (1=Published,2=Draft), embed (regions,playlists,widgets,tags,campaigns,permissions), campaignId, folderId` |
| POST | `/layout` | `name, description, layoutId (template), resolutionId, returnDraft, code, folderId` |
| PUT | `/layout/{layoutId}` | `name*, description, tags, retired, enableStat, code, folderId` |
| POST | `/layout/{layoutId}` | Clear draft canvas |
| DELETE | `/layout/{layoutId}` | |
| PUT | `/layout/background/{layoutId}` | `backgroundColor*, backgroundImageId, backgroundzIndex*, resolutionId` |
| PUT | `/layout/applyTemplate/{layoutId}` | `templateId` |
| PUT | `/layout/retire/{id}` · `/layout/unretire/{id}` | |
| PUT | `/layout/setenablestat/{layoutId}` | `enableStat*` |
| POST | `/layout/copy/{layoutId}` | `name*, description, copyMediaFiles*` |
| POST | `/layout/{layoutId}/tag` · `/untag` | `tag*[]` |
| GET | `/layout/status/{layoutId}` | Validation status |
| PUT | `/layout/checkout/{layoutId}` ✅ | → Draft object |
| PUT | `/layout/publish/{layoutId}` ✅ | `publishNow, publishDate` |
| PUT | `/layout/discard/{layoutId}` | |
| POST | `/layout/fullscreen` | `id*, type* (media\|playlist), resolutionId, backgroundColor, layoutDuration` |

### 4.3 Regions (`layout` tag) — included with layouts
| Method | Endpoint | Key params |
|--------|----------|------------|
| POST | `/region/{layoutId}` | `type (zone\|frame\|playlist\|canvas, default frame), width, height, top, left` |
| PUT | `/region/{regionId}` | `width, height, top, left, zIndex, transitionType, transitionDuration, transitionDirection, loop*` |
| DELETE | `/region/{regionId}` | |
| PUT | `/region/position/all/{layoutId}` | `regions*[]` (JSON-encoded: regionId, top, left, width, height) |
| POST | `/region/drawer/{layoutId}` · PUT `/region/drawer/{id}` | Drawer region add/save |

### 4.4 Playlists (`playlist`) — 12 ops
| Method | Endpoint | Key params |
|--------|----------|------------|
| GET | `/playlist` ✅ | `playlistId, name, userId, tags, exactTags, logicalOperator, ownerUserGroupId, embed (regions,widgets,permissions,tags), folderId` |
| POST | `/playlist` ✅ | `name*, isDynamic*, tags, filterMediaName, logicalOperatorName, filterMediaTag, exactTags, logicalOperator, maxNumberOfItems, folderId` |
| PUT | `/playlist/{playlistId}` | same as POST → **204** |
| DELETE | `/playlist/{playlistId}` ✅ | |
| POST | `/playlist/copy/{playlistId}` | `name*, copyMediaFiles*` |
| POST | `/playlist/library/assign/{playlistId}` ✅ | `media*[], duration, useDuration, displayOrder` |
| POST | `/playlist/order/{playlistId}` | `widgets*[]` (all widgetIds + positions) |
| GET | `/playlist/usage/{id}` · `/usage/layouts/{id}` | Usage reports |
| PUT | `/playlist/setenablestat/{playlistId}` | `enableStat*` (On/Off/Inherit) |
| POST | `/playlist/{id}/convert` | `name` — inline → global playlist |
| PUT | `/playlist/{id}/selectfolder` | `folderId` |

### 4.5 Widgets (`widget`) — 15 ops (all under `/playlist/widget`)
| Method | Endpoint | Key params |
|--------|----------|------------|
| POST | `/playlist/widget/{type}/{playlistId}` | `displayOrder, templateId` (media widgets use library/assign instead) |
| PUT | `/playlist/widget/{id}` ✅ | `useDuration, duration, name, enableStat, isRepeatData, showFallback (never\|always\|empty\|error), properties` |
| DELETE | `/playlist/widget/{widgetId}` | |
| PUT | `/playlist/widget/transition/{type}/{widgetId}` | `transitionType* (fly\|fadeIn\|fadeOut), transitionDuration, transitionDirection` |
| PUT/DELETE | `/playlist/widget/{widgetId}/audio` | `mediaId, volume (0-100), loop` |
| PUT | `/playlist/widget/{widgetId}/expiry` | `fromDt, toDt, deleteOnExpiry` |
| PUT | `/playlist/widget/{widgetId}/region` | `targetRegionId*` (drawer) |
| PUT | `/playlist/widget/{widgetId}/elements` ✅ | body JSON `elements*` |
| PUT | `/playlist/widget/{widgetId}/dataType` | body JSON `dataType*` |
| GET/POST | `/playlist/widget/data/{id}` | get / add fallback data (`data*`, `displayOrder`) |
| PUT/DELETE | `/playlist/widget/data/{id}/{dataId}` | edit / delete data |
| POST | `/playlist/widget/data/{id}/order` | body `order*[]` |

### 4.6 Library / Media (`library`) — 17 ops
| Method | Endpoint | Key params |
|--------|----------|------------|
| GET | `/library` ✅ | `mediaId, media, type, ownerId, retired, tags, exactTags, logicalOperator, duration, fileSize, ownerUserGroupId, folderId, isReturnPublicUrls`. `duration`/`fileSize` accept number or `operator|value` (lt/gt/lte/gte) |
| POST | `/library` ✅ | `files*, name, oldMediaId, updateInLayouts, deleteOldRevisions, tags, expires, playlistId, widgetFromDt/ToDt, deleteOnExpiry, applyToMedia, folderId` |
| GET | `/library/search` | Search all (local + connectors) |
| PUT | `/library/{mediaId}` ✅ | `name*, duration*, retired*, tags, updateInLayouts, expires, folderId` |
| DELETE | `/library/{mediaId}` ✅ | `forceDelete*, purge` |
| GET | `/library/download/{mediaId}/{type}` ✅ | Binary |
| GET | `/library/thumbnail/{mediaId}` ✅ | Thumbnail (`width, height, preview` via query) |
| POST | `/library/{mediaId}/tag` · `/untag` | `tag*[]` |
| POST | `/library/copy/{mediaId}` | `name*, tags` |
| POST | `/library/uploadUrl` | `url*, type*, extension, enableStat, optionalName, expires, folderId` |
| GET | `/library/usage/{id}` · `/usage/layouts/{id}` · `/{id}/isused/` | Usage / in-use |
| PUT | `/library/{id}/selectfolder` · `/setenablestat/{id}` | Folder / stats |
| DELETE | `/library/tidy` | `tidyGenericFiles` |

### 4.7 Campaigns (`campaign`) — 7 ops
| Method | Endpoint | Key params |
|--------|----------|------------|
| GET | `/campaign` | `campaignId, name, tags, exactTags, logicalOperator, hasLayouts, isLayoutSpecific, retired, totalDuration, embed, folderId` |
| POST | `/campaign` | `type* (list\|ad), name*, folderId, layoutIds[], cyclePlaybackEnabled, playCount, listPlayOrder, targetType (plays\|budget\|imp), target` |
| PUT | `/campaign/{campaignId}` | + `manageLayouts, startDt, endDt, displayGroupIds[], ref1..5` |
| DELETE | `/campaign/{campaignId}` | |
| POST | `/campaign/layout/assign/{campaignId}` | `layoutId*` (**single** since v3.0), `daysOfWeek[], dayPartId, geoFence` |
| DELETE | `/campaign/layout/remove/{campaignId}` | `layoutId*, displayOrder` |
| PUT | `/campaign/{id}/selectfolder` | `folderId` |

### 4.8 Templates (`template`) — 4 ops
`GET /template` · `GET /template/search` · `POST /template` (`name*, description,
resolutionId, returnDraft`) · `POST /template/{layoutId}` (`includeWidgets*,
name*, tags, description`).

### 4.9 Resolutions (`resolution`) — 4 ops
`GET /resolution` (`resolutionId, resolution, partialResolution, enabled, width,
height`) · `POST /resolution` (`resolution*, width*, height*`) ·
`PUT /resolution/{id}` (+ `enabled`) · `DELETE /resolution/{id}`.

### 4.10 Displays (`display`) — 10 ops
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/display` ✅ | `displayId, displayGroupId, display, tags, macAddress, hardwareKey, clientVersion/Type/Code, authorised, displayProfileId, mediaInventoryStatus (1=up-to-date,2=downloading,3=out-of-date), loggedIn, lastAccessed, folderId, xmrRegistered, isPlayerSupported, embed` |
| PUT | `/display/{displayId}` ✅ | `display*, defaultLayoutId*, licensed*, license*, incSchedule*, emailAlert*, wakeOnLanEnabled*` + many optional (geo, venue, profile, ref1..5) |
| DELETE | `/display/{displayId}` ✅ | |
| PUT | `/display/authorise/{id}` | Toggle authorised |
| PUT | `/display/defaultlayout/{id}` | `layoutId*` |
| PUT | `/display/licenceCheck/{id}` · `/purgeAll/{id}` · `/requestscreenshot/{id}` | |
| GET | `/display/status/{id}` | |
| POST | `/display/wol/{id}` | Wake on LAN |

### 4.11 Display Groups (`displayGroup`) — 22 ops
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/displaygroup` | `displayGroupId, displayGroup, displayId, nestedDisplayId, dynamicCriteria, tags, exactTags, logicalOperator, isDisplaySpecific, forSchedule, folderId` |
| POST | `/displaygroup` | `displayGroup*, description, tags, isDynamic*, dynamicCriteria, dynamicCriteriaTags, logicalOperator(Name), exactTags, folderId` |
| PUT/DELETE | `/displaygroup/{id}` | Edit (+ ref1..5) / delete |
| POST | `/displaygroup/{id}/copy` | `displayGroup*, copyMembers, copyAssignments, copyTags` |
| POST | `/displaygroup/{id}/display/assign` · `/unassign` | `displayId*[]` (assign also takes `unassignDisplayId[]`) |
| POST | `/displaygroup/{id}/displayGroup/assign` · `/unassign` | nested groups |
| POST | `/displaygroup/{id}/media/assign` · `/unassign` | `mediaId*[]` |
| POST | `/displaygroup/{id}/layout/assign` · `/unassign` | `layoutId*[]` |
| POST | `/displaygroup/{id}/action/collectNow` · `/clearStatsAndLogs` · `/revertToSchedule` | |
| POST | `/displaygroup/{id}/action/changeLayout` | `layoutId\|campaignId, duration, downloadRequired, changeMode* (queue\|replace)` |
| POST | `/displaygroup/{id}/action/overlayLayout` | `layoutId*, duration, downloadRequired` |
| POST | `/displaygroup/{id}/action/command` | `commandId*` |
| POST | `/displaygroup/{id}/action/triggerWebhook` | `triggerCode*` |
| POST | `/displaygroup/criteria[/{id}]` | body `criteriaUpdates*` (push criteria to player) |
| PUT | `/displaygroup/{id}/selectfolder` | `folderId` |

### 4.12 Display Settings / Profiles (`displayprofile`) — 5 ops + Venues
`GET /displayprofile` (`displayProfileId, displayProfile, type (windows\|android\|lg),
embed`) · `POST /displayprofile` (`name*, type*, isDefault*`) ·
`PUT/DELETE /displayprofile/{id}` · `POST /displayprofile/{id}/copy` (`name*`).
**Venues:** `GET /displayvenue`.

### 4.13 Schedule (`schedule`) — 7 ops
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/schedule` ✅ | grid: `eventTypeId (1=Layout,2=Command,3=Overlay,4=Interrupt,5=Campaign,6=Action,7=Media,…), fromDt, toDt, geoAware, recurring, campaignId, displayGroupIds[]` |
| GET | `/schedule/data/events` | calendar: `displayGroupIds*[] ([-1]=all), from, to` |
| GET | `/schedule/{displayGroupId}/events` | `singlePointInTime, date, startDate, endDate` |
| POST | `/schedule` | `eventTypeId*, displayGroupIds*[], displayOrder*, isPriority*, fromDt*, toDt`; type-specific: `campaignId, fullScreenCampaignId, commandId, mediaId, dayPartId, syncTimezone`; recurrence `recurrenceType/Detail/Range/RepeatsOn`; geo `isGeoAware, geoLocation[]\|geoLocationJson`; action `actionType, actionTriggerCode, actionLayoutCode`; data connector `dataSetId, dataSetParams`; `scheduleReminders[]` |
| PUT | `/schedule/{eventId}` | same as POST |
| DELETE | `/schedule/{eventId}` · `/schedulerecurrence/{eventId}` | delete event / recurring |

> ⚠️ `eventTypeId` here is **1=Layout** (not 1=Campaign as legacy docs claimed). See [§8](#8-reconciled-discrepancies).

### 4.14 DataSets (`dataset`) — 22 ops
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/dataset` ✅ | `dataSetId, dataSet, code, isRealTime, userId, embed (columns), folderId` |
| POST | `/dataset` | `dataSet*, isRemote*, isRealTime*, dataConnectorSource*`; remote fields: `method, uri, postData, authentication (None\|Basic\|Digest), username, password, customHeaders, userAgent, refreshRate, clearRate, truncateOnEmpty, runsAfter, dataRoot, summarize, summarizeField, sourceId (1=json,2=csv), ignoreFirstRow, rowLimit, limitPolicy (stop\|fifo\|…), csvSeparator, dataConnectorScript, folderId` |
| PUT/DELETE | `/dataset/{dataSetId}` | Edit / delete |
| POST | `/dataset/copy/{dataSetId}` | `dataSet*, description, code, copyRows` |
| PUT | `/dataset/{id}/selectfolder` · `/dataConnector/{id}` | folder / connector script |
| GET | `/dataset/export/csv/{dataSetId}` | CSV export |
| POST | `/dataset/import/{dataSetId}` | `files*, csvImport_{columnId}*, overwrite, ignorefirstrow` |
| POST | `/dataset/importjson/{dataSetId}` | body `data*` (`{ uniqueKeys, rows }`) |
| GET/POST | `/dataset/data/{dataSetId}` ✅ | rows / add row (`dataSetColumnId_ID*`) |
| PUT/DELETE | `/dataset/data/{dataSetId}/{rowId}` ✅(DELETE) | edit / delete row |
| GET/POST | `/dataset/{dataSetId}/column` ✅(GET) | search / add column (`heading*, columnOrder*, dataTypeId*, dataSetColumnTypeId*, showFilter*, showSort*, listContent, formula, remoteField, tooltip, isRequired, dateFormat`) |
| PUT/DELETE | `/dataset/{dataSetId}/column/{columnId}` | edit / delete column |
| GET/POST | `/dataset/{dataSetId}/rss` | RSS feeds (`title*, summaryColumnId*, contentColumnId*, publishedDateColumnId*`) |
| PUT/DELETE | `/dataset/{dataSetId}/rss/{rssId}` | edit (`regeneratePsk*`) / delete |

### 4.15 Folders (`folder`) — 4 ops
`GET /folders` ✅ (`gridView, folderId, folderName, exactFolderName`) ·
`POST /folders` (`text*, parentId`) · `PUT /folders/{id}` (`text*`) ·
`DELETE /folders/{id}`.

### 4.16 Users (`user`) — 12 ops
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/user` ✅ | `userId, userName, userTypeId, retired` (used during login lookup) |
| GET | `/user/me` | Authenticated user |
| POST | `/user` | `userName*, userTypeId*, homePageId*, password*, groupId*, newUserWizard*, hideNavigation*` + email/name/phone/ref/quota |
| PUT/DELETE | `/user/{userId}` | Edit / delete (`deleteAllItems, reassignUserId`) |
| GET | `/user/permissions/{entity}/{objectId}` ✅ | Read permissions |
| POST | `/user/permissions/{entity}/{objectId}` ✅ | `groupIds*[], ownerId` (ownership transfer on media upload) |
| GET | `/user/permissions/{entity}` | `ids*` (bulk read) |
| POST | `/user/permissions/{entity}/multiple` | `ids*, groupIds*[], ownerId` |
| GET/PUT/POST | `/user/pref` | User preferences |

### 4.17 User Groups (`usergroup`) — 7 ops
`GET /group` · `POST /group` (`group*` + notification flags) ·
`PUT/DELETE /group/{userGroupId}` · `POST /group/{id}/copy`
(`group*, copyMembers, copyFeatures`) ·
`POST /group/members/assign/{userGroupId}` · `/unassign/{userGroupId}` (`userId*[]`).

### 4.18 Notifications (`notification`) — 4 ops
| Method | Endpoint | Notes |
|--------|----------|-------|
| GET | `/notification` | `notificationId, subject, embed (userGroups,displayGroups)` |
| POST | `/notification` | `subject*, body, releaseDt (ISO), isInterrupt*, displayGroupIds*[], userGroupIds*[]` |
| PUT | `/notification/{id}` | same (`releaseDt*`) |
| DELETE | `/notification/{id}` | |

### 4.19 Statistics (`statistics`) — 3 ops
`GET /stats` (`type (Layout\|Media\|Widget), fromDt, toDt, statDate, statId,
displayId(s), layoutId[], mediaId[], campaignId, parentCampaignId,
returnDisplayLocalTime, returnDateFormat, embed`) ·
`GET /stats/getExportStatsCount` · `GET /stats/timeDisconnected` (`fromDt*, toDt*`).

### 4.20 Modules (`module`) — 4 ops
`GET /module` · `GET /module/properties/{id}` ·
`GET /module/templates/{dataType}` (`type`) ·
`GET /module/template/{dataType}/properties/{id}`.

### 4.21 Commands (`command`) — 4 ops
`GET /command` (`commandId, command, code, useRegexForName/Code,
logicalOperatorName/Code`) · `POST /command` (`command*, code*, description,
commandString, validationString, availableOn, createAlertOn`) ·
`PUT/DELETE /command/{commandId}`.

### 4.22 Dayparting (`dayPart`) — 4 ops
`GET /daypart` (`dayPartId, name, embed (exceptions)`) ·
`POST /daypart` (`name*, startTime*, endTime*, description,
exceptionDays/StartTimes/EndTimes[]`) · `PUT/DELETE /daypart/{dayPartId}`.

### 4.23 Tags (`tags`) — 4 ops
`GET /tag` (`tagId, tag, exactTag, isSystem, isRequired, haveOptions`) ·
`POST /tag` (`name, isRequired, options`) · `PUT/DELETE /tag/{tagId}`.

### 4.24 Sync Groups (`syncGroup`) — 6 ops
`GET /syncgroups` (`syncGroupId, name, ownerId, folderId`) ·
`POST /syncgroup/add` (`name*, syncPublisherPort, folderId`) ·
`POST /syncgroup/{id}/edit` (`name*, leadDisplayId*, syncSwitchDelay,
syncVideoPauseDelay, …`) · `POST /syncgroup/{id}/members` (`displayId*[],
unassignDisplayId[]`) · `GET /syncgroup/{id}/displays` (`eventId`) ·
`DELETE /syncgroup/{id}/delete`.

### 4.25 Actions (`action`) — 3 ops (interactive)
`GET /action` (`actionId, ownerId, triggerType, triggerCode, actionType, source,
sourceId, target, targetId, layoutId, sourceOrTargetId`) ·
`POST /action` (`layoutId*, actionType* (next\|previous\|navLayout\|navWidget),
target* (screen\|region), targetId, source (layout\|region\|widget), sourceId,
triggerType (touch\|webhook), triggerCode, widgetId, layoutCode`) ·
`DELETE /action/{actionId}`.

### 4.26 Fonts (`font`) — 5 ops
`GET /fonts` (`id, name`) · `POST /fonts` (`files*, name`) ·
`GET /fonts/details/{id}` · `GET /fonts/download/{id}` · `DELETE /fonts/{id}/delete`.

### 4.27 Player Software (`Player Software`) — 4 ops
`POST /playersoftware` (`files*`) · `GET /playersoftware/download/{id}` ·
`PUT /playersoftware/{versionId}` (`playerShowVersion, version, code`) ·
`DELETE /playersoftware/{versionId}`.

### 4.28 Menu Boards (`menuBoard`) — 13 ops · *feature preview — do not use in production*
`GET /menuboards` · `POST /menuboard` (`name*, description, code, folderId`) ·
`PUT/DELETE /menuboard/{menuId}` · `PUT /menuboard/{id}/selectfolder` ·
`GET /menuboard/{menuId}/categories` · `POST /menuboard/{menuId}/category` ·
`PUT/DELETE /menuboard/{menuCategoryId}/category` ·
`GET /menuboard/{menuCategoryId}/products` ·
`POST /menuboard/{menuCategoryId}/product` ·
`PUT/DELETE /menuboard/{menuProductId}/product`.

---

## 5. Key Workflows

### 5.1 Layout edit: Checkout → Design → Publish
From `HowPublishWorks` / `HowOnClickLayoutShouldWork` captures and
`report_publish_workflow.md.resolved`:
1. Layout starts **Published**.
2. **Checkout** `PUT /layout/checkout/{layoutId}` → **Draft** (`publishedStatusId: 2`);
   original keeps playing.
3. **Design** the draft in the Layout Designer.
4. **Publish** `PUT /layout/publish/{layoutId}` (web UI body `publishNow=on&publishDate=`;
   API form `publishNow=1`) → **Published**; if in use, the update is pushed to players.

**Desired platform behavior:** clicking a layout auto-checkouts then **immediately
redirects** into the designer; Publish calls the publish endpoint with `publishNow=1`.
Platform routes: `PUT /api/layouts/checkout/:layoutId`,
`PUT /api/layouts/publish/:layoutId`. Guard against "already checked out" by
checking `publishedStatusId` first.

### 5.2 Media upload (dedup + ownership transfer)
[uploadMedia](backend/src/controllers/libraryController.js): pre-check name
(`GET /library?ownerId=`) → `POST /library` (`files[]`, `forceDuplicateCheck=1`)
→ ownership transfer `POST /user/permissions/{Media}/{mediaId}` with `ownerId`
→ `PUT /library/{mediaId}` to force the final name. Check `files[0].error`/`mediaId`.

### 5.3 Add media to a playlist
`POST /api/playlists/:playlistId/media` → `POST /playlist/library/assign/{playlistId}`
(`media[]`, `duration`, `useDuration`, `displayOrder`); reorder via
`POST /playlist/order/{playlistId}`.

### 5.4 Build a complete layout
`POST /layout` → `POST /region/{layoutId}` → `POST /playlist/widget/{type}/{playlistId}`
→ `PUT /playlist/widget/{widgetId}` (duration) → `PUT /layout/publish/{layoutId}`.

---

## 6. Conventions

**Pagination (DataTables).** List endpoints accept `start` (offset, default 0),
`length` (page size, default 10), `draw` (counter), `order[0][column]` /
`order[0][dir]`. Responses carry `recordsTotal` / `recordsFiltered`. Backend
helper [fetchUserScopedCollection](backend/src/utils/xiboDataHelpers.js) loops
pages, passes `ownerId`/`userId`, de-dupes, and filters by owner. **Request one
page and let Xibo filter** rather than pulling everything (large libraries are slow).

**Request format.** `GET`/`DELETE` → query params. Uploads → `multipart/form-data`.
`PUT` → **`application/x-www-form-urlencoded`** (Xibo requirement; backend uses
`qs.stringify`). A few PUTs (`/elements`, `/dataType`) and some POSTs take JSON bodies.

**Embedding.** `embed=` inlines related data to cut round-trips, e.g.
`GET /layout?embed=regions,playlists,widgets,tags,campaigns,permissions`.

**Response codes.** `200` · `201` · `204` · `400` · `401` · `403` · `404` ·
`409` (duplicate/in-use) · `422` (validation) · `500`.

**Scopes.** All endpoints are gated by OAuth2 scopes `read:all` / `write:all`.

---

## 7. Data Models

Representative shapes (full per-field tables live in the JSON examples of the
legacy `API_Documentation` for Layout/Region/Playlist/Widget/Permission):

- **Media**: `mediaId, ownerId, parentId, name, mediaType, storedAs, fileName,
  tags[], fileSize, duration, valid, retired, md5, owner, released, createdDt,
  modifiedDt, enableStat, orientation, width, height, folderId, permissionsFolderId`.
- **Layout**: `layoutId, ownerId, campaignId, parentId, publishedStatusId,
  publishedStatus, schemaVersion, layout, description, backgroundColor, width,
  height, orientation, duration, status, retired, regions[], tags[], folderId`.
- **Playlist**: `playlistId, ownerId, name, regionId, isDynamic, filterMedia*,
  maxNumberOfItems, duration, enableStat, widgets[], tags[], folderId`.
- **Widget**: `widgetId, playlistId, ownerId, type, duration, displayOrder,
  useDuration, calculatedDuration, fromDt, toDt, transition*, widgetOptions[],
  mediaIds[], audio[]`.
- **Region**: `regionId, layoutId, ownerId, type, name, width, height, top, left,
  zIndex, regionOptions[], duration, isDrawer, regionPlaylist{}`.
- **Permission**: `permissionId, entityId, groupId, objectId, isUser, entity,
  group, view, edit, delete, modifyPermissions`.

A full published-layout response (regions → `regionPlaylist`, drawers) is captured
in `HowPublishWorks`.

---

## 8. Reconciled Discrepancies

Legacy docs disagreed; this file uses the **spec/code-verified** value.

| Topic | Legacy docs | Correct (verified) |
|-------|-------------|--------------------|
| Token endpoint | `POST /oauth/access_token` | **`POST {XIBO_API_URL}/authorize/access_token`** (swagger `tokenUrl` + [xiboClient.js](backend/src/utils/xiboClient.js)) |
| OAuth flow/scopes | unspecified | `oauth2 accessCode`, `authorizationUrl /api/authorize`, scopes **`read:all` / `write:all`** |
| Platform's grant | "JWT via Xibo" | **`client_credentials`** app token + **web-proxy CSRF** password check |
| Schedule `eventTypeId` | `1=Campaign,2=Command,3=Overlay` | **`1=Layout, 2=Command, 3=Overlay, 4=Interrupt, 5=Campaign, 6=Action, 7=Media`** |
| Campaign create field | `campaign*` (name) | **`name*`** + required **`type*` (list\|ad)** |
| Campaign assign layout | array of `layoutId` | **single `layoutId`** since v3.0.0 |
| Notification fields | `isEmail, date` | **`releaseDt` (ISO), `isInterrupt*`, `displayGroupIds*[]`, `userGroupIds*[]`** |
| Upload media response | `200 OK` | Xibo returns `files[]`; check `files[0].error` / `files[0].mediaId` |
| Edit Playlist response | `200` | **`204 No Content`** |
| Rate limiting | "100/min, 1000/hr" | **Not in the spec**; depends on the Xibo instance — treat as guidance |
| Coverage | ~14 resource groups | **25 groups / 229 operations** (added Actions, Commands, Dayparting, Fonts, Modules, Statistics, Sync Groups, Tags, Users, User Groups, Menu Boards, Player Software, Folders, Venues, DataSet columns/RSS/import-export) |

---

*Generated by reconciling the project's API docs against the live backend
([backend/src](backend/src)) and the official Xibo v4 OpenAPI spec
(`swagger.json`, 229 operations). When the platform proxies a new Xibo resource,
add it to [§3](#3-platform-backend-api) and mark it ✅ in [§4](#4-xibo-cms-api-reference).*

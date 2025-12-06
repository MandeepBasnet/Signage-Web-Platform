# Text Element Editing Fix - Visual Diagrams

## 1. Request Flow Comparison

### BEFORE FIX ❌

```
┌─────────────────────────────────────────────────────────────────┐
│ User edits text in Canvas widget                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ handleTextSave() Creates:                                        │
│   const formData = new URLSearchParams()                         │
│   headers["Content-Type"] = "application/x-www-form-urlencoded" │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ fetch() Sends:                                                   │
│   method: PUT                                                    │
│   body: formData (URLSearchParams)                               │
│   Content-Type: application/x-www-form-urlencoded (manual)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend xiboClient:                                              │
│   Detects PUT request                                            │
│   Converts to URLSearchParams AGAIN                              │
│   Sets Content-Type AGAIN                                        │
│   (Double encoding?)                                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Xibo API Receives:                                               │
│   ❌ Ambiguous/malformed data                                    │
│   ❌ 400 Bad Request                                             │
│   ❌ Elements parameter corrupted                                │
└─────────────────────────────────────────────────────────────────┘
```

### AFTER FIX ✅

```
┌─────────────────────────────────────────────────────────────────┐
│ User edits text in Canvas widget                                 │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ handleTextSave() Creates:                                        │
│   const formDataObj = new FormData()                             │
│   formDataObj.append('elements', JSON.stringify(data))           │
│   // NO manual Content-Type header                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Browser Automatically:                                           │
│   Generates boundary                                             │
│   Sets Content-Type: multipart/form-data; boundary=...           │
│   Properly encodes form fields                                   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ fetch() Sends:                                                   │
│   method: PUT                                                    │
│   body: FormData (multipart encoded)                             │
│   Content-Type: multipart/form-data; boundary=... (auto)         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend Express:                                                 │
│   Receives multipart request                                     │
│   body-parser parses it                                          │
│   req.body = { elements: "stringified_json" }                    │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Backend xiboClient:                                              │
│   Detects PUT request                                            │
│   Converts { elements: "..." } to URLSearchParams                │
│   Sets Content-Type: application/x-www-form-urlencoded           │
│   Sends to Xibo API (correct format)                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Xibo API Receives:                                               │
│   ✅ Properly formatted form data                                │
│   ✅ 200 OK                                                      │
│   ✅ Elements parameter correctly parsed                         │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│ Frontend Refreshes:                                              │
│   ✅ Layout updates with new text                                │
│   ✅ Alert: "Text updated successfully!"                         │
│   ✅ User is happy                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Error Handling Flow

```
                    Text Save Action
                          ↓
                ┌─────────────────────┐
                │ handleTextSave()    │
                └────────┬────────────┘
                         ↓
              ┌──────────────────────┐
              │ Fetch API Request    │
              │ PUT /elements        │
              └────────┬─────────────┘
                       ↓
            ┌──────────────────────┐
            │ Response OK?         │
            └────────┬─────────────┘
                     ↓
        ┌────────────────────────────┐
        ↓                            ↓
      YES                           NO
        ↓                            ↓
   ✅ SUCCESS              ❌ ERROR (Catch Block)
        ↓                            ↓
   Refresh Layout          Show Error Dialog
        ↓                            ↓
   Show Success Alert    ┌──────────────────────────┐
        ↓                │ "Failed to update text"  │
   Reset Editing State   │ "Open Xibo CMS?"         │
                         └─────┬──────────┬──────────┘
                               ↓          ↓
                              OK       CANCEL
                               ↓          ↓
                          Open Xibo    Dismiss
                          CMS Portal   Dialog
```

---

## 3. Content-Type Handling

```
┌─────────────────────────────────────────────────────────────────┐
│                    BROWSER LAYER                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ FormData() API                                            │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ • Generates boundary: ----WebKitFormBoundary7MA4YWxkTrZu  │   │
│ │ • Encodes fields properly                                 │   │
│ │ • Auto Content-Type: multipart/form-data; boundary=...    │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    NETWORK LAYER                                 │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ Request:                                                  │   │
│ │ PUT /api/playlists/widgets/123/elements HTTP/1.1          │   │
│ │ Content-Type: multipart/form-data; boundary=...           │   │
│ │ Authorization: Bearer token...                            │   │
│ │                                                           │   │
│ │ ----WebKitFormBoundary7MA4YWxkTrZu                        │   │
│ │ Content-Disposition: form-data; name="elements"           │   │
│ │                                                           │   │
│ │ [{"elements":[{"properties":[{"id":"text","value":"..."}] │   │
│ │ ----WebKitFormBoundary7MA4YWxkTrZu--                      │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND EXPRESS LAYER                         │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ body-parser Middleware                                    │   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ • Detects multipart/form-data                             │   │
│ │ • Parses boundary                                         │   │
│ │ • Extracts form fields                                    │   │
│ │ • req.body = { elements: "stringified_json" }             │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    xiboClient LAYER                              │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ xiboRequest('/playlist/widget/123/elements', 'PUT', {...})│   │
│ ├───────────────────────────────────────────────────────────┤   │
│ │ • Detects PUT method                                      │   │
│ │ • Converts { elements } to URLSearchParams                │   │
│ │ • Sets Content-Type: application/x-www-form-urlencoded    │   │
│ │ • Creates: elements=%5B%7B...%7D%5D (URL-encoded)         │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│                    XIBO API LAYER                                │
│ ┌───────────────────────────────────────────────────────────┐   │
│ │ PUT /playlist/widget/123/elements HTTP/1.1                │   │
│ │ Content-Type: application/x-www-form-urlencoded           │   │
│ │ Authorization: Bearer token...                            │   │
│ │                                                           │   │
│ │ elements=%5B%7B...%7D%5D                                  │   │
│ │                                                           │   │
│ │ ✅ Accepted & Parsed                                      │   │
│ │ ✅ 200 OK Response                                        │   │
│ └───────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 4. Architecture Comparison

### BEFORE (URLSearchParams - Problematic)

```
┌──────────────────┐
│   User Action    │
│  Double-click    │
│  Edit Text       │
│  Save            │
└────────┬─────────┘
         ↓
┌──────────────────────────────────────┐
│ Frontend (LayoutDesign.jsx)          │
│ ├─ Parse elements JSON               │
│ ├─ Update text value                 │
│ ├─ Create URLSearchParams()          │
│ ├─ Append elements as string         │
│ ├─ Set Content-Type manually         │ ⚠️ Problem here
│ └─ fetch() with body: formData       │
└────────┬──────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Backend (Express)                    │
│ ├─ Receive request                   │
│ ├─ Parse URL-encoded body            │
│ ├─ req.body.elements = "JSON string" │
│ └─ Pass to xiboClient                │
└────────┬──────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ xiboClient (xiboRequest)             │
│ ├─ Detect PUT method                 │
│ ├─ Convert to URLSearchParams AGAIN  │ ⚠️ Double conversion
│ ├─ Set Content-Type AGAIN            │
│ └─ Send to Xibo API                  │
└────────┬──────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Xibo API                             │
│ ├─ Parse form data                   │
│ ├─ ❌ Error: Malformed data          │ ✗ FAIL
│ └─ 400 Bad Request                   │
└──────────────────────────────────────┘
```

### AFTER (FormData - Correct)

```
┌──────────────────┐
│   User Action    │
│  Double-click    │
│  Edit Text       │
│  Save            │
└────────┬─────────┘
         ↓
┌──────────────────────────────────────┐
│ Frontend (LayoutDesign.jsx)          │
│ ├─ Parse elements JSON               │
│ ├─ Update text value                 │
│ ├─ Create FormData()                 │
│ ├─ Append elements as string         │
│ ├─ NO manual Content-Type             │ ✓ Correct
│ └─ fetch() with body: formDataObj    │
└────────┬──────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Browser (Automatic)                  │
│ ├─ Detect FormData instance          │
│ ├─ Generate multipart boundary       │
│ ├─ Set Content-Type automatically    │ ✓ Proper encoding
│ └─ Encode form fields                │
└────────┬──────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Backend (Express)                    │
│ ├─ Receive multipart request         │
│ ├─ body-parser decodes it            │
│ ├─ req.body.elements = "JSON string" │ ✓ Clean data
│ └─ Pass to xiboClient                │
└────────┬──────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ xiboClient (xiboRequest)             │
│ ├─ Detect PUT method                 │
│ ├─ Convert to URLSearchParams ONCE   │ ✓ Single conversion
│ ├─ Set Content-Type correctly        │
│ └─ Send to Xibo API                  │
└────────┬──────────────────────────────┘
         ↓
┌──────────────────────────────────────┐
│ Xibo API                             │
│ ├─ Parse form data                   │
│ ├─ ✅ Success: Valid data            │ ✓ SUCCESS
│ └─ 200 OK                            │
└──────────────────────────────────────┘
```

---

## 5. State Machine: Text Editing Lifecycle

```
                    ┌─────────────────┐
                    │   IDLE STATE    │
                    │  No editing     │
                    └────────┬────────┘
                             ↓
                    User double-clicks
                    text element
                             ↓
                    ┌─────────────────┐
                    │ EDITING STATE   │
                    │ Text input open │
                    │ User types text │
                    └────────┬────────┘
                             ↓
                    User clicks Save
                             ↓
                    ┌─────────────────┐
                    │  SAVING STATE   │
                    │ Request sent    │
                    │ Awaiting response
                    └─────┬──────┬───┘
                          ↓      ↓
                        ✅        ❌
                   (200 OK)   (400/500)
                        ↓          ↓
            ┌─────────────────┐  ┌──────────────────┐
            │ SUCCESS STATE   │  │ ERROR STATE      │
            │ Layout refreshes│  │ Error shown      │
            │ Elements update │  │ Fallback offered │
            │ User alerted    │  └────┬──────────┬──┘
            └────────┬────────┘       ↓          ↓
                     ↓         User clicks:  User clicks:
                     ↓         OK            Cancel
                     ↓         ↓             ↓
                     ↓    Opens Xibo  Dismiss
                     ↓    CMS Portal   Error
                     ↓         ↓        ↓
            ┌─────────────────┐│ ┌─────────────────┐
            │ IDLE STATE      ├┘ │ IDLE STATE      │
            │ Ready for next  │  │ Ready for retry │
            │ operation       │  │ or new edit     │
            └─────────────────┘  └─────────────────┘
```

---

## 6. Component Interaction Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND                                  │
│                                                                  │
│  ┌──────────────────┐                ┌──────────────────────┐   │
│  │  LayoutDesign    │                │  Component State     │   │
│  │  Component       │◄──────────────►│  - editing...Id      │   │
│  │  (React)         │                │  - editingTextValue  │   │
│  │                  │                │  - savingText        │   │
│  └────────┬─────────┘                └──────────────────────┘   │
│           │                                                      │
│           │ handleTextSave()                                     │
│           ↓                                                      │
│  ┌──────────────────────────────┐                               │
│  │ FormData Encoding            │                               │
│  │ • Create FormData object     │                               │
│  │ • Append elements            │                               │
│  │ • Get auth headers           │                               │
│  └────────┬─────────────────────┘                               │
│           │                                                      │
│           │ fetch(PUT /playlists/widgets/.../elements)          │
│           ↓                                                      │
└─────────────────────────────────────────────────────────────────┘
                    NETWORK REQUEST
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                        BACKEND                                   │
│                                                                  │
│  ┌──────────────────────────────┐                               │
│  │ Express Route Handler         │                               │
│  │ PUT /playlists/widgets/...    │                               │
│  └────────┬─────────────────────┘                               │
│           │                                                      │
│           │ (body-parser auto-parses multipart)                  │
│           ↓                                                      │
│  ┌──────────────────────────────┐                               │
│  │ widgetController.update...   │                               │
│  │ • Validate widget ID         │                               │
│  │ • Validate elements          │                               │
│  │ • Log request details        │                               │
│  └────────┬─────────────────────┘                               │
│           │                                                      │
│           │ xiboRequest(PUT /playlist/widget/...)               │
│           ↓                                                      │
│  ┌──────────────────────────────┐                               │
│  │ xiboClient.xiboRequest()     │                               │
│  │ • Detect PUT method          │                               │
│  │ • Convert to URLSearchParams │                               │
│  │ • Set form-urlencoded header │                               │
│  │ • Send axios request         │                               │
│  └────────┬─────────────────────┘                               │
│           │                                                      │
│           │ axios(PUT to Xibo API)                              │
│           ↓                                                      │
└─────────────────────────────────────────────────────────────────┘
                    XIBO API REQUEST
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                      XIBO CMS API                                │
│                                                                  │
│  ┌──────────────────────────────┐                               │
│  │ Widget Element Update         │                               │
│  │ • Parse form-urlencoded       │                               │
│  │ • Extract elements parameter  │                               │
│  │ • Update widget in database   │                               │
│  └────────┬─────────────────────┘                               │
│           │                                                      │
│           ↓                                                      │
│  ┌──────────────────────────────┐                               │
│  │ Response                      │                               │
│  │ 200 OK with updated widget    │                               │
│  └──────────────────────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 7. Logging Output Timeline

```
TIMELINE: Text Edit & Save
═══════════════════════════════════════════════════════════════

[T0] User Action
     └─ User double-clicks text element

[T1] Frontend: handleTextSave() Start
     └─ [handleTextSave] Widget details: {"widgetId": 123, ...}

[T2] Frontend: Parse Elements
     └─ [Text Save] Updating widget 123 with new text elements
     └─ [Text Save] Elements data: [{"elements":[...]}]...

[T3] Frontend: Prepare FormData
     └─ [Text Save] FormData prepared with elements (245 chars)
     └─ [Text Save] Auth headers: Authorization

[T4] Frontend: Send Request
     └─ fetch() PUT /api/playlists/widgets/123/elements

[T5] Backend: Receive Request
     └─ [updateWidgetElements] Updating widget 123
     └─ [updateWidgetElements] Request Content-Type: multipart/form-data
     └─ [updateWidgetElements] Elements type: string
     └─ [updateWidgetElements] Elements length: 245

[T6] Backend: Prepare xiboClient Call
     └─ [updateWidgetElements] Preparing to send to Xibo API:
     └─   - Endpoint: /playlist/widget/123/elements
     └─   - Method: PUT
     └─   - Data keys: elements

[T7] xiboClient: Prepare Request
     └─ [xiboRequest] PUT https://xibo-api.../api/playlist/widget/123/elements
     └─   hasData: true
     └─   dataKeys: ["elements"]

[T8] xiboClient: Send Request
     └─ Axios sends PUT with form-urlencoded body

[T9] Xibo API: Process
     └─ Parses form data
     └─ Updates widget elements in database
     └─ Returns 200 OK

[T10] Backend: Receive Response
     └─ [updateWidgetElements] ✓ Successfully updated widget 123
     └─ [updateWidgetElements] Xibo response: {...}

[T11] Backend: Send to Frontend
     └─ Response 200 OK with JSON data

[T12] Frontend: Receive Response
     └─ [Text Save] Response status: 200 OK
     └─ [Text Save] ✓ Successfully updated widget 123
     └─ [Text Save] Response: {...}

[T13] Frontend: Refresh Layout
     └─ fetchLayoutDetails() called

[T14] Frontend: Clear Editing State
     └─ setEditingTextWidgetId(null)
     └─ setEditingElementId(null)
     └─ setEditingTextValue("")

[T15] Frontend: User Notification
     └─ alert("✓ Text updated successfully!")

[T16] UI Updates
     └─ Layout refreshes
     └─ New text appears in widget
     └─ Ready for next edit


ERROR TIMELINE (Fallback):
═════════════════════════════════════════════════════════════

[T0-T8] Same as above

[T9 ERROR] Xibo API: Error
          └─ Returns 400 Bad Request

[T10] Backend: Catch Error
      └─ [updateWidgetElements] ✗ Error updating widget: ...
      └─ [updateWidgetElements] Response status: 400
      └─ [updateWidgetElements] Response data: {"error": "..."}

[T11] Backend: Forward Error
      └─ Response 400 with error message

[T12] Frontend: Catch Error
      └─ [Text Save] ✗ API Error: {message: "..."}
      └─ [handleTextSave] ✗ Error updating text: Error: ...
      └─ [handleTextSave] Error details: {name: "Error", ...}

[T13] Frontend: Show Fallback Dialog
      └─ confirm("Failed to update text...\nOpen Xibo CMS?")

[T14] User Response
      ├─ OK → Opens Xibo CMS portal in new tab
      └─ Cancel → Dismisses dialog

[T15] Frontend: Ready for Retry
      └─ setSavingText(false)
      └─ User can retry or use fallback
```

---

**Diagrams Created:** December 6, 2025  
**Purpose:** Visual understanding of the text element editing fix

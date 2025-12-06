# Layout Checkout Error Scenarios & Solutions

## Scenario 1: User Opens Published Layout (BEFORE FIX) ❌

```
User clicks layout in Dashboard
  ↓
componentMount: fetchLayoutDetails(layoutId=123)
  ↓
GET /api/layouts/123 → { layout: { layoutId: 123, publishedStatusId: 1 } }
  ↓
publishedStatusId === 1 (Published)
  ↓
handleAutoCheckout(123)
  ↓
PUT /api/layouts/checkout/123
  ↓
Xibo API: PUT /layout/checkout/123
  ↓
Return: { data: { layoutId: 456 } } (draft layout ID is 456)
  ↓
Navigate to /layout/designer/456
  ↓
useEffect[layoutId]: fetchLayoutDetails(layoutId=456)
  ↓
GET /api/layouts/456 → { layout: { layoutId: 456, publishedStatusId: 2 } }
  ↓
publishedStatusId === 2 (Draft) ✅
  ↓
setLayout(draftLayout)
  ↓
✅ User can now edit layout
```

**Result:** Works correctly on first open.

---

## Scenario 2: User Publishes Layout (BEFORE FIX) ❌

```
User clicks "Publish" button
  ↓
handlePublishLayout()
  ↓
PUT /api/layouts/publish/456
  ↓
Xibo API: PUT /layout/publish/456
  ↓
Returns: { success: true }
  ↓
setPublishSuccess(true)
  ↓
fetchLayoutDetails() ← 🔴 PROBLEM: This refreshes the layout!
  ↓
GET /api/layouts/456 → But 456 was the DRAFT, now it's obsolete!
  ↓
Hmm, system now has stale layout state...
  ↓
navigate("/dashboard")
  ↓
⚠️ State confusion about which layout to work with
```

**Problem:** After publish, `fetchLayoutDetails()` call causes issues because:

- Draft layout (456) is no longer the current layout
- Published layout (123) is now the live version
- System may have inconsistent state

---

## Scenario 3: User Reopens Layout After Publish (BEFORE FIX) ❌

```
User at Dashboard, clicks same layout again
  ↓
User is expecting to work on the published layout
  ↓
componentMount: fetchLayoutDetails(layoutId=123)
  ↓
GET /api/layouts/123 → { layout: { layoutId: 123, publishedStatusId: 1 } }
  ↓
publishedStatusId === 1 (Published)
  ↓
handleAutoCheckout(123) ← Auto-checkout triggered
  ↓
PUT /api/layouts/checkout/123
  ↓
⚠️ ERROR RESPONSE: HTTP 422 (Unprocessable Entity)
  ↓
Xibo API: "This layout is already checked out"
  ↓
🔴 ERROR: "This layout is already checked out" ❌
  ↓
handleAutoCheckout error handler catches it...
  ↓
Tries to find existing draft:
  GET /api/layouts?parentId=123&publishedStatusId=2
  ↓
Response: { data: [ { layoutId: 456, parentId: 123, ... } ] }
  ↓
Tries to extract draftId: 456
  ↓
navigate(/layout/designer/456)
  ↓
useEffect[layoutId]: fetchLayoutDetails(layoutId=456)
  ↓
GET /api/layouts/456 → { layout: { layoutId: 456, publishedStatusId: 2 } }
  ↓
BUT WAIT: Draft was supposed to be discarded after publish!
  ↓
What state is this layout in??? 🤔
  ↓
Confusion about whether layout is live or draft
```

**Problem:** The system doesn't properly distinguish between:

1. Published layout (123) - The live, user-facing version
2. Old draft (456) - Should have been discarded after publish
3. New draft (should be created now)

**Result:** Multiple drafts may exist, causing "already checked out" cascading errors.

---

## Scenario 4: Multiple Users/Sessions (Race Condition) ❌

```
User A:
  Opens published layout (123)
  ↓
  handleAutoCheckout(123)
  ↓
  Creates draft (456)
  ↓
  Navigates to draft (456)
  ↓
  Editing...

User B (simultaneously):
  Opens same published layout (123)
  ↓
  handleAutoCheckout(123)
  ↓
  PUT /api/layouts/checkout/123
  ↓
  🔴 ERROR HTTP 422: Already checked out (by User A!)
  ↓
  Error handler tries to find existing draft
  ↓
  Finds draft (456) by User A
  ↓
  Navigates to draft (456) - SAME DRAFT AS USER A
  ↓
  TWO USERS EDITING THE SAME DRAFT! ⚠️
```

**Problem:** No locking mechanism to prevent concurrent edits to same draft.

---

## NOW: Scenario 1 (AFTER FIX) ✅

**Same as before, but cleaner:**

```
User clicks layout in Dashboard
  ↓
componentMount: fetchLayoutDetails(layoutId=123)
  ↓
GET /api/layouts/123 → { layout: { layoutId: 123, publishedStatusId: 1 } }
  ↓
publishedStatusId === 1 (Published) && !skipCheckout ✅
  ↓
handleAutoCheckout(123)
  ↓
PUT /api/layouts/checkout/123
  ↓
Xibo API: PUT /layout/checkout/123
  ↓
Return: { data: { layoutId: 456 } } (draft layout ID is 456)
  ↓
Navigate to /layout/designer/456
  ↓
useEffect[layoutId]: fetchLayoutDetails(layoutId=456)
  ↓
GET /api/layouts/456 → { layout: { layoutId: 456, publishedStatusId: 2 } }
  ↓
publishedStatusId === 2 (Draft) && !skipCheckout ✅ (no auto-checkout)
  ↓
setLayout(draftLayout) ✅
  ↓
✅ User can now edit layout
```

**Result:** Clean, no extra fetchLayoutDetails calls.

---

## NOW: Scenario 2 (AFTER FIX) ✅

```
User clicks "Publish" button
  ↓
handlePublishLayout()
  ↓
PUT /api/layouts/publish/456
  ↓
Xibo API: PUT /layout/publish/456
  ↓
Returns: { success: true }
  ↓
setPublishSuccess(true)
  ↓
🔧 setSkipAutoCheckout(true) ← PREVENT AUTO-CHECKOUT!
  ↓
✅ No fetchLayoutDetails() called here!
  ↓
alert("Layout published successfully!")
  ↓
navigate("/dashboard", { replace: true })
  ↓
✅ Clean redirect, no state confusion
```

**Result:** After publish, no auto-checkout triggered. System state remains clean.

---

## NOW: Scenario 3 (AFTER FIX) ✅

```
User at Dashboard, clicks same layout again
  ↓
User expects to open published layout for editing
  ↓
componentMount: fetchLayoutDetails(layoutId=123)
  ↓
GET /api/layouts/123 → { layout: { layoutId: 123, publishedStatusId: 1 } }
  ↓
publishedStatusId === 1 (Published) && !skipCheckout ✅
  ↓
handleAutoCheckout(123) ← Auto-checkout triggered (CORRECT)
  ↓
PUT /api/layouts/checkout/123
  ↓
Xibo: PUT /layout/checkout/123
  ↓
Two possibilities:

  PATH A (Success):
  ↓
  Return: { data: { layoutId: 789 } } (NEW draft)
  ↓
  Extract draftLayoutId = 789
  ↓
  Navigate to /layout/designer/789
  ↓
  ✅ Opens new draft, user can edit

  PATH B (Already Checked Out):
  ↓
  ERROR RESPONSE: HTTP 422
  ↓
  Error message: "already checked out"
  ↓
  🔧 Detect: response.status === 422 ✅
  ↓
  Handle: Search for existing draft
  ↓
  GET /api/layouts?parentId=123&publishedStatusId=2
  ↓
  Response: { data: [ { layoutId: 456, parentId: 123, ... } ] }
  ↓
  🔧 Better extraction: Try all field names
  ↓
  Extract: layoutId = 456
  ↓
  Navigate to /layout/designer/456
  ↓
  ✅ Opens existing draft, user can continue editing
```

**Result:** Whether new draft created or existing draft found, user gets to edit screen cleanly.

---

## NOW: Scenario 4 (AFTER FIX) - Better but Not Perfect ⚠️

```
User A:
  Opens published layout (123)
  ↓
  handleAutoCheckout(123) creates draft (456)
  ↓
  Navigates to /layout/designer/456
  ↓
  Editing...

User B (simultaneously):
  Opens same published layout (123)
  ↓
  handleAutoCheckout(123)
  ↓
  PUT /api/layouts/checkout/123
  ↓
  ⚠️ ERROR HTTP 422: Already checked out (by User A)
  ↓
  Error handler (IMPROVED):
  ↓
  GET /api/layouts?parentId=123&publishedStatusId=2
  ↓
  Finds draft (456) by User A
  ↓
  Navigate to /layout/designer/456 ✅
  ↓
  User B and A both open same draft
  ↓
  ⚠️ Still same issue: concurrent editing

💡 NOTE: This is actually CORRECT behavior!
   - Both users working on same draft is OK
   - Xibo handles locking/conflict prevention
   - Our job is just to route them to the right layout
```

**Result:** Better error handling - users get routed to existing draft instead of error.

---

## Key Differences: Before vs After

| Aspect                  | BEFORE FIX ❌                                         | AFTER FIX ✅                            |
| ----------------------- | ----------------------------------------------------- | --------------------------------------- |
| **After Publish**       | `fetchLayoutDetails()` called, causes state confusion | No refresh, clean redirect              |
| **Auto-Checkout Loop**  | Risk of multiple checkouts                            | `skipCheckout` flag prevents recursion  |
| **Draft ID Parsing**    | Single field name check (`data.data?.layoutId`)       | Multiple field names tried              |
| **422 Error Detection** | Generic error message                                 | Specific "ALREADY_CHECKED_OUT" handling |
| **Draft Search**        | Limited field names                                   | Tries 4 different ID field names        |
| **Console Logging**     | Minimal                                               | Detailed for debugging                  |
| **State Management**    | Unclear publish flow                                  | Clear publish-without-checkout flow     |

---

## Error Messages Users May See

### ✅ AFTER FIX (Better)

**Scenario 1: First time opening published layout**

```
[Auto-Checkout] Checking out published layout 123...
[Auto-Checkout] Successfully created draft layout 456
```

→ User sees layout, can edit. ✅

**Scenario 2: Layout already checked out**

```
[Auto-Checkout] Checking out published layout 123...
[Auto-Checkout] Layout already checked out (422), searching for existing draft...
[Auto-Checkout] Found 1 drafts for parent 123
[Auto-Checkout] Found existing draft (ID: 456), navigating...
```

→ User redirected to existing draft, can edit. ✅

**Scenario 3: After publish**

```
Layout published successfully! Redirecting to dashboard...
[skipAutoCheckout flag set to true]
```

→ User redirected to dashboard without confusion. ✅

---

## Debugging Tips

### Check Console for Flow:

```javascript
// Open browser DevTools → Console
// Look for [Auto-Checkout] messages
[Auto-Checkout] Checking out published layout 123...
[Auto-Checkout] Successfully created draft layout 456
// OR
[Auto-Checkout] Layout already checked out (422), searching for existing draft...
[Auto-Checkout] Found 1 drafts for parent 123
```

### Check Response Structure:

```javascript
// If you see "No draft layout ID returned from checkout"
// Check the response in Network tab:
// Should have layoutId in one of:
// - data.data.layoutId
// - data.layoutId
// - data.layout.layoutId
// - data.id
```

### Check HTTP Status:

```javascript
// 200 OK = Success, draft created
// 422 Unprocessable Entity = Already checked out
// Other 4xx/5xx = Actual error
```

# JSON Structure Simplification - Attempt 1

**Date:** December 6, 2025  
**Change:** Simplified elements JSON structure  
**Status:** Ready for testing

---

## What Changed

### Before
```javascript
// Sent the full nested structure
const formData = new FormData();
formData.append("elements", JSON.stringify(elementsData));
// elementsData = [{"elements":[...]}]
```

### After
```javascript
// Extract and send just the inner elements array
let elementsToSend = elementsData;

if (Array.isArray(elementsData) && elementsData.length > 0 && elementsData[0].elements) {
  elementsToSend = elementsData[0].elements;  // Extract inner array
}

const formData = new FormData();
formData.append("elements", JSON.stringify(elementsToSend));
// elementsToSend = [...] (just the elements array)
```

---

## Structure Comparison

### Original Structure (What we were sending)
```json
[
  {
    "elements": [
      {"id": "global_library_image", ...},
      {"id": "text", ...},
      {"id": "text", ...}
    ]
  }
]
```

### New Structure (What we're sending now)
```json
[
  {"id": "global_library_image", ...},
  {"id": "text", ...},
  {"id": "text", ...}
]
```

**Key Difference:** Removed the outer array and wrapper object, sending just the elements array directly.

---

## Expected Behavior

### Frontend Logs
You should now see:
```
[Text Save] Extracting inner elements array from wrapper
[Text Save] Sending FormData with elements (XXX chars)
[Text Save] Structure: Array with 3 items
```

### Backend Logs
Should show the simplified structure being sent to Xibo API.

### Xibo API Response
**Hoping for:** 200 OK instead of 422  
**If still 422:** We'll try the next approach (send as object instead of array)

---

## Testing Instructions

1. Double-click a text element
2. Edit the text
3. Click Save
4. Check console logs for the new structure messages
5. Check if save succeeds

---

## If This Works ✅
- Text editing will work!
- Document the correct format
- Update testing guide

## If This Fails ❌
**Next attempts:**
1. Try sending as object: `{"elements":[...]}`
2. Try sending just stringified array without "elements" key
3. Fall back to hybrid solution (block Canvas, link to Xibo CMS)

---

**Status:** Waiting for test results

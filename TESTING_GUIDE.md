# Playlist Creation - Testing & Verification Guide

## Quick Summary of Fixes

| Issue                  | Root Cause                  | Solution                                                                                                             |
| ---------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| 409 Conflict Error     | Duplicate playlist name     | Added pre-creation duplicate check in backend                                                                        |
| Unclear Error Message  | Generic error handling      | Now returns: "A playlist named 'X' already exists for your account. Please choose another name."                     |
| Ownership Verification | Confusion about token usage | Verified: User-scoped tokens (xiboToken) are used, so Xibo CMS automatically assigns ownership to authenticated user |

---

## Testing Checklist

### ✅ Test 1: Create Playlist (Unique Name)

**Steps**:

1. Login to application as any user
2. Navigate to Playlists section
3. Click "Add Playlist" button
4. Enter name: `Test Playlist 1`
5. Enter description: `Testing unique name`
6. Click "Create Playlist"

**Expected Result**:

- Modal closes
- New playlist appears in list
- Owner is logged-in user (verify in Xibo CMS if needed)
- No errors

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 2: Duplicate Playlist Prevention

**Steps**:

1. Login as User A
2. Create playlist: `My Videos`
3. Click "Add Playlist" again
4. Try to enter same name: `My Videos`
5. Click "Create Playlist"

**Expected Result**:

- Error message displays: `"A playlist named 'My Videos' already exists for your account. Please choose another name."`
- Modal remains open (doesn't close)
- User can modify name and retry
- User can click Cancel to close

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 3: Multiple Users - Same Name Allowed

**Steps**:

1. Login as **User A**
2. Create playlist: `Team Announcements`
3. Logout and login as **User B**
4. Create playlist with same name: `Team Announcements`
5. Click "Create Playlist"

**Expected Result**:

- User B's playlist is created successfully
- Both playlists exist in system (different owners)
- User A cannot see User B's playlist and vice versa
- No conflict error (because they have different owners)

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 4: Empty/Invalid Name Handling

**Steps**:

1. Click "Add Playlist"
2. Leave name empty
3. Click "Create Playlist"

**Expected Result**:

- Error message: `"Playlist name is required"`
- Modal remains open
- Button is disabled (Create button is greyed out until name is entered)

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 5: Whitespace-Only Name

**Steps**:

1. Click "Add Playlist"
2. Enter name: `   ` (only spaces)
3. Click "Create Playlist"

**Expected Result**:

- Error message: `"Playlist name is required"`
- Modal remains open

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 6: Description (Optional Field)

**Steps**:

1. Click "Add Playlist"
2. Enter name: `Videos with Descriptions`
3. Enter description: `This is a test playlist`
4. Click "Create Playlist"

**Expected Result**:

- Playlist created successfully
- Description is saved
- Modal closes

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 7: Long Name Handling

**Steps**:

1. Click "Add Playlist"
2. Enter very long name (50+ characters)
3. Click "Create Playlist"

**Expected Result**:

- Playlist created successfully (if within limits)
- Or error message if exceeds Xibo CMS limits
- Error message is clear and helpful

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 8: Special Characters in Name

**Steps**:

1. Click "Add Playlist"
2. Enter name: `My Playlist #1 - Test @2024`
3. Click "Create Playlist"

**Expected Result**:

- Playlist created successfully (if allowed by Xibo)
- Or helpful error message
- Name preserved exactly as entered

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 9: Modal Cancel Button

**Steps**:

1. Click "Add Playlist"
2. Enter name: `Test Playlist`
3. Click "Cancel" button

**Expected Result**:

- Modal closes
- No playlist is created
- Form fields are cleared
- User returns to playlist list

**Status**: [ ] Pass [ ] Fail

---

### ✅ Test 10: Loading State During Creation

**Steps**:

1. Click "Add Playlist"
2. Enter name: `Test Loading State`
3. While form is submitting, observe Create button

**Expected Result**:

- Button shows "Creating..." text
- Button is disabled
- Cannot click multiple times
- Cursor shows loading indicator

**Status**: [ ] Pass [ ] Fail

---

## Backend Verification

### Check Duplicate Detection Logic

```bash
# In terminal, check the new code in playlistController.js

curl -X POST http://localhost:5000/api/playlists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"name": "Test", "description": "First time"}'

# Should succeed with 201

curl -X POST http://localhost:5000/api/playlists \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <JWT_TOKEN>" \
  -d '{"name": "Test", "description": "Second time"}'

# Should fail with 409 and message about duplicate
```

### Verify Response Format

```javascript
// Success (201):
{
  "success": true,
  "message": "Playlist created successfully",
  "playlist": { ... }
}

// Duplicate (409):
{
  "success": false,
  "message": "A playlist named 'Test' already exists for your account. Please choose another name."
}

// Invalid (400):
{
  "message": "Playlist name is required"
}
```

---

## Xibo CMS Verification

**To verify ownership in Xibo CMS**:

1. Login to Xibo CMS admin panel
2. Navigate to Playlists
3. View created playlist
4. Check Owner field
5. Should show: Authenticated user's name (not application account)

---

## Console Logs to Check

### Browser Console (Frontend)

```javascript
// Should NOT see errors like:
// "Error creating playlist: Error: You already own a Playlist called 'Test'"

// Should see proper error handling:
// If duplicate: Error display in modal without console errors
// If created: Success and modal closes
```

### Server Console (Backend)

```
// Normal creation:
POST /api/playlists 201 ✓

// Duplicate attempt:
POST /api/playlists 409 (Conflict)

// Should NOT see:
// Any database connection errors
// Any auth token issues
```

---

## Regression Testing

### Ensure Existing Features Still Work:

- [ ] Can still view existing playlists
- [ ] Can still edit playlist details
- [ ] Can still delete playlists
- [ ] Can still add media to playlists
- [ ] Can still view media in playlists
- [ ] Pagination still works
- [ ] Filtering by name still works
- [ ] Logout/Login cycle still works

---

## Performance Considerations

### Duplicate Check Performance

- Pre-creation check adds one extra GET request
- This is **acceptable** because:
  - Prevents bad state (409 from Xibo)
  - Improves UX with specific error message
  - Single query is very fast
  - Prevents frustrated users retrying

---

## Troubleshooting

### If you see: "Cannot read property 'xiboToken'"

**Cause**: User context not properly extracted
**Solution**:

1. Verify JWT token contains xiboToken
2. Check auth middleware is setting req.user
3. Check backend is using correct token source

### If you see: "A playlist named 'X' already exists" even for different users

**Cause**: userId filter not working
**Solution**:

1. Verify userId is being extracted from JWT
2. Check Xibo API userId parameter is correct
3. Verify user IDs match between JWT and Xibo CMS

### If modal doesn't reopen after error

**Cause**: setIsCreating state not being reset
**Solution**:

1. Check finally block is executing
2. Verify setIsCreating(false) is being called
3. Check for exceptions in catch block

---

## Success Criteria

✅ **All tests pass**: Feature is working correctly
✅ **No console errors**: Error handling is proper
✅ **Xibo CMS shows correct owner**: Ownership is assigned properly
✅ **User-friendly messages**: Errors are clear
✅ **Modal UX is smooth**: No stuck states

---

**Created**: November 17, 2025
**Status**: Ready for QA Testing

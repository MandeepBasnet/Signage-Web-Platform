# Canvas Widget Detection Fix - Testing Instructions

## Fix Applied ✅

I've successfully implemented the canvas widget detection fix in `LayoutDesign.jsx` (lines 917-946).

### What Changed:
```javascript
const handleTextDoubleClick = (widget, currentText, elementId = null) => {
  // ⚠️ XIBO API LIMITATION: Canvas/Global widget elements cannot be edited via API
  // Detect Canvas/Global widgets (case-insensitive)
  const isCanvasWidget = 
    widget.type?.toLowerCase() === "canvas" || 
    widget.type?.toLowerCase() === "global" || 
    widget.moduleName?.toLowerCase() === "canvas" ||
    widget.moduleName?.toLowerCase() === "global";
  
  if (isCanvasWidget) {
    // Show dialog offering to open Xibo CMS
    const openXibo = confirm(
      "⚠️ Canvas Widget Editing Limitation\n\n" +
      "Canvas/Global widget text elements cannot be edited through this interface due to Xibo API restrictions.\n\n" +
      "Would you like to open this layout in the official Xibo CMS to make your changes?\n\n" +
      "Click OK to open Xibo CMS in a new tab, or Cancel to stay here."
    );
    
    if (openXibo) {
      const xiboUrl = `https://portal.signage-lab.com/layout/designer/${layoutId}`;
      window.open(xiboUrl, '_blank', 'noopener,noreferrer');
    }
    return;
  }
  
  // For non-canvas widgets, proceed with editing
  setEditingTextWidgetId(String(widget.widgetId));
  setEditingElementId(elementId);
  setEditingTextValue(currentText);
};
```

## Testing Instructions

### Step 1: Refresh Browser
1. Go to http://localhost:5173/layout/designer/4903
2. Press **Ctrl+Shift+R** (hard refresh) to load the new code

### Step 2: Test Canvas Widget Detection
1. Look in the sidebar on the right for text elements
2. Find "Testing23Text" or "TextTest" under Region 2
3. **Double-click** on the text content (not the Edit Text button)

### Step 3: Expected Behavior
You should see a dialog box with:
- Title: "⚠️ Canvas Widget Editing Limitation"
- Message explaining the API restriction
- Two buttons: "OK" and "Cancel"

### Step 4: Test Xibo CMS Redirect
1. Click "OK" in the dialog
2. A new tab should open with Xibo CMS
3. URL should be: https://portal.signage-lab.com/layout/designer/4903

## Success Criteria

✅ **Success**: Dialog appears when double-clicking canvas widget text  
✅ **Success**: Clicking OK opens Xibo CMS in new tab  
✅ **Success**: No error messages in console  

❌ **Failure**: No dialog appears  
❌ **Failure**: Dialog appears but Xibo CMS doesn't open  
❌ **Failure**: Console shows errors  

## If Test Fails

If the dialog doesn't appear or Xibo CMS doesn't open, we'll implement **Option 2: Failsafe Solution**:
- Create a new text widget with the updated content
- Delete the old text widget
- Place the new widget at the exact same position with the same styling

This approach bypasses the element update API entirely.

## Next Steps

**After testing, please report:**
1. Did the dialog appear? (Yes/No)
2. Did Xibo CMS open in a new tab? (Yes/No)
3. Any console errors? (Copy/paste if yes)

Based on your feedback, I'll either:
- **If successful**: Document the solution and close the task
- **If failed**: Implement the failsafe solution (Option 2)

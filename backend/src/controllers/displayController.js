import { fetchUserScopedCollection, handleControllerError, getUserContext } from "../utils/xiboDataHelpers.js";
import { xiboRequest } from "../utils/xiboClient.js";
import axios from "axios";

export const getDisplays = async (req, res) => {
  try {
    const { start, length } = req.query;
    const userId = req.user.id; 

    // 1. Fetch User Details to get Groups
    let userGroups = [];
    let user = null;
    try {
      // We use the App Token (via xiboRequest default) to fetch user details
      const userDetails = await xiboRequest(
        `/user?userId=${userId}&embed=groups`,
        "GET"
      );
      
      if (Array.isArray(userDetails)) {
        user = userDetails[0];
      } else if (userDetails.data) {
         user = Array.isArray(userDetails.data) ? userDetails.data[0] : userDetails.data;
      } else {
        user = userDetails;
      }

      if (user) {
        // Add explicit groups
        if (user.groups) {
          userGroups = user.groups.map(g => g.group);
        }
        // Add primary group if it exists
        if (user.group) {
          userGroups.push(user.group);
        }
      }
    } catch (userError) {
      console.error(`[getDisplays] Failed to fetch user details:`, userError.message);
    }

    // 2. Fetch All Displays
    // We fetch a large number to ensure we get everything, then filter.
    const params = new URLSearchParams({
      start: 0,
      length: 1000,
      embed: "status,currentLayout,displayGroup,groupsWithPermissions", 
    });

    const response = await xiboRequest(
      `/display?${params.toString()}`, 
      "GET"
    );

    let displays = [];
    if (Array.isArray(response)) {
        displays = response;
    } else if (response.data) {
        displays = response.data;
    }

    // 3. Filter Displays
    const filteredDisplays = displays.filter(display => {
      // 1. Owner check
      if (display.ownerId == userId) return true;

      // 2. Group Permissions check
      if (display.groupsWithPermissions) {
        const permittedGroups = typeof display.groupsWithPermissions === 'string' 
          ? display.groupsWithPermissions.split(',').map(s => s.trim())
          : display.groupsWithPermissions; 

        // Check intersection
        const hasPermission = permittedGroups.some(pg => userGroups.includes(pg));
        if (hasPermission) return true;
      }

      return false;
    });

    // 4. Fetch Schedules for these displays
    const displayGroupIds = filteredDisplays.map(d => d.displayGroupId).filter(id => id);
    const uniqueGroupIds = [...new Set(displayGroupIds)];

    let scheduledLayouts = [];
    if (uniqueGroupIds.length > 0) {
        try {
            const scheduleParams = new URLSearchParams();
            uniqueGroupIds.forEach(id => scheduleParams.append('displayGroupIds[]', id));
            // Fetch active schedules (wide range)
            const now = Math.floor(Date.now() / 1000);
            // scheduleParams.append('fromDt', now - 86400); 
            // scheduleParams.append('toDt', now + 31536000); 
            // Using a very wide range to ensure we catch "Always" events which might have 0-INT_MAX
            // Actually, Xibo might default to a range if not specified. 
            // Let's try without dates first, or with the user's observed params if needed.
            // The user's log showed fromDt=0 and toDt=2147483647 for "Always".
            
            const scheduleResponse = await xiboRequest(`/schedule?${scheduleParams.toString()}`, 'GET');
            
            let events = [];
            if (Array.isArray(scheduleResponse)) {
                events = scheduleResponse;
            } else if (scheduleResponse.data) {
                events = scheduleResponse.data;
            }
            
            // Filter for Layouts (eventTypeId = 1)
            scheduledLayouts = events.filter(e => e.eventTypeId === 1);

        } catch (error) {
            console.error("Failed to fetch schedules:", error);
        }
    }

    // 5. Pagination & Normalization
    const startIndex = parseInt(start) || 0;
    const limit = parseInt(length) || 10;
    const pagedDisplays = filteredDisplays.slice(startIndex, startIndex + limit);

    const normalizedDisplays = pagedDisplays.map((display) => {
        const layoutId = display.currentLayoutId || display.defaultLayoutId;
        const layoutObj = display.currentLayout || null;
        
        // Find layouts for this display
        const displayLayouts = scheduledLayouts.filter(event => {
            // Check if event's displayGroups contains this display's groupId
            return event.displayGroups && event.displayGroups.some(dg => dg.displayGroupId === display.displayGroupId);
        }).map(event => ({
            id: event.eventId,
            name: event.name, // Layout name
            eventId: event.eventId,
            fromDt: event.fromDt,
            toDt: event.toDt,
            isAlways: event.isAlways,
            campaign: event.campaign,
            layoutId: event.campaignId // Map campaignId to layoutId for thumbnails
        }));

        return {
            ...display,
            id: display.displayId,
            displayId: display.displayId, // Ensure displayId is present
            name: display.display,
            status: display.loggedIn ? 'Active' : 'Inactive', // Simple status mapping
            layoutId: layoutId,
            layout: layoutObj,
            layoutName: display.currentLayout?.layout || display.defaultLayout || "Default Layout",
            clientType: display.clientType,
            clientVersion: display.clientVersion,
            lastAccessed: display.lastAccessed,
            scheduledLayouts: displayLayouts // Add scheduled layouts
        };
    });

    // Return in DataTables format (or standard JSON if not using DataTables)
    // The frontend expects { data: [...] } based on previous code
    res.json({ 
      data: normalizedDisplays, 
      total: filteredDisplays.length,
      recordsTotal: filteredDisplays.length,
      recordsFiltered: filteredDisplays.length
    });

  } catch (err) {
    handleControllerError(res, err, "Failed to fetch displays");
  }
};

export const deleteDisplay = async (req, res) => {
    try {
        const { displayId } = req.params;
        const { token } = getUserContext(req);

        await xiboRequest({
            method: 'DELETE',
            endpoint: `/display/${displayId}`,
            token
        });

        res.status(204).send();
    } catch (err) {
        handleControllerError(res, err, "Failed to delete display");
    }
};

export const updateDisplay = async (req, res) => {
    try {
        const { displayId } = req.params;
        const { token } = getUserContext(req);
        const { display, description, license } = req.body; // Fields to update

        // Xibo expects form-data for updates usually, but JSON might work if headers are set.
        // xiboRequest handles JSON by default.
        // Check documentation: PUT /display/{displayId} takes form data.
        // We will pass the body directly.

        const formData = new URLSearchParams();
        if (display) formData.append('display', display);
        if (description) formData.append('description', description);
        if (license) formData.append('license', license);
        
        // We need to send as application/x-www-form-urlencoded
        await axios.put(`${process.env.XIBO_API_URL}/display/${displayId}`, formData, {
            headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        });

        res.status(200).json({ success: true, message: "Display updated successfully" });
    } catch (err) {
        handleControllerError(res, err, "Failed to update display");
    }
};

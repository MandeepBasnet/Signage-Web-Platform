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
        if (user.groups) {
          userGroups = user.groups.map(g => g.group);
        }
        if (user.group) {
          userGroups.push(user.group);
        }
      }
    } catch (userError) {
      console.error(`[getDisplays] Failed to fetch user details:`, userError.message);
    }

    // 2. Fetch All Displays
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
      if (display.ownerId == userId) return true;
      if (display.groupsWithPermissions) {
        const permittedGroups = typeof display.groupsWithPermissions === 'string' 
          ? display.groupsWithPermissions.split(',').map(s => s.trim())
          : display.groupsWithPermissions; 
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
            const scheduleResponse = await xiboRequest(`/schedule?${scheduleParams.toString()}`, 'GET');
            
            let events = [];
            if (Array.isArray(scheduleResponse)) {
                events = scheduleResponse;
            } else if (scheduleResponse.data) {
                events = scheduleResponse.data;
            }
            
            // Filter for Layouts (eventTypeId = 1)
            scheduledLayouts = events.filter(e => e.eventTypeId === 1);

            // 5. Resolve Layout IDs from Campaigns
            const campaignIds = [...new Set(scheduledLayouts.map(e => e.campaignId).filter(id => id))];
            const campaignLayoutMap = new Map();

            if (campaignIds.length > 0) {
                try {
                    await Promise.all(campaignIds.map(async (campaignId) => {
                        try {
                            const layouts = await xiboRequest(`/layout?campaignId=${campaignId}`, 'GET');
                            if (Array.isArray(layouts) && layouts.length > 0) {
                                campaignLayoutMap.set(campaignId, layouts[0].layoutId);
                            }
                        } catch (e) {
                            console.warn(`Failed to fetch layouts for campaign ${campaignId}`, e);
                        }
                    }));
                } catch (error) {
                    console.error("Failed to resolve campaign layouts:", error);
                }
            }
            
            // Attach map to request for use in normalization
            req.campaignLayoutMap = campaignLayoutMap;

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
        
        const displayLayouts = scheduledLayouts.filter(event => {
            return event.displayGroups && event.displayGroups.some(dg => dg.displayGroupId === display.displayGroupId);
        }).map(event => {
            const resolvedLayoutId = (req.campaignLayoutMap && req.campaignLayoutMap.get(event.campaignId)) || event.campaignId;
            return {
                id: event.eventId,
                name: event.name,
                eventId: event.eventId,
                fromDt: event.fromDt,
                toDt: event.toDt,
                isAlways: event.isAlways,
                campaign: event.campaign,
                layoutId: resolvedLayoutId
            };
        });

        return {
            ...display,
            id: display.displayId,
            displayId: display.displayId,
            name: display.display,
            status: display.loggedIn ? 'Active' : 'Inactive',
            layoutId: layoutId,
            layout: layoutObj,
            layoutName: (display.currentLayout && display.currentLayout.layout) || display.defaultLayout || "Default Layout",
            clientType: display.clientType,
            clientVersion: display.clientVersion,
            lastAccessed: display.lastAccessed,
            scheduledLayouts: displayLayouts
        };
    });

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
        const { display, description, license } = req.body; 

        const formData = new URLSearchParams();
        if (display) formData.append('display', display);
        if (description) formData.append('description', description);
        if (license) formData.append('license', license);
        
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

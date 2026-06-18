import { fetchUserScopedCollection, handleControllerError, getUserContext } from "../utils/xiboDataHelpers.js";
import { xiboRequest } from "../utils/xiboClient.js";
import { createTtlCache } from "../utils/ttlCache.js";
import axios from "axios";

// Resolving a scheduled campaign to its layoutId hits `/layout?campaignId=` once
// per campaign on every dashboard load. That mapping is effectively static, so we
// cache it with a short TTL: cached campaigns are served from memory and only
// cache misses (or expired entries) re-fetch. Shared across requests because a
// campaign -> layout resolution is the same regardless of the requesting user.
const CAMPAIGN_LAYOUT_TTL_MS = 5 * 60 * 1000;
const campaignLayoutCache = new Map(); // campaignId -> { layoutId, expiresAt }

// User group membership changes rarely, so cache the resolved
// { canonicalUserId, userGroups } per requester to skip the /user call on warm
// dashboard loads. Schedules change infrequently relative to dashboard
// refreshes, so cache them briefly keyed by the set of display groups queried.
const userContextCache = createTtlCache({ maxSize: 500, ttlMs: 5 * 60 * 1000 });
const scheduleCache = createTtlCache({ maxSize: 200, ttlMs: 30 * 1000 });

export const getDisplays = async (req, res) => {
  try {
    const { start, length } = req.query;

    // req.user.id may be a numeric Xibo userId OR (when the login user lookup
    // failed) the login identifier (email/username). Resolve a CANONICAL numeric
    // userId so the ownership comparison below actually works.
    const rawId = req.user.id;
    const idIsNumeric = rawId !== undefined && rawId !== null && !isNaN(Number(rawId));

    // 1. Resolve the user's canonical id + groups. Cached (groups rarely change)
    // and run CONCURRENTLY with the displays fetch below — neither depends on the
    // other; only the filtering step needs both.
    const userKey = idIsNumeric
      ? `id:${rawId}`
      : `name:${req.user.username || rawId}`;
    const resolveUserContext = async () => {
      const hit = userContextCache.get(userKey);
      if (hit) return hit;
      let userGroups = [];
      let canonicalUserId = idIsNumeric ? Number(rawId) : null;
      let isSuperAdmin = false;
      try {
        const userQuery = idIsNumeric
          ? `/user?userId=${rawId}&embed=groups`
          : `/user?userName=${encodeURIComponent(req.user.username || rawId)}&embed=groups`;
        const userDetails = await xiboRequest(userQuery, "GET");

        let user = null;
        if (Array.isArray(userDetails)) {
          user = userDetails[0];
        } else if (userDetails.data) {
          user = Array.isArray(userDetails.data) ? userDetails.data[0] : userDetails.data;
        } else {
          user = userDetails;
        }

        if (user) {
          // Trust the userId Xibo returns over whatever was in the JWT.
          if (user.userId !== undefined && user.userId !== null) {
            canonicalUserId = Number(user.userId);
          }
          if (user.groups) {
            userGroups = user.groups.map((g) => g.group);
          }
          if (user.group) {
            userGroups.push(user.group);
          }
          // userTypeId 1 = Super Admin → sees every display.
          isSuperAdmin = Number(user.userTypeId) === 1;
        }
      } catch (userError) {
        console.error(`[getDisplays] Failed to fetch user details:`, userError.message);
        return { canonicalUserId, userGroups, isSuperAdmin: false }; // don't cache a failed lookup
      }
      const ctx = { canonicalUserId, userGroups, isSuperAdmin };
      userContextCache.set(userKey, ctx);
      return ctx;
    };

    // 2. Fetch user context and all displays concurrently (independent calls).
    const params = new URLSearchParams({
      start: 0,
      length: 1000,
      embed: "status,currentLayout,displayGroup,groupsWithPermissions",
    });
    const [{ canonicalUserId, userGroups, isSuperAdmin }, response] = await Promise.all([
      resolveUserContext(),
      xiboRequest(`/display?${params.toString()}`, "GET"),
    ]);

    let displays = [];
    if (Array.isArray(response)) {
        displays = response;
    } else if (response.data) {
        displays = response.data;
    }

    // 3. Filter Displays — keep only those the logged-in user owns OR that are
    // permission-shared with one of their groups ("only my displays" scope).
    // Super Admins (userTypeId 1) see every display.
    const filteredDisplays = isSuperAdmin ? displays : displays.filter(display => {
      // Compare as numbers so a valid owner match doesn't fail on type
      // (canonicalUserId is numeric; display.ownerId is numeric in Xibo).
      if (
        canonicalUserId !== null &&
        Number(display.ownerId) === canonicalUserId
      ) {
        return true;
      }
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
            // Cache schedules briefly, keyed by the set of display groups queried.
            const scheduleKey = [...uniqueGroupIds].sort((a, b) => a - b).join(",");
            let events = scheduleCache.get(scheduleKey);
            if (!events) {
                const scheduleParams = new URLSearchParams();
                uniqueGroupIds.forEach(id => scheduleParams.append('displayGroupIds[]', id));
                const scheduleResponse = await xiboRequest(`/schedule?${scheduleParams.toString()}`, 'GET');

                if (Array.isArray(scheduleResponse)) {
                    events = scheduleResponse;
                } else if (scheduleResponse.data) {
                    events = scheduleResponse.data;
                } else {
                    events = [];
                }
                scheduleCache.set(scheduleKey, events);
            }

            // Filter for Layouts (eventTypeId = 1)
            scheduledLayouts = events.filter(e => e.eventTypeId === 1);

            // 5. Resolve Layout IDs from Campaigns
            const campaignIds = [...new Set(scheduledLayouts.map(e => e.campaignId).filter(id => id))];
            const campaignLayoutMap = new Map();

            if (campaignIds.length > 0) {
                const now = Date.now();

                // Serve still-valid entries from cache; only re-fetch the misses.
                const missingCampaignIds = [];
                for (const campaignId of campaignIds) {
                    const cached = campaignLayoutCache.get(campaignId);
                    if (cached && cached.expiresAt > now) {
                        campaignLayoutMap.set(campaignId, cached.layoutId);
                    } else {
                        missingCampaignIds.push(campaignId);
                    }
                }

                if (missingCampaignIds.length > 0) {
                    try {
                        await Promise.all(missingCampaignIds.map(async (campaignId) => {
                            try {
                                const layouts = await xiboRequest(`/layout?campaignId=${campaignId}`, 'GET');
                                if (Array.isArray(layouts) && layouts.length > 0) {
                                    const layoutId = layouts[0].layoutId;
                                    campaignLayoutMap.set(campaignId, layoutId);
                                    campaignLayoutCache.set(campaignId, {
                                        layoutId,
                                        expiresAt: now + CAMPAIGN_LAYOUT_TTL_MS,
                                    });
                                }
                            } catch (e) {
                                console.warn(`Failed to fetch layouts for campaign ${campaignId}`, e);
                            }
                        }));
                    } catch (error) {
                        console.error("Failed to resolve campaign layouts:", error);
                    }
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

        // xiboRequest signature is (endpoint, method, data, userToken)
        await xiboRequest(`/display/${displayId}`, "DELETE", null, token);

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

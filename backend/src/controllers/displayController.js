import { fetchUserScopedCollection, handleControllerError, getUserContext } from "../utils/xiboDataHelpers.js";
import { xiboRequest } from "../utils/xiboClient.js";
import axios from "axios";

export const getDisplays = async (req, res) => {
  try {
    const { token, userId } = getUserContext(req);
    
    // Direct request to Xibo API to avoid over-filtering in helper
    // Using standard Xibo API parameters as per documentation
    // We rely on the token to handle permissions
    const params = new URLSearchParams({
      start: 0,
      length: 100,
      embed: "status,currentLayout,displayGroup",
    });

    if (userId) {
      params.append("userId", userId);
      // params.append("ownerId", userId); 
    }

    const response = await xiboRequest(
      `/display?${params.toString()}`, 
      "GET", 
      null, 
      token
    );

    // Xibo returns { data: [...], recordsTotal: N, ... } or just array
    // Handle both cases
    let displays = [];
    let total = 0;

    if (Array.isArray(response)) {
        displays = response;
        total = response.length;
    } else if (response.data) {
        displays = response.data;
        total = response.recordsTotal || response.total || displays.length;
    }

    // Normalize display data
    const normalizedDisplays = displays.map((display) => {
        // Determine the layout to show (current or default)
        const layoutId = display.currentLayoutId || display.defaultLayoutId;
        
        return {
            ...display,
            id: display.displayId,
            name: display.display,
            status: display.loggedIn ? 'Active' : 'Inactive',
            layoutId: layoutId,
            // Try to get layout name from embedded data
            layoutName: display.currentLayout?.layout || display.defaultLayout || "Default Layout",
            // Ensure we have client info
            clientType: display.clientType,
            clientVersion: display.clientVersion,
            lastAccessed: display.lastAccessed
        };
    });

    res.json({ data: normalizedDisplays, total: total });
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

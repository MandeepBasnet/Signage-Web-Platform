import { xiboRequest } from "../utils/xiboClient.js";

export const getLayouts = async (req, res) => {
  try {
    // Use the user's Xibo token from JWT to get their layouts
    const userXiboToken = req.user?.xiboToken;
    if (!userXiboToken) {
      return res.status(401).json({
        message: "User Xibo token not found. Please login again.",
      });
    }

    // Get user ID from JWT token
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        message: "User ID not found in token. Please login again.",
      });
    }

    // Fetch layouts from Xibo API
    const data = await xiboRequest("/layout", "GET", null, userXiboToken);

    // Filter layouts to only return those owned by the logged-in user
    // Handle different response formats from Xibo API
    let layouts = [];
    if (Array.isArray(data)) {
      layouts = data;
    } else if (data?.data && Array.isArray(data.data)) {
      layouts = data.data;
    } else if (data?.data) {
      layouts = [data.data];
    }

    // Filter by ownerId matching the user's ID
    const userLayouts = layouts.filter((layout) => {
      // Convert both to numbers for comparison (Xibo returns ownerId as number)
      const layoutOwnerId = parseInt(layout.ownerId || layout.owner_id);
      const userXiboId = parseInt(userId);
      return layoutOwnerId === userXiboId;
    });

    // Return filtered layouts in the same format as received
    if (Array.isArray(data)) {
      res.json(userLayouts);
    } else {
      res.json({
        ...data,
        data: userLayouts,
      });
    }
  } catch (err) {
    console.error("Get layouts error:", err.message);
    if (err.response) {
      return res.status(err.response.status || 500).json({
        message: err.response.data?.message || "Failed to fetch layouts",
        error: err.message,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

export const publishLayout = async (req, res) => {
  const { layoutId } = req.params;
  try {
    // Use the user's Xibo token from JWT
    const userXiboToken = req.user?.xiboToken;
    if (!userXiboToken) {
      return res.status(401).json({
        message: "User Xibo token not found. Please login again.",
      });
    }

    const result = await xiboRequest(
      `/layout/publish/${layoutId}`,
      "PUT",
      null,
      userXiboToken
    );
    res.json(result);
  } catch (err) {
    console.error("Publish layout error:", err.message);
    if (err.response) {
      return res.status(err.response.status || 500).json({
        message: err.response.data?.message || "Failed to publish layout",
        error: err.message,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

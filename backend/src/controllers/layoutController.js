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

    const data = await xiboRequest("/layout", "GET", null, userXiboToken);
    res.json(data);
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

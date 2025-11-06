import { xiboRequest } from "../utils/xiboClient.js";

export const getLayouts = async (req, res) => {
  try {
    const data = await xiboRequest("/layout");
    res.json(data);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

export const publishLayout = async (req, res) => {
  const { layoutId } = req.params;
  try {
    const result = await xiboRequest(`/layout/publish/${layoutId}`, "PUT");
    res.json(result);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

import { xiboRequest } from "../utils/xiboClient.js";
import {
  fetchUserScopedCollection,
  getUserContext,
  handleControllerError,
} from "../utils/xiboDataHelpers.js";

export const getLayouts = async (req, res) => {
  try {
    const layouts = await fetchUserScopedCollection({
      req,
      endpoint: "/layout",
      idKeys: ["layoutId", "layout_id", "id"],
    });

    res.json({ data: layouts, total: layouts.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch layouts");
  }
};

export const publishLayout = async (req, res) => {
  const { layoutId } = req.params;

  try {
    const { token } = getUserContext(req);

    const result = await xiboRequest(
      `/layout/publish/${layoutId}`,
      "PUT",
      null,
      token
    );

    res.json(result);
  } catch (err) {
    handleControllerError(res, err, "Failed to publish layout");
  }
};

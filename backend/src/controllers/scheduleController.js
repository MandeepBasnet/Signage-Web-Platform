import { fetchUserScopedCollection, handleControllerError } from "../utils/xiboDataHelpers.js";

export const getSchedule = async (req, res) => {
  try {
    const { fromDt, toDt } = req.query;

    const schedules = await fetchUserScopedCollection({
      req,
      endpoint: "/schedule",
      idKeys: ["eventId", "id"],
      queryParams: {
        fromDt: fromDt, // Required by Xibo
        toDt: toDt,     // Required by Xibo
        embed: "displayGroups,campaign", // Embed related info
      },
    });

    res.json({ data: schedules, total: schedules.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch schedule");
  }
};

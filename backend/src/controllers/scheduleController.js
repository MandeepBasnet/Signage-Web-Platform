import axios from "axios";
import qs from "qs";
import FormData from "form-data";
import {
  fetchUserScopedCollection,
  handleControllerError,
  getUserContext,
  HttpError,
} from "../utils/xiboDataHelpers.js";
import { xiboRequest, getAccessToken } from "../utils/xiboClient.js";

// Pad a value to a string; small helper for date formatting (Y-m-d H:i:s).
const pad = (n) => String(n).padStart(2, "0");
const formatXiboDate = (date = new Date()) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
  `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;

const normalizeOne = (response) => {
  if (!response) return null;
  if (response.data && !Array.isArray(response.data)) return response.data;
  if (Array.isArray(response)) return response[0];
  return response;
};

export const getSchedule = async (req, res) => {
  try {
    const { fromDt, toDt } = req.query;

    const schedules = await fetchUserScopedCollection({
      req,
      endpoint: "/schedule",
      idKeys: ["eventId", "id"],
      queryParams: {
        fromDt: fromDt, // Required by Xibo
        toDt: toDt, // Required by Xibo
        embed: "displayGroups,campaign", // Embed related info
      },
    });

    res.json({ data: schedules, total: schedules.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch schedule");
  }
};

// List display groups for the Add-Event target picker.
// Includes display-specific groups so a single display can be targeted.
export const getDisplayGroups = async (req, res) => {
  try {
    let { token } = getUserContext(req);
    if (!token) token = await getAccessToken();

    const response = await xiboRequest("/displaygroup", "GET", null, token);
    const groups = Array.isArray(response)
      ? response
      : response?.data || [];

    res.json({ data: groups, total: groups.length });
  } catch (err) {
    handleControllerError(res, err, "Failed to fetch display groups");
  }
};

// Wrap a playlist in a full-screen layout and return its (layout-specific)
// campaignId — Xibo schedules layouts by campaignId, and a playlist can only be
// scheduled by first wrapping it this way (POST /layout/fullscreen).
const wrapPlaylistAsFullscreen = async (playlistId, token) => {
  const form = new FormData();
  form.append("id", String(playlistId));
  form.append("type", "playlist");

  const response = await axios.post(
    `${process.env.XIBO_API_URL}/layout/fullscreen`,
    form,
    {
      headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
    }
  );

  const layout = normalizeOne(response.data);
  const campaignId = layout?.campaignId || layout?.campaign_id;
  if (!campaignId) {
    throw new HttpError(
      502,
      "Could not create a full-screen layout for the playlist (no campaignId returned)."
    );
  }
  return campaignId;
};

// Resolve a layout's campaignId when the client didn't pass one.
const resolveLayoutCampaignId = async (layoutId, token) => {
  const response = await xiboRequest(
    `/layout?layoutId=${layoutId}`,
    "GET",
    null,
    token
  );
  const layout = Array.isArray(response)
    ? response[0]
    : Array.isArray(response?.data)
    ? response.data[0]
    : response?.data || response;
  return layout?.campaignId || layout?.campaign_id || null;
};

export const createScheduleEvent = async (req, res) => {
  try {
    let { token } = getUserContext(req);
    if (!token) token = await getAccessToken();

    const {
      contentType, // 'playlist' | 'layout'
      contentId, // playlistId or layoutId
      campaignId: campaignIdFromBody, // optional, for layouts
      displayGroupIds, // array
      fromDt,
      toDt,
      isAlways, // boolean
      isPriority, // boolean
    } = req.body || {};

    // Validate target display groups
    const groupIds = Array.isArray(displayGroupIds)
      ? displayGroupIds.filter((id) => id !== undefined && id !== null && id !== "")
      : [];
    if (groupIds.length === 0) {
      throw new HttpError(400, "At least one display group is required.");
    }

    // Resolve the campaignId to schedule
    let campaignId = campaignIdFromBody;
    if (contentType === "playlist") {
      if (!contentId) throw new HttpError(400, "A playlist is required.");
      campaignId = await wrapPlaylistAsFullscreen(contentId, token);
    } else if (contentType === "layout") {
      if (!campaignId) {
        if (!contentId) throw new HttpError(400, "A layout is required.");
        campaignId = await resolveLayoutCampaignId(contentId, token);
      }
    }
    if (!campaignId) {
      throw new HttpError(400, "Could not resolve a campaign to schedule.");
    }

    // Dates: custom window (dayPartId=0) needs from/to; "Always" uses dayPartId=1.
    const always = !!isAlways;
    const from = fromDt || formatXiboDate();
    if (!always && !toDt) {
      throw new HttpError(400, "An end date/time is required unless 'Always' is set.");
    }

    const form = new FormData();
    form.append("eventTypeId", "1"); // Layout
    form.append("campaignId", String(campaignId));
    groupIds.forEach((id) => form.append("displayGroupIds[]", String(id)));
    form.append("dayPartId", always ? "1" : "0");
    form.append("fromDt", from);
    if (!always) form.append("toDt", toDt);
    form.append("displayOrder", "0");
    form.append("isPriority", isPriority ? "1" : "0");
    form.append("syncTimezone", "0");

    const response = await axios.post(
      `${process.env.XIBO_API_URL}/schedule`,
      form,
      {
        headers: { Authorization: `Bearer ${token}`, ...form.getHeaders() },
      }
    );

    res.status(201).json({ success: true, data: response.data });
  } catch (err) {
    console.error(
      "Error creating schedule event:",
      err.response?.data || err.message
    );
    handleControllerError(res, err, "Failed to create schedule event");
  }
};

// Edit an existing event's targeting / timing / priority. The content
// (campaignId + eventTypeId) is preserved — to change the content, delete and
// re-create. Xibo's PUT /schedule wants the full field set as form-urlencoded.
export const updateScheduleEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    let { token } = getUserContext(req);
    if (!token) token = await getAccessToken();

    const {
      eventTypeId,
      campaignId,
      displayGroupIds,
      fromDt,
      toDt,
      isAlways,
      isPriority,
      displayOrder,
    } = req.body || {};

    const groupIds = Array.isArray(displayGroupIds)
      ? displayGroupIds.filter((id) => id !== undefined && id !== null && id !== "")
      : [];
    if (groupIds.length === 0) {
      throw new HttpError(400, "At least one display group is required.");
    }
    if (!campaignId) {
      throw new HttpError(400, "campaignId is required to edit this event.");
    }

    const always = !!isAlways;
    if (!always && !toDt) {
      throw new HttpError(400, "An end date/time is required unless 'Always' is set.");
    }

    const payload = {
      eventTypeId: String(eventTypeId || 1),
      campaignId: String(campaignId),
      displayGroupIds: groupIds.map(String),
      dayPartId: always ? "1" : "0",
      fromDt: fromDt || formatXiboDate(),
      displayOrder: String(displayOrder ?? 0),
      isPriority: isPriority ? "1" : "0",
      syncTimezone: "0",
    };
    if (!always) payload.toDt = toDt;

    // Xibo PUT requires application/x-www-form-urlencoded; arrays as key[].
    await axios.put(
      `${process.env.XIBO_API_URL}/schedule/${eventId}`,
      qs.stringify(payload, { arrayFormat: "brackets" }),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    res.json({ success: true });
  } catch (err) {
    console.error(
      "Error updating schedule event:",
      err.response?.data || err.message
    );
    handleControllerError(res, err, "Failed to update schedule event");
  }
};

export const deleteScheduleEvent = async (req, res) => {
  try {
    const { eventId } = req.params;
    let { token } = getUserContext(req);
    if (!token) token = await getAccessToken();

    await xiboRequest(`/schedule/${eventId}`, "DELETE", null, token);
    res.status(204).send();
  } catch (err) {
    handleControllerError(res, err, "Failed to delete schedule event");
  }
};

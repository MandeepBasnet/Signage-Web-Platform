import qs from "qs";
import axios from "axios";
import { xiboRequest, getAccessToken } from "../utils/xiboClient.js";

export const getDatasets = async (req, res) => {
  try {
    // Default DataTables parameters required by Xibo
    const defaultParams = {
      draw: 1,
      start: 0,
      length: 100,
      order: [{ column: 1, dir: 'asc' }], // Order by dataSet (name)
      columns: [
        { data: 'dataSetId', name: '', searchable: true, orderable: true, search: { value: '', regex: false } },
        { data: 'dataSet', name: '', searchable: true, orderable: true, search: { value: '', regex: false } },
        { data: 'description', name: '', searchable: true, orderable: true, search: { value: '', regex: false } },
        { data: 'code', name: '', searchable: true, orderable: true, search: { value: '', regex: false } }
      ],
      folderId: 124,
      logicalOperatorName: 'OR',
      ...req.query
    };

    const queryString = qs.stringify(defaultParams, { arrayFormat: 'indices' });
    const response = await xiboRequest(`/dataset?${queryString}`, "GET");
    
    // Normalize response to always be { data: [...] }
    const responseData = Array.isArray(response) ? { data: response } : response;
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching datasets:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ 
      error: "Failed to fetch datasets",
      details: error.response?.data || error.message
    });
  }
};

export const getDatasetColumns = async (req, res) => {
  try {
    const { id } = req.params;
    
    const defaultParams = {
      draw: 1,
      start: 0,
      length: 100,
      ...req.query
    };

    const queryString = qs.stringify(defaultParams, { arrayFormat: 'indices' });
    const response = await xiboRequest(`/dataset/${id}/column?${queryString}`, "GET");
    
    const responseData = Array.isArray(response) ? { data: response } : response;
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching dataset columns:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to fetch dataset columns" });
  }
};

export const getDatasetData = async (req, res) => {
  try {
    const { id } = req.params;
    
    const defaultParams = {
      draw: 1,
      start: 0,
      length: 100,
      ...req.query
    };

    const queryString = qs.stringify(defaultParams, { arrayFormat: 'indices' });
    const response = await xiboRequest(`/dataset/data/${id}?${queryString}`, "GET");
    
    const responseData = Array.isArray(response) ? { data: response } : response;
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching dataset data:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to fetch dataset data" });
  }
};

export const addDatasetRow = async (req, res) => {
  try {
    const { id } = req.params;
    const token = await getAccessToken();
    
    // Xibo expects form-data for adding rows
    // We use axios directly here because xiboRequest defaults to JSON for POST
    // and we need application/x-www-form-urlencoded
    const response = await axios.post(
      `${process.env.XIBO_API_URL}/dataset/data/${id}`,
      qs.stringify(req.body),
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    res.status(201).json(response.data);
  } catch (error) {
    console.error("Error adding dataset row:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to add dataset row" });
  }
};

export const deleteDatasetRow = async (req, res) => {
  try {
    const { id, rowId } = req.params;
    
    // Xibo API endpoint: DELETE /dataset/data/{datasetId}/{rowId}
    const response = await xiboRequest(`/dataset/data/${id}/${rowId}`, "DELETE");
    res.json(response);
  } catch (error) {
    console.error("Error deleting dataset row:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to delete dataset row" });
  }
};

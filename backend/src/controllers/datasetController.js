
import axios from "axios";
import qs from "qs";
import jwt from "jsonwebtoken";

const API_BASE_URL = process.env.VITE_API_BASE_URL || "http://localhost:3000"; // Fallback, though usually not needed in backend

// Helper to get Xibo client
const getXiboClient = (token) => {
  return axios.create({
    baseURL: process.env.XIBO_API_URL,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });
};

const getXiboToken = (authHeader) => {
  const token = authHeader?.split(" ")[1];
  if (!token) throw new Error("No token provided");
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    return decoded.xiboToken;
  } catch (err) {
    throw new Error("Invalid token");
  }
};

export const getDatasets = async (req, res) => {
  try {
    const xiboToken = getXiboToken(req.headers.authorization);
    const client = getXiboClient(xiboToken);
    
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

    const response = await client.get("/dataset", { 
      params: defaultParams,
      paramsSerializer: params => qs.stringify(params, { arrayFormat: 'indices' })
    });
    
    // Normalize response to always be { data: [...] }
    const responseData = Array.isArray(response.data) ? { data: response.data } : response.data;
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
    const xiboToken = getXiboToken(req.headers.authorization);
    const { id } = req.params;
    const client = getXiboClient(xiboToken);
    
    const defaultParams = {
      draw: 1,
      start: 0,
      length: 100,
      ...req.query
    };

    const response = await client.get(`/dataset/${id}/column`, {
      params: defaultParams,
      paramsSerializer: params => qs.stringify(params, { arrayFormat: 'indices' })
    });
    
    const responseData = Array.isArray(response.data) ? { data: response.data } : response.data;
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching dataset columns:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to fetch dataset columns" });
  }
};

export const getDatasetData = async (req, res) => {
  try {
    const xiboToken = getXiboToken(req.headers.authorization);
    const { id } = req.params;
    const client = getXiboClient(xiboToken);
    
    const defaultParams = {
      draw: 1,
      start: 0,
      length: 100,
      ...req.query
    };

    const response = await client.get(`/dataset/data/${id}`, {
      params: defaultParams,
      paramsSerializer: params => qs.stringify(params, { arrayFormat: 'indices' })
    });
    
    const responseData = Array.isArray(response.data) ? { data: response.data } : response.data;
    res.json(responseData);
  } catch (error) {
    console.error("Error fetching dataset data:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to fetch dataset data" });
  }
};

export const addDatasetRow = async (req, res) => {
  try {
    const xiboToken = getXiboToken(req.headers.authorization);
    const { id } = req.params;
    const client = getXiboClient(xiboToken);
    
    // Xibo expects form-data for adding rows
    // The keys should be `dataSetColumnId_{columnId}`
    const response = await client.post(`/dataset/data/${id}`, qs.stringify(req.body));
    res.status(201).json(response.data);
  } catch (error) {
    console.error("Error adding dataset row:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to add dataset row" });
  }
};

export const deleteDatasetRow = async (req, res) => {
  try {
    const xiboToken = getXiboToken(req.headers.authorization);
    const { id, rowId } = req.params;
    const client = getXiboClient(xiboToken);
    
    // Xibo API endpoint: DELETE /dataset/data/{datasetId}/{rowId}
    const response = await client.delete(`/dataset/data/${id}/${rowId}`);
    res.json(response.data);
  } catch (error) {
    console.error("Error deleting dataset row:", error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: "Failed to delete dataset row" });
  }
};

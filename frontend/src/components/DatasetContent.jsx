import React, { useState, useEffect } from "react";
import AddRowModal from "./AddRowModal";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api";

export default function DatasetContent() {
  const [view, setView] = useState("list"); // 'list' or 'details'
  const [datasets, setDatasets] = useState([]);
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Datasets on Mount
  useEffect(() => {
    fetchDatasets();
  }, []);

  const fetchDatasets = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : {};
      
      const response = await fetch(`${API_BASE_URL}/datasets`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch datasets");
      const data = await response.json();
      // Xibo returns { data: [...] } for lists
      setDatasets(data.data || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDatasetClick = async (dataset) => {
    setSelectedDataset(dataset);
    setView("details");
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      
      // Fetch Columns
      const colResponse = await fetch(`${API_BASE_URL}/datasets/${dataset.dataSetId}/column`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const colData = await colResponse.json();
      setColumns(colData.data || []);

      // Fetch Data
      const dataResponse = await fetch(`${API_BASE_URL}/datasets/data/${dataset.dataSetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rowData = await dataResponse.json();
      setRows(rowData.data || []);

    } catch (err) {
      setError("Failed to load dataset details");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAddRow = async (formData) => {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(`${API_BASE_URL}/datasets/data/${selectedDataset.dataSetId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams(formData),
    });

    if (!response.ok) throw new Error("Failed to add row");
    
    // Refresh data
    const dataResponse = await fetch(`${API_BASE_URL}/datasets/data/${selectedDataset.dataSetId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const rowData = await dataResponse.json();
    setRows(rowData.data || []);
  };

  const handleDeleteRow = async (rowId) => {
    if (!confirm("Are you sure you want to delete this row?")) return;

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/datasets/data/${selectedDataset.dataSetId}/${rowId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to delete row");

      // Refresh data
      const dataResponse = await fetch(`${API_BASE_URL}/datasets/data/${selectedDataset.dataSetId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rowData = await dataResponse.json();
      setRows(rowData.data || []);
    } catch (err) {
      alert("Failed to delete row: " + err.message);
    }
  };

  const handleBack = () => {
    setView("list");
    setSelectedDataset(null);
    setColumns([]);
    setRows([]);
    setError(null);
  };

  if (loading && view === "list" && datasets.length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading datasets...</div>;
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}

      {view === "list" ? (
        <>
          <h1 className="text-2xl font-bold mb-6 text-gray-800">Datasets</h1>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Code</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {datasets.map((ds) => (
                  <tr 
                    key={ds.dataSetId} 
                    onClick={() => handleDatasetClick(ds)}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ds.dataSet}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.description}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{ds.code}</td>
                  </tr>
                ))}
                {datasets.length === 0 && !loading && (
                  <tr>
                    <td colSpan="3" className="px-6 py-8 text-center text-gray-500">No datasets found.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleBack}
                className="text-gray-600 hover:text-gray-900 flex items-center gap-1"
              >
                ← Back
              </button>
              <h1 className="text-2xl font-bold text-gray-800">{selectedDataset?.dataSet}</h1>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <span>+</span> Add Row
            </button>
          </div>

          {loading ? (
             <div className="p-8 text-center text-gray-500">Loading data...</div>
          ) : (
            <div className="bg-white rounded-lg shadow overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.map((col) => (
                      <th key={col.dataSetColumnId} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {col.heading}
                      </th>
                    ))}
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((row, idx) => (
                    <tr key={row.id || idx} className="hover:bg-gray-50">
                      {columns.map((col) => (
                        <td key={`${row.id}-${col.dataSetColumnId}`} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {row[col.heading] || row[`col_${col.dataSetColumnId}`] || "-"} 
                        </td>
                      ))}
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRow(row.id);
                          }}
                          className="text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete row"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={columns.length + 1} className="px-6 py-8 text-center text-gray-500">No data rows found.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}

          <AddRowModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            columns={columns}
            onSave={handleAddRow}
          />
        </>
      )}
    </div>
  );
}

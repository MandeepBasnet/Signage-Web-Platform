import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import AddRowModal from "./AddRowModal";

import { API_BASE_URL } from "../config/api.js";
import { useDatasets } from "../hooks/queries/useDatasets.js";
import { useDatasetColumns } from "../hooks/queries/useDatasetColumns.js";
import { useDatasetRows } from "../hooks/queries/useDatasetRows.js";
import { useToast } from "../hooks/useToast.js";
import { useConfirm } from "../hooks/useConfirm.js";

const EMPTY_ARRAY = [];

export default function DatasetContent() {
  const toast = useToast();
  const confirmDialog = useConfirm();
  const [view, setView] = useState("list"); // 'list' or 'details'
  const [selectedDataset, setSelectedDataset] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Cached datasets list.
  const {
    data: datasets = EMPTY_ARRAY,
    isLoading: datasetsLoading,
    error: datasetsError,
  } = useDatasets();

  // Detail (columns + rows) for the selected dataset; both queries are enabled
  // only when a dataset is selected and cached per id. Mutations refetch rows.
  const dataSetId = selectedDataset?.dataSetId;
  const {
    data: columns = EMPTY_ARRAY,
    isLoading: columnsLoading,
    error: columnsError,
  } = useDatasetColumns(dataSetId);
  const {
    data: rows = EMPTY_ARRAY,
    isLoading: rowsLoading,
    error: rowsError,
    refetch: refetchRows,
  } = useDatasetRows(dataSetId);

  const detailLoading = columnsLoading || rowsLoading;
  const error = view === "list" ? datasetsError : columnsError || rowsError;

  const handleDatasetClick = (dataset) => {
    setSelectedDataset(dataset);
    setView("details");
  };

  const handleAddRow = async (formData) => {
    const token = localStorage.getItem("auth_token");
    const response = await fetch(
      `${API_BASE_URL}/datasets/data/${selectedDataset.dataSetId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(formData),
      }
    );

    if (!response.ok) throw new Error("Failed to add row");

    // Refresh the rows
    await refetchRows();
  };

  const handleDeleteRow = async (rowId) => {
    const ok = await confirmDialog({
      title: "Delete this row?",
      body: "The row is removed from the data source. This can't be undone.",
      confirmLabel: "Delete row",
      destructive: true,
    });
    if (!ok) return;

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `${API_BASE_URL}/datasets/data/${selectedDataset.dataSetId}/${rowId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) throw new Error("Failed to delete row");

      // Refresh the rows
      await refetchRows();
    } catch (err) {
      toast.error("Couldn't delete the row", err.message);
    }
  };

  const handleBack = () => {
    setView("list");
    setSelectedDataset(null);
  };

  if (datasetsLoading && view === "list" && datasets.length === 0) {
    return <div className="p-8 text-center text-gray-500">Loading datasets...</div>;
  }

  return (
    <div className="p-6 h-full flex flex-col">
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error.message || "Something went wrong"}
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
                {datasets.length === 0 && !datasetsLoading && (
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
                <ArrowLeft className="w-4 h-4" />
                Back
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

          {detailLoading ? (
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

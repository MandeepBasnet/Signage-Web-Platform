import React, { useState } from "react";

export default function AddRowModal({ isOpen, onClose, columns, onSave }) {
  const [formData, setFormData] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

  const handleChange = (columnId, value) => {
    setFormData((prev) => ({
      ...prev,
      [`dataSetColumnId_${columnId}`]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSave(formData);
      setFormData({}); // Reset form
      onClose();
    } catch (error) {
      console.error("Failed to save row:", error);
      // Handle error (e.g., show toast)
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out columns that shouldn't be edited (like ID if auto-generated, though Xibo usually wants all)
  // For now, we'll show all columns returned by the API
  const editableColumns = columns.filter(col => col.heading !== "id"); // Assuming 'id' might be internal, adjust as needed

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Add New Row</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {editableColumns.map((col) => (
            <div key={col.dataSetColumnId} className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700">
                {col.heading}
              </label>
              <input
                type="text" // Default to text, could be improved with data types
                className="border border-gray-300 rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder={`Enter ${col.heading}`}
                onChange={(e) => handleChange(col.dataSetColumnId, e.target.value)}
                required
              />
            </div>
          ))}

          <div className="flex justify-end gap-3 mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:bg-blue-400"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Row"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

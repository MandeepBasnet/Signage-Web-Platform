import { useCallback, useRef, useState } from "react";
import { X } from "lucide-react";
import { useFocusTrap } from "../hooks/useFocusTrap.js";
import { getAuthHeaders } from "../utils/auth.js";
import { API_BASE_URL } from "../config/api.js";
import { formatFileSize } from "../utils/mediaTypes.js";

// Append the original file's extension to a user-supplied name when it lacks one.
const ensureNameHasExtension = (desiredName = "", fallbackName = "") => {
  const trimmed = desiredName?.trim() ?? "";
  if (!trimmed) return trimmed;

  const fallbackMatch = (fallbackName || "").match(/(\.[^./\\]+)$/);
  const fallbackExtension = fallbackMatch ? fallbackMatch[0] : "";
  const hasExtension = /\.[^./\\]+$/.test(trimmed);

  if (hasExtension || !fallbackExtension) {
    return trimmed;
  }

  return `${trimmed}${fallbackExtension}`;
};

// Self-contained "Upload Media" modal. Owns the upload form state; folder options
// are supplied/refreshed by the parent (shared with the library folder filter).
// Calls onUploaded(nameInfo) then onClose() after a successful upload.
export default function UploadMediaModal({
  onClose,
  folderOptions,
  foldersLoading,
  onRefreshFolders,
  onUploaded,
}) {
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadFolder, setUploadFolder] = useState("1");
  const [uploadDuration, setUploadDuration] = useState(10);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [nameSuggestion, setNameSuggestion] = useState(null);
  const panelRef = useRef(null);

  // Escape must not abandon an upload that is already in flight — the close
  // button is disabled for the same reason.
  const requestClose = useCallback(() => {
    if (!uploading) onClose?.();
  }, [uploading, onClose]);
  useFocusTrap(true, panelRef, requestClose);

  const handleFileChange = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setUploadFile(file);
      if (!uploadName) {
        setUploadName(file.name);
      }
      setUploadError(null);
      setNameSuggestion(null);
    }
  };

  const validateMediaNameAvailability = async (nameToValidate) => {
    if (!nameToValidate) {
      setUploadError("Media name is required.");
      return false;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/library/validate-name`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: nameToValidate }),
      });

      if (response.status === 409) {
        const errorData = await response.json().catch(() => ({}));
        setUploadError(
          errorData?.message ||
            `A media named '${nameToValidate}' already exists. Please choose another name.`
        );
        // Store suggestion with full details for retry
        setNameSuggestion({
          originalName: errorData?.nameInfo?.originalName || nameToValidate,
          suggestedName: errorData?.nameInfo?.suggestedName || nameToValidate,
          wasChanged: errorData?.nameInfo?.wasChanged || false,
          changeReason: errorData?.nameInfo?.changeReason || null,
        });
        return false;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.message ||
            `Failed to validate media name: ${response.status}`
        );
      }

      // Name is valid - clear any suggestions
      setNameSuggestion(null);
      return true;
    } catch (err) {
      console.error("Error validating media name:", err);
      setUploadError(err.message || "Failed to validate media name");
      setNameSuggestion(null);
      return false;
    }
  };

  const handleUploadSubmit = async (event) => {
    event.preventDefault();
    if (!uploadFile) {
      setUploadError("Please select a media file to upload.");
      return;
    }

    try {
      setUploading(true);
      setUploadError(null);
      const derivedName = ensureNameHasExtension(
        uploadName?.trim() || uploadFile.name,
        uploadFile.name
      );

      setUploadProgress("Checking media name...");
      const nameIsValid = await validateMediaNameAvailability(derivedName);
      if (!nameIsValid) {
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      setUploadProgress("Preparing upload...");

      const formData = new FormData();
      formData.append("media", uploadFile);
      formData.append("folderId", uploadFolder || "1");
      formData.append("duration", uploadDuration || 10);
      if (derivedName) {
        formData.append("name", derivedName);
      }

      setUploadProgress("Uploading to server...");

      const response = await fetch(`${API_BASE_URL}/library/upload`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
        },
        body: formData,
      });

      const result = await response.json();

      // Handle duplicate name errors from server
      if (response.status === 409) {
        setUploadError(
          result?.message ||
            `A media with that name already exists. Please choose another name.`
        );
        // Store suggestion from server for user to retry with
        if (result?.nameInfo) {
          setNameSuggestion({
            originalName: result.nameInfo.originalName,
            suggestedName: result.nameInfo.suggestedName,
            wasChanged: result.nameInfo.wasChanged,
            changeReason: result.nameInfo.changeReason,
          });
        }
        setUploading(false);
        setUploadProgress(null);
        return;
      }

      if (!response.ok) {
        throw new Error(
          result?.message ||
            result?.error ||
            `Upload failed: ${response.status}`
        );
      }

      setUploadProgress("Upload successful!");

      // Wait a moment to show success message, then notify the parent (which
      // surfaces any name-change notice and reloads the list) and close.
      setTimeout(() => {
        onUploaded?.(result.nameInfo);
        onClose?.();
      }, 1000);
    } catch (err) {
      console.error("Error uploading media:", err);
      setUploadError(err.message || "Failed to upload media");
      setUploadProgress(null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="upload-modal-title"
        className="w-full max-w-lg rounded-lg bg-white shadow-xl"
      >
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <h3
              id="upload-modal-title"
              className="text-lg font-semibold text-gray-900"
            >
              Upload Media
            </h3>
            <p className="text-sm text-gray-500">
              Select a file and destination folder
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close upload modal"
            disabled={uploading}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form className="px-6 py-4 space-y-4" onSubmit={handleUploadSubmit}>
          <div>
            <label
              htmlFor="upload-file"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Media File *
            </label>
            <input
              type="file"
              id="upload-file"
              accept="image/*,video/*,audio/*,application/pdf"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-700"
              disabled={uploading}
              required
            />
            {uploadFile && (
              <p className="text-xs text-gray-500 mt-1">
                Selected: {uploadFile.name} ({formatFileSize(uploadFile.size)})
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="upload-name"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Display Name
            </label>
            <input
              type="text"
              id="upload-name"
              value={uploadName}
              onChange={(e) => {
                setUploadName(e.target.value);
                setNameSuggestion(null);
                setUploadError(null);
              }}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Optional name"
              disabled={uploading}
            />
          </div>

          <div>
            <label
              htmlFor="upload-folder"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Folder
            </label>
            <select
              id="upload-folder"
              value={uploadFolder}
              onChange={(e) => setUploadFolder(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={uploading}
            >
              {folderOptions.length === 0 ? (
                <option value="1">
                  {foldersLoading ? "Loading folders..." : "Root Folder"}
                </option>
              ) : (
                folderOptions.map((folder) => (
                  <option key={folder.id} value={folder.id}>
                    {folder.path}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50"
              onClick={onRefreshFolders}
              disabled={foldersLoading || uploading}
            >
              {foldersLoading ? "Refreshing folders..." : "Refresh folders"}
            </button>
          </div>

          <div>
            <label
              htmlFor="upload-duration"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Duration (seconds)
            </label>
            <input
              type="number"
              id="upload-duration"
              min="1"
              value={uploadDuration}
              onChange={(e) => setUploadDuration(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={uploading}
            />
          </div>

          {uploadProgress && (
            <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-700">
              {uploadProgress}
            </div>
          )}

          {uploadError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {uploadError}
            </div>
          )}

          {nameSuggestion?.suggestedName && (
            <div className="rounded-md border border-yellow-200 bg-yellow-50 px-3 py-3 text-sm text-yellow-800 space-y-2">
              <div>
                <p className="mb-2">
                  <span className="font-semibold">Conflict Detected:</span> A
                  media with the name{" "}
                  <span className="font-mono">
                    "{nameSuggestion.originalName}"
                  </span>{" "}
                  already exists.
                </p>
                <p>
                  Suggested alternative:{" "}
                  <span className="font-semibold font-mono">
                    {nameSuggestion.suggestedName}
                  </span>
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setUploadName(nameSuggestion.suggestedName);
                    setNameSuggestion(null);
                    setUploadError(null);
                  }}
                  className="rounded-md bg-yellow-600 px-3 py-1 text-xs font-medium text-white hover:bg-yellow-700 transition-colors"
                >
                  Use suggested name
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNameSuggestion(null);
                    setUploadError(null);
                  }}
                  className="rounded-md bg-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-400 transition-colors"
                >
                  Try different name
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
              disabled={uploading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors disabled:opacity-70"
              disabled={uploading || !uploadFile}
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

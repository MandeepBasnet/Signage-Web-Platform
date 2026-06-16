import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../../lib/apiClient.js";
import { flattenFolders } from "../../utils/folderUtils.js";

// Library folder list + the user's home folder id (used to pick the default
// folder view). Cached so reopening the Media tab or the upload modal doesn't
// re-fetch. Returns { folders, homeFolderId }.
export function useFolders() {
  return useQuery({
    queryKey: ["folders"],
    queryFn: () =>
      apiGet("/library/folders").then((d) => ({
        folders: flattenFolders(d?.folders || []),
        homeFolderId: d?.homeFolderId ?? null,
      })),
  });
}

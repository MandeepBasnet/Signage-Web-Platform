// Flatten the Xibo folder tree into a flat list of { id, label, path } options.
// Each node's display path is the " / "-joined chain of ancestor labels.

export function flattenFolders(nodes = [], parentPath = []) {
  const list = [];
  nodes.forEach((node) => {
    if (!node) return;
    const folderId = node.folderId || node.id;
    const label =
      node.folderName || node.text || node.name || `Folder ${folderId || ""}`;
    const currentPath = [...parentPath, label];

    if (folderId) {
      list.push({
        id: String(folderId),
        label,
        path: currentPath.join(" / "),
      });
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
      list.push(...flattenFolders(node.children, currentPath));
    }
  });
  return list;
}

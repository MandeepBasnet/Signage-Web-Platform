import express from "express";
import * as datasetController from "../controllers/datasetController.js";
import { cacheList } from "../middleware/responseCache.js";

const router = express.Router();

// The datasets list has no create/delete endpoint here, so a short TTL is the
// only freshness mechanism it needs (row mutations don't affect the list).
router.get("/", cacheList("datasets"), datasetController.getDatasets);
router.get("/:id/column", datasetController.getDatasetColumns);
router.get("/data/:id", datasetController.getDatasetData);
router.post("/data/:id", datasetController.addDatasetRow);
router.delete("/data/:id/:rowId", datasetController.deleteDatasetRow);

export default router;

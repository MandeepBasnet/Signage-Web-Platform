import express from "express";
import * as datasetController from "../controllers/datasetController.js";

const router = express.Router();

router.get("/", datasetController.getDatasets);
router.get("/:id/column", datasetController.getDatasetColumns);
router.get("/data/:id", datasetController.getDatasetData);
router.post("/data/:id", datasetController.addDatasetRow);
router.delete("/data/:id/:rowId", datasetController.deleteDatasetRow);

export default router;

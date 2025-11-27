import express from "express";
import {
  getDatasets,
  getDatasetColumns,
  getDatasetData,
  addDatasetRow,
} from "../controllers/datasetController.js";

const router = express.Router();

router.get("/", getDatasets);
router.get("/:id/column", getDatasetColumns);
router.get("/data/:id", getDatasetData);
router.post("/data/:id", addDatasetRow);

export default router;

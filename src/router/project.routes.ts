import express from "express";
import projectController from "../controller/project.controller";
import { authenticationMiddleware } from "../middleware/auth.middleware";
import validate from "../middleware/validate.middleware";
import projectSchema from "../schema/project.schema";
import upload from "../middleware/multer.middleware";
import validateFiles from "../middleware/validateFiles.middleware";
import parseMilestones from "../middleware/parseMilestones.middleware";

const projectRoutes = express.Router();

projectRoutes.post(
  "/",
  authenticationMiddleware,
  upload.fields([{ name: "file", maxCount: 1 }, { name: "image", maxCount: 1 }, { name: "invoice", maxCount: 1 }]),
  validateFiles(["file","image"]),
  parseMilestones,
  validate(projectSchema.createProjectSchema),
  projectController.createProject
);

projectRoutes.get(
  "/",
  authenticationMiddleware,
  projectController.getAllProjects
);

projectRoutes.put(
  "/:projectId",
  authenticationMiddleware,
  upload.fields([{ name: "image", maxCount: 1 }]),
  validate(projectSchema.updateProjectSchema),
  projectController.updateProject
);

projectRoutes.get(
  "/getInvestedProjects",
  authenticationMiddleware,
  projectController.getInvestedProjects
);

projectRoutes.get(
  "/:projectId",
  authenticationMiddleware,
  validate(projectSchema.updateProjectSchema),
  projectController.getProjectROIData
);

export default projectRoutes;

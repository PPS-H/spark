import express from "express";
import projectController from "../controller/project.controller";
import { authenticationMiddleware } from "../middleware/auth.middleware";
import validate from "../middleware/validate.middleware";
import projectSchema from "../schema/project.schema";
import upload from "../middleware/multer.middleware";
import validateFiles from "../middleware/validateFiles.middleware";

const projectRoutes = express.Router();

projectRoutes.post(
  "/",
  authenticationMiddleware,
  upload.fields([{ name: "file", maxCount: 1 }]),
  validateFiles(["file"]),
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
  validate(projectSchema.updateProjectSchema),
  projectController.updateProject
);

projectRoutes.get(
  "/:projectId",
  authenticationMiddleware,
  validate(projectSchema.updateProjectSchema),
  projectController.getProjectROIData
);

export default projectRoutes;

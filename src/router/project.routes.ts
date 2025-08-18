import express from "express";
import projectController from "../controller/project.controller";
import { authenticationMiddleware } from "../middleware/auth.middleware";
import validate from "../middleware/validate.middleware";
import projectSchema from "../schema/project.schema";

const projectRoutes = express.Router();

projectRoutes.post(
  "/",
  authenticationMiddleware,
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

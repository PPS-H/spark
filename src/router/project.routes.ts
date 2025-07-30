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

export default projectRoutes;

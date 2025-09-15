import express from "express";
import adminSchema from "../schema/admin.schema";
import adminController from "../controller/admin.controller";
import validate from "../middleware/validate.middleware";
import { adminAuthenticationMiddleware } from "../middleware/admin.middleware";

const adminRoutes = express.Router();

adminRoutes.post(
  "/login",
  validate(adminSchema.adminLoginSchema),
  adminController.adminLogin
);

adminRoutes.get(
  "/draft-projects",
  adminAuthenticationMiddleware,
  validate(adminSchema.adminGetDraftProjectsSchema),
  adminController.getDraftProjects
);

adminRoutes.put(
  "/project/:projectId/approve-reject",
  adminAuthenticationMiddleware,
  validate(adminSchema.adminApproveRejectProjectSchema),
  adminController.approveRejectProject
);

adminRoutes.get(
  "/project/:projectId",
  adminAuthenticationMiddleware,
  validate(adminSchema.adminGetProjectDetailsSchema),
  adminController.getProjectDetails
);

export default adminRoutes;
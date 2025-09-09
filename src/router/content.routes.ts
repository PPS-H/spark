import express from "express";
import userSchema from "../schema/user.schema";
import userController from "../controller/user.controller";
import validate from "../middleware/validate.middleware";
import contentController from "../controller/content.controller";
import contentSchema from "../schema/content.schema";
import { authenticationMiddleware } from "../middleware/auth.middleware";
import upload from "../middleware/multer.middleware";
import validateFiles from "../middleware/validateFiles.middleware";

const contentRoutes = express.Router();

contentRoutes.post(
  "/",
  authenticationMiddleware,
  upload.fields([{ name: "file", maxCount: 1 }]),
  validateFiles(["file"]),
  validate(contentSchema.addContentSchema),
  contentController.addContent
);

contentRoutes.get(
  "/",
  authenticationMiddleware,
  validate(contentSchema.getAllContentSchema),
  contentController.getAllContent
);

contentRoutes.get(
  "/getTrendingContent",
  authenticationMiddleware,
  validate(contentSchema.getTrendingContentSchema),
  contentController.getTrendingContent
);

contentRoutes.get(
  "/getUserContentSearchHisory",
  authenticationMiddleware,
  validate(contentSchema.searchContentSchema),
  contentController.getUserContentSearchHisory
);

contentRoutes.put(
  "/likeDislikeContent/:contentId",
  authenticationMiddleware,
  validate(contentSchema.likeDislikeContentSchema),
  contentController.likeDislikeContent
);
0
contentRoutes.delete(
  "/:contentId",
  authenticationMiddleware,
  validate(contentSchema.deleteContentSchema),
  contentController.deleteContent
);
export default contentRoutes;

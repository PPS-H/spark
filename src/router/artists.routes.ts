import express from "express";
import artistController from "../controller/artist.controller";
import { authenticationMiddleware } from "../middleware/auth.middleware";
import validate from "../middleware/validate.middleware";
import contentSchema from "../schema/content.schema";
import artistSchema from "../schema/artist.schema";
import upload from "../middleware/multer.middleware";

const artistRoutes = express.Router();

artistRoutes.get(
  "/",
  authenticationMiddleware,
  artistController.getFeaturedArtists
);

artistRoutes.put(
  "/likeDislikeArtist/:artistId",
  authenticationMiddleware,
  validate(artistSchema.likeDislikeArtistSchema),
  artistController.likeDislikeArtist
);

artistRoutes.put(
  "/followUnfollowArtist/:artistId",
  authenticationMiddleware,
  validate(artistSchema.likeDislikeArtistSchema),
  artistController.followUnfollowArtist
);

artistRoutes.get(
  "/analytics",
  authenticationMiddleware,
  artistController.getAnalytics
);

artistRoutes.post(
  "/fund-unlock-request",
  authenticationMiddleware,
  validate(artistSchema.submitFundUnlockRequestSchema),
  artistController.submitFundUnlockRequest
);

artistRoutes.get(
  "/fund-unlock-request/:projectId/status",
  authenticationMiddleware,
  validate(artistSchema.getFundUnlockRequestStatusSchema),
  artistController.getFundUnlockRequestStatus
);

artistRoutes.post(
  "/milestone-proof",
  authenticationMiddleware,
  upload.single("proof"),
  validate(artistSchema.addMilestoneProofSchema),
  artistController.addMilestoneProof
);

export default artistRoutes;

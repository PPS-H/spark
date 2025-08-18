import express from "express";
import streamingAuthController from "../controller/streamingAuth.controller";
import { authenticationMiddleware } from "../middleware/auth.middleware";

const streamingAccountRoutes = express.Router();

streamingAccountRoutes.get(
  "/connectSpotify",
  authenticationMiddleware,
  streamingAuthController.connectSpotify
);

streamingAccountRoutes.get(
  "/spotify/callback",
  streamingAuthController.spotifyCallback
);

streamingAccountRoutes.get(
  "/connectYoutube",
  streamingAuthController.connectYouTube
);

streamingAccountRoutes.get(
  "/youtube/callback",
  streamingAuthController.youTubeCallback
);

streamingAccountRoutes.get(
  "/getStreamingAccounts",
  authenticationMiddleware,
  streamingAuthController.getConnectedAccounts
);

streamingAccountRoutes.get(
  "/disconnectAccount",
  streamingAuthController.disconnectAccount
);

export default streamingAccountRoutes;

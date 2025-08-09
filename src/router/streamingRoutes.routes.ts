import express from "express";
import streamingAuthController from "../controller/streamingAuth.controller";

const streamingAccountRoutes = express.Router();

streamingAccountRoutes.get(
  "/connectSpotify",
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
  streamingAuthController.getConnectedAccounts
);

streamingAccountRoutes.get(
  "/disconnectAccount",
  streamingAuthController.disconnectAccount
);

export default streamingAccountRoutes;

import express from "express";
import artistController from "../controller/artist.controller";
import { authenticationMiddleware } from "../middleware/auth.middleware";
import validate from "../middleware/validate.middleware";
import contentSchema from "../schema/content.schema";
import artistSchema from "../schema/artist.schema";

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

export default artistRoutes;

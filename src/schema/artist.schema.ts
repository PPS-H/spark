import Joi from "joi";
import { numberValidation, ObjectIdValidation } from ".";

const getFeaturedArtistsSchema = {
  query: Joi.object({
    page: numberValidation("Page", false, 1),
    limit: numberValidation("Limit", false, 1),
  }),
};

const likeDislikeArtistSchema = {
  params: Joi.object({
    artistId: ObjectIdValidation("Artist ID"),
  }),
};

export default {
  getFeaturedArtistsSchema,
  likeDislikeArtistSchema,
};

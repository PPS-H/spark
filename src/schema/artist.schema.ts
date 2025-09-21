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

const submitFundUnlockRequestSchema = {
  body: Joi.object({
    projectId: ObjectIdValidation("Project ID"),
  }),
};

const getFundUnlockRequestStatusSchema = {
  params: Joi.object({
    projectId: ObjectIdValidation("Project ID"),
  }),
};

export default {
  getFeaturedArtistsSchema,
  likeDislikeArtistSchema,
  submitFundUnlockRequestSchema,
  getFundUnlockRequestStatusSchema,
};

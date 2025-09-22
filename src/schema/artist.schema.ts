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

const addMilestoneProofSchema = {
  body: Joi.object({
    projectId: ObjectIdValidation("Project ID"),
    milestoneId: ObjectIdValidation("Milestone ID"),
    description: Joi.string().required().max(1000).messages({
      "string.empty": "Description is required",
      "string.max": "Description must not exceed 1000 characters",
    }),
  }),
};

export default {
  getFeaturedArtistsSchema,
  likeDislikeArtistSchema,
  submitFundUnlockRequestSchema,
  getFundUnlockRequestStatusSchema,
  addMilestoneProofSchema,
};

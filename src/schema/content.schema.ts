import Joi from "joi";
import {
  numberValidation,
  ObjectIdValidation,
  specificStringValidation,
  stringValidation,
} from ".";
import { contentType, searchType } from "../utils/enums";
import { query } from "express";

const addContentSchema = {
  body: Joi.object({
    title: stringValidation("Title"),
    genre: stringValidation("Genre"),
    description: stringValidation("Description"),
  }),
};

const getAllContentSchema = {
  query: Joi.object({
    type: specificStringValidation("Type", contentType, false),
  }),
};

const likeDislikeContentSchema = {
  params: Joi.object({
    contentId: ObjectIdValidation("Content ID"),
  }),
};

const getTrendingContentSchema = {
  query: Joi.object({
    page: numberValidation("Page", false),
    limit: numberValidation("Limit", false),
    type: specificStringValidation("Type", searchType, false),
    search: stringValidation("Search", false),
  }),
};

const searchContentSchema = {
  query: Joi.object({
    search: stringValidation("Search", false),
  }),
};

const deleteContentSchema = {
  params: Joi.object({
    contentId: ObjectIdValidation("Content ID"),
  }),
};

export default {
  addContentSchema,
  getAllContentSchema,
  likeDislikeContentSchema,
  getTrendingContentSchema,
  searchContentSchema,
  deleteContentSchema
};

import Joi from "joi";
import {
  ObjectIdValidation,
  specificStringValidation,
  stringValidation,
} from ".";
import { projectDurationType } from "../utils/enums";

const createProjectSchema = {
  body: Joi.object({
    title: stringValidation("Title"),
    fundingGoal: stringValidation("Funding Goal"),
    description: stringValidation("Description"),
    duration: specificStringValidation("Duration", projectDurationType),
  }),
};

const updateProjectSchema = {
  params: Joi.object({
    projectId: ObjectIdValidation("Project ID"),
  }),
  body: Joi.object({
    title: stringValidation("Title", false),
    fundingGoal: stringValidation("Funding Goal", false),
    description: stringValidation("Description", false),
    duration: specificStringValidation("Duration", projectDurationType, false),
  }),
};

export default {
  createProjectSchema,
  updateProjectSchema,
};

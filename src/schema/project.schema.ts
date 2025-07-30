import Joi from "joi";
import { specificStringValidation, stringValidation } from ".";
import { contentType, projectDurationType } from "../utils/enums";

const createProjectSchema = {
  body: Joi.object({
    title: stringValidation("Title"),
    fundingGoal: stringValidation("Funding Goal"),
    description: stringValidation("Description"),
    duration: specificStringValidation("Duration", projectDurationType),
  }),
};

export default {
  createProjectSchema,
};

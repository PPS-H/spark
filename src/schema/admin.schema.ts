import Joi from "joi";
import { emailValidation, passwordValidation, stringValidation, numberValidation, ObjectIdValidation, specificStringValidation } from ".";

const adminLoginSchema = {
  body: Joi.object({
    email: emailValidation(true),
    password: passwordValidation("Password"),
  }),
};

const adminGetDraftProjectsSchema = {
  query: Joi.object({
    page: numberValidation("Page", false),
    limit: numberValidation("Limit", false),
  }),
};

const adminApproveRejectProjectSchema = {
  params: Joi.object({
    projectId: ObjectIdValidation("Project ID"),
  }),
  body: Joi.object({
    action: specificStringValidation("Action", ["approve", "reject"], true),
    reason: stringValidation("Reason", false),
  }),
};

const adminGetProjectDetailsSchema = {
  params: Joi.object({
    projectId: ObjectIdValidation("Project ID"),
  }),
};

const adminSchema = {
  adminLoginSchema,
  adminGetDraftProjectsSchema,
  adminApproveRejectProjectSchema,
  adminGetProjectDetailsSchema,
};

export default adminSchema;
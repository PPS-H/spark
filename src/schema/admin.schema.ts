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

const adminGetFundUnlockRequestsSchema = {
  query: Joi.object({
    page: numberValidation("Page", false),
    limit: numberValidation("Limit", false),
    status: specificStringValidation("Status", ["pending", "approved", "rejected"], false),
  }),
};

const adminApproveRejectFundRequestSchema = {
  params: Joi.object({
    requestId: ObjectIdValidation("Request ID"),
  }),
  body: Joi.object({
    action: specificStringValidation("Action", ["approve", "reject"], true),
    adminResponse: stringValidation("Admin Response", false),
    milestoneId: ObjectIdValidation("Milestone ID", false),
  }),
};

const adminGetFundRequestDetailsSchema = {
  params: Joi.object({
    requestId: ObjectIdValidation("Request ID"),
  }),
};

const adminGetMilestoneProofsSchema = {
  query: Joi.object({
    page: numberValidation("Page", false, 1),
    limit: numberValidation("Limit", false, 1),
    status: specificStringValidation("Status", ["pending", "approved", "rejected"], false),
  }),
};

const adminGetMilestoneProofDetailsSchema = {
  params: Joi.object({
    proofId: ObjectIdValidation("Proof ID"),
  }),
};

const adminApproveRejectMilestoneProofSchema = {
  params: Joi.object({
    proofId: ObjectIdValidation("Proof ID"),
  }),
  body: Joi.object({
    action: specificStringValidation("Action", ["approve", "reject"], true),
    adminResponse: stringValidation("Admin Response", false),
  }),
};

const adminSchema = {
  adminLoginSchema,
  adminGetDraftProjectsSchema,
  adminApproveRejectProjectSchema,
  adminGetProjectDetailsSchema,
  adminGetFundUnlockRequestsSchema,
  adminApproveRejectFundRequestSchema,
  adminGetFundRequestDetailsSchema,
  adminGetMilestoneProofsSchema,
  adminGetMilestoneProofDetailsSchema,
  adminApproveRejectMilestoneProofSchema,
};

export default adminSchema;
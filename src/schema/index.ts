import Joi from "joi";
import mongoose from "mongoose";

export const stringValidation = (key: string, isRequired: boolean = true) => {
  let schema: any;
  if (isRequired) {
    schema = Joi.string()
      .required()
      .messages({
        "string.empty": `${key} cannot be empty.`,
        "string.base": `${key} should be a type of text`,
        "any.required": `${key} is required`,
      });
  } else {
    schema = Joi.string()
      .optional()
      .messages({
        "string.empty": `${key} cannot be empty.`,
        "string.base": `${key} should be a type of text`,
      });
  }

  return schema;
};

export const booleanValidation = (key: string, isRequired: boolean = true) => {
  let schema: any;

  if (isRequired) {
    schema = Joi.boolean()
      .required()
      .messages({
        "boolean.base": `${key} must be a boolean value.`,
        "any.required": `${key} is required.`,
      });
  } else {
    schema = Joi.boolean()
      .optional()
      .messages({
        "boolean.base": `${key} must be a boolean value.`,
      });
  }

  return schema;
};

export const numberValidation = (
  key: string,
  isRequired: boolean = true,
  min: number = 0
) => {
  let schema: any;
  if (isRequired) {
    schema = Joi.number()
      .min(min)
      .required()
      .messages({
        "number.base": `${key} must be a number.`,
        "number.min": `${key} must be at least ${min}.`,
        "any.required": `${key} is required.`,
      });
  } else {
    schema = Joi.number()
      .min(min)
      .optional()
      .messages({
        "number.base": `${key} must be a number.`,
        "number.min": `${key} must be at least ${min}.`,
      });
  }
  return schema;
};

export const ObjectIdValidation = (key: string, isRequired: boolean = true) => {
  let schema: any;
  if (isRequired) {
    schema = Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .required()
      .custom((value, helpers) => {
        const id = value;
        if (!mongoose.Types.ObjectId.isValid(id)) {
          return helpers.error("any.invalid");
        }
        return value;
      }, "ObjectId validation")
      .messages({
        "string.base": `${key} should be a type of text`,
        "string.empty": `${key} cannot be empty`,
        "string.pattern.base": `${key} must be a valid ObjectId`,
        "any.invalid": `${key} must be a valid ObjectId`,
        "any.required": `${key} is required.`,
      });
  } else {
    schema = Joi.string()
      .pattern(/^[0-9a-fA-F]{24}$/)
      .optional()
      .messages({
        "string.base": `${key} should be a type of text`,
        "string.empty": `${key} cannot be empty`,
        "string.pattern.base": `${key} must be a valid ObjectId`,
      });
  }
  return schema;
};

export const passwordValidation = (key: string = "Password") => {
  return Joi.string()
    .min(12)
    .max(50)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*[^a-zA-Z0-9]).{12,}$/)
    .required()
    .messages({
      "string.base": `${key} should be a type of text.`,
      "string.empty": `${key} cannot be empty.`,
      "string.min": `${key} should have at least 12 characters.`,
      "string.max": `${key} should not exceed 50 characters.`,
      "string.pattern.base": `${key} must include at least one uppercase letter, one lowercase letter, and one special character.`,
      "any.required": `${key} is required.`,
    });
};

export const emailValidation = (isRequired: boolean = true) => {
  let schema: any;
  if (isRequired) {
    schema = Joi.string().required().email().messages({
      "string.email": "Email must be a valid email address.",
      "string.empty": "Email cannot be empty.",
      "any.required": `Email is required`,
    });
  } else {
    schema = Joi.string().optional().email().messages({
      "string.email": "Email must be a valid email address.",
      "string.empty": "Email cannot be empty.",
    });
  }
  return schema;
};

export const specificStringValidation = (
  key: string,
  type: any,
  isRequired: boolean = true
) => {
  let schema: any;
  if (isRequired) {
    schema = Joi.string()
      .required()
      .valid(...Object.values({ ...type }))
      .messages({
        "string.base": `${key} must be a string.`,
        "string.empty": `${key} cannot be empty.`,
        "any.required": `${key} is required`,
        "any.only": `${key} must be one of: ${Object.values(type).join(", ")}.`,
      });
  } else {
    schema = Joi.string()
      .optional()
      .valid(...Object.values({ ...type }))
      .messages({
        "string.base": `${key} must be a string.`,
        "string.empty": `${key} cannot be empty.`,
        "any.only": `${key} must be one of: ${Object.values(type).join(", ")}.`,
      });
  }
  return schema;
};

export const specificNumberValidation = (
  key: string,
  type: any,
  isRequired: boolean = true
) => {
  let schema: any;
  if (isRequired) {
    schema = Joi.number()
      .required()
      .valid(...Object.values({ ...type }))
      .messages({
        "number.base": `${key} must be a number.`,
        "any.required": `${key} is required`,
        "any.only": `${key} must be one of: ${Object.values(type).join(", ")}.`,
      });
  } else {
    schema = Joi.number()
      .optional()
      .valid(...Object.values({ ...type }))
      .messages({
        "number.base": `${key} must be a number.`,
        "any.only": `${key} must be one of: ${Object.values(type).join(", ")}.`,
      });
  }
  return schema;
};
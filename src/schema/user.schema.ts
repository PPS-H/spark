import Joi from "joi";
import {
  booleanValidation,
  emailValidation,
  numberValidation,
  ObjectIdValidation,
  passwordValidation,
  specificNumberValidation,
  specificStringValidation,
  stringValidation,
} from ".";
import {
  companyType,
  musicPlatforms,
  teamSize,
  userRoles,
} from "../utils/enums";

export const registerUserSchema = {
  body: Joi.object({
    username: stringValidation("Username"),
    email: emailValidation(true),
    password: passwordValidation("Password"),
    country: stringValidation("Country",false),
    favoriteGenre: stringValidation("Favorite Genre"),

    musicPlatforms: Joi.array()
      .items(specificStringValidation("Music Platform", musicPlatforms, true))
      .optional()
      .messages({
        "array.base": "Music platforms must be an array.",
        "array.includes": "Invalid music platform provided.",
      }),

    aboutTxt: stringValidation("About Text", false),
    role: specificStringValidation("Role", userRoles),

    // Artist-specific field
    artistBio: Joi.string().when("role", {
      is: userRoles.ARTIST,
      then: Joi.string().required().messages({
        "any.required": "Artist bio is required when role is artist.",
        "string.empty": "Artist bio cannot be empty.",
      }),
      otherwise: Joi.string().optional(),
    }),

    // Label-specific fields
    companyType: Joi.string()
      .valid(...Object.values(companyType))
      .when("role", {
        is: userRoles.LABEL,
        then: Joi.required().messages({
          "any.required": "Company type is required when role is label.",
        }),
        otherwise: Joi.optional(),
      }),

    teamSize: Joi.string()
      .valid(...Object.values(teamSize))
      .when("role", {
        is: userRoles.LABEL,
        then: Joi.required().messages({
          "any.required": "Team size is required when role is label.",
        }),
        otherwise: Joi.optional(),
      }),

    companyDescription: stringValidation("Company Description", false),

    // Social media and website
    instagram: Joi.string().uri().optional().messages({
      "string.uri": "Instagram link must be a valid URL.",
    }),
    youtube: Joi.string().uri().optional().messages({
      "string.uri": "YouTube link must be a valid URL.",
    }),
    spotify: Joi.string().uri().optional().messages({
      "string.uri": "Spotify link must be a valid URL.",
    }),
    website: Joi.string().uri().optional().messages({
      "string.uri": "Website link must be a valid URL.",
    }),
  }),
};

const loginUserSchema = {
  body: Joi.object({
    email: emailValidation(true),
    password: stringValidation("Password", true),
  }),
};

const updateUserProfileSchema = {
  body: Joi.object({
    username: stringValidation("Username", false),
    // email: emailValidation(false),
    country: stringValidation("Country", false),
    favoriteGenre: stringValidation("Favorite Genre", false),
    musicPlatforms: Joi.array()
      .items(specificStringValidation("Music Platform", musicPlatforms, true))
      .optional()
      .messages({
        "array.base": "Music platforms must be an array.",
        "array.includes": "Invalid music platform provided.",
      }),
    aboutTxt: stringValidation("About Text", false),
    artistBio: stringValidation("Artist Bio", false),

    // Social media and website
    instagram: Joi.string().uri().optional().messages({
      "string.uri": "Instagram link must be a valid URL.",
    }),
    youtube: Joi.string().uri().optional().messages({
      "string.uri": "YouTube link must be a valid URL.",
    }),
    spotify: Joi.string().uri().optional().messages({
      "string.uri": "Spotify link must be a valid URL.",
    }),
    website: Joi.string().uri().optional().messages({
      "string.uri": "Website link must be a valid URL.",
    }),

    companyType: specificStringValidation("Company Type", companyType, false),
    teamSize: specificStringValidation("Team Size", teamSize, false),

    companyDescription: stringValidation("Company Description", false),
    emailNotifications: booleanValidation("Email notifications", false),
    pushNotifications: booleanValidation("Push notifications", false),
    fundingAlerts: booleanValidation("Funding Alerts", false),
    publicProfile: booleanValidation("Public Profile", false),
    investmentActivity: booleanValidation("Investment Activity", false),
    directMessages: booleanValidation("Direct Messages", false),
    autoPreview: booleanValidation("Auto Preview", false),
    language: Joi.string()
      .valid('en', 'fr', 'es', 'pt', 'it', 'ja', 'zh', 'ko')
      .optional()
      .messages({
        "any.only": "Language must be one of: en, fr, es, pt, it, ja, zh, ko",
      }),
    darkMode: booleanValidation("Dark Mode", false),
  }),
};

const verifyOTPSchema = {
  body: Joi.object({
    userId: ObjectIdValidation("UserID"),
    otp: numberValidation("OTP"),
    type: specificNumberValidation("Type", [1, 2]),
  }),
};

const sendOTPSchema = {
  body: Joi.object({
    email: emailValidation(),
    type: specificNumberValidation("Type", [1, 2, 3, 4]),
  }),
};

const changePasswordSchema = {
  body: Joi.object({
    userId: ObjectIdValidation("User Id"),
    password: passwordValidation(),
  }),
};

const resetPasswordSchema = {
  body: Joi.object({
    oldPassword: stringValidation("Current Password", true),
    newPassword: passwordValidation("New Password"),
  }),
};

const updatePasswordSchema = {
  body: Joi.object({
    oldPassword: stringValidation("Current Password", true),
    password: passwordValidation("New Password"),
  }),
};

export default {
  registerUserSchema,
  loginUserSchema,
  updateUserProfileSchema,
  verifyOTPSchema,
  sendOTPSchema,
  changePasswordSchema,
  resetPasswordSchema,
  updatePasswordSchema
};

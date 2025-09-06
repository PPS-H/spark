import Joi from "joi";
import {
  numberValidation,
  ObjectIdValidation,
  specificStringValidation,
  stringValidation,
} from ".";
import { projectDurationType } from "../utils/enums";

const createProjectSchema = {
  body: Joi.object({
    title: stringValidation("Project Title"),
    fundingGoal: numberValidation("Funding Goal"),
    description: stringValidation("Description"),
    duration: specificStringValidation("Duration", projectDurationType),
    
    // Required metadata fields
    songTitle: stringValidation("Song Title"),
    artistName: stringValidation("Artist Name"),
    isrcCode: Joi.string()
      .pattern(/^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/)
      .required()
      .messages({
        'string.pattern.base': 'ISRC code must be in format: CC-XXX-YY-NNNNN',
        'any.required': 'ISRC code is required'
      }),
    upcCode: Joi.string()
      .pattern(/^[0-9]{12}$/)
      .optional()
      .messages({
        'string.pattern.base': 'UPC code must be exactly 12 digits'
      }),
    
    // Spotify (Required)
    spotifyTrackLink: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'Spotify track link must be a valid URL' }),
    spotifyTrackId: Joi.string()
      .pattern(/^[a-zA-Z0-9]{22}$/)
      .optional()
      .messages({
        'string.pattern.base': 'Spotify track ID must be exactly 22 characters'
      }),
    
    // YouTube Music (Optional)
    youtubeMusicLink: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'YouTube Music link must be a valid URL'
      }),
    youtubeVideoId: Joi.string()
      .pattern(/^[a-zA-Z0-9_-]{11}$/)
      .optional()
      .messages({
        'string.pattern.base': 'YouTube video ID must be exactly 11 characters'
      }),
    
    // Deezer (Optional)
    deezerTrackLink: Joi.string()
      .uri()
      .optional()
      .messages({
        'string.uri': 'Deezer track link must be a valid URL'
      }),
    deezerTrackId: Joi.string()
      .pattern(/^[0-9]+$/)
      .optional()
      .messages({
        'string.pattern.base': 'Deezer track ID must be numeric'
      }),
    
    // Additional fields
    releaseType: Joi.string().valid('single', 'album', 'ep').required(),
    expectedReleaseDate: Joi.date().optional(),
    fundingDeadline: Joi.date().greater('now').optional()
  })
};


const updateProjectSchema = {
  params: Joi.object({
    projectId: ObjectIdValidation("Project ID"),
  }),
  body: Joi.object({
    title: stringValidation("Title", false),
    fundingGoal: numberValidation("Funding Goal", false),
    description: stringValidation("Description", false),
    duration: specificStringValidation("Duration", projectDurationType, false),
  }),
};

export default {
  createProjectSchema,
  updateProjectSchema,
};

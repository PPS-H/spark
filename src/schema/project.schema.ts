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
    fundingDeadline: Joi.date().greater('now').optional(),
    
    // Milestones validation
    milestones: Joi.array()
      .items(
        Joi.object({
          name: Joi.string().required().messages({
            'any.required': 'Milestone name is required',
            'string.empty': 'Milestone name cannot be empty'
          }),
          amount: Joi.number().positive().required().messages({
            'any.required': 'Milestone amount is required',
            'number.positive': 'Milestone amount must be positive',
            'number.base': 'Milestone amount must be a number'
          }),
          description: Joi.string().required().messages({
            'any.required': 'Milestone description is required',
            'string.empty': 'Milestone description cannot be empty'
          }),
          order: Joi.number().integer().positive().required().messages({
            'any.required': 'Milestone order is required',
            'number.integer': 'Milestone order must be an integer',
            'number.positive': 'Milestone order must be positive'
          })
        })
      )
      .min(1)
      .required()
      .messages({
        'any.required': 'At least one milestone is required',
        'array.min': 'At least one milestone is required',
        'array.base': 'Milestones must be an array'
      })
      .custom((milestones, helpers) => {
        const { fundingGoal } = helpers.state.ancestors[0];
        if (fundingGoal) {
          const totalMilestoneAmount = milestones.reduce((sum: number, milestone: any) => sum + milestone.amount, 0);
          if (totalMilestoneAmount !== fundingGoal) {
            return helpers.error('milestone.total.mismatch', {
              totalMilestoneAmount,
              fundingGoal
            });
          }
        }
        return milestones;
      })
      .messages({
        'milestone.total.mismatch': 'Total milestone amount ({{#totalMilestoneAmount}}) must equal funding goal ({{#fundingGoal}})'
      }),
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
    image: Joi.string().optional(),
  }),
};

export default {
  createProjectSchema,
  updateProjectSchema,
};

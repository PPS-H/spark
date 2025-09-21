import { Schema, model } from "mongoose";
import { ProjectCampaignModel } from "../../types/Database/types";
import {
  contentType,
  projectDurationType,
  projectStatus,
} from "../utils/enums";

const projectSchema = new Schema<any>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    fundingGoal: { type: Number, required: true },
    description: { type: String, required: true },
    duration: {
      type: String,
      enum: Object.values(projectDurationType),
      required: true,
    },

    // Required metadata fields from frontend
    songTitle: { type: String, required: true },
    artistName: { type: String, required: true },
    isrcCode: { type: String, required: true },
    upcCode: { type: String }, // Optional for singles

    // Platform-specific fields
    spotifyTrackLink: { type: String, default: null },
    spotifyTrackId: { type: String, default: null },
    youtubeMusicLink: { type: String }, // Optional
    youtubeVideoId: { type: String }, // Optional
    deezerTrackLink: { type: String }, // Optional
    deezerTrackId: { type: String }, // Optional

    // Additional fields
    releaseType: {
      type: String,
      enum: ["single", "album", "ep"],
      required: true,
    },
    expectedReleaseDate: { type: Date },
    fundingDeadline: { type: Date },

    // Project image
    image: { type: String }, // Path to uploaded image file

    expectedROIPercentage: { type: Number }, // e.g., 15.5 means 15.5% expected return
    automaticROI: {
      totalGrossRevenue: { type: Number },
      artistShare: { type: Number }, // 70%
      investorShare: { type: Number }, // 25%
      platformFee: { type: Number }, // 5%
      projectedStreams: {
        spotify: { type: Number, default: 0 },
        youtube: { type: Number, default: 0 },
        deezer: { type: Number, default: 0 },
      },
      revenueBreakdown: {
        spotify: { type: Number, default: 0 },
        youtube: { type: Number, default: 0 },
        deezer: { type: Number, default: 0 },
      },
      confidence: { type: Number }, // 0-100 confidence score
      methodology: { type: String },
      calculatedAt: { type: Date },
      disclaimer: {
        type: String,
        default:
          "ROI calculated based on historical data and industry averages. Not guaranteed.",
      },
    },

    // Verification status
    isVerified: { type: Boolean, default: false },
    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "failed", "needs_review"],
      default: "pending",
    },
    verificationData: { type: Schema.Types.Mixed },
    verifiedAt: { type: Date },

    // Project status
    status: {
      type: String,
      enum: Object.values(projectStatus),
      default: projectStatus.DRAFT,
    },
    isActive: { type: Boolean, default: false },

    // DistroKid connection
    distroKidReleaseId: { type: String },
    distroKidConnected: { type: Boolean, default: false },
    distrokidFile: { type: String },

    // Invoice file
    invoiceFile: { type: String },

    // Milestones
    milestones: [{
      name: { type: String, required: true },
      amount: { type: Number, required: true },
      description: { type: String, required: true },
      order: { type: Number, required: true },
      status: { type: String, default: "pending", enum: ["pending", "approved",] }
    }],

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Project = model<any>("projects", projectSchema);
export default Project;

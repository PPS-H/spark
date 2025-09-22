import mongoose, { Schema, model } from "mongoose";

export interface MilestoneProofModel {
  _id: string;
  projectId: mongoose.Types.ObjectId;
  artistId: mongoose.Types.ObjectId;
  milestoneId: mongoose.Types.ObjectId;
  description: string;
  proof: string; // File path
  status: string;
  adminId?: mongoose.Types.ObjectId;
  adminResponse?: string;
  createdAt: Date;
  updatedAt: Date;
}

const milestoneProofSchema = new Schema<MilestoneProofModel>(
  {
    projectId: {
      type: Schema.Types.ObjectId,
      ref: "projects",
      required: true
    },
    artistId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    milestoneId: {
      type: Schema.Types.ObjectId,
      required: true
    },
    description: {
      type: String,
      required: true,
      maxlength: 1000
    },
    proof: {
      type: String,
      required: true
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    adminId: {
      type: Schema.Types.ObjectId,
      ref: "User"
    },
    adminResponse: {
      type: String,
      maxlength: 1000
    }
  },
  { timestamps: true }
);

// Index for efficient queries
milestoneProofSchema.index({ projectId: 1, milestoneId: 1 });
milestoneProofSchema.index({ artistId: 1, status: 1 });
milestoneProofSchema.index({ status: 1, createdAt: -1 });

const MilestoneProof = model("MilestoneProof", milestoneProofSchema);
export default MilestoneProof;

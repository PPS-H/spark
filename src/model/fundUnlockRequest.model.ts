import mongoose, { Schema, model } from "mongoose";

export interface FundUnlockRequestModel {
  _id: string;
  projectId: mongoose.Types.ObjectId;
  artistId: mongoose.Types.ObjectId;
  paymentId?: mongoose.Types.ObjectId;
  projectMilestoneId: mongoose.Types.ObjectId;
  status: string;
  requestedAt: Date;
  respondedAt?: Date;
  adminId?: mongoose.Types.ObjectId;
  adminResponse?: string;
  transferId?: string;
  transferStatus?: string;
  createdAt: Date;
  updatedAt: Date;
}

const fundUnlockRequestSchema = new Schema<FundUnlockRequestModel>(
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
    paymentId: { 
      type: Schema.Types.ObjectId, 
      ref: "Payment"
    },
    projectMilestoneId: { 
      type: Schema.Types.ObjectId, 
      required: true 
    },
    status: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending"
    },
    requestedAt: { 
      type: Date, 
      default: Date.now 
    },
    respondedAt: { 
      type: Date 
    },
    adminId: { 
      type: Schema.Types.ObjectId, 
      ref: "User" 
    },
    adminResponse: { 
      type: String,
      maxlength: 1000
    },
    transferId: { 
      type: String 
    },
    transferStatus: { 
      type: String 
    }
  },
  { timestamps: true }
);

// Index for efficient queries
fundUnlockRequestSchema.index({ projectId: 1, status: 1 });
fundUnlockRequestSchema.index({ artistId: 1, status: 1 });
fundUnlockRequestSchema.index({ status: 1, createdAt: -1 });

const FundUnlockRequest = model("FundUnlockRequest", fundUnlockRequestSchema);
export default FundUnlockRequest;

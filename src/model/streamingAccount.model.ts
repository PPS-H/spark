import { Schema, model } from "mongoose";

const streamingAccountSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    platform: { type: String, enum: ["spotify", "youtube"], required: true },
    platformUserId: { type: String, required: true },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Date },
    scope: [{ type: String }],
    isActive: { type: Boolean, default: true },
    lastSyncAt: { type: Date },
    platformData: { type: Schema.Types.Mixed }, // Store platform-specific user data
  },
  { timestamps: true }
);

streamingAccountSchema.index({ userId: 1, platform: 1 }, { unique: true });

const StreamingAccount = model("StreamingAccount", streamingAccountSchema);
export default StreamingAccount;

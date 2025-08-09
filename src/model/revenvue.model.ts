import { Schema, model } from "mongoose";
import { RevenueModel } from "../../types/Database/types";
import { revenueSource } from "../utils/enums";

const revenueSchema = new Schema<RevenueModel>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "projects", required: true },
    artistId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    source: { type: String, enum: Object.values(revenueSource), required: true },
    amount: { type: Number, required: true },
    streamCount: { type: Number, default: 0 },
    country: { type: String },
    payoutRate: { type: Number }, // $ per stream
    currency: { type: String, default: "USD" },
    platformData: { type: Schema.Types.Mixed }, // Store API response data
    isProcessed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Revenue = model<RevenueModel>("revenues", revenueSchema);
export default Revenue;

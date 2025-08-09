import { Schema, model } from "mongoose";
import { PayoutModel } from "../../types/Database/types";
import { payoutStatus } from "../utils/enums";

const payoutSchema = new Schema<PayoutModel>(
  {
    investmentId: { type: Schema.Types.ObjectId, ref: "investments", required: true },
    investorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    projectId: { type: Schema.Types.ObjectId, ref: "projects", required: true },
    amount: { type: Number, required: true },
    ownershipShare: { type: Number, required: true },
    revenueId: { type: Schema.Types.ObjectId, ref: "revenues", required: true },
    status: { type: String, enum: Object.values(payoutStatus), default: payoutStatus.PENDING },
    processedAt: { type: Date },
    transactionId: { type: String },
    paymentMethod: { type: String },
  },
  { timestamps: true }
);

const Payout = model<PayoutModel>("payouts", payoutSchema);
export default Payout;
    
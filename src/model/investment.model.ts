import { Schema, model } from "mongoose";
import { InvestmentModel } from "../../types/Database/types";
import { investmentStatus, investmentType } from "../utils/enums";

const investmentSchema = new Schema<InvestmentModel>(
  {
    projectId: { type: Schema.Types.ObjectId, ref: "projects", required: true },
    investorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    artistId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    amount: { type: Number, required: true },
    ownershipPercentage: { type: Number, required: true },
    expectedReturn: { type: Number, required: true },
    actualReturn: { type: Number, default: 0 },
    status: {
      type: String,
      enum: Object.values(investmentStatus),
      default: investmentStatus.ACTIVE,
    },
    investmentType: {
      type: String,
      enum: Object.values(investmentType),
      required: true,
    },
    paymentMethod: { type: String },
    transactionId: { type: String },
    maturityDate: { type: Date },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

const Investment = model<InvestmentModel>("investments", investmentSchema);
export default Investment;

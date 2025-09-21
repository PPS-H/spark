import { Schema, model } from "mongoose";
import { paymentStatus, paymentType } from "../utils/enums";
import { PaymentModel } from "../../types/Database/types";

const paymentSchema = new Schema<PaymentModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    projectId: { type: Schema.Types.ObjectId, ref: "projects" },
    projectMilestoneId: { type: Schema.Types.ObjectId },
    amount: { type: Number, required: true },
    expectedReturn: { type: Number },
    transactionDate: { type: Date, required: true },
    cardId: { type: String },
    transactionId: { type: String },
    transferId: { type: String },
    paymentIntentId: { type: String },
    stripeTransferId: { type: String },
    stripeTransferStatus: { type: String },
    type: {
      type: String,
      enum: [paymentType.INVESTMENT, paymentType.MILESTONE_TRANSFER, paymentType.REFUND],
      default: paymentType.INVESTMENT,
      required: true,
    },
    status: {
      type: String,
      enum: [paymentStatus.SUCCESS, paymentStatus.FAILED],
      required: true,
    },
    description: { type: String },
  },
  { timestamps: true }
);

const Payment = model("Payment", paymentSchema);
export default Payment;

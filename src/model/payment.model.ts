import { Schema, model } from "mongoose";
import { paymentStatus } from "../utils/enums";
import { PaymentModel } from "../../types/Database/types";

const paymentSchema = new Schema<PaymentModel>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    projectId: { type: Schema.Types.ObjectId, ref: "projects" },
    amount: { type: Number },
    expectedReturn: { type: Number },
    transactionDate: { type: Date },
    cardId: { type: String },
    transactionId: { type: String },
    // refundId: { type: String },
    transferId: { type: String },
    paymentIntentId: { type: String },
    status: {
      type: String,
      enum: [paymentStatus.SUCCESS, paymentStatus.FAILED],
    },
  },
  { timestamps: true }
);

const Payment = model("Payment", paymentSchema);
export default Payment;

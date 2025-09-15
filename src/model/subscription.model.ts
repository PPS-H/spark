import { Schema, model } from "mongoose";

const subscriptionSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    stripeSubscriptionId: {
      type: String,
      required: true,
      unique: true,
    },
    stripeCustomerId: {
      type: String,
      required: true,
    },
    stripePriceId: {
      type: String,
      required: true,
    },
    stripeProductId: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: [
        'active',
        'canceled',
        'incomplete',
        'incomplete_expired',
        'past_due',
        'trialing',
        'unpaid',
        'paused'
      ],
      required: true,
    },
    currentPeriodStart: {
      type: Date,
      required: true,
    },
    currentPeriodEnd: {
      type: Date,
      required: true,
    },
    cancelAtPeriodEnd: {
      type: Boolean,
      default: false,
    },
    canceledAt: {
      type: Date,
      default: null,
    },
    trialStart: {
      type: Date,
      default: null,
    },
    trialEnd: {
      type: Date,
      default: null,
    },
    planType: {
      type: String,
      enum: ['artist', 'label'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      default: 'usd',
    },
    interval: {
      type: String,
      enum: ['day', 'week', 'month', 'year'],
      required: true,
    },
    intervalCount: {
      type: Number,
      default: 1,
    },
    metadata: {
      type: Map,
      of: String,
      default: {},
    },
  },
  { timestamps: true }
);

// Index for efficient queries
subscriptionSchema.index({ userId: 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ planType: 1 });

const Subscription =model("Subscription", subscriptionSchema);
export default Subscription;

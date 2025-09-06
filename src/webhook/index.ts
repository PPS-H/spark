import { Request, Response, NextFunction, RequestHandler } from "express";
import { stripe, TryCatch } from "../utils/helper";
import Payment from "../model/payment.model";
import { paymentStatus } from "../utils/enums";
import { getProjectById } from "../services/project.services";
import { getUserById } from "../services/user.services";
import "dotenv/config";


// Stripe webhook endpoint
export const stripeWebhook: RequestHandler = async (req: Request, res: Response) => {
  try {
    const sig = req.headers["stripe-signature"] as string;
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

    console.log("🔔 Webhook endpoint secret:", endpointSecret);

    if (!endpointSecret) {
      console.error("❌ STRIPE_WEBHOOK_SECRET is not set");
      res.status(500).json({ error: "Webhook secret not configured" });
      return;
    }

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
    } catch (err) {
      console.error("❌ Webhook signature verification failed:", err);
      res.status(400).json({ error: "Invalid signature" });
      return;
    }

    console.log("🔔 Webhook event received:", event.type);

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;
      case "payment_intent.succeeded":
        await handlePaymentIntentSucceeded(event.data.object);
        break;
      case "payment_intent.payment_failed":
        await handlePaymentIntentFailed(event.data.object);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    console.error("❌ Webhook error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Handle successful checkout session completion
const handleCheckoutSessionCompleted = async (session: any) => {
  try {
    console.log("✅ Checkout session completed:", session.id);

    const { projectId, userId, investmentAmount } = session.metadata;

    if (!projectId || !userId || !investmentAmount) {
      console.error("❌ Missing required metadata in checkout session");
      return;
    }

    // Get project details to calculate expected return
    const project = await getProjectById(projectId);
    if (!project) {
      console.error("❌ Project not found:", projectId);
      return;
    }

    // Get user details
    const user = await getUserById(userId);
    if (!user) {
      console.error("❌ User not found:", userId);
      return;
    }

    // Calculate expected return based on project's expected ROI
    const expectedReturn = (parseFloat(investmentAmount) * project.expectedROIPercentage) / 100;

    // Create payment record
    const paymentRecord = await Payment.create({
      userId: userId,
      projectId: projectId,
      amount: parseFloat(investmentAmount),
      expectedReturn: expectedReturn,
      transactionId: session.id,
      paymentIntentId: session.payment_intent,
      status: paymentStatus.SUCCESS,
      transactionDate: new Date(session.created * 1000),
      // Additional fields for tracking
      cardId: session.payment_method || null,
      transferId: session.transfer_data?.destination || null,
    });

    console.log("✅ Payment record created:", paymentRecord._id);

    // Update project funding progress (optional - you might want to add this)
    // await updateProjectFundingProgress(projectId, parseFloat(investmentAmount));

  } catch (error) {
    console.error("❌ Error handling checkout session completed:", error);
  }
};

// Handle successful payment intent
const handlePaymentIntentSucceeded = async (paymentIntent: any) => {
  try {
    console.log("✅ Payment intent succeeded:", paymentIntent.id);

    // Find the payment record by paymentIntentId and update if needed
    const paymentRecord = await Payment.findOne({ 
      paymentIntentId: paymentIntent.id 
    });

    if (paymentRecord && paymentRecord.status !== paymentStatus.SUCCESS) {
      paymentRecord.status = paymentStatus.SUCCESS;
      paymentRecord.transactionDate = new Date(paymentIntent.created * 1000);
      await paymentRecord.save();
      console.log("✅ Payment record updated to success:", paymentRecord._id);
    }

  } catch (error) {
    console.error("❌ Error handling payment intent succeeded:", error);
  }
};

// Handle failed payment intent
const handlePaymentIntentFailed = async (paymentIntent: any) => {
  try {
    console.log("❌ Payment intent failed:", paymentIntent.id);

    // Find the payment record by paymentIntentId and update status
    const paymentRecord = await Payment.findOne({ 
      paymentIntentId: paymentIntent.id 
    });

    if (paymentRecord) {
      paymentRecord.status = paymentStatus.FAILED;
      await paymentRecord.save();
      console.log("❌ Payment record updated to failed:", paymentRecord._id);
    }

  } catch (error) {
    console.error("❌ Error handling payment intent failed:", error);
  }
};

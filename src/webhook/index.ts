import { Request, Response, NextFunction, RequestHandler } from "express";
import { stripe, TryCatch } from "../utils/helper";
import Payment from "../model/payment.model";
import { paymentStatus } from "../utils/enums";
import { getProjectById } from "../services/project.services";
import { getUserById } from "../services/user.services";
import "dotenv/config";
import Subscription from "../model/subscription.model";


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
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;
      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;
      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;
      case "invoice.upcoming":
        await handleInvoiceUpcoming(event.data.object);
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

// Handle subscription created
const handleSubscriptionCreated = async (subscription: any) => {
  try {
    console.log("✅ Subscription created:", subscription);

    const { userId, planType, customerId } = subscription.metadata;

    if (!userId || !planType || !customerId) {
      console.error("❌ Missing required metadata in subscription");
      return;
    }

    // Get user details
    const user = await getUserById(userId);
    if (!user) {
      console.error("❌ User not found:", userId);
      return;
    }

    // Create subscription record
    const subscriptionRecord = await Subscription.create({
      userId: userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: subscription.items.data[0].price.id,
      stripeProductId: subscription.items.data[0].price.product,
      status: subscription.status,
      currentPeriodStart:  new Date(subscription.items.data[0].current_period_start * 1000),
    currentPeriodEnd: new Date(subscription.items.data[0].current_period_end * 1000), 
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialStart: subscription.trial_start ? new Date(subscription.trial_start * 1000) : null,
      trialEnd: subscription.trial_end ? new Date(subscription.trial_end * 1000) : null,
      planType: planType,
      amount: subscription.items.data[0].price.unit_amount,
      currency: subscription.items.data[0].price.currency,
      interval: subscription.items.data[0].price.recurring.interval,
      intervalCount: subscription.items.data[0].price.recurring.interval_count,
      metadata: subscription.metadata
    });

    // Update user with subscription details
    (user as any).subscriptionId = subscriptionRecord._id;
    (user as any).isProMember = true;
    await user.save();

    console.log("✅ Subscription record created:", subscriptionRecord._id);

  } catch (error) {
    console.error("❌ Error handling subscription created:", error);
  }
};

// Handle subscription updated
const handleSubscriptionUpdated = async (subscription: any) => {
  try {
    console.log("✅ Subscription updated:", subscription.id);

    const { userId } = subscription.metadata;

    if (!userId) {
      console.error("❌ Missing userId in subscription metadata");
      return;
    }

    // Update subscription record
    
    const subscriptionRecord = await Subscription.findOne({ 
      stripeSubscriptionId: subscription.id 
    });

    if (subscriptionRecord) {
      subscriptionRecord.status = subscription.status;
      subscriptionRecord.currentPeriodStart = new Date(subscription.current_period_start * 1000);
      subscriptionRecord.currentPeriodEnd = new Date(subscription.current_period_end * 1000);
      subscriptionRecord.cancelAtPeriodEnd = subscription.cancel_at_period_end;
      subscriptionRecord.canceledAt = subscription.canceled_at ? new Date(subscription.canceled_at * 1000) : null;
      await subscriptionRecord.save();

      console.log("✅ Subscription record updated:", subscriptionRecord._id);
    }

  } catch (error) {
    console.error("❌ Error handling subscription updated:", error);
  }
};

// Handle subscription deleted
const handleSubscriptionDeleted = async (subscription: any) => {
  try {
    console.log("❌ Subscription deleted:", subscription.id);

    const { userId } = subscription.metadata;

    if (!userId) {
      console.error("❌ Missing userId in subscription metadata");
      return;
    }

    // Update subscription record
    
    const subscriptionRecord = await Subscription.findOne({ 
      stripeSubscriptionId: subscription.id 
    });

    if (subscriptionRecord) {
      subscriptionRecord.status = 'canceled';
      subscriptionRecord.canceledAt = new Date();
      await subscriptionRecord.save();

      // Update user
      const user = await getUserById(userId);
      if (user) {
        (user as any).isProMember = false;
        await user.save();
      }

      console.log("✅ Subscription record canceled:", subscriptionRecord._id);
    }

  } catch (error) {
    console.error("❌ Error handling subscription deleted:", error);
  }
};

// Handle invoice payment succeeded
const handleInvoicePaymentSucceeded = async (invoice: any) => {
  try {
    console.log("✅ Invoice payment succeeded:", invoice.id);

    if (invoice.subscription) {
      const { userId } = invoice.metadata;

      if (!userId) {
        console.error("❌ Missing userId in invoice metadata");
        return;
      }

      // Update subscription status to active
      
      const subscriptionRecord = await Subscription.findOne({ 
        stripeSubscriptionId: invoice.subscription 
      });

      if (subscriptionRecord) {
        subscriptionRecord.status = 'active';
        await subscriptionRecord.save();

        // Update user
        const user = await getUserById(userId);
        if (user) {
          (user as any).isProMember = true;
          await user.save();
        }

        console.log("✅ Subscription payment succeeded:", subscriptionRecord._id);
      }
    }

  } catch (error) {
    console.error("❌ Error handling invoice payment succeeded:", error);
  }
};

// Handle invoice payment failed
const handleInvoicePaymentFailed = async (invoice: any) => {
  try {
    console.log("❌ Invoice payment failed:", invoice.id);

    if (invoice.subscription) {
      const { userId } = invoice.metadata;

      if (!userId) {
        console.error("❌ Missing userId in invoice metadata");
        return;
      }

      // Update subscription status
      
      const subscriptionRecord = await Subscription.findOne({ 
        stripeSubscriptionId: invoice.subscription 
      });

      if (subscriptionRecord) {
        subscriptionRecord.status = 'past_due';
        await subscriptionRecord.save();

        console.log("❌ Subscription payment failed:", subscriptionRecord._id);
      }
    }

  } catch (error) {
    console.error("❌ Error handling invoice payment failed:", error);
  }
};

// Handle upcoming invoice
const handleInvoiceUpcoming = async (invoice: any) => {
  try {
    console.log("📅 Upcoming invoice:", invoice.id);

    if (invoice.subscription) {
      const { userId } = invoice.metadata;

      if (!userId) {
        console.error("❌ Missing userId in invoice metadata");
        return;
      }

      // Here you could send email notifications about upcoming charges
      // For now, just log it
      console.log("📧 Upcoming invoice for user:", userId, "Amount:", invoice.amount_due);

    }

  } catch (error) {
    console.error("❌ Error handling upcoming invoice:", error);
  }
};

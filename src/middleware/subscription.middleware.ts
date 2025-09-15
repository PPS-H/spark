import { NextFunction, Request, Response } from "express";
import { TryCatch } from "../utils/helper";
import ErrorHandler from "../utils/ErrorHandler";
import Subscription from "../model/subscription.model";

// Middleware to check if user has an active subscription
export const requireActiveSubscription = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;

    if (!userId) {
      return next(new ErrorHandler("User ID not found", 401));
    }

    try {
      // Check if user has an active subscription
      const subscription = await Subscription.findOne({
        userId: userId,
        status: { $in: ['active', 'trialing'] }
      }).sort({ createdAt: -1 }); // Get the latest subscription

      if (!subscription) {
        return next(new ErrorHandler(
          "Active subscription required. Please upgrade to Pro to access this feature.",
          403
        ));
      }

      // Check if subscription is not canceled and not past due
      if (subscription.status === 'canceled' || subscription.status === 'past_due') {
        return next(new ErrorHandler(
          "Your subscription is not active. Please update your payment method or renew your subscription.",
          403
        ));
      }

      // Add subscription info to request for use in controllers
      req.subscription = subscription;
      next();
    } catch (error) {
      console.error("Error checking subscription:", error);
      return next(new ErrorHandler("Failed to verify subscription status", 500));
    }
  }
);

// Middleware to check if user has a specific plan type subscription
export const requirePlanType = (planType: 'artist' | 'label') => {
  return TryCatch(
    async (req: Request, res: Response, next: NextFunction) => {
      const { userId } = req;

      if (!userId) {
        return next(new ErrorHandler("User ID not found", 401));
      }

      try {
        // Check if user has an active subscription with the required plan type
        const subscription = await Subscription.findOne({
          userId: userId,
          planType: planType,
          status: { $in: ['active', 'trialing'] }
        }).sort({ createdAt: -1 });

        if (!subscription) {
          return next(new ErrorHandler(
            `${planType.charAt(0).toUpperCase() + planType.slice(1)} Pro subscription required. Please upgrade to access this feature.`,
            403
          ));
        }

        // Add subscription info to request
        req.subscription = subscription;
        next();
      } catch (error) {
        console.error("Error checking plan type subscription:", error);
        return next(new ErrorHandler("Failed to verify subscription plan", 500));
      }
    }
  );
};

// Extend Request interface to include subscription
declare global {
  namespace Express {
    interface Request {
      subscription?: any;
    }
  }
}

import { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { stripe, TryCatch } from "../utils/helper";
import { getUserById } from "../services/user.services";
import ErrorHandler from "../utils/ErrorHandler";
import path from "path";
import {
  AccountSuccessRequest,
  MakePaymentMethod,
} from "../../types/API/Payment/types";
import User from "../model/user.model";
import { paymentStatus } from "../utils/enums";
import Payment from "../model/payment.model";
import {
  getProjectById,
  getProjectFundingStats,
} from "../services/project.services";

const addCustomerCard = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;
    const { cardId, isPrimary } = req.body;

    const user = await getUserById(userId);
    console.log("addCustomerCard", user);

    if (!user.stripeCustomerId) {
      const customer = await stripe.customers.create({
        name: user.username,
        email: user.email,
      });

      user.stripeCustomerId = customer.id;
      await user.save();
    }

    await stripe.paymentMethods.attach(cardId, {
      customer: user.stripeCustomerId,
    });

    // Setting default card
    if (isPrimary) {
      await stripe.customers.update(user.stripeCustomerId, {
        invoice_settings: {
          default_payment_method: cardId,
        },
      });
    }

    user.isPaymentMethodAdded = true;
    await user.save();

    res.status(201).json({
      success: true,
      message: "Card added successfully",
      customerId: user.stripeCustomerId,
    });
  }
);

const createStripeAccount = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;

    const user = await getUserById(userId);

    // Check if user has an active subscription
    if (!user.isProMember) {
      return next(new ErrorHandler(
        "Pro subscription required to connect Stripe account. Please upgrade to Pro to access this feature.",
        403
      ));
    }

    if (user.stripeConnectId && user.isStripeAccountConnected)
      return next(new ErrorHandler("Account already created", 400));

    if (!user.stripeConnectId) {
      const account = await stripe.accounts.create({
        country: "IE",
        email: user.email,
        type: "express",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        }
      });

      user.stripeConnectId = account.id;
      await user.save();
    }

    // Set the automatic payout schedule to every week on Monday
    // await stripe.accounts.update(user.stripeConnectId, {
    //   settings: {
    //     payouts: {
    //       schedule: {
    //         interval: "weekly",
    //         weekly_anchor: "monday",
    //       },
    //     },
    //   },
    // });

    // await stripe.accounts.update(user.stripeConnectId, {
    //   settings: {
    //     payouts: {
    //       schedule: {
    //         interval: "daily",
    //       },
    //     },
    //   },
    // });

    const accountLink = await stripe.accountLinks.create({
      account: user.stripeConnectId,
      return_url:
        process.env.BACKEND_URL +
        "/api/v1/payment/account/success/" +
        user.stripeConnectId,
      refresh_url: process.env.BACKEND_URL + "/api/v1/payment/account/refresh",
      type: "account_onboarding",
    });

    res.status(200).json({
      success: true,
      accountLink,
    });
  }
);

const accountRefresh = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    res.sendFile(
      path.join(__dirname, "../../../src/public/view", "refresh_page.html")
    );
  }
);

const accountSuccess = TryCatch(
  async (req: Request<AccountSuccessRequest>, res: Response) => {
    const { stripeConnectId } = req.params;

    const account = await stripe.accounts.retrieve(stripeConnectId);

    const user = await User.findOne({ stripeConnectId });

    if (!user || !account.details_submitted) {
      return res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/stripe-connect-failed`);
    }

    user.isStripeAccountConnected = true;
    await user.save();

    // Redirect to success page
    res.redirect(`${process.env.FRONTEND_URL || "http://localhost:5173"}/stripe-connect-success`);
  }
);

const makePayment = TryCatch(
  async (
    req: Request<{}, {}, MakePaymentMethod>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const {
      paymentMethodId: cardId,
      amount,
      projectId,
      expectedReturn,
    } = req.body;

    const user = await getUserById(userId);

    const project = await getProjectById(projectId);

    const projectStats = await getProjectFundingStats(projectId);
    if (projectStats.totalInvested >= project.fundingGoal) {
      return next(
        new ErrorHandler("Funding goal already reached for this project", 400)
      );
    }

    if (amount > project.fundingGoal - projectStats.totalInvested) {
      return next(
        new ErrorHandler(
          `You can only invest up to ${project.fundingGoal - projectStats.totalInvested
          } in this project`,
          400
        )
      );
    }

    const paymentIntent: any = await stripe.paymentIntents.create({
      amount: amount * 100,
      currency: "usd",
      customer: user.stripeCustomerId,
      payment_method: cardId,
      confirm: true,
      off_session: true,
      capture_method: "automatic",
      // transfer_data: {
      //   destination: host.stripeConnectId,
      // },
    });

    if (!paymentIntent || paymentIntent.status !== "succeeded")
      return next(new ErrorHandler("Payment failed", 400));

    const paymentDeduction = await Payment.create({
      userId: userId,
      cardId,
      projectId,
      amount,
      expectedReturn,
      transactionId: paymentIntent.id,
      paymentIntentId: paymentIntent.id,
      status:
        paymentIntent.status == "succeeded"
          ? paymentStatus.SUCCESS
          : paymentStatus.FAILED,
      transactionDate: new Date(paymentIntent.created * 1000),
    });

    res.status(200).json({
      success: true,
      message: "You have joined the game successfully",
    });
  }
);

const getPaymentMethods = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;

    const user = await getUserById(userId);
    let externalAccounts: any;
    let paymentMethods: any;

    if (user.stripeConnectId) {
      externalAccounts = await stripe.accounts.listExternalAccounts(
        user.stripeConnectId
      );

      externalAccounts = externalAccounts.data.map((account: any) => ({
        id: account.id,
        last4: account.last4,
        bank_name: account.bank_name,
      }));
    }

    if (user.stripeCustomerId) {
      paymentMethods = await stripe.paymentMethods.list({
        customer: user.stripeCustomerId,
        type: "card",
      });

      paymentMethods = paymentMethods.data.map((account: any) => ({
        id: account.id,
        last4: account.card.last4,
        brand: account.card.brand,
      }));
    }

    res.status(200).json({
      success: true,
      paymentMethods: { externalAccounts, paymentMethods },
    });
  }
);

// const getBalance = TryCatch(
//   async (req: Request, res: Response, next: NextFunction) => {
//     const { userId } = req;
//     const user = await getUserById(userId);

//     if (!user.stripeConnectId || !user.isStripeAccountConnected) {
//       return next(
//         new ErrorHandler("Please add your bank account", httpStatus.BAD_REQUEST)
//       );
//     }

//     const account = await stripe.accounts.retrieve(user.stripeConnectId);

//     const daysMap = {
//       monday: 1,
//       tuesday: 2,
//       wednesday: 3,
//       thursday: 4,
//       friday: 5,
//       saturday: 6,
//       sunday: 7,
//     };

//     let nextScheduleDate: any;

//     if (account.settings.payouts) {
//       if (
//         account.settings.payouts?.schedule &&
//         account.settings.payouts?.schedule.interval == "daily"
//       ) {
//         nextScheduleDate = moment().utc().add(1, "day");
//       }

//       if (
//         account.settings.payouts?.schedule &&
//         account.settings.payouts?.schedule.interval == "weekly"
//       ) {
//         const dayOfWeek =
//           account.settings.payouts?.schedule.weekly_anchor?.toLowerCase();
//         const targetDay = daysMap[dayOfWeek]; // Get the target day index

//         if (typeof targetDay !== "undefined") {
//           const today = moment().utc();
//           nextScheduleDate =
//             today.day() >= targetDay
//               ? today.add(1, "week").day(targetDay)
//               : today.day(targetDay);
//         }
//       }

//       nextScheduleDate = nextScheduleDate.format("YYYY-MM-DD");
//     }

//     // Retrieve balance for the connected account
//     const balance = await stripe.balance.retrieve({
//       stripeAccount: user.stripeConnectId,
//     });

//     const availableBalance = balance.available.reduce(
//       (total, bal) => total + bal.amount,
//       0
//     );

//     const pendingBalance = balance.pending.reduce(
//       (total, bal) => total + bal.amount,
//       0
//     );

//     const instantlyAvailableBalance = balance.instant_available.reduce(
//       (total, bal) => total + bal.amount,
//       0
//     );

//     // const refferals = await Payment.find({
//     //   referredBy: userId,
//     //   type: paymentType.REFERRAL,
//     //   status: paymentStatus.SUCCESS,
//     // }).select("amount");

//     // const referralBalance = refferals.reduce(
//     //   (total, payment) => total + payment.amount,
//     //   0
//     // );

//     const hostEarnings = await Payment.find({
//       hostId: userId,
//       type: paymentType.HOST_TRANSFER,
//       status: paymentStatus.SUCCESS,
//     }).select("amount");

//     const host = hostEarnings.reduce(
//       (total, payment) => total + payment.amount,
//       0
//     );

//     // Retrieve and calculate referral balance
//     // const transfers = await stripe.transfers.list({
//     //   destination: user.stripeConnectId,
//     // });

//     // console.log("transfers:::", transfers.data);

//     // const referralBalance =
//     //   transfers.data
//     //     .filter((transfer) => transfer.metadata.commission_type === "referral")
//     //     .reduce((total, transfer) => total + transfer.amount, 0) / 100; // convert to dollars

//     const referralBalance = await getTotalReferralEarnings(
//       user.stripeConnectId
//     );
//     // const host = (availableBalance + pendingBalance) / 100;
//     const payout = instantlyAvailableBalance / 100;
//     const total = user.credits;

//     // console.log("balance:::", balance, {
//     //   available: availableBalance / 100,
//     //   pending: pendingBalance / 100,
//     //   total,
//     //   instantlyAvailableBalance: instantlyAvailableBalance / 100,
//     //   referrals: referralBalance,
//     // });

//     res.status(httpStatus.OK).json({
//       success: true,
//       message: "Balance fetched successfully",
//       referrals: referralBalance,
//       total,
//       host,
//       payout,
//       nextPayoutDate: nextScheduleDate,
//     });
//   }
// );

const deleteCustomerCard = TryCatch(async (req, res, next) => {
  const { userId } = req;
  const { paymentMethodId } = req.params;

  const user = await getUserById(userId);
  if (!user) return next(new ErrorHandler("User not found", 400));

  const paymentMethods = await stripe.paymentMethods.list({
    customer: user.stripeCustomerId,
    type: "card",
  });

  // Check if there's only one payment method
  if (paymentMethods.data.length <= 1) {
    return next(
      new ErrorHandler(
        "To delete this payment method, please add another card.",
        400
      )
    );
  }

  await stripe.paymentMethods.detach(paymentMethodId);

  res.status(200).json({
    success: true,
    message: "Card deleted successfully",
  });
});

const createCheckoutSession = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { projectId, amount, currency = "usd" } = req.body;
    const { userId } = req;

    if (!projectId || !amount) {
      return next(new ErrorHandler("Project ID and amount are required", 400));
    }

    if (amount < 100) {
      return next(new ErrorHandler("Minimum investment amount is $100", 400));
    }

    // Get project details
    const project = await getProjectById(projectId);
    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    // Get user details
    const user = await getUserById(userId);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `Investment in ${project.title}`,
              description: `Investment in ${project.songTitle} by ${project.artistName}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/invest/${projectId}?payment=success`,
      cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/invest/${projectId}?payment=cancelled`,
      customer_email: user.email,
      metadata: {
        projectId: projectId,
        userId: userId,
        investmentAmount: amount.toString(),
      },
    });

    res.status(200).json({
      success: true,
      message: "Checkout session created successfully",
      data: {
        sessionId: session.id,
        url: session.url,
      },
    });
  }
);

// Get Stripe Products
const getStripeProducts = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { type } = req.query;
      
      // Fetch all products from Stripe
      const products = await stripe.products.list({
        active: true,
        expand: ['data.default_price']
      });
      
      // Filter products based on type parameter
      let filteredProducts = products.data;
      if (type) {
        filteredProducts = products.data.filter(product => 
          product.metadata?.type === type
        );
      } else {
        // Default filter for artist and label
        filteredProducts = products.data.filter(product =>
          product.metadata?.type === 'artist' || product.metadata?.type === 'label'
        );
      }
      
      // Format products
      const formattedProducts = filteredProducts
        .map(product => {
          const price = product.default_price as any;
          return {
            id: product.id,
            name: product.name,
            description: product.description || '',
            type: product.metadata?.type || 'unknown',
            price: price ? {
              id: price.id,
              amount: price.unit_amount,
              currency: price.currency,
              interval: price.recurring?.interval || 'month',
              intervalCount: price.recurring?.interval_count || 1
            } : null,
            features: product.metadata?.features ?
              JSON.parse(product.metadata.features) : [],
            marketingFeatures: product.metadata?.marketingFeatures ?
              JSON.parse(product.metadata.marketingFeatures) : [],
            active: product.active,
            created: product.created
          };
        }).sort((a, b) => {
          if (!a.price && !b.price) return 0;
          if (!a.price) return 1;  // move nulls to bottom
          if (!b.price) return -1;
          return a.price.amount - b.price.amount; // ascending
        });

      res.status(200).json({
        success: true,
        message: "Products fetched successfully",
        data: formattedProducts
      });
    } catch (error) {
      console.error('Error fetching Stripe products:', error);
      return next(new ErrorHandler("Failed to fetch products", 500));
    }
  }
);

// Create Subscription Checkout Session
const createSubscriptionCheckout = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { priceId, userId } = req.body;

      if (!priceId || !userId) {
        return next(new ErrorHandler("Price ID and User ID are required", 400));
      }

      // Get user details
      const user = await getUserById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Get price details from Stripe
      const price = await stripe.prices.retrieve(priceId);
      const product = await stripe.products.retrieve(price.product as string);

      // Create or retrieve Stripe customer
      let customer;
      try {
        if (user.stripeCustomerId) {
          // Retrieve existing customer
          customer = await stripe.customers.retrieve(user.stripeCustomerId);
        } else {
          // Create new customer
          customer = await stripe.customers.create({
            email: user.email,
            name: user.username,
            metadata: {
              userId: userId,
              role: user.role
            }
          });
          
          // Update user with customer ID
          user.stripeCustomerId = customer.id;
          await user.save();
        }
      } catch (customerError) {
        console.error('Error creating/retrieving customer:', customerError);
        return next(new ErrorHandler("Failed to create customer", 500));
      }

      // Create checkout session for subscription
      const session = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ['card'],
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        mode: 'subscription',
        success_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/subscription-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL || "http://localhost:5173"}/settings`,
        metadata: {
          userId: userId,
          planType: product.metadata?.type || 'unknown',
          customerId: customer.id
        },
        subscription_data: {
          metadata: {
            userId: userId,
            planType: product.metadata?.type || 'unknown',
            customerId: customer.id
          }
        }
      });

      res.status(200).json({
        success: true,
        message: "Checkout session created successfully",
        data: {
          sessionId: session.id,
          url: session.url
        }
      });

    } catch (error) {
      console.error('Error creating subscription checkout:', error);
      return next(new ErrorHandler("Failed to create checkout session", 500));
    }
  }
);

// Get User Subscription Details
const getUserSubscription = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;

      if (!userId) {
        return next(new ErrorHandler("User ID is required", 400));
      }

      // Get user details
      const user = await getUserById(userId);
      if (!user) {
        return next(new ErrorHandler("User not found", 404));
      }

      // Get subscription details
      const Subscription = require('../model/subscription.model').default;
      const subscription = await Subscription.findOne({ userId: userId })
        .sort({ createdAt: -1 }); // Get the latest subscription

      if (!subscription) {
        return res.status(200).json({
          success: true,
          message: "No subscription found",
          data: null
        });
      }

      res.status(200).json({
        success: true,
        message: "Subscription details fetched successfully",
        data: subscription
      });

    } catch (error) {
      console.error('Error fetching user subscription:', error);
      return next(new ErrorHandler("Failed to fetch subscription details", 500));
    }
  }
);

export default {
  createStripeAccount,
  accountRefresh,
  accountSuccess,
  makePayment,
  getPaymentMethods,
  addCustomerCard,
  deleteCustomerCard,
  createCheckoutSession,
  getStripeProducts,
  createSubscriptionCheckout,
  getUserSubscription,
};

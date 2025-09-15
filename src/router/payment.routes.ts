import express from "express";
import paymentController from "../controller/payment.controller";
import { authenticationMiddleware } from "../middleware/auth.middleware";
import validate from "../middleware/validate.middleware";
import paymentSchema from "../schema/payment.schema";
import { roleAccessMiddleware } from "../middleware/roleAccess.middleware";
import { userRoles } from "../utils/enums";

const paymentRoutes = express.Router();

paymentRoutes.post(
  "/createStripeAccount",
  authenticationMiddleware,
  roleAccessMiddleware([userRoles.ARTIST, userRoles.LABEL]),
  paymentController.createStripeAccount
);

paymentRoutes.post(
  "/connect-stripe",
  authenticationMiddleware,
  roleAccessMiddleware([userRoles.ARTIST, userRoles.LABEL]),
  paymentController.createStripeAccount
);

paymentRoutes.get("/account/refresh", paymentController.accountRefresh);

paymentRoutes.get(
  "/account/success/:stripeConnectId",
  paymentController.accountSuccess
);

paymentRoutes.post(
  "/makePayment",
  authenticationMiddleware,
  validate(paymentSchema.makePaymentSchema),
  paymentController.makePayment
);

paymentRoutes.get(
  "/getPaymentMethods",
  authenticationMiddleware,
  paymentController.getPaymentMethods
);

paymentRoutes.post(
  "/addCustomerCard",
  authenticationMiddleware,
  paymentController.addCustomerCard
);

paymentRoutes.delete(
  "/deleteCustomerCard/:paymentMethodId",
  authenticationMiddleware,
  validate(paymentSchema.deleteCustomerCardValidation),
  paymentController.deleteCustomerCard
);

paymentRoutes.post(
  "/createCheckoutSession",
  authenticationMiddleware,
  paymentController.createCheckoutSession
);

paymentRoutes.get(
  "/products",
  paymentController.getStripeProducts
);

paymentRoutes.post(
  "/create-subscription-checkout",
  authenticationMiddleware,
  paymentController.createSubscriptionCheckout
);

paymentRoutes.get(
  "/subscription/:userId",
  authenticationMiddleware,
  paymentController.getUserSubscription
);

export default paymentRoutes;

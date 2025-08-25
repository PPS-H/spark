import Joi from "joi";
import { numberValidation, ObjectIdValidation, stringValidation } from ".";

const makePaymentSchema = {
  body: Joi.object({
    projectId: ObjectIdValidation("Project ID"),
    paymentMethodId: stringValidation("Payment Method ID"),
    amount: numberValidation("Amount"),
    expectedReturn: numberValidation("Amount"),
  }),
};

const deleteCustomerCardValidation = {
  params: Joi.object({
    paymentMethodId: stringValidation("Payment Method ID"),
  }),
};

export default {
  makePaymentSchema,
  deleteCustomerCardValidation,
};

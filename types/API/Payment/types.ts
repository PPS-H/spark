export type AccountSuccessRequest = {
  stripeConnectId: string;
};

export type MakePaymentMethod = {
  paymentMethodId: string;
  amount: number;
  projectId: any;
  expectedReturn: number;
};

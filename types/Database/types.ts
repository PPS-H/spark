import { extend, string } from "joi";
import { Document } from "mongoose";

export interface UserModel extends Document {
  username: string;
  email: string;
  password: string;
  country: string;
  favoriteGenre: string;
  musicPlatforms: string[];
  aboutTxt: string;
  role: string;
  artistBio: string;
  socialMediaLinks: {
    instagram: string;
    youtube: string;
    spotify: string;
  };
  companyType: string;
  teamSize: string;
  website: string;
  companyDescription: string;
  isDeleted: boolean;
  isEmailVerified: boolean;

  otp: number;
  otpExpiry: Date;
  otpVerified: boolean;

  emailNotifications: boolean;
  pushNotifications: boolean;
  fundingAlerts: boolean;
  publicProfile: boolean;
  investmentActivity: boolean;
  directMessages: boolean;
  autoPreview: boolean;
  language: string;
  darkMode: boolean;

  stripeCustomerId: string;
  stripeConnectId: string;
  isStripeAccountConnected: boolean;
  isPaymentMethodAdded: boolean;
  subscriptionId: any;
  isProMember: boolean;
  profilePicture: string;

  matchPassword(password: string): Promise<boolean>;
}

export interface ContentModel extends Document {
  userId: any;
  title: string;
  file: string;
  genre: string;
  description: string;
  type: string;
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectCampaignModel extends Document {
  userId: any;
  title: string;
  fundingGoal: number;
  duration: string;
  description: string;
  songTitle: string;
  artistName: string;
  isrcCode: string;
  upcCode?: string;
  spotifyTrackLink?: string;
  spotifyTrackId?: string;
  youtubeMusicLink?: string;
  youtubeVideoId?: string;
  deezerTrackLink?: string;
  deezerTrackId?: string;
  releaseType: string;
  expectedReleaseDate?: Date;
  fundingDeadline?: Date;
  image?: string;
  expectedROIPercentage?: number;
  automaticROI?: {
    totalGrossRevenue: number;
    artistShare: number;
    investorShare: number;
    platformFee: number;
    projectedStreams: {
      spotify: number;
      youtube: number;
      deezer: number;
    };
    revenueBreakdown: {
      spotify: number;
      youtube: number;
      deezer: number;
    };
    confidence: number;
    methodology: string;
    calculatedAt: Date;
    disclaimer: string;
  };
  isVerified: boolean;
  verificationStatus: string;
  verificationData?: any;
  verifiedAt?: Date;
  status: string;
  isActive: boolean;
  distroKidReleaseId?: string;
  distroKidConnected: boolean;
  distrokidFile?: string;
  invoiceFile?: string;
  milestones: Array<{
    name: string;
    amount: number;
    description: string;
    order: number;
  }>;

  createdAt: Date;
  updatedAt: Date;
}

export interface InvestmentModel extends Document {
  projectId: any;
  investorId: any;
  artistId: any;
  amount: number;
  ownershipPercentage: number;
  expectedReturn: number;
  actualReturn: number;
  status: string;
  investmentType: string;
  paymentMethod: string;
  transactionId: string;
  maturityDate: any;
  isDeleted: boolean;

  createdAt: Date;
  updatedAt: Date;
}

export interface PayoutModel extends Document {
  investmentId: any;
  investorId: any;
  projectId: any;
  amount: number;
  ownershipShare: number;
  revenueId: any;
  status: string;
  processedAt: Date;
  transactionId: string;
  paymentMethod: string;

  createdAt: Date;
  updatedAt: Date;
}

export interface RevenueModel {
  projectId: any;
  artistId: any;
  source: string;
  amount: number;
  streamCount: number;
  country: string;
  payoutRate: number;
  currency: string;
  platformData: Record<string, any>;
  isProcessed: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaymentModel extends Document {
  userId: any;
  projectId: any;
  projectMilestoneId?: any;
  amount: number;
  expectedReturn?: number;
  transactionDate: Date;
  cardId?: string;
  transactionId?: string;
  transferId?: string;
  paymentIntentId?: string;
  stripeTransferId?: string;
  stripeTransferStatus?: string;
  type: string;
  status: string;
  description?: string;

  createdAt: Date;
  updatedAt: Date;
}

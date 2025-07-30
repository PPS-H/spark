import { Document } from "mongoose";

export interface UserModel extends Document {
  username?: string;
  email: string;
  password: string;
  country?: string;
  favoriteGenre?: string;
  musicPlatforms?: string[];
  aboutTxt?: string;
  role: string;
  artistBio?: string;
  socialMediaLinks?: {
    instagram?: string;
    youtube?: string;
    spotify?: string;
  };
  companyType?: string;
  teamSize?: string;
  website?: string;
  companyDescription?: string;
  isDeleted: boolean;

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
  language: boolean;
  darkMode: boolean;

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
  fundingGoal: string;
  duration: string;
  description: string;

  createdAt: Date;
  updatedAt: Date;
}

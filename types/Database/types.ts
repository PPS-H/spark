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

  matchPassword(password: string): Promise<boolean>;
}

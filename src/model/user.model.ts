import { Schema, model } from "mongoose";
import bcrypt from "bcrypt";
import {
  companyType,
  musicPlatforms,
  teamSize,
  userRoles,
} from "../utils/enums";
import { UserModel } from "../../types/Database/types";

const userSchema = new Schema<UserModel>(
  {
    username: { type: String },
    email: { type: String, unique: true },
    password: { type: String },
    country: { type: String },
    favoriteGenre: { type: String },
    musicPlatforms: [
      {
        type: String,
        enum: Object.values(musicPlatforms),
      },
    ],
    aboutTxt: { type: String },
    role: {
      type: String,
      enum: Object.values(userRoles),
      default: userRoles.FAN,
    },
    artistBio: { type: String },
    socialMediaLinks: {
      instagram: { type: String },
      youtube: { type: String },
      spotify: { type: String },
    },
    companyType: { type: String, enum: Object.values(companyType) },
    teamSize: { type: String, enum: Object.values(teamSize) },
    website: { type: String },
    companyDescription: { type: String },
    isDeleted: { type: Boolean, default: false },
    otp: { type: Number },
    otpExpiry: { type: Date },
    otpVerified: { type: Boolean },
    emailNotifications: { type: Boolean },
    pushNotifications: { type: Boolean },
    fundingAlerts: { type: Boolean },
    publicProfile: { type: Boolean },
    investmentActivity: { type: Boolean },
    directMessages: { type: Boolean },
    autoPreview: { type: Boolean },
    language: { type: Boolean },
    darkMode: { type: Boolean },

    stripeCustomerId: { type: String },
    stripeConnectId: { type: String },
    isStripeAccountConnected: { type: Boolean, default: false },
    isPaymentMethodAdded: { type: Boolean, default: false },
  },
  { timestamps: true }
);

userSchema.pre("save", async function () {
  if (this.isModified("password")) {
    const hashedPassword = await bcrypt.hash(this.password, 10);
    this.password = hashedPassword;
  }
});

userSchema.methods.matchPassword = async function (password: string) {
  if (!this.password) return false;
  const isCompared = await bcrypt.compare(password, this.password);
  return isCompared;
};

const User = model<UserModel>("User", userSchema);
export default User;

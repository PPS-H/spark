import { NextFunction, Request, Response } from "express";
import {
  addMinutesToCurrentTime,
  generateJwtToken,
  generateOTP,
  SUCCESS,
  TryCatch,
} from "../utils/helper";
import {
  ChangePasswordType,
  LoginUserRequest,
  RegisterUserRequest,
  ResetPasswordRequest,
  SendOTPRequest,
  UpdateUserProfileRequest,
  VerifyOTPRequest,
} from "../../types/API/User/types";
import ErrorHandler from "../utils/ErrorHandler";
import User from "../model/user.model";
import {
  getUserByEmail,
  getUserById,
} from "../services/user.services";
import { userRoles } from "../utils/enums";
import { sendEmail } from "../utils/sendEmail";
import Likes from "../model/likes.model";

const registerUser = TryCatch(
  async (
    req: Request<{}, {}, RegisterUserRequest>,
    res: Response,
    next: NextFunction
  ) => {
    let {
      username,
      email,
      password,
      country,
      favoriteGenre,
      musicPlatforms,
      aboutTxt,
      role,
      artistBio,
      instagram,
      youtube,
      spotify,
      companyType,
      teamSize,
      website,
      companyDescription,
    } = req.body;

    email = email.toLowerCase().trim();
    username = username?.toLowerCase().trim();

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return next(new ErrorHandler("User already exists with this email", 400));
    }

    const payload: any = {
      username,
      email,
      password,
      country: country || undefined,
      favoriteGenre: favoriteGenre || undefined,
      musicPlatforms: musicPlatforms || [],
      aboutTxt: aboutTxt || undefined,
      role: role || userRoles.FAN,
    };

    if (role == userRoles.ARTIST) {
      payload.artistBio = artistBio;
      payload.socialMediaLinks = {};
      payload.socialMediaLinks.instagram = instagram;
      payload.socialMediaLinks.youtube = youtube;
      payload.socialMediaLinks.spotify = spotify;
    }
    if (role == userRoles.LABEL) {
      payload.companyType = companyType;
      payload.teamSize = teamSize;
      payload.website = website;
      payload.companyDescription = companyDescription;
    }

    // Create user
    const user = await User.create(payload);

    return SUCCESS(res, 201, "User registered successfully", {
      data: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
      },
    });
  }
);

const loginUser = TryCatch(
  async (
    req: Request<{}, {}, LoginUserRequest>,
    res: Response,
    next: NextFunction
  ) => {
    let { email, password } = req.body;

    email = email.toLowerCase().trim();

    const user = await getUserByEmail(email);
    if (!user) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    const token = generateJwtToken({ userId: user._id, role: user?.role });

    return SUCCESS(res, 200, "Login successfully", {
      data: {
        token,
      },
    });
  }
);

const getUser = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;

    return SUCCESS(res, 200, "User details fetched successfully", {
      data: {
        user,
      },
    });
  }
);

const updateUserProfile = TryCatch(
  async (
    req: Request<{ userId: string }, {}, UpdateUserProfileRequest>,
    res: Response,
    next: NextFunction
  ) => {
    let {
      username,
      email,
      country,
      favoriteGenre,
      musicPlatforms,
      aboutTxt,
      artistBio,
      instagram,
      youtube,
      spotify,
      companyType,
      teamSize,
      website,
      companyDescription,
      emailNotifications,
      pushNotifications,
      fundingAlerts,
      publicProfile,
      investmentActivity,
      directMessages,
      autoPreview,
      language,
      darkMode,
    } = req.body;

    const { userId } = req;

    const user = await getUserById(userId);

    if (email) {
      email = email.toLowerCase().trim();

      // Check if email is already taken by another user
      const existingUser = await User.findOne({
        email,
        _id: { $ne: userId },
        isDeleted: false,
      });
      if (existingUser) {
        return next(
          new ErrorHandler("Email is already taken by another user", 400)
        );
      }
    }

    if (username) {
      username = username.toLowerCase().trim();
    }

    const updateData: any = {};
    if (username !== undefined) updateData.username = username;
    if (email !== undefined) updateData.email = email;
    if (country !== undefined) updateData.country = country;
    if (favoriteGenre !== undefined) updateData.favoriteGenre = favoriteGenre;
    if (musicPlatforms !== undefined)
      updateData.musicPlatforms = musicPlatforms;
    if (aboutTxt !== undefined) updateData.aboutTxt = aboutTxt;
    if (artistBio !== undefined) updateData.artistBio = artistBio;

    if (companyType !== undefined) updateData.companyType = companyType;
    if (teamSize !== undefined) updateData.teamSize = teamSize;
    if (instagram !== undefined) updateData.instagram = instagram;
    if (website !== undefined) updateData.website = website;
    if (spotify !== undefined) updateData.spotify = spotify;
    if (youtube !== undefined) updateData.youtube = youtube;
    if (emailNotifications !== undefined)
      updateData.emailNotifications = emailNotifications;
    if (pushNotifications !== undefined)
      updateData.pushNotifications = pushNotifications;
    if (fundingAlerts !== undefined) updateData.fundingAlerts = fundingAlerts;
    if (publicProfile !== undefined) updateData.publicProfile = publicProfile;
    if (investmentActivity !== undefined)
      updateData.investmentActivity = investmentActivity;
    if (directMessages !== undefined)
      updateData.directMessages = directMessages;
    if (autoPreview !== undefined) updateData.autoPreview = autoPreview;
    if (language !== undefined) updateData.language = language;
    if (darkMode !== undefined) updateData.darkMode = darkMode;
    if (companyDescription !== undefined)
      updateData.companyDescription = companyDescription;

    // Update user
    const updatedUser = await User.findByIdAndUpdate(userId, updateData, {
      new: true,
      runValidators: true,
    });

    return SUCCESS(res, 200, "Profile updated successfully", {
      data: {
        _id: updatedUser._id,
        username: updatedUser.username,
        email: updatedUser.email,
      },
    });
  }
);

const sendOtp = TryCatch(
  async (
    req: Request<{}, {}, SendOTPRequest>,
    res: Response,
    next: NextFunction
  ) => {
    let { email, type } = req.body; // Forgot:1,ResendForgot:2
    const emailTemplate = type == 1 ? 3 : 4;
    email = email.toLowerCase();

    let query: any = { email };
    const user = await User.findOne(query);
    if (!user) return next(new ErrorHandler("User not found", 404));

    const otp = generateOTP();
    user.otp = Number(otp);
    user.otpExpiry = new Date(addMinutesToCurrentTime(2));
    user.otpVerified = false;
    await user.save();
    await sendEmail(user.email, emailTemplate, otp);

    return SUCCESS(
      res,
      200,
      `OTP ${type == 2 ? "resent" : "sent"} successfully`,
      {
        data: {
          _id: user._id,
        },
      }
    );
  }
);

const verifyOtp = TryCatch(
  async (
    req: Request<{}, {}, VerifyOTPRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId, otp, type } = req.body; // Forgot:1
    const user = await getUserById(userId);
    const now = new Date();

    if (user.otpExpiry < now) {
      user.otp = undefined;
      user.otpExpiry = undefined;
      await user.save();
      return next(new ErrorHandler("OTP has been expired", 400));
    }

    if (user.otp != otp) return next(new ErrorHandler("Invalid OTP", 400));

    user.otp = undefined;
    user.otpExpiry = undefined;
    user.otpVerified = true;
    await user.save();
    return SUCCESS(res, 200, `OTP verified successfully`, {
      data: {
        _id: user._id,
        role: user.role,
      },
    });
  }
);

const changePassword = TryCatch(
  async (
    req: Request<{}, {}, ChangePasswordType>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId, password } = req.body;
    const user = await getUserById(userId);
    if (!user.otpVerified)
      return next(new ErrorHandler("Please verify OTP first", 400));
    user.password = password;
    user.otpVerified = false;
    await user.save();
    return SUCCESS(res, 200, "Password has been changed successfully");
  }
);

const deleteAccount = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;

    const user = await getUserById(userId);
    user.isDeleted = true;
    await user.save();

    return SUCCESS(res, 200, "User account deleted successfully");
  }
);

const resetPassword = TryCatch(
  async (
    req: Request<{}, {}, ResetPasswordRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { user } = req;
    const { oldPassword, newPassword } = req.body;

    const isOldPasswordValid = await user.matchPassword(oldPassword);
    if (!isOldPasswordValid) {
      return next(new ErrorHandler("Current password is incorrect", 400));
    }

    const isSamePassword = await user.matchPassword(newPassword);
    if (isSamePassword) {
      return next(
        new ErrorHandler(
          "New password must be different from current password",
          400
        )
      );
    }

    user.password = newPassword;
    await user.save();

    return SUCCESS(res, 200, "Password reset successfully");
  }
);


export default {
  registerUser,
  loginUser,
  getUser,
  updateUserProfile,
  sendOtp,
  verifyOtp,
  changePassword,
  deleteAccount,
  resetPassword,
};

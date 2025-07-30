import express from "express";
import userSchema from "../schema/user.schema";
import userController from "../controller/user.controller";
import validate from "../middleware/validate.middleware";
import { authenticationMiddleware } from "../middleware/auth.middleware";

const userRoutes = express.Router();

userRoutes.post(
  "/register",
  validate(userSchema.registerUserSchema),
  userController.registerUser
);

userRoutes.post(
  "/login",
  validate(userSchema.loginUserSchema),
  userController.loginUser
);

userRoutes.get("/", authenticationMiddleware, userController.getUser);

userRoutes.put(
  "/",
  authenticationMiddleware,
  validate(userSchema.updateUserProfileSchema),
  userController.updateUserProfile
);

userRoutes.put(
  "/verifyOtp",
  validate(userSchema.verifyOTPSchema),
  userController.verifyOtp
);

userRoutes.put(
  "/sendOtp",
  validate(userSchema.sendOTPSchema),
  userController.sendOtp
);

userRoutes.put(
  "/changePassword",
  validate(userSchema.changePasswordSchema),
  userController.changePassword
);

userRoutes.put(
  "/resetPassword",
  validate(userSchema.resetPasswordSchema),
  userController.resetPassword
);

userRoutes.delete("/", authenticationMiddleware, userController.deleteAccount);

export default userRoutes;

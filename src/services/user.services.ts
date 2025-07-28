import { UserModel } from "../../types/Database/types";
import User from "../model/user.model";
import ErrorHandler from "../utils/ErrorHandler";

export const getUserById = async (userId: string): Promise<UserModel> => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new ErrorHandler("User not found", 400);

  return user;
};

export const getUserByEmail = async (email: string): Promise<UserModel | null> => {
  const user = await User.findOne({
    email: email,
    isDeleted: false,
  });
  if (!user) return null;

  return user;
};

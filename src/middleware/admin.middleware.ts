import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import ErrorHandler from "../utils/ErrorHandler";
import { TryCatch } from "../utils/helper";
import User from "../model/user.model";

export const adminAuthenticationMiddleware = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers["authorization"];
    if (!authHeader)
      return next(new ErrorHandler("Please login to access the route", 401));

    const token = authHeader.split(" ")[1];

    const decode = jwt.verify(token, process.env.JWT_SECRET) as JwtPayload;

    if (!decode) return next(new ErrorHandler("Invalid token", 401));

    const user = await User.findOne({ _id: decode.userId });
    if (!user) return next(new ErrorHandler("User not found", 400));

    if (user.email != process.env.ADMIN_EMAIL)
      return next(
        new ErrorHandler("You are not authorized to access this route", 400)
      );

    req.userId = user._id.toString();
    req.user = user;
    next();
  }
);

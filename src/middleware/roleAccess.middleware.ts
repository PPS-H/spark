import { NextFunction, Request, Response } from "express";
import { TryCatch } from "../utils/helper";

export const roleAccessMiddleware = (role: string) => {
  return TryCatch(async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;

    if (user.role !== role) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  });
};

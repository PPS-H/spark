import { NextFunction, Request, Response } from "express";
import { TryCatch } from "../utils/helper";

export const roleAccessMiddleware = (roles: string | string[]) => {
  return TryCatch(async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;

    // Convert single role to array for consistent handling
    const allowedRoles = Array.isArray(roles) ? roles : [roles];

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  });
};

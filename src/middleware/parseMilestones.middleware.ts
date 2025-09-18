import { NextFunction, Request, Response } from "express";
import ErrorHandler from "../utils/ErrorHandler";

export const parseMilestones = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check if milestones is a JSON string and parse it
    if (req.body.milestones && typeof req.body.milestones === 'string') {
      console.log("Parsing milestones from JSON string:", req.body.milestones);
      req.body.milestones = JSON.parse(req.body.milestones);
      console.log("Parsed milestones:", req.body.milestones);
    }
    next();
  } catch (error) {
    console.error("Error parsing milestones:", error);
    next(new ErrorHandler("Invalid milestones format", 400));
  }
};

export default parseMilestones;

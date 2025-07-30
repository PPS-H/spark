import { NextFunction, Request, Response } from "express";
import { CreateProjectRequest } from "../../types/API/Project/types";
import Project from "../model/projectCampaign.model";
import { SUCCESS, TryCatch } from "../utils/helper";

const createProject = TryCatch(
  async (
    req: Request<{}, {}, CreateProjectRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const { title, fundingGoal, description, duration } = req.body;

    await Project.create({
      userId,
      title,
      fundingGoal,
      description,
      duration,
    });

    return SUCCESS(res, 200, "Project created successfully");
  }
);

const getAllProjects = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;
    const projects = await Project.find({ userId });
    return SUCCESS(res, 200, "Projects fetched  successfully",{data:{projects}});
  }
);

export default {
  createProject,
  getAllProjects,
};

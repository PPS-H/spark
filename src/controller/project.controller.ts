import { NextFunction, Request, Response } from "express";
import {
  CreateProjectRequest,
  ProjectIdRequest,
  UpdateProjectRequest,
} from "../../types/API/Project/types";
import Project from "../model/projectCampaign.model";
import { SUCCESS, TryCatch } from "../utils/helper";
import ErrorHandler from "../utils/ErrorHandler";

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
    return SUCCESS(res, 200, "Projects fetched  successfully", {
      data: { projects },
    });
  }
);

const updateProject = TryCatch(
  async (
    req: Request<ProjectIdRequest, {}, UpdateProjectRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const { projectId } = req.params;
    const { title, fundingGoal, description, duration } = req.body;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    // Check if user is the owner of the project
    if (project.userId.toString() !== userId.toString()) {
      return next(
        new ErrorHandler("You are not authorized to update this project", 403)
      );
    }

    // Update only provided fields
    const updateData: any = {};
    if (title !== undefined) updateData.title = title;
    if (fundingGoal !== undefined) updateData.fundingGoal = fundingGoal;
    if (description !== undefined) updateData.description = description;
    if (duration !== undefined) updateData.duration = duration;

    // Update project
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      updateData,
      { new: true, runValidators: true }
    );

    return SUCCESS(res, 200, "Project updated successfully", {
      data: {
        _id: updatedProject._id,
        title: updatedProject.title,
        fundingGoal: updatedProject.fundingGoal,
        description: updatedProject.description,
        duration: updatedProject.duration,
        userId: updatedProject.userId,
        createdAt: updatedProject.createdAt,
        updatedAt: updatedProject.updatedAt,
      },
    });
  }
);

export default {
  createProject,
  getAllProjects,
  updateProject,
};

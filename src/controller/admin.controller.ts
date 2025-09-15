import { NextFunction, Request, Response } from "express";
import { generateJwtToken, SUCCESS, TryCatch } from "../utils/helper";
import { AdminLoginRequest, AdminGetDraftProjectsRequest, AdminProjectIdRequest, AdminApproveRejectProjectRequest, AdminGetProjectDetailsRequest } from "../../types/API/Admin/types";
import ErrorHandler from "../utils/ErrorHandler";
import User from "../model/user.model";
import { getUserByEmail } from "../services/user.services";
import Project from "../model/projectCampaign.model";
import Payment from "../model/payment.model";
import { projectStatus } from "../utils/enums";
import mongoose from "mongoose";

const adminLogin = TryCatch(
  async (
    req: Request<{}, {}, AdminLoginRequest>,
    res: Response,
    next: NextFunction
  ) => {
    let { email, password } = req.body;

    email = email.toLowerCase().trim();

    // Check if email matches admin email
    if (email !== process.env.ADMIN_EMAIL) {
      return next(new ErrorHandler("Unauthorized access. Admin email required.", 401));
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }


    const isPasswordValid = await user.matchPassword(password);
    if (!isPasswordValid) {
      return next(new ErrorHandler("Invalid email or password", 401));
    }

    const token = generateJwtToken({ userId: user._id, role: user?.role });

    return SUCCESS(res, 200, "Admin login successfully", {
      data: {
        token,
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          role: user.role,
          isAdmin: true,
        },
      },
    });
  }
);

const getDraftProjects = TryCatch(
  async (
    req: Request<{}, {}, {}, AdminGetDraftProjectsRequest>,
    res: Response,
    next: NextFunction
  ) => {
    let { page = 1, limit = 10 } = req.query;
    page = Number(page);
    limit = Number(limit);

    const query = {
      status: projectStatus.DRAFT,
    };

    const [projects, totalCount] = await Promise.all([
      Project.find(query)
        .populate("userId", "username email artistBio profilePicture")
        .select("-automaticROI -verificationData")
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Project.countDocuments(query),
    ]);

    return SUCCESS(res, 200, "Draft projects fetched successfully", {
      data: { projects },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
    });
  }
);

const approveRejectProject = TryCatch(
  async (
    req: Request<AdminProjectIdRequest, {}, AdminApproveRejectProjectRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { projectId } = req.params;
    const { action, reason } = req.body;

    // Check if project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    // Check if project is in draft status
    if (project.status !== projectStatus.DRAFT) {
      return next(new ErrorHandler("Project is not in draft status", 400));
    }

    // Update project status based on action
    let newStatus: string;
    let message: string;

    if (action === "approve") {
      newStatus = projectStatus.ACTIVE;
      message = "Project approved successfully";
    } else {
      newStatus = projectStatus.REJECTED;
      message = "Project rejected successfully";
    }

    // Update project
    const updatedProject = await Project.findByIdAndUpdate(
      projectId,
      { 
        status: newStatus,
        ...(reason && { rejectionReason: reason })
      },
      { new: true, runValidators: true }
    ).populate("userId", "username email artistBio profilePicture");

    return SUCCESS(res, 200, message, {
      data: {
        project: updatedProject,
        message: message,
      },
    });
  }
);

const getProjectDetails = TryCatch(
  async (
    req: Request<AdminGetProjectDetailsRequest, {}, {}>,
    res: Response,
    next: NextFunction
  ) => {
    const { projectId } = req.params;

    // Get project details with full population
    const project = await Project.findById(projectId)
      .populate("userId", "username email artistBio profilePicture country favoriteGenre socialMediaLinks")
      .select("-automaticROI -verificationData");

    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    // Get funding statistics
    const fundingStats = await Payment.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
        },
      },
      {
        $group: {
          _id: null,
          totalRaised: { $sum: "$amount" },
          totalInvestors: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          totalRaised: 1,
          totalInvestors: 1,
        },
      },
    ]);

    const stats = fundingStats[0] || { totalRaised: 0, totalInvestors: 0 };
    const fundingProgress = project.fundingGoal > 0 
      ? Math.min((stats.totalRaised / project.fundingGoal) * 100, 100) 
      : 0;

    return SUCCESS(res, 200, "Project details fetched successfully", {
      data: {
        project,
        fundingStats: {
          totalRaised: stats.totalRaised,
          totalInvestors: stats.totalInvestors,
          fundingProgress: Math.round(fundingProgress * 100) / 100,
        },
      },
    });
  }
);

const adminController = {
  adminLogin,
  getDraftProjects,
  approveRejectProject,
  getProjectDetails,
};

export default adminController;
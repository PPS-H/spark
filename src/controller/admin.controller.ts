import { NextFunction, Request, Response } from "express";
import { generateJwtToken, SUCCESS, TryCatch, stripe } from "../utils/helper";
import { AdminLoginRequest, AdminGetDraftProjectsRequest, AdminProjectIdRequest, AdminApproveRejectProjectRequest, AdminGetProjectDetailsRequest } from "../../types/API/Admin/types";
import ErrorHandler from "../utils/ErrorHandler";
import User from "../model/user.model";
import { getUserByEmail } from "../services/user.services";
import Project from "../model/projectCampaign.model";
import Payment from "../model/payment.model";
import FundUnlockRequest from "../model/fundUnlockRequest.model";
import MilestoneProof from "../model/milestoneProof.model";
import { projectStatus, paymentStatus, paymentType, milestoneProofStatus } from "../utils/enums";
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

const getFundUnlockRequests = TryCatch(
  async (
    req: Request<{}, {}, {}, { page?: number; limit?: number; status?: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { page = 1, limit = 10, status } = req.query;

    const pageNum = Number(page);
    const limitNum = Number(limit);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    // Get fund unlock requests with pagination
    const fundRequests = await FundUnlockRequest.find(filter)
      .populate("projectId", "title fundingGoal status milestones")
      .populate("artistId", "username email profilePicture")
      .populate("paymentId", "amount status transactionDate")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count for pagination
    const totalRequests = await FundUnlockRequest.countDocuments(filter);
    const totalPages = Math.ceil(totalRequests / limitNum);

    return SUCCESS(res, 200, "Fund unlock requests fetched successfully", {
      data: {
        requests: fundRequests,
        pagination: {
          currentPage: pageNum,
          totalPages,
          totalRequests,
          hasNextPage: pageNum < totalPages,
          hasPrevPage: pageNum > 1,
        },
      },
    });
  }
);

const getFundRequestDetails = TryCatch(
  async (
    req: Request<{ requestId: string }, {}, {}>,
    res: Response,
    next: NextFunction
  ) => {
    const { requestId } = req.params;

    const fundRequest = await FundUnlockRequest.findById(requestId)
      .populate("projectId", "title fundingGoal status description image milestones expectedROIPercentage")
      .populate("artistId", "username email profilePicture artistBio country")
      .populate("paymentId", "amount status transactionDate transactionId");

    if (!fundRequest) {
      return next(new ErrorHandler("Fund unlock request not found", 404));
    }

    // Get project funding statistics
    const fundingStats = await Payment.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(fundRequest.projectId),
          status: paymentStatus.SUCCESS,
        },
      },
      {
        $group: {
          _id: null,
          totalRaised: { $sum: "$amount" },
          totalInvestors: { $sum: 1 },
        },
      },
    ]);

    const stats = fundingStats[0] || { totalRaised: 0, totalInvestors: 0 };
    const projectFundingGoal = (fundRequest.projectId as any).fundingGoal;
    const fundingProgress = projectFundingGoal > 0
      ? Math.min((stats.totalRaised / projectFundingGoal) * 100, 100)
      : 0;

    return SUCCESS(res, 200, "Fund request details fetched successfully", {
      data: {
        request: fundRequest,
        projectFundingStats: {
          totalRaised: stats.totalRaised,
          totalInvestors: stats.totalInvestors,
          fundingProgress: Math.round(fundingProgress * 100) / 100,
          fundingGoal: projectFundingGoal,
        },
      },
    });
  }
);

const approveRejectFundRequest = TryCatch(
  async (
    req: Request<{ requestId: string }, {}, { action: string; adminResponse?: string; milestoneId?: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { requestId } = req.params;
    const { action, adminResponse, milestoneId } = req.body;

    const fundRequest = await FundUnlockRequest.findById(requestId)
      .populate("projectId", "title status milestones")
      .populate("artistId", "username email stripeConnectId isStripeAccountConnected")
      .populate("paymentId", "amount status");

    if (!fundRequest) {
      return next(new ErrorHandler("Fund unlock request not found", 404));
    }

    if (fundRequest.status !== "pending") {
      return next(new ErrorHandler("This request has already been processed", 400));
    }

    // Update the request
    const updateData: any = {
      status: action === "approve" ? "approved" : "rejected",
      respondedAt: new Date(),
      adminId: req.user?._id,
    };

    if (adminResponse) {
      updateData.adminResponse = adminResponse;
    }

    // If approving, handle Stripe transfer
    if (action === "approve") {
      const artist = fundRequest.artistId as any;
      const project = fundRequest.projectId as any;
      
      // Check if artist has Stripe Connect account
      if (!artist.stripeConnectId || !artist.isStripeAccountConnected) {
        return next(new ErrorHandler("Artist must have a connected Stripe account to receive funds", 400));
      }

      // Find the milestone
      const milestone = project.milestones.find((m: any) => 
        m._id.toString() === (milestoneId || fundRequest.projectMilestoneId.toString())
      );

      if (!milestone) {
        return next(new ErrorHandler("Milestone not found", 404));
      }

      try {
        // Create Stripe transfer
        const transfer = await stripe.transfers.create({
          amount: Math.round(milestone.amount * 100), // Convert to cents
          currency: 'eur',
          destination: artist.stripeConnectId,
          transfer_group: `milestone_${milestone._id}`,
          metadata: {
            projectId: project._id.toString(),
            milestoneId: milestone._id.toString(),
            artistId: artist._id.toString(),
            requestId: fundRequest._id.toString(),
          },
        });

        // Create payment record for the transfer
        const transferPayment = await Payment.create({
          userId: artist._id,
          projectId: project._id,
          projectMilestoneId: milestone._id,
          amount: milestone.amount,
          transactionDate: new Date(),
          transferId: transfer.id,
          stripeTransferId: transfer.id,
          stripeTransferStatus: 'pending',
          type: paymentType.MILESTONE_TRANSFER,
          status: paymentStatus.SUCCESS,
          description: `Milestone transfer: ${milestone.name}`,
        });

        // Update milestone status to approved
        await Project.findByIdAndUpdate(
          project._id,
          {
            $set: {
              "milestones.$[elem].status": "approved"
            }
          },
          {
            arrayFilters: [{ "elem._id": milestone._id }]
          }
        );

        updateData.transferId = transfer.id;
        updateData.transferStatus = 'pending';

      } catch (stripeError: any) {
        console.error("Stripe transfer error:", stripeError);
        return next(new ErrorHandler(`Stripe transfer failed: ${stripeError.message}`, 400));
      }
    }

    const updatedRequest = await FundUnlockRequest.findByIdAndUpdate(
      requestId,
      updateData,
      { new: true }
    ).populate("projectId", "title status milestones")
     .populate("artistId", "username email stripeConnectId")
     .populate("paymentId", "amount status");

    return SUCCESS(res, 200, `Fund request ${action}d successfully`, {
      data: {
        request: updatedRequest,
        action: action,
        message: `Fund unlock request has been ${action}d`,
        ...(action === "approve" && { transferId: updateData.transferId }),
      },
    });
  }
);

const getMilestoneProofs = TryCatch(
  async (
    req: Request<{}, {}, {}, { page?: string; limit?: string; status?: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { page = "1", limit = "10", status } = req.query;
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build filter object
    const filter: any = {};
    if (status) {
      filter.status = status;
    }

    // Get milestone proofs with pagination
    const milestoneProofs = await MilestoneProof.find(filter)
      .populate("projectId", "title status fundingGoal")
      .populate("artistId", "username email profilePicture")
      .populate("adminId", "username email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    // Get total count
    const totalCount = await MilestoneProof.countDocuments(filter);

    return SUCCESS(res, 200, "Milestone proofs fetched successfully", {
      data: {
        milestoneProofs: milestoneProofs.map(proof => ({
          proofId: proof._id,
          projectId: proof.projectId,
          artistId: proof.artistId,
          milestoneId: proof.milestoneId,
          description: proof.description,
          proof: proof.proof,
          status: proof.status,
          adminId: proof.adminId,
          adminResponse: proof.adminResponse,
          createdAt: proof.createdAt,
          updatedAt: proof.updatedAt
        })),
        pagination: {
          currentPage: pageNum,
          totalPages: Math.ceil(totalCount / limitNum),
          totalCount,
          hasNextPage: pageNum < Math.ceil(totalCount / limitNum),
          hasPrevPage: pageNum > 1
        }
      }
    });
  }
);

const getMilestoneProofDetails = TryCatch(
  async (
    req: Request<{ proofId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { proofId } = req.params;

    const milestoneProof = await MilestoneProof.findById(proofId)
      .populate("projectId", "title status fundingGoal milestones")
      .populate("artistId", "username email profilePicture artistBio country")
      .populate("adminId", "username email");

    if (!milestoneProof) {
      return next(new ErrorHandler("Milestone proof not found", 404));
    }

    // Find the specific milestone
    const project = milestoneProof.projectId as any;
    const milestone = project.milestones.find((m: any) => 
      m._id.toString() === milestoneProof.milestoneId.toString()
    );

    return SUCCESS(res, 200, "Milestone proof details fetched successfully", {
      data: {
        proof: {
          proofId: milestoneProof._id,
          projectId: milestoneProof.projectId,
          artistId: milestoneProof.artistId,
          milestoneId: milestoneProof.milestoneId,
          milestone: milestone ? {
            name: milestone.name,
            amount: milestone.amount,
            description: milestone.description,
            status: milestone.status,
            order: milestone.order
          } : null,
          description: milestoneProof.description,
          proof: milestoneProof.proof,
          status: milestoneProof.status,
          adminId: milestoneProof.adminId,
          adminResponse: milestoneProof.adminResponse,
          createdAt: milestoneProof.createdAt,
          updatedAt: milestoneProof.updatedAt
        }
      }
    });
  }
);

const approveRejectMilestoneProof = TryCatch(
  async (
    req: Request<{ proofId: string }, {}, { action: string; adminResponse?: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { proofId } = req.params;
    const { action, adminResponse } = req.body;

    const milestoneProof = await MilestoneProof.findById(proofId)
      .populate("projectId", "title status")
      .populate("artistId", "username email");

    if (!milestoneProof) {
      return next(new ErrorHandler("Milestone proof not found", 404));
    }

    if (milestoneProof.status !== milestoneProofStatus.PENDING) {
      return next(new ErrorHandler("This proof has already been processed", 400));
    }

    // Update the proof
    const updateData: any = {
      status: action === "approve" ? milestoneProofStatus.APPROVED : milestoneProofStatus.REJECTED,
      adminId: req.user?._id,
    };

    if (adminResponse) {
      updateData.adminResponse = adminResponse;
    }

    const updatedProof = await MilestoneProof.findByIdAndUpdate(
      proofId,
      updateData,
      { new: true }
    ).populate("projectId", "title status")
     .populate("artistId", "username email")
     .populate("adminId", "username email");

    return SUCCESS(res, 200, `Milestone proof ${action}d successfully`, {
      data: {
        proof: updatedProof,
        action: action,
        message: `Milestone proof has been ${action}d`,
      },
    });
  }
);

const adminController = {
  adminLogin,
  getDraftProjects,
  approveRejectProject,
  getProjectDetails,
  getFundUnlockRequests,
  getFundRequestDetails,
  approveRejectFundRequest,
  getMilestoneProofs,
  getMilestoneProofDetails,
  approveRejectMilestoneProof,
};

export default adminController;
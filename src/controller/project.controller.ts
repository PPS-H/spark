import { NextFunction, Request, Response } from "express";
import {
  CreateProjectRequest,
  ProjectIdRequest,
  UpdateProjectRequest,
} from "../../types/API/Project/types";
import Project from "../model/projectCampaign.model";
import { SUCCESS, TryCatch } from "../utils/helper";
import ErrorHandler from "../utils/ErrorHandler";
import User from "../model/user.model";
import { projectStatus } from "../utils/enums";
import MetadataVerificationService from "../services/metadataVerificationService";
import {
  determineRiskLevel,
  getHistoricalPerformance,
} from "../services/project.services";
import AutomaticROICalculationService from "../services/automaticRoiCalcService";
import Investment from "../model/investment.model";
import mongoose from "mongoose";

const createProject = TryCatch(
  async (
    req: Request<{}, {}, CreateProjectRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const {
      title,
      fundingGoal,
      description,
      duration,
      songTitle,
      artistName,
      isrcCode,
      upcCode,
      spotifyTrackLink,
      spotifyTrackId,
      youtubeMusicLink,
      youtubeVideoId,
      deezerTrackLink,
      deezerTrackId,
      releaseType,
      genre,
      releaseDate,
      expectedReleaseDate,
      fundingDeadline,
    } = req.body;

    // Get artist info
    const artist = await User.findById(userId);
    if (!artist) {
      return next(new ErrorHandler("Artist not found", 404));
    }

    // Existing validations (ISRC, UPC, duplicates)...
    const isrcPattern = /^[A-Z]{2}[A-Z0-9]{3}[0-9]{7}$/;
    if (!isrcPattern.test(isrcCode)) {
      return next(
        new ErrorHandler(
          "Invalid ISRC code format. Expected format: CC-XXX-YY-NNNNN",
          400
        )
      );
    }

    if ((releaseType === "album" || releaseType === "ep") && !upcCode) {
      return next(
        new ErrorHandler("UPC code is required for albums and EPs", 400)
      );
    }

    // Check for duplicates
    const existingProject = await Project.findOne({
      userId,
      $or: [
        { isrcCode: isrcCode },
        { spotifyTrackId: spotifyTrackId },
        {
          songTitle: { $regex: new RegExp(`^${songTitle.trim()}$`, "i") },
          artistName: { $regex: new RegExp(`^${artistName.trim()}$`, "i") },
        },
      ],
      isDeleted: false,
    });

    if (existingProject) {
      return next(
        new ErrorHandler("Project already exists for this song", 400)
      );
    }

    // **MULTI-PLATFORM METADATA VERIFICATION**
    const verificationService = new MetadataVerificationService();

    console.log("Starting multi-platform metadata verification...");
    const verificationResults = await verificationService.verifyProjectMetadata(
      {
        songTitle,
        artistName,
        isrcCode,
        spotifyTrackLink,
        spotifyTrackId,
        youtubeMusicLink,
        youtubeVideoId,
        deezerTrackLink,
        deezerTrackId,
      }
    );

    // Check if verification passed
    if (!verificationResults.overall.isVerified) {
      const errorMessage =
        verificationResults.overall.errors.length > 0
          ? verificationResults.overall.errors.join(", ")
          : "Multi-platform metadata verification failed";

      return next(
        new ErrorHandler(`Project verification failed: ${errorMessage}`, 400)
      );
    }

    // **GET HISTORICAL PERFORMANCE DATA**
    console.log("Fetching historical performance data...");
    const historicalData = await getHistoricalPerformance(userId);

    console.log(
      "verificationResults::::::",
      historicalData,
      verificationResults
    );

    // **AUTOMATICALLY CALCULATE ROI**
    console.log("Calculating automatic ROI...");
    let automaticROI = null;
    let expectedROIPercentage = 0;
    try {
      automaticROI = await AutomaticROICalculationService.calculateAutomaticROI(
        { genre, duration, fundingGoal },
        historicalData,
        verificationResults
      );

      console.log(
        "automaticROI.expectedROIPercentage;:::",
        automaticROI.expectedROIPercentage
      );

      expectedROIPercentage = automaticROI.expectedROIPercentage;
    } catch (error) {
      console.error("Error calculating automatic ROI:", error);
      // Continue without ROI if calculation fails
    }

    // Extract verified IDs
    const verifiedSpotifyTrackId =
      verificationResults.spotify?.trackData?.id || spotifyTrackId;
    const verifiedYouTubeVideoId =
      verificationResults.youtube?.trackData?.id || youtubeVideoId;
    const verifiedDeezerTrackId =
      verificationResults.deezer?.trackData?.id || deezerTrackId;

    try {
      // **Create project with automatic ROI data**
      const projectData: any = {
        userId,
        title,
        fundingGoal,
        description,
        duration,
        songTitle,
        artistName,
        isrcCode,
        upcCode,
        spotifyTrackLink,
        spotifyTrackId: verifiedSpotifyTrackId,
        youtubeMusicLink,
        youtubeVideoId: verifiedYouTubeVideoId,
        deezerTrackLink,
        deezerTrackId: verifiedDeezerTrackId,
        releaseType,
        genre,
        expectedROIPercentage: expectedROIPercentage,
        releaseDate: releaseDate ? new Date(releaseDate) : undefined,
        expectedReleaseDate: expectedReleaseDate
          ? new Date(expectedReleaseDate)
          : undefined,
        fundingDeadline: fundingDeadline
          ? new Date(fundingDeadline)
          : undefined,

        // Verification data
        isVerified: true,
        verificationStatus: "verified",
        verificationData: verificationResults,
        verifiedAt: new Date(),
        status: projectStatus.ACTIVE,
        isActive: true,
      };

      // **Add automatic ROI data if calculated**
      if (automaticROI) {
        projectData.automaticROI = {
          totalGrossRevenue: automaticROI.totalGrossRevenue,
          artistShare: automaticROI.artistShare,
          investorShare: automaticROI.investorShare,
          platformFee: automaticROI.platformFee,
          projectedStreams: automaticROI.projectedStreams,
          revenueBreakdown: automaticROI.revenueBreakdown,
          confidence: automaticROI.confidence,
          methodology: automaticROI.methodology,
          calculatedAt: new Date(),
          disclaimer: automaticROI.disclaimer,
        };
      }

      const project = await Project.create(projectData);

      // **Prepare response with automatic ROI**
      const responseData: any = {
        _id: project._id,
        title: project.title,
        songTitle: project.songTitle,
        artistName: project.artistName,
        releaseType: project.releaseType,
        genre: project.genre,
        duration: project.duration,
        isVerified: project.isVerified,
        verificationStatus: project.verificationStatus,
        status: project.status,
        isActive: project.isActive,
        fundingGoal: project.fundingGoal,
        fundingDeadline: project.fundingDeadline,
        canAcceptInvestments: true,

        // Verification summary
        verificationSummary: {
          confidence: verificationResults.overall.confidence,
          platformsVerified: verificationResults.overall.platformsVerified,
          totalPlatforms: verificationResults.overall.totalPlatforms,
          warnings: verificationResults.overall.warnings,
        },

        // Platform data
        platformData: {
          spotify: verificationResults.spotify?.trackData,
          youtube: verificationResults.youtube?.trackData,
          deezer: verificationResults.deezer?.trackData,
        },
      };

      // **Add automatic ROI to response**
      if (automaticROI) {
        const fundingGoalAmount = parseFloat(fundingGoal);

        responseData.automaticROI = {
          totalGrossRevenue: automaticROI.totalGrossRevenue,
          artistShare: automaticROI.artistShare,
          investorShare: automaticROI.investorShare,
          platformFee: automaticROI.platformFee,
          projectedStreams: automaticROI.projectedStreams,
          revenueBreakdown: automaticROI.revenueBreakdown,
          confidence: automaticROI.confidence,
          methodology: automaticROI.methodology,
          disclaimer: automaticROI.disclaimer,

          // Sample investor projections
          sampleInvestorROI: {
            investment1000:
              AutomaticROICalculationService.calculateInvestorAutomaticROI(
                1000,
                fundingGoalAmount,
                automaticROI.investorShare,
                automaticROI.confidence
              ),
            investment5000:
              AutomaticROICalculationService.calculateInvestorAutomaticROI(
                5000,
                fundingGoalAmount,
                automaticROI.investorShare,
                automaticROI.confidence
              ),
            investment10000:
              AutomaticROICalculationService.calculateInvestorAutomaticROI(
                10000,
                fundingGoalAmount,
                automaticROI.investorShare,
                automaticROI.confidence
              ),
          },
        };

        responseData.message = `Project verified and ROI automatically calculated with ${automaticROI.confidence}% confidence. Projected investor share: $${automaticROI.investorShare}`;
      } else {
        responseData.message = `Project verified across ${verificationResults.overall.platformsVerified}/${verificationResults.overall.totalPlatforms} platforms and ready for investments`;
      }

      return SUCCESS(
        res,
        201,
        "Project created with automatic ROI calculation",
        {
          data: responseData,
        }
      );
    } catch (error: any) {
      console.error("Error creating project with automatic ROI:", error);
      return next(
        new ErrorHandler("Failed to create project with automatic ROI", 500)
      );
    }
  }
);

const getAllProjects = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId ,user} = req;
    let { page = 1, limit = 10 } = req.query;
    page = Number(page);
    limit = Number(limit);

    const query:any={};
    if(user.role === "artist"){
      query.userId = userId;
    }

    const projects = await Project.find(query).select("-automaticROI -verificationData").skip((page - 1) * limit).limit(limit);
    return SUCCESS(res, 200, "Projects fetched  successfully", {
      data: { projects },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(projects.length / limit),
      },
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

const getProjectROIData = TryCatch(
  async (
    req: Request<{ projectId: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { projectId } = req.params;

    const project = await Project.findOne({
      _id: projectId,
      isDeleted: false,
      isActive: true,
    }).populate("userId", "username email artistBio");

    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    // Get current funding statistics
    const fundingStats = await Investment.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          isDeleted: false,
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
    const fundingGoalAmount = parseFloat(project.fundingGoal);
    const progressPercentage = (stats.totalRaised / fundingGoalAmount) * 100;

    // Get monthly listeners from historical data
    const historicalData = await getHistoricalPerformance(
      project.userId._id.toString()
    );
    const monthlyListeners =
      historicalData?.platforms?.spotify?.followers ||
      historicalData?.platforms?.youtube?.subscribers ||
      Math.round(Math.random() * 100000);

    // Determine risk level based on ROI and confidence
    let riskLevel = "Medium";
    if (project.automaticROI?.confidence) {
      const confidence = project.automaticROI.confidence;
      const roi = project.expectedROIPercentage || 0;

      if (confidence >= 75 && roi > 10) riskLevel = "Low";
      else if (confidence >= 60 && roi > 5) riskLevel = "Medium";
      else if (confidence >= 40) riskLevel = "Medium-High";
      else riskLevel = "High";
    }

    return SUCCESS(res, 200, "Project ROI data retrieved successfully", {
      data: {
        project: {
          _id: project._id,
          title: project.title,
          songTitle: project.songTitle,
          artistName: project.artistName,
          artist: project.userId,
        },

        // Artist Performance Data (for your interface)
        artistPerformance: {
          monthlyListeners: monthlyListeners,
          expectedROI: project.expectedROIPercentage || 0, // This shows in interface like "10%"
          riskLevel: riskLevel,
        },

        // Funding Progress Data
        fundingProgress: {
          raised: stats.totalRaised,
          goal: fundingGoalAmount,
          funded: Math.round(progressPercentage * 10) / 10,
          totalInvestors: stats.totalInvestors,
        },

        // Investment limits
        investmentLimits: {
          min: 100,
          max: 10000,
          remaining: Math.max(0, fundingGoalAmount - stats.totalRaised),
        },

        // ROI explanation for transparency
        roiExplanation: {
          model: "70% Artist / 25% Investors / 5% Platform",
          investorShare:
            "You receive your proportional share of the 25% investor revenue",
          payoutFrequency: "Monthly or quarterly based on actual revenue",
          riskNote: "Returns depend on actual streaming performance",
        },
      },
    });
  }
);

// const calculateInvestorROI = TryCatch(
//   async (
//     req: Request<{ projectId: string }, {}, {}, { amount: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { projectId } = req.params;
//     const { amount } = req.query;

//     const investmentAmount = parseFloat(amount as string);

//     if (!investmentAmount || investmentAmount < 100) {
//       return next(new ErrorHandler("Investment amount must be at least €100", 400));
//     }

//     const project = await Project.findOne({
//       _id: projectId,
//       isDeleted: false,
//       isActive: true
//     });

//     if (!project) {
//       return next(new ErrorHandler("Project not found", 404));
//     }

//     const fundingGoalAmount = parseFloat(project.fundingGoal);

//     // Calculate investor returns using project's Expected ROI
//     const investorReturns = AutomaticROICalculationService.calculateInvestorReturnFromROI(
//       investmentAmount,
//       project.expectedROIPercentage || 0,
//       fundingGoalAmount
//     );

//     return SUCCESS(res, 200, "Investor ROI calculated successfully", {
//       data: {
//         investorReturns: {
//           investmentAmount: investorReturns.investmentAmount,
//           ownershipPercentage: investorReturns.ownershipPercentage,
//           projectedReturn: investorReturns.projectedReturn,
//           projectedProfit: investorReturns.projectedProfit,
//           expectedROIPercentage: investorReturns.expectedROIPercentage,

//           // Additional info for clarity
//           shareOfInvestorPortion: investorReturns.shareOfInvestorPortion,
//           explanation: `You will own ${investorReturns.ownershipPercentage}% of the total funding and receive ${investorReturns.shareOfInvestorPortion}% of the 25% investor revenue share.`
//         },

//         projectInfo: {
//           title: project.title,
//           songTitle: project.songTitle,
//           artistName: project.artistName,
//           expectedROI: project.expectedROIPercentage,
//           fundingGoal: project.fundingGoal
//         }
//       }
//     });
//   }
// );

// const getProjectDetails = TryCatch(
//   async (
//     req: Request<{ projectId: string }>,
//     res: Response,
//     next: NextFunction
//   ) => {
//     const { projectId } = req.params;
//     const { userId } = req;

//     const project = await Project.findOne({
//       _id: projectId,
//       isDeleted: false
//     }).populate('userId', 'username email artistBio');

//     if (!project) {
//       return next(new ErrorHandler("Project not found", 404));
//     }

//     // Get funding statistics
//     const fundingStats = await Investment.aggregate([
//       {
//         $match: {
//           projectId: new mongoose.Types.ObjectId(projectId),
//           isDeleted: false
//         }
//       },
//       {
//         $group: {
//           _id: null,
//           totalRaised: { $sum: "$amount" },
//           totalInvestors: { $sum: 1 },
//           avgInvestment: { $avg: "$amount" }
//         }
//       }
//     ]);

//     const stats = fundingStats[0] || { totalRaised: 0, totalInvestors: 0, avgInvestment: 0 };
//     const fundingGoalAmount = parseFloat(project.fundingGoal);
//     const progressPercentage = (stats.totalRaised / fundingGoalAmount) * 100;

//     return SUCCESS(res, 200, "Project details retrieved successfully", {
//       data: {
//         project: {
//           _id: project._id,
//           title: project.title,
//           description: project.description,
//           songTitle: project.songTitle,
//           artistName: project.artistName,
//           artist: project.userId,
//           releaseType: project.releaseType,
//           genre: project.genre,
//           fundingGoal: project.fundingGoal,
//           duration: project.duration,
//           status: project.status,
//           isVerified: project.isVerified,
//           verificationStatus: project.verificationStatus,
//           isActive: project.isActive,
//           canAcceptInvestments: project.isVerified && project.isActive,
//           fundingDeadline: project.fundingDeadline,
//           createdAt: project.createdAt,

//           // Spotify data from verification
//           spotifyData: project.verificationData?.spotify?.trackData,
//           verificationConfidence: project.verificationData?.overall?.confidence,

//           // Funding stats
//           totalRaised: stats.totalRaised,
//           totalInvestors: stats.totalInvestors,
//           progressPercentage: Math.round(progressPercentage * 100) / 100,
//           remainingAmount: fundingGoalAmount - stats.totalRaised,
//           avgInvestmentAmount: Math.round(stats.avgInvestment * 100) / 100
//         }
//       }
//     });
//   }
// );

export default {
  createProject,
  getAllProjects,
  updateProject,
  getProjectROIData,
};

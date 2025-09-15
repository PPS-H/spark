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
import { likesType, projectStatus } from "../utils/enums";
import MetadataVerificationService from "../services/metadataVerificationService";
import {
  determineRiskLevel,
  getHistoricalPerformance,
} from "../services/project.services";
import AutomaticROICalculationService from "../services/automaticRoiCalcService";
import Investment from "../model/investment.model";
import mongoose from "mongoose";
import Likes from "../model/likes.model";
import Payment from "../model/payment.model";
import { getFiles } from "../utils/helper";
import { requireActiveSubscription, requirePlanType } from "../middleware/subscription.middleware";

const createProject = TryCatch(
  async (
    req: Request<{}, {}, CreateProjectRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    
    // Check if user has an active subscription
    const user = await User.findById(userId);
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    if (!user.isProMember) {
      return next(new ErrorHandler(
        "Pro subscription required to create projects. Please upgrade to Pro to access this feature.",
        403
      ));
    }

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

    // console.log("req.body::::::", req.body);
    // return;

    const files = getFiles(req, ["file", "image"]);

    console.log("files::::::", files);

    const distrokidFile = files.file[0];
    const projectImage = files.image ? files.image[0] : null;
    console.log("files::::::", distrokidFile, projectImage);

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

    // if (existingProject) {
    //   return next(
    //     new ErrorHandler("Project already exists for this song", 400)
    //   );
    // }

    // **MULTI-PLATFORM METADATA VERIFICATION (Optional)**
    const verificationService = new MetadataVerificationService();
    let verificationResults = null;

    // Only run verification if at least one platform is provided
    const hasSpotify = spotifyTrackLink || spotifyTrackId;
    const hasYouTube = youtubeMusicLink || youtubeVideoId;
    const hasDeezer = deezerTrackLink || deezerTrackId;

    if (hasSpotify || hasYouTube || hasDeezer) {
      console.log("Starting multi-platform metadata verification...");
      verificationResults = await verificationService.verifyProjectMetadata(
        {
          songTitle,
          artistName,
          isrcCode,
          spotifyTrackLink: spotifyTrackLink || null,
          spotifyTrackId: spotifyTrackId || null,
          youtubeMusicLink: youtubeMusicLink || null,
          youtubeVideoId: youtubeVideoId || null,
          deezerTrackLink: deezerTrackLink || null,
          deezerTrackId: deezerTrackId || null,
        }
      );

      // Only fail if verification was attempted and failed
      if (verificationResults && !verificationResults.overall.isVerified) {
        const errorMessage =
          verificationResults.overall.errors.length > 0
            ? verificationResults.overall.errors.join(", ")
            : "Multi-platform metadata verification failed";

        return next(
          new ErrorHandler(`Project verification failed: ${errorMessage}`, 400)
        );
      }
    } else {
      // No platforms provided, create basic verification result
      verificationResults = {
        spotify: null,
        youtube: null,
        deezer: null,
        overall: {
          isVerified: true,
          confidence: 0,
          errors: [],
          warnings: ['No platform verification performed'],
          platformsVerified: 0,
          totalPlatforms: 0
        }
      };
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

    // Extract verified IDs (handle case where verificationResults might be null)
    const verifiedSpotifyTrackId =
      verificationResults?.spotify?.trackData?.id || spotifyTrackId || null;
    const verifiedYouTubeVideoId =
      verificationResults?.youtube?.trackData?.id || youtubeVideoId || null;
    const verifiedDeezerTrackId =
      verificationResults?.deezer?.trackData?.id || deezerTrackId || null;

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
        spotifyTrackLink: spotifyTrackLink ? spotifyTrackLink : null,
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
        isVerified: verificationResults ? verificationResults.overall.isVerified : true,
        verificationStatus: verificationResults ? "verified" : "unverified",
        verificationData: verificationResults,
        verifiedAt: verificationResults ? new Date() : null,
        status: projectStatus.ACTIVE,
        isActive: true,
        distrokidFile: distrokidFile,
        image: projectImage
      };

      console.log("projectData::::::", projectData,distrokidFile,projectImage);

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
        verificationSummary: verificationResults ? {
          confidence: verificationResults.overall.confidence,
          platformsVerified: verificationResults.overall.platformsVerified,
          totalPlatforms: verificationResults.overall.totalPlatforms,
          warnings: verificationResults.overall.warnings,
        } : {
          confidence: 0,
          platformsVerified: 0,
          totalPlatforms: 0,
          warnings: ['No platform verification performed'],
        },

        // Platform data
        platformData: verificationResults ? {
          spotify: verificationResults.spotify?.trackData || null,
          youtube: verificationResults.youtube?.trackData || null,
          deezer: verificationResults.deezer?.trackData || null,
        } : {
          spotify: null,
          youtube: null,
          deezer: null,
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
    const { userId, user } = req;
    let { page = 1, limit = 10 } = req.query;
    page = Number(page);
    limit = Number(limit);

    const query: any = {};
    if (user.role === "artist") {
      query.userId = userId;
    } else {
      const investedProjects = await Payment.distinct("projectId", {
        userId: new mongoose.Types.ObjectId(userId),
      });
      query._id = { $nin: investedProjects };
      
      // For label and fan roles, only show projects where funding deadline has not been reached
      query.fundingDeadline = { $gt: new Date() };
    }

    const [projects, totalCount] = await Promise.all([
      Project.find(query)
        .select("-automaticROI -verificationData")
        .skip((page - 1) * limit)
        .limit(limit),
      Project.countDocuments(query),
    ]);

    // For label and fan roles, filter out projects where funding goal has been reached
    let filteredProjects = projects;
    if (user.role !== "artist") {
      const projectsWithFundingStatus = await Promise.all(
        projects.map(async (project) => {
          // Get current funding for this project
          const fundingStats = await Payment.aggregate([
            {
              $match: {
                projectId: new mongoose.Types.ObjectId(project._id),
              },
            },
            {
              $group: {
                _id: null,
                totalRaised: { $sum: "$amount" },
              },
            },
          ]);

          const totalRaised = fundingStats[0]?.totalRaised || 0;
          const fundingGoal = parseFloat(project.fundingGoal);
          
          return {
            project,
            totalRaised,
            fundingGoal,
            isFullyFunded: totalRaised >= fundingGoal
          };
        })
      );

      // Filter out fully funded projects for labels and fans
      filteredProjects = projectsWithFundingStatus
        .filter(item => !item.isFullyFunded)
        .map(item => item.project);
    }

    return SUCCESS(res, 200, "Projects fetched successfully", {
      data: { projects: filteredProjects },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
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
    
    // Handle image upload
    const files = getFiles(req, ["image"]);
    const projectImage = files.image ? files.image[0] : null;

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
    if (projectImage) updateData.image = projectImage.path;

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
        image: updatedProject.image,
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
    const { userId } = req;

    const project = await Project.findOne({
      _id: projectId,
      isDeleted: false,
      isActive: true,
    }).populate("userId", "username email artistBio aboutTxt");

    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    // Get current funding statistics
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
          investors: { $addToSet: "$userId" }, // collect unique investors
        },
      },
      {
        $project: {
          _id: 0,
          totalRaised: 1,
          totalInvestors: 1,
          userInvested: { $in: [new mongoose.Types.ObjectId(userId), "$investors"] }, // check if userId is in investors
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
      historicalData?.platforms?.youtube?.subscribers

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

    const isLiked = await Likes.findOne({
      likedBy: userId,
      artistId: project.userId._id,
      type: likesType.ARTIST,
    })

    return SUCCESS(res, 200, "Project ROI data retrieved successfully", {
      data: {
        project: {
          _id: project._id,
          title: project.title,
          songTitle: project.songTitle,
          artistName: project.artistName,
          image: project.image,
          artist: { ...project.userId.toObject(), isLiked: isLiked ? true : false, isAlreadyInvested: stats.userInvested ? true : false },
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


const getInvestedProjects = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;
    let { page = 1, limit = 10 } = req.query;
    page = Number(page);
    limit = Number(limit);

    // Step 1: Get all projectIds the user has invested in
    const investedProjects = await Payment.distinct("projectId", {
      userId: new mongoose.Types.ObjectId(userId),
    });

    // Step 2: Build query (only projects user invested in)
    const query: any = {
      _id: { $in: investedProjects },
    };

    // Step 3: Fetch projects + total count in parallel
    const [projects, totalCount] = await Promise.all([
      Project.find(query).populate("userId", "username email artistBio aboutTxt country favoriteGenre image")
        .select("-automaticROI -verificationData")
        .skip((page - 1) * limit)
        .limit(limit),
      Project.countDocuments(query),
    ]);

    // Step 4: Return response
    return SUCCESS(res, 200, "Invested projects fetched successfully", {
      data: { projects },
      pagination: {
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
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
  getInvestedProjects
};

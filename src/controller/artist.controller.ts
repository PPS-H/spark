import { NextFunction, Request, Response } from "express";
import { SUCCESS, TryCatch } from "../utils/helper";
import User from "../model/user.model";
import Project from "../model/projectCampaign.model";
import Likes from "../model/likes.model";
import Content from "../model/content.model";
import Investment from "../model/investment.model";
import Revenue from "../model/revenvue.model";
import FollowUnfollow from "../model/followUnfollow.model";
import FundUnlockRequest from "../model/fundUnlockRequest.model";
import Payment from "../model/payment.model";
import { likesType, paymentStatus, userRoles, contentType, investmentStatus, revenueSource } from "../utils/enums";
import { getUserById } from "../services/user.services";
import ErrorHandler from "../utils/ErrorHandler";
import { LikeDislikeRequest } from "../../types/API/Artist/types";
import { getUserTotalFundsRaised } from "../services/artist.services";
import { getUserTotalPayments } from "../services/artist.services";
import mongoose from "mongoose";

const getFeaturedArtists = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;
    let { page = 1, limit = 10 } = req.query as any;
    const projection =
      "_id username email role favoriteGenre artistBio profileImage socialMediaLinks";

      page=Number(page)
      limit=Number(limit)
    const [genreArtistIds, campaignArtistIds, topLikedArtistIds] =
      await Promise.all([
        User.find({
          favoriteGenre: user.favoriteGenre,
          role: userRoles.ARTIST,
          isDeleted: false,
          _id: { $ne: user._id },
        }).distinct("_id"),

        Project.distinct("userId", {
          createdAt: { $gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 7) },
        }),

        Likes.aggregate([
          { 
            $match: { 
              artistId: { $exists: true, $ne: null } 
            } 
          },
          { 
            $group: { 
              _id: "$artistId", 
              likeCount: { $sum: 1 } 
            } 
          },
          { $sort: { likeCount: -1 } },
          { $limit: 20 }
        ]).then((data) => data.map((d) => d._id)),
      ]);

    // Step 2: Merge all unique artist IDs (excluding current user)
    const allArtistIds = Array.from(
      new Set([
        ...genreArtistIds.map(String),
        ...campaignArtistIds.map(String),
        ...topLikedArtistIds.map(String),
      ])
    ).filter((id) => id !== user._id.toString());

    const skip = (page - 1) * limit;


    const count = await User.countDocuments({
      _id: { $in: allArtistIds },
      role: userRoles.ARTIST,
      isDeleted: false,
    });

    // Step 3: Fetch artist details
    // const artists = await User.find({
    //   _id: { $in: allArtistIds },
    //   role: userRoles.ARTIST,
    //   isDeleted: false,
    // })
    //   .select(projection)
    //   .skip(skip)
    //   .limit(limit)
    //   .lean();

    const artistObjectIds = allArtistIds.map(id => new mongoose.Types.ObjectId(id));

    const artists = await User.aggregate([
      {
        $match: {
          _id: { $in: artistObjectIds },
          role: userRoles.ARTIST,
          isDeleted: false
        }
      },
      {
        $skip: skip
      },
      {
        $limit: limit
      },
      // Lookup projects for each artist
      {
        $lookup: {
          from: "projects",
          localField: "_id",
          foreignField: "userId",
          as: "projects",
          pipeline: [
            {
              $match: {
                isDeleted: false
              }
            },
            {
              $project: {
                _id: 1,
                fundingGoal: 1
              }
            }
          ]
        }
      },
      // Lookup payments through projects
      {
        $lookup: {
          from: "payments",
          let: { projectIds: "$projects._id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $in: ["$projectId", "$$projectIds"] },
                    { $eq: ["$status", paymentStatus.SUCCESS] }
                  ]
                }
              }
            },
            {
              $project: {
                amount: 1,
                expectedReturn: 1
              }
            }
          ],
          as: "payments"
        }
      },
      // Calculate funding metrics with null handling
      {
        $addFields: {
          fundingGoal: {
            $ifNull: [
              { $sum: "$projects.fundingGoal" },
              0
            ]
          },
          currentFunding: {
            $ifNull: [
              { $sum: "$payments.amount" },
              0
            ]
          },
          expectedReturn: {
            $ifNull: [
              {
                $round: [
                  { $avg: "$payments.expectedReturn" },
                  2
                ]
              },
              0
            ]
          }
        }
      },
      // Clean up - remove temporary fields
      {
        $project: {
          projects: 0,
          payments: 0
        }
      }
    ]);
    
    const artistIds = artists.map((artist: any) => artist._id);

    // const [fundingData,paymentData]=await Promise.all([
    //   getUserTotalFundsRaised(artistIds),
    //   getUserTotalPayments(artistIds),
    // ])



    // Step 4: Check liked artists
    const likedArtistIds = await Likes.find({
      likedBy: user._id,
      artistId: { $in: artistIds },
    }).distinct("artistId");

    const artistsWithIsLiked = artists.map((artist: any) => ({
      ...artist,
      isLiked: likedArtistIds.map(String).includes(artist._id.toString()),
    }));

    return SUCCESS(res, 200, "Featured artists fetched successfully", {
      data: artistsWithIsLiked,
      pagination: {
        page,
        limit,
        totalPages: Math.floor(count / limit),
      },
    });
  }
);

const likeDislikeArtist = TryCatch(
  async (
    req: Request<LikeDislikeRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const { artistId } = req.params;
     const artist = await getUserById(artistId);

    if (artist.role != userRoles.ARTIST)
      return new ErrorHandler("User is not an artist", 400);

    const isAlreadyLiked = await Likes.findOne({
      likedBy: userId,
      artistId,
    });

    if (isAlreadyLiked) {
      await Likes.deleteOne({ _id: isAlreadyLiked._id });
    } else {
      await Likes.create({ likedBy: userId, artistId, type: likesType.ARTIST });
    }

    return SUCCESS(
      res,
      200,
      `Artist ${isAlreadyLiked ? "DisLiked" : "Liked"} successfully`
    );
  }
);

const followUnfollowArtist = TryCatch(
  async (
    req: Request<LikeDislikeRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const { artistId } = req.params;

    const artist = await getUserById(artistId);

    if (artist.role != userRoles.ARTIST)
      return new ErrorHandler("User is not an artist", 400);

    const isAlreadyFollowed = await FollowUnfollow.findOne({
      followedBy: userId,
      artistId,
    });

    if (isAlreadyFollowed) {
      await FollowUnfollow.deleteOne({ _id: isAlreadyFollowed._id });
    } else {
      await FollowUnfollow.create({ followedBy: userId, artistId });
    }

    return SUCCESS(
      res,
      200,
      `Artist ${isAlreadyFollowed ? "Unfollowed" : "Followed"} successfully`
    );
  }
);

const searchArtist = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {}
);

const getAnalytics = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;
    const user = await User.findById(userId).select('-password');
    
    if (!user) {
      return next(new ErrorHandler("User not found", 404));
    }

    if (user.role === userRoles.ARTIST) {
      // Artist Analytics
      const [
        projects,
        content,
        likes,
        followers,
        revenue,
        payments
      ] = await Promise.all([
        // Get user's projects
        Project.find({ userId: userId, isDeleted: false }),
        
        // Get user's content
        Content.find({ userId: userId, isDeleted: false }),
        
        // Get total likes for user's content
        Likes.countDocuments({ 
          $or: [
            { artistId: userId },
            { contentId: { $in: await Content.find({ userId: userId, isDeleted: false }).distinct('_id') } }
          ]
        }),
        
        // Get followers count
        FollowUnfollow.countDocuments({ artistId: userId }),
        
        // Get revenue data
        Revenue.find({ artistId: userId }),
        
        // Get successful payments for user's projects
        mongoose.connection.db.collection('payments').aggregate([
          {
            $lookup: {
              from: 'projects',
              localField: 'projectId',
              foreignField: '_id',
              as: 'project'
            }
          },
          {
            $match: {
              'project.userId': new mongoose.Types.ObjectId(userId),
              status: paymentStatus.SUCCESS
            }
          },
          {
            $group: {
              _id: null,
              totalAmount: { $sum: '$amount' },
              totalInvestors: { $sum: 1 }
            }
          }
        ]).toArray()
      ]);

      // Calculate project metrics
      const totalProjects = projects.length;
      const activeProjects = projects.filter(p => p.status === 'active').length;
      const draftProjects = projects.filter(p => p.status === 'draft').length;
      const totalFundingGoal = projects.reduce((sum, project) => sum + (project.fundingGoal || 0), 0);
      
      // Calculate funding metrics
      const totalFundsRaised = payments.length > 0 ? payments[0].totalAmount : 0;
      const totalInvestors = payments.length > 0 ? payments[0].totalInvestors : 0;
      
      // Calculate monthly ROI
      let monthlyROI = 0;
      if (projects.length > 0) {
        const totalROI = projects.reduce((sum, project) => sum + (project.expectedROIPercentage || 0), 0);
        monthlyROI = totalROI / projects.length;
      }

      // Content breakdown
      const contentBreakdown = {
        audio: {
          count: content.filter(c => c.type === contentType.AUDIO).length,
          percentage: content.length > 0 ? (content.filter(c => c.type === contentType.AUDIO).length / content.length) * 100 : 0
        },
        video: {
          count: content.filter(c => c.type === contentType.VIDEO).length,
          percentage: content.length > 0 ? (content.filter(c => c.type === contentType.VIDEO).length / content.length) * 100 : 0
        },
        image: {
          count: content.filter(c => c.type === contentType.IMAGE).length,
          percentage: content.length > 0 ? (content.filter(c => c.type === contentType.IMAGE).length / content.length) * 100 : 0
        }
      };

      // Revenue breakdown
      const totalRevenue = revenue.reduce((sum, rev) => sum + rev.amount, 0);
      const spotifyRevenue = revenue.filter(r => r.source === revenueSource.SPOTIFY).reduce((sum, rev) => sum + rev.amount, 0);
      const youtubeRevenue = revenue.filter(r => r.source === revenueSource.YOUTUBE).reduce((sum, rev) => sum + rev.amount, 0);
      
      const revenueBreakdown = {
        spotify: {
          amount: spotifyRevenue,
          percentage: totalRevenue > 0 ? (spotifyRevenue / totalRevenue) * 100 : 0
        },
        youtube: {
          amount: youtubeRevenue,
          percentage: totalRevenue > 0 ? (youtubeRevenue / totalRevenue) * 100 : 0
        }
      };

      // Project status breakdown
      const projectStatusBreakdown = {
        active: {
          count: activeProjects,
          percentage: totalProjects > 0 ? (activeProjects / totalProjects) * 100 : 0
        },
        draft: {
          count: draftProjects,
          percentage: totalProjects > 0 ? (draftProjects / totalProjects) * 100 : 0
        }
      };

      // Calculate engagement rate (simplified)
      const totalEngagement = followers > 0 ? (likes / followers) * 100 : 0;

      return SUCCESS(res, 200, "Artist analytics fetched successfully", {
        data: {
          totalRevenue,
          totalEngagement: Math.round(totalEngagement * 100) / 100,
          followers,
          likes,
          totalProjects,
          totalFundsRaised,
          totalFundingGoal,
          monthlyROI: Math.round(monthlyROI * 100) / 100,
          totalInvestors,
          activeProjects,
          draftProjects,
          contentBreakdown,
          revenueBreakdown,
          projectStatusBreakdown,
          investmentStatusBreakdown: {
            active: { percentage: 0, count: 0 },
            completed: { percentage: 0, count: 0 },
            cancelled: { percentage: 0, count: 0 }
          }
        }
      });

    } else if (user.role === userRoles.LABEL) {
      // Label Analytics
      const [
        investments,
        content,
        likes,
        followers,
        revenue
      ] = await Promise.all([
        // Get label's investments
        Investment.find({ investorId: userId, isDeleted: false }),
        
        // Get content from invested projects
        Content.find({ 
          userId: { $in: await Investment.find({ investorId: userId }).distinct('artistId') },
          isDeleted: false 
        }),
        
        // Get total likes for invested artists' content
        Likes.countDocuments({ 
          contentId: { $in: await Content.find({ 
            userId: { $in: await Investment.find({ investorId: userId }).distinct('artistId') },
            isDeleted: false 
          }).distinct('_id') }
        }),
        
        // Get followers count for invested artists
        FollowUnfollow.countDocuments({ 
          artistId: { $in: await Investment.find({ investorId: userId }).distinct('artistId') }
        }),
        
        // Get revenue from invested projects
        Revenue.find({ 
          projectId: { $in: await Investment.find({ investorId: userId }).distinct('projectId') }
        })
      ]);

      // Calculate investment metrics
      const totalInvestments = investments.length;
      const activeInvestments = investments.filter(i => i.status === investmentStatus.ACTIVE).length;
      const completedInvestments = investments.filter(i => i.status === investmentStatus.COMPLETED).length;
      const cancelledInvestments = investments.filter(i => i.status === investmentStatus.CANCELLED).length;
      const totalInvestedAmount = investments.reduce((sum, inv) => sum + inv.amount, 0);
      const averageReturn = investments.length > 0 ? 
        investments.reduce((sum, inv) => sum + inv.expectedReturn, 0) / investments.length : 0;

      // Content breakdown
      const contentBreakdown = {
        audio: {
          count: content.filter(c => c.type === contentType.AUDIO).length,
          percentage: content.length > 0 ? (content.filter(c => c.type === contentType.AUDIO).length / content.length) * 100 : 0
        },
        video: {
          count: content.filter(c => c.type === contentType.VIDEO).length,
          percentage: content.length > 0 ? (content.filter(c => c.type === contentType.VIDEO).length / content.length) * 100 : 0
        },
        image: {
          count: content.filter(c => c.type === contentType.IMAGE).length,
          percentage: content.length > 0 ? (content.filter(c => c.type === contentType.IMAGE).length / content.length) * 100 : 0
        }
      };

      // Revenue breakdown
      const totalRevenue = revenue.reduce((sum, rev) => sum + rev.amount, 0);
      const spotifyRevenue = revenue.filter(r => r.source === revenueSource.SPOTIFY).reduce((sum, rev) => sum + rev.amount, 0);
      const youtubeRevenue = revenue.filter(r => r.source === revenueSource.YOUTUBE).reduce((sum, rev) => sum + rev.amount, 0);
      
      const revenueBreakdown = {
        spotify: {
          amount: spotifyRevenue,
          percentage: totalRevenue > 0 ? (spotifyRevenue / totalRevenue) * 100 : 0
        },
        youtube: {
          amount: youtubeRevenue,
          percentage: totalRevenue > 0 ? (youtubeRevenue / totalRevenue) * 100 : 0
        }
      };

      // Investment status breakdown
      const investmentStatusBreakdown = {
        active: {
          count: activeInvestments,
          percentage: totalInvestments > 0 ? (activeInvestments / totalInvestments) * 100 : 0
        },
        completed: {
          count: completedInvestments,
          percentage: totalInvestments > 0 ? (completedInvestments / totalInvestments) * 100 : 0
        },
        cancelled: {
          count: cancelledInvestments,
          percentage: totalInvestments > 0 ? (cancelledInvestments / totalInvestments) * 100 : 0
        }
      };

      // Calculate engagement rate (simplified)
      const totalEngagement = followers > 0 ? (likes / followers) * 100 : 0;

      return SUCCESS(res, 200, "Label analytics fetched successfully", {
        data: {
          totalRevenue,
          totalEngagement: Math.round(totalEngagement * 100) / 100,
          followers,
          likes,
          totalProjects: 0,
          totalFundsRaised: 0,
          totalFundingGoal: 0,
          monthlyROI: 0,
          totalInvestors: 0,
          activeProjects: 0,
          draftProjects: 0,
          totalInvestments,
          totalInvestedAmount,
          averageReturn: Math.round(averageReturn * 100) / 100,
          activeInvestments,
          completedInvestments,
          cancelledInvestments,
          contentBreakdown,
          revenueBreakdown,
          projectStatusBreakdown: {
            active: { percentage: 0, count: 0 },
            draft: { percentage: 0, count: 0 }
          },
          investmentStatusBreakdown
        }
      });

    } else {
      return next(new ErrorHandler("Analytics not available for this user role", 400));
    }
  }
);

const submitFundUnlockRequest = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;
    const { projectId } = req.body;

    // Validate input
    if (!projectId) {
      return next(new ErrorHandler("Project ID is required", 400));
    }

    // Check if project exists and belongs to the artist
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    if (project.userId.toString() !== user._id.toString()) {
      return next(new ErrorHandler("You can only submit fund unlock requests for your own projects", 403));
    }

    // Check if project is active
    if (project.status !== "active") {
      return next(new ErrorHandler("Fund unlock requests can only be submitted for active projects", 400));
    }

    // Check if project has milestones
    if (!project.milestones || project.milestones.length === 0) {
      return next(new ErrorHandler("Project must have milestones to submit fund unlock requests", 400));
    }

    // Check if there's already a pending request for this project
    const existingRequest = await FundUnlockRequest.findOne({
      projectId,
      artistId: user._id,
      status: "pending"
    });

    if (existingRequest) {
      return next(new ErrorHandler("You already have a pending fund unlock request for this project", 400));
    }

    // Calculate total funds raised for this project
    const totalRaised = await Payment.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          status: paymentStatus.SUCCESS
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const fundsRaised = totalRaised[0]?.total || 0;
    const fundingGoal = project.fundingGoal;
    const fundingPercentage = (fundsRaised / fundingGoal) * 100;

    // Check if project has reached 50% of funding goal
    if (fundingPercentage < 50) {
      return next(new ErrorHandler("Fund unlock requests can only be submitted when the project reaches 50% of its funding goal", 400));
    }

    // Find the next milestone to unlock based on current funding percentage
    let targetMilestone = null;
    let milestoneIndex = -1;

    // Sort milestones by order
    const sortedMilestones = project.milestones.sort((a: any, b: any) => a.order - b.order);

    for (let i = 0; i < sortedMilestones.length; i++) {
      const milestone = sortedMilestones[i];
      const milestoneThreshold = (milestone.amount / fundingGoal) * 100;
      
      // Check if this milestone threshold has been reached
      if (fundingPercentage >= milestoneThreshold) {
        // Check if this milestone is already approved
        if (milestone.status !== "approved") {
          targetMilestone = milestone;
          milestoneIndex = i;
          break;
        }
      }
    }

    if (!targetMilestone) {
      return next(new ErrorHandler("No milestone is available for unlock at current funding level", 400));
    }

    // Create fund unlock request linked to the target milestone
    const fundUnlockRequest = await FundUnlockRequest.create({
      projectId,
      artistId: user._id,
      projectMilestoneId: targetMilestone._id,
      status: "pending",
      requestedAt: new Date()
    });

    return SUCCESS(res, 201, "Fund unlock request submitted successfully", {
      data: {
        requestId: fundUnlockRequest._id,
        projectId: fundUnlockRequest.projectId,
        projectMilestoneId: fundUnlockRequest.projectMilestoneId,
        milestoneName: targetMilestone.name,
        milestoneAmount: targetMilestone.amount,
        milestoneDescription: targetMilestone.description,
        status: fundUnlockRequest.status,
        requestedAt: fundUnlockRequest.requestedAt,
        fundingPercentage: Math.round(fundingPercentage * 100) / 100,
        totalRaised: fundsRaised,
        fundingGoal: fundingGoal
      }
    });
  }
);

const getFundUnlockRequestStatus = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;
    const { projectId } = req.params;

    // Validate input
    if (!projectId) {
      return next(new ErrorHandler("Project ID is required", 400));
    }

    // Check if project exists and belongs to the artist
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    if (project.userId.toString() !== user._id.toString()) {
      return next(new ErrorHandler("You can only check fund unlock requests for your own projects", 403));
    }

    // Check if there's a pending request for this project
    const pendingRequest = await FundUnlockRequest.findOne({
      projectId,
      artistId: user._id,
      status: "pending"
    });

    // Calculate total funds raised for this project
    const totalRaised = await Payment.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          status: paymentStatus.SUCCESS
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$amount" }
        }
      }
    ]);

    const fundsRaised = totalRaised[0]?.total || 0;
    const fundingGoal = project.fundingGoal;
    const fundingPercentage = (fundsRaised / fundingGoal) * 100;

    return SUCCESS(res, 200, "Fund unlock request status fetched successfully", {
      data: {
        hasPendingRequest: !!pendingRequest,
        pendingRequest: pendingRequest ? {
          requestId: pendingRequest._id,
          status: pendingRequest.status,
          requestedAt: pendingRequest.requestedAt
        } : null,
        fundingStats: {
          totalRaised: fundsRaised,
          fundingGoal: fundingGoal,
          fundingPercentage: Math.round(fundingPercentage * 100) / 100,
          canRequestUnlock: fundingPercentage >= 50
        }
      }
    });
  }
);

export default {
  getFeaturedArtists,
  likeDislikeArtist,
  followUnfollowArtist,
  getAnalytics,
  submitFundUnlockRequest,
  getFundUnlockRequestStatus
};

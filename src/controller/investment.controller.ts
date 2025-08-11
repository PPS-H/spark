import { NextFunction, Request, Response } from "express";
import { SUCCESS, TryCatch } from "../utils/helper";
import Project from "../model/projectCampaign.model";
import ErrorHandler from "../utils/ErrorHandler";
import Investment from "../model/investment.model";
import mongoose from "mongoose";
import { CreateInvestmentRequest } from "../schema/investment.schema";
import User from "../model/user.model";
import { UserModel } from "../../types/Database/types";
import { investmentStatus } from "../utils/enums";
import Payout from "../model/payout.model";
import Revenue from "../model/revenvue.model";
import YouTubeAPIService from "../services/youtubeApiService";
import SpotifyAPIService from "../services/spotifyAPIService";
import StreamingAccount from "../model/streamingAccount.model";

const createInvestment = TryCatch(
  async (
    req: Request<{}, {}, CreateInvestmentRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const { projectId, amount, investmentType } = req.body;

    // Validate project exists
    const project = await Project.findById(projectId);
    if (!project) {
      return next(new ErrorHandler("Project not found", 404));
    }

    // Check if project is still accepting investments
    const totalInvested = await Investment.aggregate([
      {
        $match: {
          projectId: new mongoose.Types.ObjectId(projectId),
          isDeleted: false,
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const currentTotal = totalInvested[0]?.total || 0;
    const fundingGoal = parseFloat(project.fundingGoal);

    if (currentTotal >= fundingGoal) {
      return next(
        new ErrorHandler("Project funding goal has been reached", 400)
      );
    }

    if (currentTotal + amount > fundingGoal) {
      return next(
        new ErrorHandler(
          `Investment amount exceeds remaining funding needed. Maximum: ${
            fundingGoal - currentTotal
          }`,
          400
        )
      );
    }

    // Calculate ownership percentage
    const ownershipPercentage = (amount / fundingGoal) * 100;

    // Calculate expected return based on business logic
    const expectedReturn = await calculateExpectedReturn(
      project,
      amount,
      ownershipPercentage
    );

    // Calculate maturity date based on project duration
    const maturityDate = calculateMaturityDate(project.duration);

    // Create investment
    const investment = await Investment.create({
      projectId,
      investorId: userId,
      artistId: project.userId,
      amount,
      ownershipPercentage,
      expectedReturn,
      investmentType,
      maturityDate,
    });

    return SUCCESS(res, 201, "Investment created successfully", {
      data: {
        _id: investment._id,
        amount: investment.amount,
        ownershipPercentage: investment.ownershipPercentage,
        expectedReturn: investment.expectedReturn,
        maturityDate: investment.maturityDate,
        project: {
          _id: project._id,
          title: project.title,
          fundingGoal: project.fundingGoal,
        },
      },
    });
  }
);

const calculateExpectedReturn = async (
  project: any,
  investmentAmount: number,
  ownershipPercentage: number
) => {
  try {
    // Get artist data for calculations
    const artist: UserModel = await User.findById(project.userId);
    if (!artist) throw new Error("Artist not found");

    // Base calculation factors
    const factors = {
      genreMultiplier: getGenreMultiplier(artist.favoriteGenre),
      countryMultiplier: getCountryMultiplier(artist.country),
      durationMultiplier: getDurationMultiplier(project.duration),
      historicalPerformance: await getHistoricalPerformance(artist._id.toString()),
    };

    // Get historical streaming revenue (mock data - integrate with actual APIs)
    const monthlyStreamingRevenue =
      factors.historicalPerformance.monthlyRevenue || 1000;

    // Calculate projected revenue based on genre and country
    const projectedMonthlyRevenue =
      monthlyStreamingRevenue *
      factors.genreMultiplier *
      factors.countryMultiplier;

    // Calculate total projected revenue over investment duration
    const durationInMonths = getDurationInMonths(project.duration);
    const totalProjectedRevenue =
      projectedMonthlyRevenue * durationInMonths * factors.durationMultiplier;

    // Calculate investor's share of projected revenue
    const investorShare = (totalProjectedRevenue * ownershipPercentage) / 100;

    // Add risk-adjusted return (10-30% based on risk factors)
    const riskAdjustment = calculateRiskAdjustment(factors);
    const expectedReturn = investorShare * (1 + riskAdjustment);

    return Math.round(expectedReturn * 100) / 100; // Round to 2 decimal places
  } catch (error) {
    console.error("Error calculating expected return:", error);
    // Fallback calculation: 15% annual return
    const annualRate = 0.15;
    const durationInYears = getDurationInYears(project.duration);
    return (
      Math.round(investmentAmount * (1 + annualRate * durationInYears) * 100) /
      100
    );
  }
};

// Helper functions for return calculation
const getGenreMultiplier = (genre: string): number => {
  const genreMultipliers: { [key: string]: number } = {
    pop: 1.3,
    "hip-hop": 1.4,
    electronic: 1.2,
    rock: 1.1,
    jazz: 0.9,
    classical: 0.8,
    country: 1.0,
    "r&b": 1.2,
    indie: 1.0,
  };

  return genreMultipliers[genre?.toLowerCase()] || 1.0;
};

const getCountryMultiplier = (country: string): number => {
  const countryMultipliers: { [key: string]: number } = {
    US: 1.5,
    UK: 1.3,
    Germany: 1.2,
    France: 1.1,
    Canada: 1.2,
    Australia: 1.1,
    India: 0.8,
    Brazil: 0.9,
  };

  return countryMultipliers[country] || 1.0;
};

const getDurationMultiplier = (duration: string): number => {
  const durationMultipliers: { [key: string]: number } = {
    "6_months": 0.8,
    "1_year": 1.0,
    "2_years": 1.2,
    "5_years": 1.5,
    lifetime: 2.0,
  };

  return durationMultipliers[duration] || 1.0;
};

const calculateRiskAdjustment = (factors: any): number => {
  let riskScore = 0.15; // Base 15% return

  // Adjust based on genre performance
  if (factors.genreMultiplier > 1.2) riskScore += 0.05;
  if (factors.genreMultiplier < 0.9) riskScore -= 0.05;

  // Adjust based on historical performance
  if (factors.historicalPerformance.growth > 0.2) riskScore += 0.1;
  if (factors.historicalPerformance.growth < 0) riskScore -= 0.1;

  // Ensure risk adjustment is within reasonable bounds (5-30%)
  return Math.max(0.05, Math.min(0.3, riskScore));
};

const getHistoricalPerformance = async (artistId: string): Promise<any> => {
  try {
    // Get connected streaming accounts
    const connectedAccounts = await StreamingAccount.find({
      userId: artistId,
      isActive: true
    });

    let performanceData = {
      monthlyRevenue: 0,
      growth: 0,
      totalStreams: 0,
      platforms: {
        spotify: { streams: 0, revenue: 0, popularity: 0, followers: 0 },
        youtube: { views: 0, revenue: 0, subscribers: 0 }
      }
    };

    for (const account of connectedAccounts) {
      if (account.platform === 'spotify') {
        // Use actual Spotify data from user's account
        const spotifyData = account.platformData;
        if (spotifyData) {
          // Calculate streams from top tracks and popularity
          const totalPopularity = spotifyData.topTracks.shortTerm.reduce(
            (sum: number, track: any) => sum + track.popularity, 0
          );
          const avgPopularity = totalPopularity / spotifyData.topTracks.shortTerm.length;
          
          // Estimate monthly streams based on actual track performance
          const estimatedMonthlyStreams = spotifyData.topTracks.shortTerm.reduce(
            (sum: number, track: any) => sum + (track.popularity * 100), 0
          );
          
          const spotifyRevenue = estimatedMonthlyStreams * getSpotifyPayoutRate('US'); // Use user's country
          
          performanceData.platforms.spotify = {
            streams: estimatedMonthlyStreams,
            revenue: spotifyRevenue,
            popularity: avgPopularity,
            followers: spotifyData.profile.followers.total
          };
        }
      } else if (account.platform === 'youtube') {
        // Use actual YouTube data
        const youtubeData = account.platformData;
        if (youtubeData) {
          // Calculate monthly views from recent videos
          const recentViews = youtubeData.recentVideos.reduce(
            (sum: number, video: any) => sum + parseInt(video.statistics.viewCount || 0), 0
          );
          
          const monthlyViews = recentViews / 3; // Assume last 3 months of data
          const youtubeRevenue = monthlyViews * getYouTubePayoutRate('US');
          
          performanceData.platforms.youtube = {
            views: monthlyViews,
            revenue: youtubeRevenue,
            subscribers: youtubeData.channel.subscriberCount
          };
        }
      }
    }

    // Calculate totals
    performanceData.monthlyRevenue = 
      performanceData.platforms.spotify.revenue + 
      performanceData.platforms.youtube.revenue;
      
    performanceData.totalStreams = 
      performanceData.platforms.spotify.streams + 
      performanceData.platforms.youtube.views;

    // Calculate growth from historical data
    // performanceData.growth = await calculateGrowthRate(artistId, performanceData.monthlyRevenue);

    // Store updated performance data
    // await storeHistoricalData(artistId, performanceData);

    return performanceData;

  } catch (error) {
    console.error('Error getting historical performance from connected accounts:', error);
    
    // Fallback to stored data
    // const fallbackData = await getStoredHistoricalData(artistId);
    // return fallbackData || getDefaultPerformanceData();
  }
};



const getDurationInMonths = (duration: string): number => {
  const durationMap: { [key: string]: number } = {
    "6_months": 6,
    "1_year": 12,
    "2_years": 24,
    "5_years": 60,
    lifetime: 120, // Assume 10 years for lifetime
  };

  return durationMap[duration] || 12;
};

const getDurationInYears = (duration: string): number => {
  return getDurationInMonths(duration) / 12;
};

const calculateMaturityDate = (duration: string): Date => {
  const months = getDurationInMonths(duration);
  const maturityDate = new Date();
  maturityDate.setMonth(maturityDate.getMonth() + months);
  return maturityDate;
};




const processRevenue = TryCatch(
    async (
      req: Request<{}, {}, any>,
      res: Response,
      next: NextFunction
    ) => {
      const { projectId, source, amount, streamCount, country, platformData } = req.body;
  
      // Validate project
      const project = await Project.findById(projectId);
      if (!project) {
        return next(new ErrorHandler("Project not found", 404));
      }
  
      // Create revenue record
      const revenue = await Revenue.create({
        projectId,
        artistId: project.userId,
        source,
        amount,
        streamCount: streamCount || 0,
        country: country || 'US',
        payoutRate: amount / (streamCount || 1),
        platformData,
      });
  
      // Process payouts for all investors
      await processInvestorPayouts(revenue);
  
      return SUCCESS(res, 201, "Revenue processed successfully", {
        data: {
          _id: revenue._id,
          amount: revenue.amount,
          source: revenue.source,
          streamCount: revenue.streamCount,
        }
      });
    }
  );
  
  const processInvestorPayouts = async (revenue: any) => {
    try {
      // Get all active investments for this project
      const investments = await Investment.find({
        projectId: revenue.projectId,
        status: investmentStatus.ACTIVE,
        isDeleted: false,
      });
  
      const payouts = [];
  
      for (const investment of investments) {
        // Calculate payout amount based on ownership percentage
        const payoutAmount = (revenue.amount * investment.ownershipPercentage) / 100;
  
        // Create payout record
        const payout = await Payout.create({
          investmentId: investment._id,
          investorId: investment.investorId,
          projectId: revenue.projectId,
          amount: payoutAmount,
          ownershipShare: investment.ownershipPercentage,
          revenueId: revenue._id,
        });
  
        payouts.push(payout);
  
        // Update investment actual return
        await Investment.findByIdAndUpdate(investment._id, {
          $inc: { actualReturn: payoutAmount }
        });
  
        // Send notification to investor (implement notification service)
        // await sendPayoutNotification(investment.investorId, payoutAmount, revenue.source);
      }
  
      // Mark revenue as processed
      await Revenue.findByIdAndUpdate(revenue._id, {
        isProcessed: true,
      });
  
      return payouts;
    } catch (error) {
      console.error("Error processing investor payouts:", error);
      throw error;
    }
  };
  

  // Spotify payout rates by country (per stream)
const getSpotifyPayoutRate = (country: string): number => {
  const payoutRates: { [key: string]: number } = {
    'US': 0.003, // $0.003 per stream
    'UK': 0.0025,
    'Germany': 0.0028,
    'France': 0.0022,
    'Canada': 0.0026,
    'Australia': 0.0024,
    'India': 0.0008,
    'Brazil': 0.0012,
    'Japan': 0.0032,
    'South Korea': 0.0029,
  };
  
  return payoutRates[country] || 0.002; // Default rate
};

// YouTube payout rates by country (per view)
const getYouTubePayoutRate = (country: string): number => {
  const payoutRates: { [key: string]: number } = {
    'US': 0.002, // $0.002 per view
    'UK': 0.0018,
    'Germany': 0.0019,
    'France': 0.0016,
    'Canada': 0.0017,
    'Australia': 0.0016,
    'India': 0.0003,
    'Brazil': 0.0005,
    'Japan': 0.0021,
    'South Korea': 0.0018,
  };
  
  return payoutRates[country] || 0.001; // Default rate
};

import Payment from "../model/payment.model";
import Project from "../model/projectCampaign.model";
import StreamingAccount from "../model/streamingAccount.model";
import ErrorHandler from "../utils/ErrorHandler";

export const getProjectById = async (projectId: string): Promise<any> => {
  const project = await Project.findOne({ _id: projectId, isDeleted: false });
  if (!project) throw new ErrorHandler("Project not found", 400);

  return project;
};

export const getHistoricalPerformance = async (
  artistId: string
): Promise<any> => {
  try {
    // Get connected streaming accounts
    const connectedAccounts = await StreamingAccount.find({
      userId: artistId,
      isActive: true,
    });

    let performanceData = {
      monthlyRevenue: 0,
      growth: 0,
      totalStreams: 0,
      platforms: {
        spotify: { streams: 0, revenue: 0, popularity: 0, followers: 0 },
        youtube: { views: 0, revenue: 0, subscribers: 0 },
      },
    };

    for (const account of connectedAccounts) {
      if (account.platform === "spotify") {
        // Use actual Spotify data from user's account
        const spotifyData = account.platformData;
        if (spotifyData) {
          // Calculate streams from top tracks and popularity
          const totalPopularity = spotifyData.topTracks.shortTerm.reduce(
            (sum: number, track: any) => sum + track.popularity,
            0
          );
          const avgPopularity =
            totalPopularity / spotifyData.topTracks.shortTerm.length;

          // Estimate monthly streams based on actual track performance
          const estimatedMonthlyStreams =
            spotifyData.topTracks.shortTerm.reduce(
              (sum: number, track: any) => sum + track.popularity * 100,
              0
            );
            
          const spotifyRevenue =
            estimatedMonthlyStreams * getSpotifyPayoutRate("US"); // Use user's country

          performanceData.platforms.spotify = {
            streams: estimatedMonthlyStreams,
            revenue: spotifyRevenue,
            popularity: avgPopularity,
            followers: spotifyData.profile.followers.total,
          };
        }
      } else if (account.platform === "youtube") {
        // Use actual YouTube data
        const youtubeData = account.platformData;
        if (youtubeData) {
          // Calculate monthly views from recent videos
          const recentViews = youtubeData.recentVideos.reduce(
            (sum: number, video: any) =>
              sum + parseInt(video.statistics.viewCount || 0),
            0
          );

          const monthlyViews = recentViews / 3; // Assume last 3 months of data
          const youtubeRevenue = monthlyViews * getYouTubePayoutRate("US");

          performanceData.platforms.youtube = {
            views: monthlyViews,
            revenue: youtubeRevenue,
            subscribers: youtubeData.channel.subscriberCount,
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
    console.error(
      "Error getting historical performance from connected accounts:",
      error
    );

    // Fallback to stored data
    // const fallbackData = await getStoredHistoricalData(artistId);
    // return fallbackData || getDefaultPerformanceData();
  }
};

// Spotify payout rates by country (per stream)
const getSpotifyPayoutRate = (country: string): number => {
  const payoutRates: { [key: string]: number } = {
    US: 0.003, // $0.003 per stream
    UK: 0.0025,
    Germany: 0.0028,
    France: 0.0022,
    Canada: 0.0026,
    Australia: 0.0024,
    India: 0.0008,
    Brazil: 0.0012,
    Japan: 0.0032,
    "South Korea": 0.0029,
  };

  return payoutRates[country] || 0.002; // Default rate
};

// YouTube payout rates by country (per view)
const getYouTubePayoutRate = (country: string): number => {
  const payoutRates: { [key: string]: number } = {
    US: 0.002, // $0.002 per view
    UK: 0.0018,
    Germany: 0.0019,
    France: 0.0016,
    Canada: 0.0017,
    Australia: 0.0016,
    India: 0.0003,
    Brazil: 0.0005,
    Japan: 0.0021,
    "South Korea": 0.0018,
  };

  return payoutRates[country] || 0.001; // Default rate
};

export const determineRiskLevel = (
  confidence: number,
  roiPercentage: number
): string => {
  if (confidence >= 75 && roiPercentage > 15) return "Low";
  if (confidence >= 60 && roiPercentage > 8) return "Medium";
  if (confidence >= 40 && roiPercentage > 0) return "Medium-High";
  return "High";
};

export const getProjectFundingStats = async (projectId: string) => {
  // 1. Find the project first
  const project = await getProjectById(projectId);
  // 2. Sum all successful payments for this project
  const result = await Payment.aggregate([
    {
      $match: {
        projectId: project._id,
        status: "SUCCESS", // only count successful investments
      },
    },
    {
      $group: {
        _id: "$projectId",
        totalInvested: { $sum: "$amount" },
      },
    },
  ]);

  const totalInvested = result.length > 0 ? result[0].totalInvested : 0;

  // 3. Calculate funding percentage
  const fundingGoal = project.fundingGoal || 0;
  const fundedPercentage =
    fundingGoal > 0 ? (totalInvested / fundingGoal) * 100 : 0;

  return {
    projectId,
    totalInvested,
    fundingGoal,
    fundedPercentage: fundedPercentage.toFixed(2), // round to 2 decimals
  };
};

export const getUserTotalFundsRaised = async (userId: string) => {
  // Step 1: Fetch all project IDs created by the user
  const projects = await Project.find({ userId }).select("_id fundingGoal").lean();
  if (!projects.length) {
    return { userId, totalRaised: 0, totalFundingGoal: 0, fundedPercentage: 0 };
  }

  const projectIds = projects.map((p) => p._id);
  const totalFundingGoal = projects.reduce((sum, p) => sum + (p.fundingGoal || 0), 0);

  // Step 2: Aggregate total invested across all projects
  const result = await Payment.aggregate([
    {
      $match: {
        projectId: { $in: projectIds },
        status: "SUCCESS", // only successful investments
      },
    },
    {
      $group: {
        _id: null,
        totalRaised: { $sum: "$amount" },
      },
    },
  ]);

  const totalRaised = result.length > 0 ? result[0].totalRaised : 0;

  // Step 3: Calculate overall funding %
  const fundedPercentage =
    totalFundingGoal > 0 ? (totalRaised / totalFundingGoal) * 100 : 0;

  return {
    userId,
    totalRaised,
    totalFundingGoal,
    fundedPercentage: fundedPercentage.toFixed(2),
  };
};


import { UserModel } from "../../types/Database/types";
import Project from "../model/projectCampaign.model";
import StreamingAccount from "../model/streamingAccount.model";
import User from "../model/user.model";
import { projectStatus, userRoles } from "../utils/enums";
import ErrorHandler from "../utils/ErrorHandler";
import { getUserTotalFundsRaised } from "./project.services";

export const getUserById = async (userId: string): Promise<UserModel> => {
  const user = await User.findOne({ _id: userId, isDeleted: false });
  if (!user) throw new ErrorHandler("User not found", 400);

  return user;
};

export const getUserByEmail = async (
  email: string
): Promise<UserModel | null> => {
  const user = await User.findOne({
    email: email,
    isDeleted: false,
  });
  if (!user) return null;

  return user;
};

// Helper functions for return calculation
export const getGenreMultiplier = (genre: string): number => {
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

export const getCountryMultiplier = (country: string): number => {
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

export const getArtistDashboardData = async (userId: any) => {
  const [fundingStats, activeProjectsCount, latestProjects] = await Promise.all(
    [
      getUserTotalFundsRaised(userId),
      await Project.countDocuments({
        status: projectStatus.ACTIVE,
      }),
      Project.find({
        artistId: userId,
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .limit(5),
    ]
  );

  return {
    fundingStats,
    activeProjectsCount,
    latestProjects,
  };
};

export const getLabelDahsboarData = async (userId: any) => {
  // I want to get top performing artists
  const topArtists = await User.find({
    role: userRoles.ARTIST,
    isDeleted: false,
  })
    .sort({ totalFundsRaised: -1 })
    .limit(5);
};

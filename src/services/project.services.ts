import StreamingAccount from "../model/streamingAccount.model";

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

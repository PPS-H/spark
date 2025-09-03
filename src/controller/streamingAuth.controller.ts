import { NextFunction, Request, Response } from "express";
import SpotifyOAuthService from "../services/spotifyAPIService";
import { SUCCESS, TryCatch } from "../utils/helper";
import ErrorHandler from "../utils/ErrorHandler";
import StreamingAccount from "../model/streamingAccount.model";
import YouTubeOAuthService from "../services/youtubeApiService";

// Connect Spotify Account
const connectSpotify = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;

    const spotifyService = new SpotifyOAuthService();
    const authUrl = spotifyService.getAuthorizationUrl(userId);

    return SUCCESS(res, 200, "Spotify authorization URL generated", {
      data: { authUrl, platform: "spotify" },
    });
  }
);

// Spotify OAuth Callback
const spotifyCallback = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { code, state } = req.query;

    if (!code || !state) {
      return next(new ErrorHandler("Missing authorization code or state", 400));
    }

    const spotifyService = new SpotifyOAuthService();
    const tokenData = await spotifyService.exchangeCodeForToken(
      code as string,
      state as string
    );

    // Get user's streaming data
    const streamingData = await spotifyService.getUserStreamingData(
      tokenData.access_token
    );

    const getUserFollowers=await spotifyService.getUserFollowers(
      tokenData.access_token
    );

    console.log(getUserFollowers,"=======>getUserFollowers")

    // Store tokens and data
    await StreamingAccount.findOneAndUpdate(
      { userId: tokenData.userId, platform: "spotify" },
      {
        platformUserId: streamingData.profile.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
        platformData: streamingData,
        lastSyncAt: new Date(),
        isActive: true,
      },
      { upsert: true, new: true }
    );

    return SUCCESS(res, 200, "Spotify account connected successfully", {
      data: {
        platform: "spotify",
        connected: true,
        profile: streamingData.profile,
      },
    });
  }
);

// Connect YouTube Account
const connectYouTube = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;

    const youtubeService = new YouTubeOAuthService();
    const authUrl = youtubeService.getAuthorizationUrl(userId);

    return SUCCESS(res, 200, "YouTube authorization URL generated", {
      data: { authUrl, platform: "youtube" },
    });
  }
);

// YouTube OAuth Callback
const youTubeCallback = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { code, state } = req.query;

    if (!code || !state) {
      return next(new ErrorHandler("Missing authorization code or state", 400));
    }

    const youtubeService = new YouTubeOAuthService();
    const tokenData = await youtubeService.exchangeCodeForToken(code as string);

    // Get channel data
    const channelData = await youtubeService.getChannelData(
      tokenData.access_token,
      tokenData.refresh_token
    );

    // Store tokens and data
    await StreamingAccount.findOneAndUpdate(
      { userId: state, platform: "youtube" },
      {
        platformUserId: channelData.channel.id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: tokenData.expiry_date
          ? new Date(tokenData.expiry_date)
          : null,
        platformData: channelData,
        lastSyncAt: new Date(),
        isActive: true,
      },
      { upsert: true, new: true }
    );

    return SUCCESS(res, 200, "YouTube account connected successfully", {
      data: {
        platform: "youtube",
        connected: true,
        channel: channelData.channel,
      },
    });
  }
);

// Get Connected Accounts
const getConnectedAccounts = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { userId } = req;

    const connectedAccounts = await StreamingAccount.find({
      userId,
      isActive: true,
    }).select("-accessToken -refreshToken -platformData"); // Don't expose tokens

    return SUCCESS(res, 200, "Connected accounts fetched successfully", {
      data: connectedAccounts,
    });
  }
);

// Disconnect Account
const disconnectAccount = TryCatch(
  async (
    req: Request<{ platform: string }>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const { platform } = req.params;

    await StreamingAccount.findOneAndUpdate(
      { userId, platform },
      { isActive: false }
    );

    return SUCCESS(res, 200, `${platform} account disconnected successfully`);
  }
);

export default {
  connectSpotify,
  spotifyCallback,
  connectYouTube,
  youTubeCallback,
  getConnectedAccounts,
  disconnectAccount,
};

import { NextFunction, Request, Response } from "express";
import { SUCCESS, TryCatch } from "../utils/helper";
import User from "../model/user.model";
import Project from "../model/projectCampaign.model";
import Likes from "../model/likes.model";
import { likesType, userRoles } from "../utils/enums";
import { getUserById } from "../services/user.services";
import ErrorHandler from "../utils/ErrorHandler";
import { LikeDislikeRequest } from "../../types/API/Artist/types";
import FollowUnfollow from "../model/followUnfollow.model";

const getFeaturedArtists = TryCatch(
  async (req: Request, res: Response, next: NextFunction) => {
    const { user } = req;
    const { page = 1, limit = 10 } = req.query as any;
    const projection =
      "_id username email role favoriteGenre artistBio profileImage socialMediaLinks";

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
          { $group: { _id: "$artistId", likeCount: { $sum: 1 } } },
          { $sort: { likeCount: -1 } },
          { $limit: 20 },
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
    const artists = await User.find({
      _id: { $in: allArtistIds },
      role: userRoles.ARTIST,
      isDeleted: false,
    })
      .select(projection)
      .skip(skip)
      .limit(limit)
      .lean();

    const artistIds = artists.map((artist: any) => artist._id);

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
        totalPages: count / limit,
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

export default {
  getFeaturedArtists,
  likeDislikeArtist,
  followUnfollowArtist
};

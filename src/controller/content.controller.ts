import { NextFunction, Request, Response } from "express";
import { getFiles, SUCCESS, TryCatch } from "../utils/helper";
import Content from "../model/content.model";
import { contentType, likesType, userRoles } from "../utils/enums";
import {
  AddContentRequest,
  GetContentRequest,
  GetTrendingContentRequest,
  LikeDislikeRequest,
  SearchContentRequest,
} from "../../types/API/Content/types";
import { getUserById } from "../services/user.services";
import { getContentById } from "../services/content.services";
import Likes from "../model/likes.model";
import User from "../model/user.model";
import ErrorHandler from "../utils/ErrorHandler";
import SearchHistory from "../model/searchHistory.model";
import FollowUnfollow from "../model/followUnfollow.model";

const addContent = TryCatch(
  async (
    req: Request<{}, {}, AddContentRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const { title, genre, description } = req.body;

    let type = undefined;
    if (req.files && req.files["file"]) {
      console.log(req.files["file"]);
      const file = req.files["file"][0];
      if (file.mimetype.startsWith("image/")) {
        type = contentType.IMAGE;
      } else if (file.mimetype.startsWith("audio/")) {
        type = contentType.AUDIO;
      } else if (file.mimetype.startsWith("video/")) {
        type = contentType.VIDEO;
      }
    }

    const files = getFiles(req, ["file"]);

    await Content.create({
      userId,
      title,
      genre,
      description,
      file: files?.file.length ? files?.file[0] : undefined,
      type,
    });

    return SUCCESS(res, 200, "Content added successfully");
  }
);

const getAllContent = TryCatch(
  async (
    req: Request<{}, {}, {}, GetContentRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    console.log("userId============", userId);
    const { type } = req.query;

    const query: any = { userId };
    if (type) query.type = type;

    const content = await Content.find(query);

    return SUCCESS(res, 200, "Content fetched successfully", {
      data: {
        content,
      },
    });
  }
);

const likeDislikeContent = TryCatch(
  async (
    req: Request<LikeDislikeRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { userId } = req;
    const { contentId } = req.params;

    const content = await getContentById(contentId);

    const isAlreadyLiked = await Likes.findOne({
      likedBy: userId,
      contentId,
      type: content.type,
    });

    if (isAlreadyLiked) {
      await Likes.deleteOne({ _id: isAlreadyLiked._id });
    } else {
      await Likes.create({ likedBy: userId, contentId, type: content.type });
    }

    return SUCCESS(
      res,
      200,
      `Content ${isAlreadyLiked ? "DisLiked" : "Liked"} successfully`
    );
  }
);

const getTrendingContent = TryCatch(
  async (
    req: Request<{}, {}, {}, GetTrendingContentRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { user } = req;
    const {
      page = 1,
      limit = 10,
      type = "top", // 'top', 'songs', 'artists'
      search = "",
    } = req.query;

    const dateThreshold = new Date(
      Date.now() - Number(7) * 24 * 60 * 60 * 1000
    );

    // Handle different types
    if (type === "top") {
      return await getTopContent(req, res, user, page, limit, dateThreshold);
    } else if (type === "songs") {
      return await getSongs(req, res, user, page, limit, search);
    } else if (type === "artists") {
      return await getArtists(req, res, user, page, limit, search);
    } else {
      return next(
        new ErrorHandler(
          "Invalid type. Must be 'top', 'songs', or 'artists'",
          400
        )
      );
    }
  }
);

// TOP CONTENT - Most popular trending videos/content
const getTopContent = async (
  req: any,
  res: any,
  user: any,
  page: number,
  limit: number,
  dateThreshold: Date
) => {
  const contentMatchConditions: any = {
    isDeleted: false,
    type: { $in: [contentType.VIDEO, contentType.IMAGE] },
  };

  // ---------------- Trending pipeline ----------------
  const trendingContentPipeline: any = [
    { $match: contentMatchConditions },

    {
      $lookup: {
        from: "likes",
        let: { contentId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$contentId", "$$contentId"] },
                  {
                    $in: [
                      "$type",
                      [likesType.AUDIO, likesType.VIDEO, likesType.IMAGE],
                    ],
                  },
                  { $gte: ["$createdAt", dateThreshold] },
                ],
              },
            },
          },
        ],
        as: "likes",
      },
    },

    {
      $addFields: {
        likeCount: { $size: "$likes" },
        weeklyTrendingScore: {
          $multiply: [
            { $size: "$likes" },
            {
              $subtract: [
                2,
                {
                  $divide: [
                    { $subtract: [new Date(), "$createdAt"] },
                    604800000, // 1 week
                  ],
                },
              ],
            },
          ],
        },
      },
    },

    // { $match: { likeCount: { $gte: 1 } } },
    { $sort: { weeklyTrendingScore: -1, likeCount: -1, createdAt: -1 } },

    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              email: 1,
              role: 1,
              artistBio: 1,
              socialMediaLinks: 1,
            },
          },
        ],
      },
    },

    { $unwind: "$user" },
    { $match: { "user.isDeleted": { $ne: true } } },
    { $skip: (Number(page) - 1) * Number(limit) },
    { $limit: Number(limit) },

    {
      $project: {
        _id: 1,
        title: 1,
        file: 1,
        genre: 1,
        description: 1,
        type: 1,
        createdAt: 1,
        likeCount: 1,
        weeklyTrendingScore: 1,
        user: 1,
      },
    },
  ];

  let topContent = await Content.aggregate(trendingContentPipeline);

  // ---------------- Fallback if no trending ----------------
  // if (!topContent.length) {
  //   const fallbackPipeline: any = [
  //     { $match: contentMatchConditions },
  //     { $sort: { createdAt: -1 } },
  //     { $skip: (Number(page) - 1) * Number(limit) },
  //     { $limit: Number(limit) },
  //     {
  //       $lookup: {
  //         from: "users",
  //         localField: "userId",
  //         foreignField: "_id",
  //         as: "user",
  //         pipeline: [
  //           {
  //             $project: {
  //               _id: 1,
  //               username: 1,
  //               email: 1,
  //               role: 1,
  //               artistBio: 1,
  //               socialMediaLinks: 1,
  //               country:1,
  //               favoriteGenre:1
  //             },
  //           },
  //         ],
  //       },
  //     },
  //     { $unwind: "$user" },
  //     { $match: { "user.isDeleted": { $ne: true } } },
  //     {
  //       $project: {
  //         _id: 1,
  //         title: 1,
  //         file: 1,
  //         genre: 1,
  //         description: 1,
  //         type: 1,
  //         createdAt: 1,
  //         likeCount: { $literal: 0 }, // keep same structure
  //         weeklyTrendingScore: { $literal: 0 }, // keep same structure
  //         user: 1,
  //       },
  //     },
  //   ];

  //   topContent = await Content.aggregate(fallbackPipeline);
  // }

  const contentWithIsLiked = await addIsLikedField(topContent, user._id);

  return SUCCESS(res, 200, "Top trending content fetched successfully", {
    data: contentWithIsLiked,
    type: "top", // always "top" so response model stays identical
  });
};

// SONGS - Audio content only
const getSongs = async (
  req: any,
  res: any,
  user: any,
  page: number,
  limit: number,
  search: string
) => {
  let matchConditions: any = {
    isDeleted: false,
    type: contentType.AUDIO, // Only audio content for songs
  };


  // Add search functionality
  if (search) {
    matchConditions.$or = [
      { title: { $regex: search, $options: "i" } },
      { genre: { $regex: search, $options: "i" } },
      { description: { $regex: search, $options: "i" } },
    ];
  }

  // Filter by user's favorite genre if no search
  // if (!search && user.favoriteGenre) {
  //   if (!matchConditions.$or) {
  //     matchConditions.$or = [];
  //   }
  //   matchConditions.$or.push({
  //     genre: { $regex: user.favoriteGenre, $options: "i" },
  //   });
  // }


  const dd = await Content.find({
    ...matchConditions
  })
  console.log(dd, "=======>dd")

  const songsPipeline: any = [
    { $match: matchConditions },

    // Lookup user details
    {
      $lookup: {
        from: "users",
        localField: "userId",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {
            $project: {
              _id: 1,
              username: 1,
              email: 1,
              role: 1,
              artistBio: 1,
              socialMediaLinks: 1,
              country: 1,
              favoriteGenre: 1
            },
          },
        ],
      },
    },

    {
      $lookup: {
        from: "likes",
        let: { contentId: "$_id" },
        pipeline: [
          {
            $match: {
              $expr: {
                $and: [
                  { $eq: ["$contentId", "$$contentId"] },
                  {
                    $in: [
                      "$type",
                      [likesType.AUDIO],
                    ],
                  },
                ],
              },
            },
          },
        ],
        as: "likes",
      },
    },

    {
      $addFields: {
        likeCount: { $size: "$likes" },
      },
    },

    { $unwind: "$user" },
    { $match: { "user.isDeleted": { $ne: true } } },

    // Sort by most recent first
    { $sort: { createdAt: -1 } },
    { $skip: (Number(page) - 1) * Number(limit) },
    { $limit: Number(limit) },

    {
      $project: {
        _id: 1,
        title: 1,
        file: 1,
        genre: 1,
        description: 1,
        type: 1,
        createdAt: 1,
        user: 1,
        likeCount: 1,
      },
    },
  ];

  const songs = await Content.aggregate(songsPipeline);
  const songsWithIsLiked = await addIsLikedField(songs, user._id);

  return SUCCESS(res, 200, "Songs fetched successfully", {
    data: songsWithIsLiked,
    type: "songs",
  });
};

// ARTISTS - Artist search with recent searches
const getArtists = async (
  req: any,
  res: any,
  user: any,
  page: number,
  limit: number,
  search: string
) => {
  let response: any = {};

  // If no search term, show recent searches
  if (!search || search.trim() === "") {
    // const recentSearches = await getRecentArtistSearches(user._id);
    // response.recentSearches = recentSearches;

    // Also show some popular artists
    const popularArtists = await User.find({
      role: userRoles.ARTIST,
      isDeleted: false,
      _id: { $ne: user._id },
    })
      .select("_id username email role artistBio socialMediaLinks country favoriteGenre")
      .limit(Number(limit))
      .lean();

    const artistsWithIsLiked = await addArtistIsLikedAndFollowedField(
      popularArtists,
      user._id
    );
    response.artists = artistsWithIsLiked;


    return SUCCESS(res, 200, "Recent searches and popular artists fetched", {
      data: response,
      type: "artists",
    });
  }

  // Search for artists based on search term
  const searchResults = await User.find({
    role: userRoles.ARTIST,
    isDeleted: false,
    _id: { $ne: user._id },
    $or: [
      { username: { $regex: `^${search}`, $options: "i" } }, // Starts with search term
      { username: { $regex: search, $options: "i" } }, // Contains search term
    ],
  })
    .select("_id username email role artistBio socialMediaLinks")
    .sort({ username: 1 }) // Alphabetical order
    .skip((Number(page) - 1) * Number(limit))
    .limit(Number(limit))
    .lean();

  // Save search term for recent searches
  await saveArtistSearch(user._id, search);

  const finalData = await addArtistIsLikedAndFollowedField(
    searchResults,
    user._id
  );


  return SUCCESS(res, 200, "Artist search results fetched", {
    data: {
      artists: finalData,
      searchTerm: search,
    },
    type: "artists",
  });
};

// Helper function to add isLiked field for content
const addIsLikedField = async (content: any[], userId: string) => {
  const contentIds = content.map((item) => item._id);
  const userLikedContent = await Likes.find({
    likedBy: userId,
    contentId: { $in: contentIds },
    type: { $in: [likesType.AUDIO, likesType.VIDEO, likesType.IMAGE] },
  }).distinct("contentId");

  return content.map((item: any) => ({
    ...item,
    isLiked: userLikedContent.map(String).includes(item._id.toString()),
  }));
};

// Helper function to add isLiked field for artists
const addArtistIsLikedAndFollowedField = async (artists: any[], userId: string) => {
  const artistIds = artists.map((artist) => artist._id);
  const userLikedArtists = await Likes.find({
    likedBy: userId,
    artistId: { $in: artistIds },
    type: likesType.ARTIST,
  }).distinct("artistId");

  const userFollowedArtist = await FollowUnfollow.find({
    followedBy: userId,
    artistId: { $in: artistIds },
  }).distinct("artistId");

  return artists.map((artist: any) => ({
    ...artist,
    isLiked: userLikedArtists.map(String).includes(artist._id.toString()),
    isFollowed: userFollowedArtist.map(String).includes(artist._id.toString()),
  }));
};


// Helper functions for recent searches (you'll need to create a search history schema)
const getRecentArtistSearches = async (userId: string) => {
  const searchTerms = await SearchHistory.find({
    userId,
  }).limit(5);
  return searchTerms.map((item: any) => item.searchTerm);
};

const saveArtistSearch = async (userId: string, searchTerm: string) => {
  const isSearchExists = await SearchHistory.findOne({
    userId,
    searchTerm: { $regex: new RegExp(`^${searchTerm}`, "i") }, // Case-insensitive starts with match
  });

  if (!isSearchExists) {
    await SearchHistory.create({
      userId,
      searchTerm,
    });
  }
};

const searchContent = TryCatch(
  async (
    req: Request<{}, {}, {}, SearchContentRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { search } = req.query;

    const [content, artist] = await Promise.all([
      Content.find({
        title: { $regex: search, $options: "i" },
      }),
      User.find({
        username: { $regex: search, $options: "i" },
      }),
    ]);

    return SUCCESS(res, 200, "Content searched successfully", {
      data: {
        content,
        artist,
      },
    });
  }
);


const getUserContentSearchHisory = TryCatch(
  async (
    req: Request<{}, {}, {}, SearchContentRequest>,
    res: Response,
    next: NextFunction
  ) => {
    const { search } = req.query;

    const history = await SearchHistory.find({
      userId: req.userId,
      searchTerm: { $regex: search, $options: "i" }
    }).sort({ createdAt: -1 });

    return SUCCESS(res, 200, "Content searched successfully", {
      data: {
        history
      },
    });
  }
);

export default {
  addContent,
  getAllContent,
  likeDislikeContent,
  getTrendingContent,
  searchContent,
  getUserContentSearchHisory
};

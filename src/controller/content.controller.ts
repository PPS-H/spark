import { NextFunction, Request, Response } from "express";
import { getFiles, SUCCESS, TryCatch } from "../utils/helper";
import Content from "../model/content.model";
import { contentType, likesType, userRoles } from "../utils/enums";
import {
  AddContentRequest,
  GetContentRequest,
  GetTrendingContentRequest,
  LikeDislikeRequest,
} from "../../types/API/Content/types";
import { getUserById } from "../services/user.services";
import { getContentById } from "../services/content.services";
import Likes from "../model/likes.model";

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
    const { page = 1, limit = 10, type } = req.query;

    const dateThreshold = new Date(
      Date.now() - Number(7) * 24 * 60 * 60 * 1000
    );

    // Build match conditions for content
    let contentMatchConditions: any = {
      isDeleted: false,
      genre: { $regex: user.favoriteGenre, $options: "i" },
    };

    if (type) {
      contentMatchConditions.type = type;
    }
    
    // Aggregate pipeline to get trending content based on likes
    const trendingContentPipeline: any = [
      // Match content criteria
      { $match: contentMatchConditions },

      // Lookup likes for each content
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
                    // { $gte: ["$createdAt", dateThreshold] }, // Only recent likes
                  ],
                },
              },
            },
          ],
          as: "likes",
        },
      },

      // Add like count and calculate trending score
      {
        $addFields: {
          likeCount: { $size: "$likes" },
          trendingScore: {
            $add: [
              { $size: "$likes" }, // Like count
              {
                $divide: [
                  { $subtract: [new Date(), "$createdAt"] },
                  86400000, // Divide by milliseconds in a day for recency factor
                ],
              },
            ],
          },
        },
      },

      // Filter content with at least some engagement
      { $match: { likeCount: { $gte: 1 } } },

      // Sort by trending score (higher is more trending)
      { $sort: { trendingScore: -1, likeCount: -1, createdAt: -1 } },

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
              },
            },
          ],
        },
      },

      // Unwind user array
      { $unwind: "$user" },

      // Filter out deleted users
      { $match: { "user.isDeleted": { $ne: true } } },

      // Skip and limit for pagination
      { $skip: (Number(page) - 1) * Number(limit) },
      { $limit: Number(limit) },

      // Final projection
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
          trendingScore: 1,
          user: 1,
        },
      },
    ];

    const trendingContent = await Content.aggregate(trendingContentPipeline);

    // Check which content is liked by current user
    const contentIds = trendingContent.map((content) => content._id);
    const userLikedContent = await Likes.find({
      likedBy: user._id,
      contentId: { $in: contentIds },
      type: { $in: [likesType.AUDIO, likesType.VIDEO, likesType.IMAGE] },
    }).distinct("contentId");

    // Add isLiked field to each content
    const contentWithIsLiked = trendingContent.map((content: any) => ({
      ...content,
      isLiked: userLikedContent.map(String).includes(content._id.toString()),
    }));

    // Get total count for pagination info
    const totalCountPipeline = [
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
        },
      },
      { $match: { likeCount: { $gte: 1 } } },
      { $count: "total" },
    ];

    const totalCountResult = await Content.aggregate(totalCountPipeline);
    const totalCount = totalCountResult[0]?.total || 0;

    return SUCCESS(res, 200, "Trending content fetched successfully", {
      data: contentWithIsLiked,
      pagination: {
        currentPage: Number(page),
        totalPages: Math.ceil(totalCount / Number(limit)),
        totalItems: totalCount,
        itemsPerPage: Number(limit),
      },
    });
  }
);

export default {
  addContent,
  getAllContent,
  likeDislikeContent,
  getTrendingContent,
};

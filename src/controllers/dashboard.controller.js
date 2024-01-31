import mongoose from "mongoose";
import { Video } from "../models/video.model.js";
import { Subscription } from "../models/subscription.model.js";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getChannelStats = asyncHandler(async (req, res) => {
  // TODO: Get the channel stats like
  /*
  1. total video views
  2. total subscribers
  3. total videos
  4. total likes
  5. total comments
  */
  const userId = req.user._id;

  const totalVideoViews = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        foreignField: "subscriber",
        localField: "owner",
        as: "subscribers",
      },
    },
    {
      $addFields: {
        totalSubscribers: {
          $size: "$subscribers",
        },
      },
    },
    {
      $lookup: {
        from: "likes",
        foreignField: "video",
        localField: "_id",
        as: "likesVideo",
      },
    },
    {
      $addFields: {
        likes: {
          $size: "$likesVideo",
        },
      },
    },
    {
      $lookup: {
        from: "comments",
        foreignField: "video",
        localField: "_id",
        as: "commentsVideo",
      },
    },
    {
      $addFields: {
        comments: {
          $size: "$commentsVideo",
        },
      },
    },
    {
      $group: {
        _id: null,
        totalViews: {
          $sum: "$views",
        },
        totalVideos: {
          $sum: 1,
        },
        totalLikes: {
          $sum: "$likes",
        },
      },
    },
    {
      $addFields: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $project: {
        _id: 0,
      },
    },
  ]);
  res
    .status(200)
    .json(new ApiResponse(200, totalVideoViews, "Get channel stats success"));
});

const getChannelVideos = asyncHandler(async (req, res) => {
  // TODO: Get all the videos uploaded by the channel

  const userId = req.user._id;
  const { limit = 10, page = 1 } = req.query;
  const channel = await Subscription.findById(userId);
  if (!channel) {
    throw new ApiError(404, "Channel is not found");
  }
  const videos = await Video.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },

    {
      $project: {
        videoFile: 1,
        thumbnail: 1,
        viwes: 1,
        duration: 1,
        title: 1,
        _id: 0,
      },
    },
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ]);
  res.status(200).json(new ApiResponse(200, videos, "Get videos success"));
});

export { getChannelStats, getChannelVideos };

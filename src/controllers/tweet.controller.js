import mongoose, { isValidObjectId } from "mongoose";
import { Tweet } from "../models/tweet.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const createTweet = asyncHandler(async (req, res) => {
  //TODO: create tweet
  const { content } = req.body;
  if (!content.trim()) {
    throw new ApiError(400, "Content is required");
  }
  let tweet = await Tweet.create({
    content: content.trim(),
    owner: req.user?._id,
  });
  if (!tweet) {
    throw new ApiError(500, "Something went wrong while creating tweet");
  }
  tweet = await Tweet.findById(tweet._id).populate(
    "owner",
    "fullname username email avatar"
  );
  return res
    .send(201)
    .json(new ApiResponse(201, tweet, "Successfully created tweet"));
});

const getUserTweets = asyncHandler(async (req, res) => {
  // TODO: get user tweets
  let { userId, page = 1, limit = 10 } = req.params;

  if (!userId.trim() || !isValidObjectId(userId)) {
    throw new ApiError(400, "User is required");
  }
  limit = isNaN(limit) ? Number(limit) : 1;
  page = isNaN(page) ? Number(page) : 1;

  if (page <= 0) page = 1;
  if (limit <= 0) limit = 10;

  const tweets = await Tweet.aggregate([
    {
      $match: {
        owner: new mongoose.Types.ObjectId(userId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "user",
        pipeline: [
          {
            $project: {
              username: 1,
              email: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
      },
    },
    {
      $sort: {
        createdAt: -1,
      },
    },
    {
      $skip: (page - 1) * limit,
    },
    {
      $limit: limit,
    },
  ]);
  if (!tweets) {
    throw new ApiError(404, "Tweets are not found");
  }

  return res.send(200).json(200, "Successfully fetched tweets");
});

const updateTweet = asyncHandler(async (req, res) => {
  //TODO: update tweet
  const { tweetId } = req.params;
  const { content } = req.body;
  if (!tweetId || !isValidObjectId(tweetId)) {
    throw new ApiError(400, "Tweet id is required");
  }
  if (!content.trim()) {
    throw new ApiError(400, "Content is required");
  }
  const tweet = await Tweet.findById({ _id: tweetId });
  if (!tweet) {
    throw new ApiError(404, "Tweet is not found");
  }
  if (tweet?.owner.toString() !== req.user?._id?.toString()) {
    throw new ApiError(401, "You can not update the tweet");
  }
  const updateTweetRes = await Tweet.findByIdAndUpdate(
    tweet,
    {
      $set: {
        content: content.trim(),
      },
    },
    { new: true }
  );
  if (!updateTweetRes) {
    throw new ApiError(500, "Something went wrong while updating tweet");
  }
  return res
    .send(200)
    .json(new ApiResponse(200, updateTweetRes, "Successfully update tweet"));
});

const deleteTweet = asyncHandler(async (req, res) => {
  //TODO: delete tweet
  const { tweetId } = req.params;
  const { content } = req.body;
  if (!tweetId || !isValidObjectId(tweetId)) {
    throw new ApiError(400, "Tweet id is required");
  }
  if (!content.trim()) {
    throw new ApiError(400, "Content is required");
  }
  const tweet = await Tweet.findById({ _id: tweetId });
  if (!tweet) {
    throw new ApiError(404, "Tweet is not found");
  }
  if (tweet?.owner.toString() !== req.user?._id?.toString()) {
    throw new ApiError(401, "You can not update the tweet");
  }
  const deleteTweetRes = await Tweet.findByIdAndDelete(tweet);
  if (!deleteTweetRes) {
    throw new ApiError(500, "Something went wrong while deleting tweet");
  }
  return res
    .send(200)
    .json(new ApiResponse(200, {}, "Successfully delete tweet"));
});

export { createTweet, getUserTweets, updateTweet, deleteTweet };

import mongoose, { isValidObjectId } from "mongoose";
import { Like } from "../models/like.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Tweet } from "../models/tweet.model.js";

const toggleVideoLike = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: toggle like on video
  if (!videoId.trim() || !isValidObjectId(videoId.trim())) {
    throw new ApiError(400, "Video id is required");
  }

  const video = await Video.findById(videoId.trim());
  if (!video) {
    throw new ApiError(400, "Video is not found");
  }
  const likedVideo = await Like.findById({
    video: videoId.trim(),
    likedBy: req.user._id,
  });

  let hasLiked;
  if (!likedVideo) {
    await Like.create({ video: likedVideo._id, likedBy: req.user._id });
    hasLiked = true;
  } else {
    await Like.deleteOne({ video: likedVideo._id, likedBy: req.user._id });
    hasLiked = false;
  }
  return res
    .send(201)
    .json(
      new ApiResponse(
        201,
        {},
        hasLiked ? "Video has been liked" : "Video has been unliked"
      )
    );
});

const toggleCommentLike = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  //TODO: toggle like on comment
  if (!commentId.trim() || !isValidObjectId(commentId)) {
    throw new ApiError(400, "Comment id is required");
  }
  const comment = await Comment.findById(commentId.trim());
  if (!comment) {
    throw new ApiError(404, "Comment is not found");
  }
  const likeComment = await Like.findOne({
    comment: commentId.trim(),
    likedBy: req.user._id,
  });
  let hasLiked;
  if (!likeComment) {
    await Like.create({
      comment: commentId.trim(),
      likedBy: req.user._id,
    });
    hasLiked = true;
  } else {
    await Like.deleteOne({
      comment: likeComment.commentId,
      likedBy: likeComment.likedBy,
    });
    hasLiked = false;
  }
  return res
    .send(200)
    .json(
      new ApiResponse(
        200,
        {},
        hasLiked ? "Add like to the comment" : "Remove like from the comment"
      )
    );
});

const toggleTweetLike = asyncHandler(async (req, res) => {
  const { tweetId } = req.params;
  //TODO: toggle like on tweet
  if (!tweetId.trim() || !isValidObjectId(tweetId)) {
    throw new ApiError(400, "Tweet id is required");
  }
  const tweet = await Tweet.findById(tweetId);

  if (!tweet) {
    throw new ApiError(404, "Tweet is not found");
  }
  let isTweetLiked;
  const likedTweet = await Like.findOne({
    tweet: tweetId.trim(),
    likedBy: req.user._id,
  });
  if (likedTweet) {
    await Like.deleteOne({
      tweet: likedTweet.tweet,
      likedBy: likedTweet.likedBy,
    });
    isTweetLiked = false;
  } else {
    await Link.create({
      tweet: tweetId.trim(),
      likedTweet: req.user._id,
    });
    isTweetLiked = true;
  }

  return res
    .send(200)
    .json(
      new ApiResponse(
        200,
        {},
        isTweetLiked ? "Add like to the tweet" : "Unliked a tweet"
      )
    );
});

const getLikedVideos = asyncHandler(async (req, res) => {
  //TODO: get all liked videos

  const userId = req.user._id.trim();

  const likedVideos = await Like.aggregate([
    {
      $match: {
        likedBy: new mongoose.Types.ObjectId(userId),
        video: {
          $exists: true,
        },
      },
    },
    {
      $lookup: {
        from: "videos",
        foreignField: "_id",
        localField: "video",
        as: "videoLists",
        pipeline: [
          {
            $project: {
              videoFile: 1,
              thumbnail: 1,
              title: 1,
              description: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        videos: {
          $first: "$videoLists",
        },
      },
    },
    {
      $project: {
        video: 1,
        _id: 0,
      },
    },
    {
      $replaceRoot: {
        newRoot: "$video",
      },
    },
  ]);
  if (!likedVideos) {
    throw new ApiError(500, "Something went wrong while fetching liked videos");
  }
  return res
    .send(200)
    .json(
      new ApiResponse(200, likedVideos, "Successfully fetched liked videos")
    );
});

export { toggleCommentLike, toggleTweetLike, toggleVideoLike, getLikedVideos };

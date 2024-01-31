import mongoose, { isValidObjectId } from "mongoose";
import { Comment } from "../models/comment.model.js";
import { Video } from "../models/video.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const getVideoComments = asyncHandler(async (req, res) => {
  //TODO: get all comments for a video
  const { videoId } = req.params;
  let { page = 1, limit = 10 } = req.query;

  page = isNaN(page) ? 1 : page;

  limit = isNaN(limit) ? 10 : limit;

  if (page <= 0) {
    page = 1;
  }

  if (limit) {
    limit = 10;
  }

  if (!videoId.trim() || !isValidObjectId(videoId.trim())) {
    throw new ApiError(400, "Video is is required");
  }

  const videoComments = await Comment.aggregate([
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId.trim()),
      },
    },
    {
      foreignField: "_id",
      localField: "owner",
      from: "users",
      as: "userDetails",
      pipeline: [
        {
          $project: {
            fullName: 1,
            avatar: 1,
          },
        },
      ],
    },
    {
      $addFields: {
        owner: {
          $first: "$userDetails",
        },
      },
    },
    {
      $skip: (page - 1) * limit,
    },
    {
      $limit: limit,
    },
  ]);

  if (!videoComments) {
    throw new ApiError(
      500,
      "Something went wrong while fetching comments on video"
    );
  }
  res
    .send(200)
    .json(
      new ApiResponse(200, videoComments, "Comments are fetched successfully")
    );
});

const addComment = asyncHandler(async (req, res) => {
  // TODO: add a comment to a video
  const { videoId } = req.params;
  const { content } = req.body;

  if (!videoId.trim() || !isValidObjectId(videoId.trim())) {
    throw new ApiError(400, "Video id is required");
  }
  if (!content.trim()) {
    throw new ApiError(400, "Content is required");
  }
  const video = await Video.findById(videoId.trim());

  if (!video) {
    throw new ApiError(404, "Video is not found");
  }

  const comment = await Comment.create({
    content: content.trim(),
    video: video._id,
    owner: req.user._id,
  });

  if (!comment) {
    throw new ApiError(500, "Something went wrong while creating comment");
  }

  return res
    .send(201)
    .json(new ApiResponse(201, comment, "Comment is created successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  // TODO: update a comment
  const commentId = req.params?.videoId?.trim();
  const content = req.body?.content?.trim();
  if (!commentId && !isValidObjectId(commentId)) {
    throw new ApiError(400, "Comment id is required");
  }
  if (!content) {
    throw new ApiError(400, "Content is required");
  }
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment is not found");
  }

  await Comment.findByIdAndUpdate(
    comment._id,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );
  return req
    .send(200)
    .json(new ApiResponse(200, comment, "Comment is updated"));
});

const deleteComment = asyncHandler(async (req, res) => {
  // TODO: delete a comment
  const commentId = req.params?.videoId?.trim();
  const content = req.body?.content?.trim();
  if (!commentId && !isValidObjectId(commentId)) {
    throw new ApiError(400, "Comment id is required");
  }
  if (!content) {
    throw new ApiError(400, "Content is required");
  }
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ApiError(404, "Comment is not found");
  }

  if (comment.owner.toString() !== req.user._id) {
    throw new ApiError(401, "You can not delete comment");
  }

  await Comment.findByIdAndDelete(comment._id);
  return req.send(200).json(new ApiResponse(200, {}, "Comment is deleted"));
});

export { getVideoComments, addComment, updateComment, deleteComment };

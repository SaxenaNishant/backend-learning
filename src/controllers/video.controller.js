import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  deletePreviousCloudinaryFile,
  uploadOnCloudinary,
} from "../utils/cloudinary.js";
import { Like } from "../models/like.model.js";
import { Comment } from "../models/comment.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  let { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  //TODO: get all videos based on query, sort, pagination

  page = isNaN(page) ? 1 : Number(page);
  limit = isNaN(limit) ? 1 : Number(limit);

  if (page <= 0) {
    page = 1;
  }
  if (limit <= 0) {
    limit = 1;
  }

  const matchStage = {};

  if (userId && isValidObjectId(userId)) {
    matchStage["$match"] = {
      owner: new mongoose.Types.ObjectId(userId),
    };
  } else if (query) {
    matchStage["$match"] = {
      $or: [
        {
          title: { $regex: query, options: "i" },
        },
        {
          description: {
            $regex: query,
            options: "i",
          },
        },
      ],
    };
  } else {
    matchStage["$match"] = {};
  }

  if (userId && query) {
    matchStage["$match"] = {
      $and: [
        {
          owner: new mongoose.Types.ObjectId(userId),
        },
        {
          $or: [
            {
              title: { $regex: query, option: "i" },
            },
            {
              description: { $regex: query, option: "i" },
            },
          ],
        },
      ],
    };
  }

  const joinOwnerStage = {
    $lookup: {
      from: "users",
      foreignField: "_id",
      local: "owner",
      as: "owner",
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
  };

  const addFieldStage = {
    $addFields: {
      owner: {
        $first: "$owner",
      },
    },
  };

  const sortStage = {};

  if (sortBy && sortBy) {
    sortStage["$sort"] = {
      [sortBy]: sortType === "asc" ? 1 : -1,
    };
  } else {
    sortStage["$sort"] = {
      createdAt: -1,
    };
  }

  const skipStage = {
    $skip: (page - 1) * limit,
  };

  const limitStage = {
    $limit: limit,
  };

  const allVideos = await Video.aggregate([
    matchStage,
    joinOwnerStage,
    addFieldStage,
    sortStage,
    skipStage,
    limitStage,
  ]);

  if (!allVideos) {
    throw new ApiError(500, "Something went wrong while fetching all videos");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, allVideos, "All videos successfully fetched"));
});

const publishAVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  // TODO: get video, upload to cloudinary, create video

  const { thumbnail, videoFile } = req.files;

  let thumbnailLocalPath, videoFileLocalPath;

  if (thumbnail && Array.isArray(thumbnail) && thumbnail.length) {
    thumbnailLocalPath = thumbnail[0]?.path;
  }
  if (videoFile && Array.isArray(videoFile) && videoFile.length) {
    videoFileLocalPath = videoFile[0]?.path;
  }

  if (
    [title, description, videoFileLocalPath].some(
      (val) => val === undefined || val?.trim() === ""
    )
  ) {
    throw new ApiError(400, "All fileds are required");
  }

  const videoFileResponse = await uploadOnCloudinary(videoFileLocalPath);
  const thumbnailResponse = thumbnailLocalPath
    ? await uploadOnCloudinary(thumbnailLocalPath)
    : "";

  if (!videoFileResponse) {
    throw new ApiError(
      400,
      "Something went wrong while uploading files on Cloudinary"
    );
  }

  const obj = {
    videoFile: videoFileResponse?.url || "",
    thumbnail: thumbnailResponse?.url || "",
    title,
    description,
    duration: videoFile?.duration || 0,
    owner: req.user._id,
  };

  const video = await Video.create(obj);
  const videoPublished = await Video.findById(video._id).select("-owner");
  if (!videoPublished) {
    throw new ApiError("500", "Something went wrong while publishing video");
  }
  return res
    .status(201)
    .json(new ApiResponse(201, videoPublished, "Successfully published video"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!videoId) {
    throw new ApiError(400, "Video id is required");
  }

  /*
  video exits hai ki nhi
  mujhe video model se kya kya mil sakta hai
  - video file, 
  - thumbnail, 
  - video title,
  - video description,
  - video duration,
  - view(dynamic) => view should also be updated on db everytime when get api returned response, 
  - owner's id who published video
  What more you need
  => email, name, avatar user ka
  => kitne likes hai video mai
  => kitne comments hai video mai
  */

  //TODO: get video by id
  //   const video = await Video.findById(videoId);

  let video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "owner",
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
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "like",
      },
    },
    {
      $lookup: {
        from: "comments",
        localField: "_id",
        foreignField: "video",
        as: "comment",
      },
    },
    {
      $addFields: {
        likes: {
          $size: "$like",
        },
        comments: {
          $size: "$comment",
        },
        owner: {
          $first: "$owner",
        },
        views: {
          $sum: [1, "$views"],
        },
      },
    },
  ]);
  if (!video) {
    throw new ApiError(404, "Video is not found");
  }

  if (video && video.length > 0) {
    video = video[0];
  }
  await Video.findByIdAndUpdate(
    video,
    {
      $set: {
        views: video.views,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Successfully found video"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: update video details like title, description, thumbnail
  if (!videoId?.trim()) {
    throw new ApiError(400, "Video id is required");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video is not found");
  }
  const thumbnail = req?.file?.path;
  if (thumbnail) {
    if (video?.thumbnail) {
      await deletePreviousCloudinaryFile(video?.thumbnail);
    }
    video.thumbnail = (await uploadOnCloudinary(thumbnail))?.url || "";
  }
  const { title, description } = req.body;

  if (title?.trim()) {
    video.title = title.trim();
  }
  if (description?.trim()) {
    video.description = description?.trim();
  }
  await video.save();

  return res
    .status(201)
    .json(new ApiResponse(201, video, "Video has been updated successfully"));
});

const deleteVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  //TODO: delete video
  if (!videoId?.trim()) {
    throw new ApiError(400, "Video id is required");
  }
  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video is not found for deletion");
  }
  if (video.owner._id?.toString() !== req.user._id.toString()) {
    throw new ApiError(400, "You can not delete this video");
  }
  const { videoFile, thumbnail, _id } = video;
  const deletedVideoRes = await Video.findByIdAndDelete(video._id);
  if (deletedVideoRes) {
    await Promise.all([
      Like.deleteMany({ video: _id }),
      Comment.deleteMany({ video: _id }),
      deletePreviousCloudinaryFile(videoFile),
      deletePreviousCloudinaryFile(thumbnail),
    ]);
  } else {
    throw new ApiError(500, "Something went wrong while deleting video");
  }
  return res
    .status(201)
    .json(new ApiResponse(201, {}, "Video has been deleted successfully"));
});

const togglePublishStatus = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  if (!videoId?.trim()) {
    throw new ApiError(400, "Video id id is required");
  }
  let video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video is not found");
  }
  video.published = !video.published;

  await video.save();
  return res
    .status(200)
    .json(
      new ApiResponse(201, {}, "Video status has been updated successfully")
    );
});

export {
  getAllVideos,
  publishAVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishStatus,
};

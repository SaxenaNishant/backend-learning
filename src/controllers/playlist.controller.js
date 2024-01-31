import mongoose, { isValidObjectId } from "mongoose";
import { Playlist } from "../models/playlist.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { Video } from "../models/video.model.js";

const createPlaylist = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  //TODO: create playlist

  if (!name.trim()) {
    throw new ApiError(400, "Name is required");
  }

  if (!description.trim()) {
    throw new ApiError(400, "Description is required");
  }

  let playlist = await Playlist.create({
    name: name.trim(),
    description: description.trim(),
    owner: req.user._id,
  });

  if (!playlist) {
    throw new ApiError(500, "Something went wrong while creating playlist");
  }
  playlist = await Playlist.findById(playlist._id).populate(
    "owner",
    "fullName username avatar"
  );
  return res
    .status(201)
    .json(new ApiResponse(201, playlist, "Playlist created successfully"));
});

const getUserPlaylists = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  //TODO: get user playlists
  if (!userId.trim() || !isValidObjectId(userId.trim())) {
    throw new ApiError(400, "User id is required");
  }

  const playlists = await Playlist.aggregate([
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
        title: 1,
        description: 1,
      },
    },
  ]);
  return res
    .send(200)
    .json(
      new ApiResponse(200, playlists, "Playlists are successfully fetched")
    );
});

const getPlaylistById = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  //TODO: get playlist by id

  if (!playlistId.trim() || !isValidObjectId(playlistId.trim())) {
    throw new ApiError(400, "Playlist id is required");
  }

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId),
      },
    },
    {
      $lookup: {
        from: "videos",
        foreignField: "_id",
        localField: "videos",
        as: "videoLists",
        pipeline: [
          {
            $lookup: {
              from: "users",
              foreignField: "_id",
              localField: "owner",
              as: "videoOwner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    email: 1,
                    avatar: 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              videoOwner: {
                $first: "$videoOwner",
              },
            },
          },
          {
            $project: {
              videoOwner: 1,
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
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "owner",
        as: "userDetail",
        pipeline: [
          {
            $project: {
              fullName: 1,
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
          $first: "$userDetail",
        },
      },
    },
  ]);
  if (!playlist) {
    throw new ApiError(500, "Something went wrong while fetching playlist");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, playlist[0], "Playlist fetched successfully"));
});

const addVideoToPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  if (!playlistId.trim() || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "Playlist id is required");
  }
  if (!videoId.trim() || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Video id is required");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video is not found");
  }

  const playlist = await Playlist.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(playlistId.trim()),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "videos",
        foreignField: "_id",
        as: "videoLists",
      },
    },
    {
      $match: {
        "$videoLists._id": { $ne: videoId },
      },
    },
    {
      $project: {
        owner: 1,
        videos: {
          $concatArrays: ["$videos", videoId],
        },
      },
    },
  ]);
  if (playlist.length === 0) {
    throw new ApiError(400, "Playlist is not found");
  }
  if (playlist[0].owner.toString() !== req.user._id.toString()) {
    throw new ApiError(400, "You can not add video to this playlist");
  }

  await Playlist.findByIdAndUpdate(
    playlistId,
    {
      $set: {
        videos: playlist[0].videos,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      new ApiResponse(200, {}, "Video is successfully added to the playlist")
    );
});

const removeVideoFromPlaylist = asyncHandler(async (req, res) => {
  const { playlistId, videoId } = req.params;
  // TODO: remove video from playlist
  if (!playlistId.trim() || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "Playlist id is required");
  }
  if (!videoId.trim() || !isValidObjectId(videoId)) {
    throw new ApiError(400, "Playlist id is required");
  }

  const playList = await Playlist.findById(playlistId);

  if (playList.owner.toString() !== req.user._id.toString()) {
    throw new ApiError(401, "You can not delete video from this playlist");
  }

  playList.videos = playList.videos.filter((vid) => vid !== videoId);

  await playList.save();

  res
    .status(200)
    .json(new ApiResponse(200, {}, "Video is deleted from this playlist"));
});

const deletePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  // TODO: delete playlist
  if (playlistId) {
    throw new ApiError(400, "Playlist id is required");
  }
  const playlist = await Playlist.findById(playlistId);
  if (!playlist) {
    throw new ApiError(404, "Playlist is not found");
  }
  if (playlist._id.toString() !== req.user._id) {
    throw new ApiError(401, "You can not update this playlist");
  }
  await Playlist.findByIdAndDelete(playlist._id);
  return res
    .send(200)
    .json(new ApiResponse(200, {}, "Playlist is successfully deleted"));
});

const updatePlaylist = asyncHandler(async (req, res) => {
  const { playlistId } = req.params;
  const { name, description } = req.body;
  //TODO: update playlist

  if (!playlistId.trim() || !isValidObjectId(playlistId)) {
    throw new ApiError(400, "Playlist id is required");
  }
  const playlist = await Playlist.findById(playlistId.trim());
  if (!playlist) {
    throw new ApiError(404, "Playlist is not found");
  }
  if (playlist._id.toString() !== req.user._id) {
    throw new ApiError(401, "You can not update this playlist");
  }
  await Playlist.findByIdAndUpdate(
    playlist._id,
    {
      $set: {
        name: name.trim(),
        description: description.trim(),
      },
    },
    { new: true }
  );
  return res
    .send(200)
    .json(new ApiResponse(200, {}, "Playlist is successfully updated"));
});

export {
  createPlaylist,
  getUserPlaylists,
  getPlaylistById,
  addVideoToPlaylist,
  removeVideoFromPlaylist,
  deletePlaylist,
  updatePlaylist,
};

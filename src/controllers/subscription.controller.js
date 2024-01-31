import mongoose, { isValidObjectId } from "mongoose";
import { User } from "../models/user.model.js";
import { Subscription } from "../models/subscription.model.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const toggleSubscription = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  // TODO: toggle subscription

  if (!channelId.trim() || !isValidObjectId(channelId)) {
    throw new ApiError(400, "Channel is is required");
  }

  const channel = await User.findById(channelId.trim());
  if (!channel) {
    throw new ApiError(404, "Channel is not found");
  }

  const isSubscribed = await Subscription.findOne({
    channel: channelId.trim(),
    subscriber: req.user._id,
  });
  let isSubscribing;
  if (!isSubscribed) {
    await Subscription.create({
      channel: channelId.trim(),
      subscriber: req.user._id,
    });
    isSubscribing = true;
  } else {
    await Subscription.deleteOne({
      channel: channelId.trim(),
      subscriber: req.user._id,
    });
    isSubscribing = false;
  }
  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        {},
        isSubscribing
          ? "Channel is subscribed successfully"
          : "Channel is unsubscribed successfully"
      )
    );
});

// controller to return subscriber list of a channel
const getUserChannelSubscribers = asyncHandler(async (req, res) => {
  const { channelId } = req.params;
  if (!channelId.trim()) {
    throw new ApiError(400, "Channel id is required");
  }

  const subscribers = await Subscription.aggregate([
    {
      $match: {
        channel: channelId,
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "channelId",
        as: subscribers,
        pipeline: [
          {
            $project: {
              username: 1,
              fullName: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        subscriberLists: {
          $first: "$subscribers",
        },
      },
    },
    {
      $project: {
        subscriberLists: 1,
      },
    },
    {
      $replaceRoot: {
        newRoot: "$subscriberLists",
      },
    },
  ]);
  if (!subscribers) {
    throw new ApiError(500, "Something went wrong while fetching subscibers");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, subscribers, "Subscibers fetched successfully"));
});

// controller to return channel list to which user has subscribed
const getSubscribedChannels = asyncHandler(async (req, res) => {
  const { subscriberId } = req.params;
  if (!subscriberId.trim() || isValidObjectId(subscriberId)) {
    throw new ApiError(400, "Subscriber id is required");
  }
  const channels = await Subscription.aggregate([
    {
      $match: {
        subscriber: subscriberId,
      },
    },
    {
      $lookup: {
        from: "users",
        foreignField: "_id",
        localField: "subscriberId",
        as: "channelLists",
        pipeline: [
          {
            $project: {
              fullName: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        channelLists: {
          $first: "$channelLists",
        },
      },
    },
    {
      $replaceRoot: {
        newRoot: "$channelLists",
      },
    },
  ]);
  if (!channels) {
    throw new ApiError(
      500,
      "Something went wrong while fetching channel lists"
    );
  }
  return res
    .status(200)
    .json(new ApiResponse(200, channels, "Channels fetched successfully"));
});

export { toggleSubscription, getUserChannelSubscribers, getSubscribedChannels };

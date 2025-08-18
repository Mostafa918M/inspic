const logger = require("../utils/logger");
const sendResponse = require("../utils/sendResponse");
const ApiError = require("../utils/apiError");
const asyncErrorHandler = require("../utils/asyncErrorHandler");
const User = require("../models/users.model");

const getProfile = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user.id;
  const user = await User.findById(userId)

  if (!user) {
    return next(new ApiError("User not found", 404));
  }

  sendResponse(res, 200, "success", "User profile retrieved successfully", {
    user: { 
      id: user._id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      firstName: user.firstName,
      lastName: user.lastName,
      bio: user.bio,
      birthdate: user.birthdate,
      followers: user.followers.length,
      following: user.following.length,
      boards: user.boards.length,
      pins: user.pins.length,
      bookmarks: user.bookmarks.length,
      likedPins: user.likedPins.length,

      role: user.role.name, 
    },
  });
});

const updateProfile = asyncErrorHandler(async (req, res, next) => {
const userId = req.user.id;
if(!userId){
  return next(new ApiError("User not found", 404));
}
  const body = req.body ?? {};

const allowed = ["firstName", "lastName", "username", "bio", "birthdate" , "gender"];

 const updates = Object.fromEntries(
    allowed
      .filter((k) => Object.prototype.hasOwnProperty.call(body, k) && body[k] !== undefined)
      .map((k) => [k, body[k]])
  );

  if (Object.keys(updates).length === 0) {
    return next(new ApiError("No fields to update", 400));
  }
  //year-month-day format
  if (updates.birthdate) {
    const birthdate = new Date(updates.birthdate);
    if (isNaN(birthdate.getTime())) {
      return next(new ApiError("Invalid birthdate format", 400));
    }
    updates.birthdate = birthdate;
  }
  if(updates.gender){
    if(!["male", "female"].includes(updates.gender)){
      return next(new ApiError("Invalid gender value", 400));
    }
  }

const user = await User.findByIdAndUpdate(
  userId,
  { $set: updates },
  {
    new: true,              
  }
);
sendResponse(res, 200, "success", "User profile updated successfully", {
  user: {
    id: user._id,
    username: user.username,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatar: user.avatar,
    bio: user.bio,
    role: user.role,
  },
});
});
module.exports = {
  getProfile,
  updateProfile
}

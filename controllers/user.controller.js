const logger = require("../utils/logger");
const sendResponse = require("../utils/sendResponse");
const ApiError = require("../utils/apiError");
const asyncErrorHandler = require("../utils/asyncErrorHandler");
const User = require("../models/users.models");

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
      role: user.role.name, 
    },
  });
});

module.exports = {
  getProfile}

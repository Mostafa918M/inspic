const asyncErrorHandler = require("../utils/asyncErrorHandler");
const User = require("../models/users.models");
const bcrypt = require("bcrypt");
const { generateRefreshToken, generateAccessToken } = require("../utils/jwt");
const sendResponse = require("../utils/sendResponse");

const signup = asyncErrorHandler(async (req, res, next) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return next(new Error("Please provide all required fields"));
  }
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    return next(new Error("Unable to create account"));
  }
  const hashPassword = await bcrypt.hash(password, 10);
  const user = new User({
    username: username,
    email: email,
    password: hashPassword,
  });

  await user.save();
  const RefreshToken = generateRefreshToken(user);
  const accessToken = generateAccessToken(user);
  res.cookie("refreshToken", RefreshToken,{
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict", 
    maxAge: 7 * 24 * 60 * 60 * 1000, 
  })
  sendResponse(res,201,"success", "Signup successful",{
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    accessToken: accessToken
  })
});

const signin = asyncErrorHandler(async (req, res, next) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return next(new Error("Please provide all required fields"));
  }
  const user = await User.findOne({ email });
  if (!user) {
    return next(new Error("Invalid email or password"));
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return next(new Error("Invalid email or password"));
  }
  const RefreshToken = generateRefreshToken(user);
  const accessToken = generateAccessToken(user);
  res.cookie("refreshToken", RefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  sendResponse(res,200,"success", "Signin successful",{
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    accessToken: accessToken
  })
  
});

module.exports = {
  signup,
  signin
};

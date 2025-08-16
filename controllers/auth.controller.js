const asyncErrorHandler = require("../utils/asyncErrorHandler");
const User = require("../models/users.models");
const bcrypt = require("bcrypt");
const { generateRefreshToken, generateAccessToken } = require("../utils/jwt");
const sendResponse = require("../utils/sendResponse");
const logger = require("../utils/logger");


const signup = asyncErrorHandler(async (req, res, next) => {
  const { username, email, password } = req.body;
   logger.info("Auth: signup attempt", {
    email,
    ip: req.ip,
    ua: req.headers["user-agent"],
  });
  if (!username || !email || !password) {
    logger.warn("Auth: signup missing fields");
    return next(new Error("Please provide all required fields"));
  }
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    logger.warn("Auth: signup email already in use", { email });
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

  logger.info("Auth: signup success", {
    userId: user._id.toString(),
    email,
    ip: req.ip,
  });
  sendResponse(res,201,"success", "Signup successful",{
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
    },
    accessToken,
  })
});


const signin = asyncErrorHandler(async (req, res, next) => {
  const { email, password } = req.body;

  logger.info("Auth: signin attempt", {
    email,
    ip: req.ip,
    ua: req.headers["user-agent"],
  });

  if (!email || !password) {
    logger.warn("Auth: signin missing fields", { email, hasEmail: !!email, hasPassword: !!password });
    return next(new Error("Please provide all required fields"));
  }
  const user = await User.findOne({ email });
  if (!user) {
    logger.warn("Auth: signin invalid email", { email, reason: "user_not_found" });
    return next(new Error("Invalid email or password"));
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    logger.warn("Auth: signin invalid password", { email });
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
    logger.info("Auth: signin success", {
    userId: user._id.toString(),
    email,
    ip: req.ip,
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

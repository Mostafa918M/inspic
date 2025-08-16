const asyncErrorHandler = require("../utils/asyncErrorHandler");
const ApiError = require("../utils/apiError");
const User = require("../models/users.models");
const bcrypt = require("bcrypt");

const { generateRefreshToken, generateAccessToken } = require("../utils/jwt");
const sendResponse = require("../utils/sendResponse");
const logger = require("../utils/logger");

const { generate6DigitCode, hashCode, compareCode } = require("../utils/verification");
const { sendVerificationEmail } = require("../utils/mailer");

const { OAuth2Client } = require("google-auth-library");

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const VERIFICATION_CODE_TTL_MIN = 15;
const MAX_VERIFICATION_ATTEMPTS = 5; 
const RESEND_COOLDOWN_SECONDS = 60;

async function createAndSendEmailCode(user, logger) {
  const code = generate6DigitCode();
  user.emailVerificationCodeHash = await hashCode(code);
  user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_CODE_TTL_MIN * 60 * 1000);
  user.emailVerificationAttempts = 0;
  user.emailVerificationLastSentAt = new Date();
  await user.save();

  await sendVerificationEmail(user.email, code);
  logger.info("Auth: verification code sent", { userId: user._id.toString(), email: user.email });
}

const signup = asyncErrorHandler(async (req, res, next) => {  
  const { username, email, password } = req.body;
   logger.info("Auth: signup attempt", {
    email,
    ip: req.ip,
    ua: req.headers["user-agent"],
  });
  if (!username || !email || !password) {
    logger.warn("Auth: signup missing fields");
    return next(new ApiError("Please provide all required fields"));
  }
  const existingEmail = await User.findOne({ email });
  if (existingEmail) {
    logger.warn("Auth: signup email already in use", { email });
    return next(new ApiError("Unable to create account"));
  }
  const hashPassword = await bcrypt.hash(password, 10);
  const user = new User({
    username: username,
    email: email,
    password: hashPassword,
    provider: "local",
    isEmailVerified: false
  });

  await user.save();
  await createAndSendEmailCode(user, logger);

 logger.info("Auth: signup created, awaiting email verification", {
    userId: user._id.toString(),
    email,
    ip: req.ip,
  });
  sendResponse(res,201,"success", "Signup successful. Please verify your email with the code sent.",{
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified
    },
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
    return next(new ApiError("Please provide all required fields", 400));
  }
  const user = await User.findOne({ email });
  if (!user) {
    logger.warn("Auth: signin invalid email", { email, reason: "user_not_found" });
    return next(new ApiError("Invalid email or password", 401));
  }
   if (!user.password) {
    return next(new ApiError("This account uses Google Sign-In. Use 'Continue with Google' or set a password.", 401));
  }
  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    logger.warn("Auth: signin invalid password", { email });
    return next(new ApiError("Invalid email or password"));
  }

   if (!user.isEmailVerified) {
    
    const now = new Date();
    if (
      user.emailVerificationLastSentAt &&
      (now - new Date(user.emailVerificationLastSentAt)) / 1000 < RESEND_COOLDOWN_SECONDS
    ) {
      logger.info("Auth: verification code throttled", { email });
      return sendResponse(res, 202, "pending", "Email not verified. Check your inbox for the latest code.", {
        requiresEmailVerification: true,
      });
    }
  
     if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < now) {
      await createAndSendEmailCode(user, logger);
    } else {
      await createAndSendEmailCode(user, logger);
    }

    return sendResponse(res, 202, "pending", "Email not verified. A new verification code has been sent.", {
      requiresEmailVerification: true,
    });
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
      isEmailVerified: user.isEmailVerified,
    },
    accessToken: accessToken
  })
  
});

const verifyEmail = asyncErrorHandler(async (req, res, next) => {
  const { email, code } = req.body;

  logger.info("Auth: verify email attempt", { email, ip: req.ip });

  if (!email || !code) {
    return next(new ApiError("Email and code are required"));
  }

  const user = await User.findOne({ email });
  if (!user) return next(new ApiError("Invalid code or email"));

  if (user.isEmailVerified) {
    return sendResponse(res, 200, "success", "Email already verified", {
      alreadyVerified: true,
    });
  }

  const now = new Date();
  if (!user.emailVerificationExpiresAt || user.emailVerificationExpiresAt < now) {
    return next(new ApiError("Verification code expired. Please request a new code."));
  }

  if (user.emailVerificationAttempts >= MAX_VERIFICATION_ATTEMPTS) {
    return next(new ApiError("Too many failed attempts. Please request a new code."));
  }

  const ok = await compareCode(code, user.emailVerificationCodeHash || "");
  user.emailVerificationAttempts += 1;

  if (!ok) {
    await user.save();
    logger.warn("Auth: verify email failed attempt", { email, attempts: user.emailVerificationAttempts });
    return next(new ApiError("Invalid verification code."));
  }

 
  user.isEmailVerified = true;
  user.emailVerificationCodeHash = null;
  user.emailVerificationExpiresAt = null;
  user.emailVerificationAttempts = 0;
  await user.save();

  const RefreshToken = generateRefreshToken(user);
  const accessToken = generateAccessToken(user);

  res.cookie("refreshToken", RefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  logger.info("Auth: email verified", { userId: user._id, email });

  return sendResponse(res, 200, "success", "Email verified successfully", {
    user: {
      id: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
    },
    accessToken,
  });
});

const resendVerification = asyncErrorHandler(async (req, res, next) => {
  const { email } = req.body;

  logger.info("Auth: resend verification attempt", { email, ip: req.ip });

  if (!email) return next(new ApiError("Email is required"));

  const user = await User.findOne({ email });
  if (!user) {
    return sendResponse(res, 200, "success", "If this email exists, a new code was sent.");
  }

  if (user.isEmailVerified) {
    return sendResponse(res, 200, "success", "Email already verified.");
  }

  const now = new Date();
  if (
    user.emailVerificationLastSentAt &&
    (now - new Date(user.emailVerificationLastSentAt)) / 1000 < RESEND_COOLDOWN_SECONDS
  ) {
    return next(new ApiError("Please wait before requesting another code."));
  }

  await createAndSendEmailCode(user, logger);
  return sendResponse(res, 200, "success", "Verification code sent.");
});

const callback = asyncErrorHandler(async (req, res, next) => {
  const { idToken } = req.body;
  if (!idToken) return next(new ApiError("Missing Google token"));

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (e) {
    return next(new ApiError("Invalid Google token"));
  }

  const { sub: googleId, email, name, picture, email_verified } = payload || {};
  if (!email || !googleId || !email_verified) return next(new ApiError("Unable to authenticate with Google"));

  // find by googleId or email (to auto-link)
  let user = await User.findOne({ $or: [{ googleId }, { email }] });

  if (!user) {
    user = await User.create({
      username: name || email.split("@")[0],
      email,
      googleId,
      provider: "google",
      avatar: picture,
      isEmailVerified: true,
    });
  } else {
    const updates = {};
    if (!user.googleId) updates.googleId = googleId;
    if (user.provider !== "google") updates.provider = "google"; // you can keep 'local' if you prefer dual-mode
    if (!user.isEmailVerified && email_verified) updates.isEmailVerified = true;
    if (!user.avatar && picture) updates.avatar = picture;
    if (Object.keys(updates).length) await User.updateOne({ _id: user._id }, { $set: updates });
  }

  const RefreshToken = generateRefreshToken(user);
  const accessToken  = generateAccessToken(user);
  res.cookie("refreshToken", RefreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "Strict", // if frontend is on another domain, switch to: sameSite: "None", secure: true
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });

  sendResponse(res, 200, "success", "Signin successful", {
    user: {
      id: user._id, username: user.username, email: user.email, role: user.role,
      avatar: user.avatar, provider: user.provider,
    },
    accessToken,
  });
});

const setPassword = asyncErrorHandler(async (req, res, next) => {
  const userId = req.user.id;
  const { newPassword } = req.body;

  if (!newPassword || newPassword.length < 8) return next(new ApiError("Password must be at least 8 characters"));

  const user = await User.findById(userId).select("+password");
  if (!user) return next(new ApiError("User not found"));

  const hash = await bcrypt.hash(newPassword, 10);
  user.password = hash;
  await user.save();

  sendResponse(res, 200, "success", "Password set successfully", {});
});

module.exports = {
  signup,
  signin,
  verifyEmail,
  resendVerification,
  callback,
  setPassword,

};

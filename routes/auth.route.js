const express = require("express");
const { body } = require("express-validator");

const {
  signup,
  signin,
  verifyEmail,
  callback,
  forgetPassword,
  resetPassword,
} = require("../controllers/auth.controller");
const { emailValidator } = require("../middlewares/validators");

const router = express.Router();

router.post(
  "/signup", emailValidator,signup
);
router.post("/signin",  emailValidator, signin);
router.post("/callback", callback);
router.post("/verify-email", verifyEmail);

router.post("/forget-password", emailValidator, forgetPassword);
router.post("/reset-password", resetPassword);

module.exports = router;

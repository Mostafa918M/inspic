const auth = require("../middlewares/authMiddleware");
const express = require("express");
const { upload } = require("../config/multer");
const {
  createPin,
  getPins,
  updatePin,
  deletePin,
} = require("../controllers/pin.controller");



const router = express.Router();

router.post("/create-pin", auth(), upload.single("media"), createPin);
router.get("/get-pins", auth(), getPins);
router.put("/update-pin/:id", auth(), updatePin);
router.delete("/delete-pin/:id", auth(), deletePin);


module.exports = router;

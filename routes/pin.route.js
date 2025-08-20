const auth = require("../middlewares/authMiddleware");
const express = require("express");
const { upload } = require("../config/multer");
const {
  createPin,
  getPins,
  updatePin,
  deletePin,
  likedPins,
  unlikePin,
  getComments,
  addComment,
  addReplay,
  deleteComment,
  getRecommendedPins,
  reportPin
  
} = require("../controllers/pin.controller");

const { getMedia,downloadMedia } = require("../controllers/media.controller");


const router = express.Router();

router.post("/create-pin", auth(), upload.single("media"), createPin);
router.get("/get-pins", auth(), getPins);
router.get("/recommendations", auth(), getRecommendedPins);

router.post('/liked-pins/:id', auth(), likedPins);
router.post('/unlike-pin/:id', auth(), unlikePin);

router.post('/:id/comment/', auth(), addComment);
router.post('/comment/:commentId/replies', auth(), addReplay);
router.get("/:id/comments/", auth(), getComments);
router.delete("/comment/:commentId", auth(), deleteComment);

router.put("/update-pin/:id", auth(), updatePin);
router.delete("/delete-pin/:id", auth(), deletePin);
router.get("/:id/media", auth(), getMedia);
router.get("/:id/download", auth(), downloadMedia);

router.post("/:id/report", auth(), reportPin);

module.exports = router;

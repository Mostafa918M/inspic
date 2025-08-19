//modules
const aqp= require('api-query-params');
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
//utils
const asyncErrorHandler = require("../utils/asyncErrorHandler");
const apiError = require("../utils/apiError");
const logger = require("../utils/logger");
const sendResponse = require("../utils/sendResponse");
const { ensureDir, userBucketDir, bucketFor, moveIfNeeded, buildMediaUri, toPosix } = require("../utils/mediaUtils");
//models
const Pin = require("../models/pin.model");
const User = require("../models/users.model");
const Interaction = require("../models/interaction.model");
const Board = require("../models/board.model");
//services
const { updateInterestsFromAction } = require("../services/interestService");
const { recommendPinsForUser } = require('../services/recommendationService');



const allowedImage = ["image/jpeg", "image/png"];
const allowedVideo = ["video/mp4", "video/mpeg", "video/quicktime"];
const isAllowed = (mt) => allowedImage.includes(mt) || allowedVideo.includes(mt);
// ---------- controller ----------
const createPin = asyncErrorHandler(async (req, res, next) => {
  const { title, description, link, keywords,privacy } = req.body;
  if(!title || !description) {
    return next(new apiError("Title and description are required", 400));
  }
  if (!req.file) return next(new apiError("Media file is required", 400));
  if (req.file.size > (req.file.sizeLimit || Infinity)) {
    return next(new apiError("File exceeds allowed size", 400));
  }
   if (!isAllowed(req.file.mimetype)) {
    try { if (req.file.path) await fsp.unlink(req.file.path); } catch {}
    return next(new apiError("Unsupported file type", 415));
  }

    const userId = req.user.id;
    const visibility = privacy ?? "public";
    const { vis, type } = bucketFor(visibility, req.file.mimetype);

    const finalDirAbs = path.resolve(userBucketDir(userId, vis, type));
    const safeFilename = path.basename(req.file.filename);
    const fromAbs = path.resolve(req.file.path);
    const storedAbs = await moveIfNeeded(fromAbs, finalDirAbs, safeFilename);


      const uri = buildMediaUri({
      userId,
      vis,
      type,
      filename: safeFilename
    });

    const pin = new Pin({
    publisher: userId,
    title,
    description,
    privacy: vis,
    media: {
      uri,
      URL: "",                                         
      filename: safeFilename,
      type: req.file.mimetype.startsWith("image/") ? "image" : "video",
      thumbnail: null,
    },
    link: link || null,
    keywords: Array.isArray(keywords) ? keywords : (keywords ? [keywords] : []),

  });
  pin.media.URL = `/api/v1/pins/get-pin/${pin._id}/media`
  await pin.save();


    await User.findByIdAndUpdate(userId,{ $push: { pins:pin._id  } })
    return sendResponse(res, 201, "success", "Pin created", { pin });

});
const getPins = asyncErrorHandler(async (req, res, next) => {
 const userId = String(req.user.id);


  const { filter, sort, skip = 0, limit = 20, projection } = aqp(req.query, {
    sort: { whitelist: ["createdAt", "updatedAt", "downloadCount", "pinReportCount", "title"] }
  });


  const mongoFilter = { ...filter, publisher: userId };

  
  if (mongoFilter["media.type"]) {
    const t = String(mongoFilter["media.type"]).toLowerCase();
    if (t === "images") mongoFilter["media.type"] = "image";
    if (t === "videos") mongoFilter["media.type"] = "video";
  }

  
  const kwRaw = (req.query.kw || req.query.keywords || "").toString();
  if (kwRaw) {
    const kws = kwRaw.split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
    const mode = String(req.query.kwMode || "any").toLowerCase();
    if (kws.length) mongoFilter.keywords = mode === "all" ? { $all: kws } : { $in: kws };
  }

  
  if (req.query.q) {
    mongoFilter.$text = { $search: String(req.query.q), $caseSensitive: false, $diacriticSensitive: false };
  }

  
  let cursor = Pin.find(mongoFilter);
  if (projection) cursor = cursor.select(projection);

  if (mongoFilter.$text) {
    cursor = cursor
      .select({ score: { $meta: "textScore" }, ...(projection || {}) })
      .sort({ score: { $meta: "textScore" } });
  } else if (sort) {
    cursor = cursor.sort(sort);
  }

  const hardLimit = Math.min(100, Math.max(1, +limit || 20));
  cursor = cursor.skip(+skip || 0).limit(hardLimit);

  const [pins, total] = await Promise.all([cursor.lean(), Pin.countDocuments(mongoFilter)]);


  const normalized = pins.map(p => ({
    ...p,
    media: { ...p.media, URL: p.media?.URL || `/api/v1/pins/get-pin/${p._id}/media` }
  }));

  return sendResponse(res, 200, "success", "Pins fetched", {
    pins: normalized,
    total,
    limit: hardLimit,
    skip: +skip || 0,
  });

})
const updatePin = asyncErrorHandler(async (req, res, next) => {
const pin = await Pin.findById(req.params.id);
  if (!pin) return next(new apiError("Pin not found", 404));

  // Defensive: ObjectId vs string                              // <<<
  if (String(pin.publisher) !== String(req.user.id)) {
    return next(new apiError("Forbidden", 403));
  }

  const updates = {};
  if (req.body.title) updates.title = req.body.title;
  if (req.body.description) updates.description = req.body.description;

  // Handle visibility/privacy change
  if (req.body.visibility || req.body.privacy) {
    const newVisRaw = req.body.visibility ?? req.body.privacy ?? "public";
    const newVis = newVisRaw.toLowerCase() === "private" ? "private" : "public";

    if (newVis !== pin.privacy) {
      const userId = req.user.id;
      const type = pin.media?.type === "image" ? "images" : "videos";

      // Prefer stored filename; fallback to deriving from uri/path             // <<<
      const filename =
        pin.media?.filename ||
        (pin.media?.path ? path.basename(pin.media.path) : null) ||
        (pin.media?.uri ? path.basename(pin.media.uri) : null);

      if (!filename) {
        return next(new apiError("Existing media filename is missing", 500));
      }

      const newDir = userBucketDir(userId, newVis, type);
      const fromAbs = pin.media?.path
        ? path.resolve(pin.media.path)
        : path.resolve(userBucketDir(userId, pin.privacy || "public", type), filename); // fallback

      const newAbs = await moveIfNeeded(fromAbs, path.resolve(newDir), filename);

      updates.privacy = newVis;
      updates["media.path"] = toPosix(newAbs);
      updates["media.uri"] = buildMediaUri({ userId, vis: newVis, type, filename }); // <<<
      updates["media.filename"] = filename;                                          // <<<
    }
  }

  Object.assign(pin, updates);
  await pin.save();
  return sendResponse(res, 200, "success", "Pin updated", { pin });
});
const deletePin = asyncErrorHandler(async (req, res, next) => {
   const pin = await Pin.findById(req.params.id);
  if (!pin) return next(new apiError("Pin not found", 404));

  if (String(pin.publisher) !== String(req.user.id)) {
    return next(new apiError("Forbidden", 403));
  }

  const typeDir = pin.media?.type === "image" ? "images" : "videos";
  const filename = pin.media?.filename;
  if (!filename) return next(new apiError("Media filename missing", 500));

  
  const candidates = [
    path.resolve(userBucketDir(pin.publisher, "public",  typeDir), filename),
    path.resolve(userBucketDir(pin.publisher, "private", typeDir), filename),
  ];

  for (const p of candidates) {
    try { await fsp.unlink(p); } catch (e) { if (e?.code !== "ENOENT") logger?.error?.(e); }
  }

  await Promise.all([
    Pin.deleteOne({ _id: pin._id }),
    User.findByIdAndUpdate(pin.publisher, { $pull: { pins: pin._id } }),
  ]);

  return sendResponse(res, 200, "success", "Pin deleted", { id: pin._id });
})

const likedPins = asyncErrorHandler(async(req,res,next)=>{
const userId = req.user.id;
  const pin = await Pin.findById(req.params.pinId);

  if (!pin) return next(new apiError("Pin not found", 404));
  if (String(pin.publisher) === String(userId)) {
    return next(new apiError("You cannot like your own pin", 403));
  }
  if (pin.likers.includes(userId)) {
    return next(new apiError("You have already liked this pin", 400));
  }
  pin.likers.push(userId);
  await pin.save();

  await User.findByIdAndUpdate(userId, { $push: { likedPins: pin._id } });

  await Interaction.create({
    user: userId,
    pin: pin._id,
    action: "LIKE",
    keywords: pin.keywords || []
  });
  await updateInterestsFromAction(userId, pin, "LIKE");
  sendResponse(res, 200, "success", "Pin liked", { pin });
})

const getRecommendedPins = asyncErrorHandler(async (req, res, next) => {
 const userId = req.user.id;
  const limit = Math.min(Math.max(parseInt(req.query.limit || "30", 10), 1), 100);

  let pins = await recommendPinsForUser(userId, { limit });

  if (!pins.length) {
    return sendResponse(res, 200, "success", "No recommendations found", { pins: [] }); //get popular pins later
  }

  // populate works on lean docs too
  pins = await Pin.populate(pins, [
    { path: "publisher", select: "username avatar" },
    { path: "board", select: "name" }, 
  ]);


  pins = pins.map(p => ({
    ...p,
    likeCount: Array.isArray(p.likers) ? p.likers.length : 0,
    commentCount: Array.isArray(p.comments) ? p.comments.length : 0,
  }));

  return sendResponse(res, 200, "success", "Recommended pins fetched", { pins });
})

module.exports = {
  createPin,
  getPins,
  updatePin,
  deletePin,
  likedPins,
  getRecommendedPins
}
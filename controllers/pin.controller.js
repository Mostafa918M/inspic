
const asyncErrorHandler = require("../utils/asyncErrorHandler");
const apiError = require("../utils/apiError");
const logger = require("../utils/logger");
const Pin = require("../models/pin.model");
const User = require("../models/users.model");
const sendResponse = require("../utils/sendResponse");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;


// ---------- helpers ----------
function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function userBucketDir(userId, vis, type) {
  return path.join("uploads", "users", String(userId), "pins", vis, type);
}

function bucketFor(visibility, mimetype) {
  const visKey = (visibility || "").toString().toLowerCase();
  const vis = visKey === "private" ? "private" : "public"; 
  const type = mimetype?.startsWith("image/") ? "images" : "videos";
  return { vis, type };
}

async function moveIfNeeded(fromAbsPath, toDirAbs, filename) {
  ensureDir(toDirAbs);
  const toAbs = path.join(toDirAbs, filename);
  if (path.resolve(fromAbsPath) !== path.resolve(toAbs)) {
    await fsp.rename(fromAbsPath, toAbs);
  }
  return toAbs;
}
function toPosix(p) { return p.split(path.sep).join("/"); }

function buildMediaUri({ userId, vis, type, filename }) {    
  
  return toPosix(`/api/v1/media/users/${userId}/pins/${vis}/${type}/${filename}`);
}                                                             

// ---------- controller ----------
const createPin = asyncErrorHandler(async (req, res, next) => {
  const { title, description, link, keywords } = req.body;
  if(!title || !description) {
    return next(new apiError("Title and description are required", 400));
  }
  if (!req.file) return next(new apiError("Media file is required", 400));
  if (req.file.size > (req.file.sizeLimit || Infinity)) {
    return next(new apiError("File exceeds allowed size", 400));
  }

    const userId = req.user.id;
    const visibility = req.body.visibility ?? req.body.privacy ?? "public";
    const { vis, type } = bucketFor(visibility, req.file.mimetype);

    const finalDir = userBucketDir(userId, vis, type);


      const uri = buildMediaUri({
      userId,
      vis,
      type,
      filename: req.file.filename
    });

    const pin = await Pin.create({
      owner: userId,
      title: title,
      description: description,
      privacy: vis,
      media: {
       uri: uri,                                    
    type: req.file.mimetype.startsWith("image/")  
      ? "image"
      : "video",
    thumbnail: null,           
      },
        link: link || null,
        keywords: keywords || [],
        board: req.body.board || null,
        publisher: userId,
        likers: [],
        comments: [],
        downloadCount: 0,
        pinReportCount: 0,
    });
    await User.findByIdAndUpdate(userId,{ $push: { pins:pin._id  } })
    return sendResponse(res, 201, "success", "Pin created", { pin });

});
const getPins = asyncErrorHandler(async (req, res, next) => {})
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
const deletePin = asyncErrorHandler(async (req, res, next) => {})

module.exports = {
  createPin,
  getPins,
  updatePin,
  deletePin,
}
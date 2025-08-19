const ApiError = require("../utils/apiError");
const asyncErrorHandler = require("../utils/asyncErrorHandler");
const Pin = require("../models/pin.model");
const { toPosix } = require("../utils/mediaUtils");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;

const UPLOADS_ROOT = path.resolve("uploads");

// const getMedia = asyncErrorHandler(async (req, res, next) => {
//     const { userId, vis, type, filename } = req.params;

//     if (!["public", "private"].includes(vis)) return next(new apiError("Not found", 404));
//     if (!["images", "videos"].includes(type)) return next(new apiError("Not found", 404));

//     const safeFilename = path.basename(filename);

//     const base = path.join(UPLOADS_ROOT, "users", userId, "pins", vis, type);
//     const abs = path.join(base, safeFilename);
//     const inside = path.resolve(abs).startsWith(path.resolve(base) + path.sep);
//     if (!inside) return next(new ApiError("Bad path", 400));

//     if (vis === "public") {
//       return res.redirect(
//         302,
//         toPosix(`/media/users/${userId}/pins/public/${type}/${safeFilename}`)
//       );
//     }

//     if (!req.user) return next(new ApiError("Unauthorized", 401));

//     const pin = await Pin.findOne({
//       owner: userId,
//       "media.filename": safeFilename,
//       "media.type": type === "images" ? "image" : "video",
//       privacy: "private",
//     });
//     if (!pin) return next(new ApiError("Not found", 404));
//     if (req.user.id !== pin.owner) {
//       return next(new ApiError("Forbidden", 403));
//     }

//     try {
//       await fsp.access(abs, fs.constants.R_OK);
//       res.setHeader("Cache-Control", "private, no-store");
//       return res.sendFile(path.resolve(abs));
//     } catch {
//       return next(new ApiError("Not found", 404));
//     }
//   })

const getMedia = asyncErrorHandler(async (req, res, next) => {
    const pin = await Pin.findById(req.params.id);
    if (!pin) return next(new ApiError("Pin not found", 404));

    const ownerId = String(pin.owner || pin.publisher);
    const fileTypeDir = pin.media.type === "image" ? "images" : "videos";
    const filename = pin.media.filename;
    if (!filename) return next(new ApiError("Media filename missing", 500));

    const base = path.join(UPLOADS_ROOT, "users", ownerId, "pins", pin.privacy, fileTypeDir);
    const abs  = path.join(base, filename);

    if (pin.privacy === "public") {
      // 302 → static
      return res.redirect(302, `/media/users/${ownerId}/pins/public/${fileTypeDir}/${filename}`);
    }

    // private: auth + ownership
    if (!req.user) return next(new ApiError("Unauthorized", 401));
    if (String(req.user.id) !== ownerId && !req.user.isAdmin) return next(new ApiError("Forbidden", 403));

    await fsp.access(abs, fs.constants.R_OK);
    if (pin.media?.mimetype) res.type(pin.media.mimetype);
    res.setHeader("Cache-Control", "private, no-store");
    return res.sendFile(path.resolve(abs));
});

  module.exports = {

 getMedia
  };
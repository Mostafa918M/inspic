// services/recommendationService.js
const {Interest} = require("../models/interests.model");
const Pin = require("../models/pin.model");
const mongoose = require("mongoose");

async function recommendPinsForUser(userId, { limit = 30 } = {}) {

  const top = await Interest.find({ user: userId })
    .sort({ score: -1 })
    .limit(10)
    .select("normKey keyword score")
    .lean();

  const keys = top.map(t => t.keyword);
  if (!keys.length) {

    return Pin.find({ privacy: "public", publisher: { $ne: userId } })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }


  return Pin.find({
      privacy: "public",
      publisher: { $ne: new mongoose.Types.ObjectId(userId) },
      keywords: { $in: keys }
    })
    .sort({ createdAt: -1 }) 
    .limit(limit)
    .lean();
}

module.exports = { recommendPinsForUser };

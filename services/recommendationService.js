// services/recommendationService.js
const {Interest} = require("../models/interests.model");
const Pin = require("../models/pin.model");
const mongoose = require("mongoose");
const User = require('../models/users.model')

async function recommendPinsForUser(userId, { limit = 30 } = {}) {

  const top = await Interest.find({ user: userId })
    .sort({ score: -1 })
    .limit(10)
    .select("keyword")
    .lean();

  const interestKeys = top.map(t => t.keyword);


  const user = await User.findById(userId).select("savedSearches").lean();
  const savedKeys = (user?.savedSearches || []).filter(Boolean);


  const keys = Array.from(new Set([...interestKeys, ...savedKeys]));

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

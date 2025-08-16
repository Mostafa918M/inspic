  const mongoose = require('mongoose');


  const userSchema = new mongoose.Schema({
    username: { type: String, required: true },
    email: { type: String, required: true, unique: true },
      password: {
      type: String,
      required: function () { return this.provider === "local"; }, 
      select: false, 
    },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    googleId: { type: String, index: true },
    provider: { type: String, enum: ['local','google'], default: 'local' },
    avatar: { type: String, default: 'https://www.gravatar.com/avatar/?d=mp' },

    isEmailVerified: { type: Boolean, default: false },
    
    emailVerificationCodeHash: { type: String, default: null },
    emailVerificationExpiresAt: { type: Date, default: null },
    emailVerificationAttempts: { type: Number, default: 0 },
    emailVerificationLastSentAt: { type: Date, default: null },
  },{timestamps: true});
  module.exports =  mongoose.model('User', userSchema);
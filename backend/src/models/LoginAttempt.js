import mongoose from "mongoose";

const loginAttemptSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    index: true, // For faster queries by username
  },
  email: {
    type: String,
    index: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  success: {
    type: Boolean,
    required: true,
    default: false,
  },
  ipAddress: {
    type: String,
  },
  userAgent: {
    type: String,
  },
  xiboUserId: {
    type: String,
  },
  errorMessage: {
    type: String,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true, // For faster queries by date
  },
});

// Create indexes for common queries
loginAttemptSchema.index({ username: 1, timestamp: -1 });
loginAttemptSchema.index({ timestamp: -1 });

export default mongoose.model("LoginAttempt", loginAttemptSchema);

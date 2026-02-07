const mongoose = require('mongoose');

const personalMessageSchema = mongoose.Schema(
  {
    roomId: {
      type: String,
      required: true,
      index: true, // For faster queries
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      trim: true,
    },
    messageType: {
      type: String,
      enum: ['text', 'voice', 'image', 'video'],
      default: 'text',
    },
    mediaUrl: {
      type: String, // URL for voice/image/video files
    },
    mediaDuration: {
      type: Number, // Duration in seconds for voice/video
    },
    read: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date, // When the message was read
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    // Auto-Delete Privacy Settings
    deleteMode: {
      type: String,
      enum: ['never', 'after_view', 'after_24h'],
      default: 'never',
    },
    expiresAt: {
      type: Date, // For TTL-based deletion (24h mode)
    },
  },
  {
    timestamps: true,
  }
);

// TTL Index for 24-hour auto-delete
personalMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const PersonalMessage = mongoose.model('PersonalMessage', personalMessageSchema);

module.exports = PersonalMessage;

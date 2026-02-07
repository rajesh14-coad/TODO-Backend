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
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const PersonalMessage = mongoose.model('PersonalMessage', personalMessageSchema);

module.exports = PersonalMessage;

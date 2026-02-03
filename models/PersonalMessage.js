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
      required: true,
      trim: true,
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

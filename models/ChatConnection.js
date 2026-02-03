const mongoose = require('mongoose');

const chatConnectionSchema = mongoose.Schema(
  {
    requesterId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'rejected'],
      default: 'pending',
    },
    roomId: {
      type: String,
      required: true,
      unique: true,
    },
  },
  {
    timestamps: true,
  }
);

// Index for faster queries
chatConnectionSchema.index({ requesterId: 1, receiverId: 1 });
chatConnectionSchema.index({ roomId: 1 });
chatConnectionSchema.index({ status: 1 });

const ChatConnection = mongoose.model('ChatConnection', chatConnectionSchema);

module.exports = ChatConnection;

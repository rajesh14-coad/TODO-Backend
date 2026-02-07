const mongoose = require('mongoose');

const chatSettingsSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    defaultDeleteMode: {
      type: String,
      enum: ['never', 'after_view', 'after_24h'],
      default: 'never',
    },
    // Per-chat settings (optional, overrides default)
    chatSpecificSettings: [
      {
        roomId: String,
        deleteMode: {
          type: String,
          enum: ['never', 'after_view', 'after_24h'],
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const ChatSettings = mongoose.model('ChatSettings', chatSettingsSchema);

module.exports = ChatSettings;

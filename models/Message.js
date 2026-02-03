const mongoose = require('mongoose');

const messageSchema = mongoose.Schema(
  {
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    text: {
      type: String,
      required: true,
      trim: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
    linkedTaskId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Task', // Note: This refers to embedded shared tasks, but since they don't have a standalone model, we store the ID. Ideally, we might store teamId + taskId.
      // Or if 'Task' model exists (server.js has taskRoutes -> Task model?), let's check. 
      // User has taskModel.js. But Team shared tasks are embedded in Team model. 
      // Just storing the String ID or ObjectId is fine for now. 
      // User prompt: "linkedTaskId add karo jo kisi specific task se connect ho sake"
      required: false
    }
  },
  {
    timestamps: true,
  }
);

const Message = mongoose.model('Message', messageSchema);

module.exports = Message;

const mongoose = require('mongoose');

const taskSchema = mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      ref: 'User',
    },
    title: {
      type: String,
      required: true,
    },
    description: {
      type: String,
      default: '',
    },
    completed: {
      type: Boolean,
      default: false,
    },
    category: {
      type: String,
      default: 'personal',
    },
    priority: {
      type: String,
      enum: ['low', 'normal', 'medium', 'high'],
      default: 'normal',
    },
    dueDate: {
      type: Date,
    },
    dueTime: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

const Task = mongoose.model('Task', taskSchema);

module.exports = Task;

const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  date: {
    type: Date,
    default: Date.now
  },
  duration: {
    type: Number, // in seconds
    required: true
  }
});

const goalSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: [true, 'Please add a goal name'],
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  totalTime: {
    type: Number, // in hours
    required: [true, 'Please add total time goal']
  },
  timeSpent: {
    type: Number, // in seconds
    default: 0
  },
  status: {
    type: String,
    enum: ['not_started', 'in_progress', 'completed'],
    default: 'not_started'
  },
  sessions: [sessionSchema]
}, {
  timestamps: true
});

module.exports = mongoose.model('Goal', goalSchema);

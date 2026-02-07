const mongoose = require('mongoose');

const sharedTaskSchema = mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    default: '',
  },
  category: {
    type: String,
    default: 'General',
  },
  dueDate: {
    type: Date,
  },
  assignedTo: {
    type: String,
  },
  completed: {
    type: Boolean,
    default: false,
  },
  completedBy: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const teamSchema = mongoose.Schema(
  {
    groupName: {
      type: String,
      required: true,
    },
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
    },
    hostId: {
      type: String,
      required: true,
    },
    members: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    sharedTasks: [sharedTaskSchema],
  },
  {
    timestamps: true,
  }
);

// Virtual field for real-time member count
teamSchema.virtual('realTimeMemberCount').get(function () {
  return this.members ? this.members.length : 0;
});

// Virtual field for real-time task count
teamSchema.virtual('realTimeTaskCount').get(function () {
  return this.sharedTasks ? this.sharedTasks.length : 0;
});

// Ensure virtuals are included in JSON
teamSchema.set('toJSON', { virtuals: true });
teamSchema.set('toObject', { virtuals: true });

// Compound index: Ensure one admin cannot create multiple teams with the same name
teamSchema.index({ groupName: 1, hostId: 1 }, { unique: true });

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;

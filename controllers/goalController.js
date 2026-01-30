const asyncHandler = require('express-async-handler');
const Goal = require('../models/Goal');

// @desc    Get all goals
// @route   GET /api/goals
// @access  Private
const getGoals = asyncHandler(async (req, res) => {
  const goals = await Goal.find({ user: req.user._id }).sort({ createdAt: -1 });
  res.json(goals);
});

// @desc    Create new goal
// @route   POST /api/goals
// @access  Private
const createGoal = asyncHandler(async (req, res) => {
  const { name, description, totalTime } = req.body;

  if (!name || !totalTime) {
    res.status(400);
    throw new Error('Please provide goal name and total time');
  }

  const goal = await Goal.create({
    user: req.user._id,
    name,
    description,
    totalTime,
    timeSpent: 0,
    status: 'not_started',
    sessions: []
  });

  res.status(201).json(goal);
});

// @desc    Update goal
// @route   PUT /api/goals/:id
// @access  Private
const updateGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findById(req.params.id);

  if (!goal) {
    res.status(404);
    throw new Error('Goal not found');
  }

  // Check user authorization
  if (goal.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  const updatedGoal = await Goal.findByIdAndUpdate(
    req.params.id,
    req.body,
    { new: true, runValidators: true }
  );

  res.json(updatedGoal);
});

// @desc    Delete goal
// @route   DELETE /api/goals/:id
// @access  Private
const deleteGoal = asyncHandler(async (req, res) => {
  const goal = await Goal.findById(req.params.id);

  if (!goal) {
    res.status(404);
    throw new Error('Goal not found');
  }

  // Check user authorization
  if (goal.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  await goal.deleteOne();
  res.json({ success: true, message: 'Goal deleted' });
});

// @desc    Add session to goal
// @route   POST /api/goals/:id/sessions
// @access  Private
const addSession = asyncHandler(async (req, res) => {
  const { duration } = req.body;

  if (!duration) {
    res.status(400);
    throw new Error('Please provide session duration');
  }

  const goal = await Goal.findById(req.params.id);

  if (!goal) {
    res.status(404);
    throw new Error('Goal not found');
  }

  // Check user authorization
  if (goal.user.toString() !== req.user._id.toString()) {
    res.status(401);
    throw new Error('Not authorized');
  }

  // Add session
  goal.sessions.push({
    date: new Date(),
    duration
  });

  // Update time spent
  goal.timeSpent += duration;

  // Update status
  const totalGoalSeconds = goal.totalTime * 3600;
  if (goal.timeSpent >= totalGoalSeconds) {
    goal.status = 'completed';
  } else if (goal.status === 'not_started') {
    goal.status = 'in_progress';
  }

  await goal.save();
  res.json(goal);
});

module.exports = {
  getGoals,
  createGoal,
  updateGoal,
  deleteGoal,
  addSession
};

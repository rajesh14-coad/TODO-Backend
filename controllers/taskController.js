const asyncHandler = require('express-async-handler');
const Task = require('../models/taskModel');

const getTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ user: req.user.id });
  res.json(tasks);
});

const createTask = asyncHandler(async (req, res) => {
  const { title, description } = req.body;

  if (!title || !description) {
    res.status(400);
    throw new Error('Please add a title and description');
  }

  const task = new Task({
    user: req.user.id,
    title,
    description,
  });

  const createdTask = await task.save();
  res.status(201).json(createdTask);
});

const getTaskById = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (task && task.user.toString() === req.user.id.toString()) {
    res.json(task);
  } else {
    res.status(404);
    throw new Error('Task not found');
  }
});

const updateTask = asyncHandler(async (req, res) => {
  const { title, description, isCompleted } = req.body;

  const task = await Task.findById(req.params.id);

  if (task && task.user.toString() === req.user.id.toString()) {
    task.title = title || task.title;
    task.description = description || task.description;
    task.isCompleted = isCompleted === undefined ? task.isCompleted : isCompleted;

    const updatedTask = await task.save();
    res.json(updatedTask);
  } else {
    res.status(404);
    throw new Error('Task not found');
  }
});

const deleteTask = asyncHandler(async (req, res) => {
  const task = await Task.findById(req.params.id);

  if (task && task.user.toString() === req.user.id.toString()) {
    await task.remove();
    res.json({ message: 'Task removed' });
  } else {
    res.status(404);
    throw new Error('Task not found');
  }
});

module.exports = {
  getTasks,
  createTask,
  getTaskById,
  updateTask,
  deleteTask,
};

const asyncHandler = require('express-async-handler');
const Task = require('../models/taskModel');

const getTasks = asyncHandler(async (req, res) => {
  const tasks = await Task.find({ user: req.user.id });
  res.json(tasks);
});

const createTask = asyncHandler(async (req, res) => {
  const { title, description, category, priority, dueDate, dueTime, completed } = req.body;

  if (!title) {
    res.status(400);
    throw new Error('Please add a title');
  }

  const task = new Task({
    user: req.user.id,
    title,
    description: description || '',
    category: category || 'personal',
    priority: priority || 'normal',
    dueDate: dueDate || null,
    dueTime: dueTime || null,
    completed: completed || false,
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
  const { title, description, completed, category, priority, dueDate, dueTime } = req.body;

  const task = await Task.findById(req.params.id);

  if (task && task.user.toString() === req.user.id.toString()) {
    task.title = title || task.title;
    task.description = description !== undefined ? description : task.description;
    task.completed = completed !== undefined ? completed : task.completed;
    task.category = category || task.category;
    task.priority = priority || task.priority;
    task.dueDate = dueDate !== undefined ? dueDate : task.dueDate;
    task.dueTime = dueTime !== undefined ? dueTime : task.dueTime;

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
    await task.deleteOne();
    res.json({ message: 'Task removed', success: true });
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

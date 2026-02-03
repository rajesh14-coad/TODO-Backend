const express = require('express');
const router = express.Router();
const {
  createTeam,
  getUserTeams,
  getTeamById,
  joinTeam,
  deleteTeam,
  removeMember,
  addSharedTask,
  updateSharedTask,
  deleteSharedTask,
  transferOwnership,
  createTestTeam,
} = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');

// Team routes
router.route('/').post(protect, createTeam);
router.route('/user/:userId').get(protect, getUserTeams);
router.route('/join').post(protect, joinTeam);
router.route('/:teamId').get(protect, getTeamById);
router.route('/:teamId').delete(protect, deleteTeam);
router.route('/:teamId/remove/:memberId').post(protect, removeMember);
router.route('/:teamId/transfer-admin').post(protect, transferOwnership);

// Dev/Test Route
router.route('/dev/seed').post(createTestTeam);

// Task routes
router.route('/:teamId/tasks').post(protect, addSharedTask);
router.route('/:teamId/tasks/:taskId').put(protect, updateSharedTask);
router.route('/:teamId/tasks/:taskId').delete(protect, deleteSharedTask);

module.exports = router;

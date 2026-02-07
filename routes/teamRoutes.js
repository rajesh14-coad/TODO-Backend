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
  getTeamMessages,
  convertMessageToTask,
  renameTeam,
  addMember
} = require('../controllers/teamController');
const { protect } = require('../middleware/authMiddleware');

// Team routes
router.route('/').post(protect, createTeam).get(protect, getUserTeams);
router.route('/user/:userId').get(protect, getUserTeams);
router.route('/join').post(protect, joinTeam);
router.route('/:teamId')
  .get(protect, getTeamById)
  .put(protect, renameTeam)
  .delete(protect, deleteTeam);
router.route('/:teamId/remove/:memberId').post(protect, removeMember);
router.route('/:teamId/add-member').post(protect, addMember);
router.route('/:teamId/transfer-admin').post(protect, transferOwnership);
router.route('/:teamId/messages').get(protect, getTeamMessages);
router.route('/:teamId/convert-msg-to-task').post(protect, convertMessageToTask);

// Dev/Test Route
// Dev/Test Route - DISABLED for Production Integrity
// router.route('/dev/seed').post(createTestTeam);

// Task routes
router.route('/:teamId/tasks').post(protect, addSharedTask);
router.route('/:teamId/tasks/:taskId').put(protect, updateSharedTask);
router.route('/:teamId/tasks/:taskId').delete(protect, deleteSharedTask);

module.exports = router;

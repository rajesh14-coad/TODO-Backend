const express = require('express');
const {
  searchUsers,
  sendChatRequest,
  respondToChatRequest,
  cancelChatRequest,
  getPendingRequests,
  blockUser,
  unblockUser,
  getBlockedUsers,
  getRecentChats,
  getPersonalMessages,
  markMessageAsRead,
  updateChatSettings,
  getChatSettings,
} = require('../controllers/chatController');
const { protect } = require('../middleware/authMiddleware');

const router = express.Router();

// Search users
router.get('/search', protect, searchUsers);

// Send chat request
router.post('/request/send', protect, sendChatRequest);

// Respond to chat request (accept/reject)
router.post('/request/respond', protect, respondToChatRequest);

// Cancel chat request
router.post('/request/cancel', protect, cancelChatRequest);

// Get pending requests
router.get('/requests', protect, getPendingRequests);

// Block/Unblock user
router.post('/block', protect, blockUser);
router.post('/unblock', protect, unblockUser);

// Get blocked users
router.get('/blocked', protect, getBlockedUsers);

// Get recent chats
router.get('/recent', protect, getRecentChats);

// ========== NEW: MESSAGE PERSISTENCE & AUTO-DELETE ==========

// Get message history for a room
router.get('/messages/:roomId', protect, getPersonalMessages);

// Mark message as read (triggers auto-delete if needed)
router.post('/messages/read', protect, markMessageAsRead);

// Get/Update chat settings
router.get('/settings', protect, getChatSettings);
router.post('/settings', protect, updateChatSettings);

module.exports = router;

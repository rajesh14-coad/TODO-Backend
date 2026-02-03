const express = require('express');
const router = express.Router();
const {
  registerUser,
  authUser,
  loginAsGuest,
  googleLogin,
  updateUserProfile,
  checkUsernameAvailability,
  getUserProfile,
  searchUsers,
  getPersonalMessages,
  getRecentChats,
  getPendingRequests,
  sendChatRequest,
  respondToChatRequest
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(registerUser);
router.post('/login', authUser);
router.post('/guest', loginAsGuest);
router.post('/google', googleLogin);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.get('/check-username/:username', checkUsernameAvailability);
router.get('/search', protect, searchUsers);
router.get('/personal-messages/:roomId', protect, getPersonalMessages);
router.get('/recent-chats', protect, getRecentChats);

// Chat Request APIs
router.get('/chat/requests', protect, getPendingRequests);
router.post('/chat/request/send', protect, sendChatRequest);
router.post('/chat/request/respond', protect, respondToChatRequest);

module.exports = router;

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
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');

router.route('/').post(registerUser);
router.post('/login', authUser);
router.post('/guest', loginAsGuest);
router.post('/google', googleLogin);
router.route('/profile').get(protect, getUserProfile).put(protect, updateUserProfile);
router.get('/check-username/:username', checkUsernameAvailability);

module.exports = router;

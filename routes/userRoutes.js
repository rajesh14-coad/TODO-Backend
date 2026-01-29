const express = require('express');
const router = express.Router();
const {
  registerUser,
  authUser,
  loginAsGuest,
  googleLogin,
} = require('../controllers/userController');

router.route('/').post(registerUser);
router.post('/login', authUser);
router.post('/guest', loginAsGuest);
router.post('/google', googleLogin);

module.exports = router;

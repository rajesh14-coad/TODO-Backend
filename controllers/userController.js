const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;

  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  const user = await User.create({
    name,
    email,
    password,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid email or password');
  }
});

const loginAsGuest = asyncHandler(async (req, res) => {
  const guestNumber = Math.floor(1000 + Math.random() * 9000);
  const user = await User.create({
    name: `Guest ${guestNumber}`,
    email: `guest_${Date.now()}@example.com`,
    isGuest: true,
  });

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      isGuest: user.isGuest,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

const googleLogin = asyncHandler(async (req, res) => {
  const { name, email, googleId, profilePicture } = req.body;

  let user = await User.findOne({ email });

  if (user) {
    user.googleId = googleId;
    user.profilePicture = profilePicture;
    await user.save();
  } else {
    user = await User.create({
      name,
      email,
      googleId,
      profilePicture,
    });
  }

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      profilePicture: user.profilePicture,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

module.exports = { registerUser, authUser, loginAsGuest, googleLogin };

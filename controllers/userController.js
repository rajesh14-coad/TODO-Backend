const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const generateToken = require('../utils/generateToken');

const registerUser = asyncHandler(async (req, res) => {
  const { name, email, password, username, mobile } = req.body;

  // Check if username is provided
  if (!username) {
    res.status(400);
    throw new Error('Username is required');
  }

  // ✅ Mobile Number Validation
  if (!mobile) {
    res.status(400);
    throw new Error('Mobile number is required');
  }

  // Check if mobile is exactly 10 digits
  if (!/^[0-9]{10}$/.test(mobile)) {
    res.status(400);
    throw new Error('Mobile number must be exactly 10 digits');
  }

  // Check for fake mobile numbers
  const fakePatterns = [
    /^0{10}$/, // 0000000000
    /^1{10}$/, // 1111111111
    /^1234567890$/, // Sequential
    /^0987654321$/, // Reverse sequential
    /^(\d)\1{9}$/, // All same digits
  ];

  if (fakePatterns.some(pattern => pattern.test(mobile))) {
    res.status(400);
    throw new Error('Please enter a valid mobile number');
  }

  // Check if user already exists by email
  const userExists = await User.findOne({ email });

  if (userExists) {
    res.status(400);
    throw new Error('User already exists');
  }

  // Check if username already exists
  const usernameExists = await User.findOne({ username: username.toLowerCase() });

  if (usernameExists) {
    res.status(400);
    throw new Error('Username already taken');
  }

  // Check if mobile already exists
  const mobileExists = await User.findOne({ mobile });

  if (mobileExists) {
    res.status(400);
    throw new Error('Mobile number already registered');
  }

  const user = await User.create({
    name,
    username,
    email,
    mobile,
    password,
  });

  if (user) {
    res.status(201).json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      mobile: user.mobile,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

const authUser = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  // Find user by email OR username
  const user = await User.findOne({
    $or: [
      { email: email },
      { username: email.toLowerCase() }
    ]
  });

  if (user && (await user.matchPassword(password))) {
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      token: generateToken(user._id),
    });
  } else {
    res.status(401);
    throw new Error('Invalid email/username or password');
  }
});

const loginAsGuest = asyncHandler(async (req, res) => {
  const guestNumber = Math.floor(1000 + Math.random() * 9000);
  const timestamp = Date.now();
  const user = await User.create({
    name: `Guest ${guestNumber}`,
    username: `guest_${timestamp}`,
    email: `guest_${timestamp}@example.com`,
    isGuest: true,
  });

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
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
    // Generate username from email (part before @)
    const baseUsername = email.split('@')[0].toLowerCase();
    let username = baseUsername;
    let counter = 1;

    // Check if username exists, if yes, append number
    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    user = await User.create({
      name,
      username,
      email,
      googleId,
      profilePicture,
    });
  }

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      token: generateToken(user._id),
    });
  } else {
    res.status(400);
    throw new Error('Invalid user data');
  }
});

const updateUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    const { name, username, profilePicture } = req.body;

    // Update name if provided
    if (name) {
      user.name = name;
    }

    // Update profile picture if provided
    if (profilePicture) {
      user.profilePicture = profilePicture;
    }

    // Handle username change with 30-day restriction
    if (username && username !== user.username) {
      // Check if username already exists
      const usernameExists = await User.findOne({
        username: username.toLowerCase(),
        _id: { $ne: user._id } // Exclude current user
      });

      if (usernameExists) {
        res.status(400);
        throw new Error('Username already taken');
      }

      // Check 30-day restriction
      if (user.lastUsernameChange) {
        const daysSinceLastChange = Math.floor(
          (Date.now() - new Date(user.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastChange < 30) {
          const daysRemaining = 30 - daysSinceLastChange;
          res.status(400);
          throw new Error(`You can change your username again in ${daysRemaining} days`);
        }
      }

      // Update username and timestamp
      user.username = username;
      user.lastUsernameChange = Date.now();
    }

    const updatedUser = await user.save();

    res.json({
      _id: updatedUser._id,
      name: updatedUser.name,
      username: updatedUser.username,
      email: updatedUser.email,
      profilePicture: updatedUser.profilePicture,
      lastUsernameChange: updatedUser.lastUsernameChange,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

// @desc    Check username availability
// @route   GET /api/users/check-username/:username
// @access  Public
const checkUsernameAvailability = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username || username.length < 3) {
    res.status(400);
    throw new Error('Username must be at least 3 characters');
  }

  const usernameExists = await User.findOne({
    username: username.toLowerCase()
  });

  res.json({
    available: !usernameExists,
    username: username.toLowerCase(),
  });
});

// @desc    Get user profile
// @route   GET /api/users/profile
// @access  Private
const getUserProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  if (user) {
    res.json({
      _id: user._id,
      name: user.name,
      username: user.username,
      email: user.email,
      profilePicture: user.profilePicture,
      lastUsernameChange: user.lastUsernameChange,
      createdAt: user.createdAt,
    });
  } else {
    res.status(404);
    throw new Error('User not found');
  }
});

module.exports = {
  registerUser,
  authUser,
  loginAsGuest,
  googleLogin,
  updateUserProfile,
  checkUsernameAvailability,
  getUserProfile,
};

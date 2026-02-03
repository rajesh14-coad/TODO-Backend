const asyncHandler = require('express-async-handler');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/userModel');
const PersonalMessage = require('../models/PersonalMessage');
const generateToken = require('../utils/generateToken');

// Initialize Google Client
// NOTE: Make sure GOOGLE_CLIENT_ID is added to your .env file
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

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
  const { idToken } = req.body;

  if (!idToken) {
    return res.status(400).json({ message: 'Google Token ID is required' });
  }

  let ticket;
  try {
    ticket = await client.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
  } catch (error) {
    return res.status(401).json({ message: 'Invalid Google Token' });
  }

  const { name, email, picture: profilePicture, sub: googleId } = ticket.getPayload();

  let user = await User.findOne({ email });

  if (user) {
    // Update existing user with Google ID if not present
    if (!user.googleId) {
      user.googleId = googleId;
    }
    // Update profile picture if user doesn't have one or purely to sync
    // user.profilePicture = profilePicture; 
    await user.save();
  } else {
    // Create new user
    // Generate username: email prefix + random number to ensure uniqueness
    const baseUsername = email.split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
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
      isGuest: false
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

// @desc    Search users by username
// @route   GET /api/users/search?username=...
// @access  Private
const searchUsers = asyncHandler(async (req, res) => {
  const ChatConnection = require('../models/ChatConnection');

  const keyword = req.query.username
    ? {
      username: {
        $regex: req.query.username,
        // STRICT: Case-insensitive regex match
        $options: 'i',
      },
    }
    : {};

  // Use lean() to get plain objects we can modify
  const users = await User.find({ ...keyword, _id: { $ne: req.user._id } })
    .select('name username profilePicture isGuest')
    .lean();

  // Attach Connection Status
  const usersWithStatus = await Promise.all(users.map(async (user) => {
    const connection = await ChatConnection.findOne({
      $or: [
        { requesterId: req.user._id, receiverId: user._id },
        { requesterId: user._id, receiverId: req.user._id }
      ]
    });

    let status = 'none';
    if (connection) {
      if (connection.status === 'accepted') {
        status = 'accepted';
      } else if (connection.status === 'pending') {
        // Check who sent it
        status = connection.requesterId.toString() === req.user._id.toString()
          ? 'requested' // I sent it
          : 'pending';  // I received it
      } else {
        status = connection.status; // rejected
      }
    }

    return { ...user, requestStatus: status };
  }));

  res.json(usersWithStatus);
});

// @desc    Get personal messages
// @route   GET /api/users/personal-messages/:roomId
// @access  Private
const getPersonalMessages = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id;

  // Check if connection is accepted
  const ChatConnection = require('../models/ChatConnection');
  const connection = await ChatConnection.findOne({ roomId });

  if (!connection) {
    res.status(403);
    throw new Error('No chat connection exists. Send a request first.');
  }

  if (connection.status !== 'accepted') {
    res.status(403);
    throw new Error(`Chat request is ${connection.status}. Cannot view messages.`);
  }

  // Verify user is part of this chat
  const isParticipant =
    connection.requesterId.toString() === userId.toString() ||
    connection.receiverId.toString() === userId.toString();

  if (!isParticipant) {
    res.status(403);
    throw new Error('Not authorized to view these messages');
  }

  const messages = await PersonalMessage.find({ roomId })
    .sort({ timestamp: 1 })
    .populate('sender', 'name username profilePicture')
    .populate('receiver', 'name username profilePicture');

  res.json(messages);
});

// @desc    Get recent chats (inbox)
// @route   GET /api/users/recent-chats
// @access  Private
const getRecentChats = asyncHandler(async (req, res) => {
  // Find all personal messages where user is sender OR receiver
  // Then group by the other person's ID to find unique conversations
  const userId = req.user._id;

  const messages = await PersonalMessage.find({
    $or: [{ sender: userId }, { receiver: userId }]
  })
    .sort({ timestamp: -1 })
    .populate('sender', 'name username profilePicture')
    .populate('receiver', 'name username profilePicture');

  const chatsMap = new Map();

  messages.forEach(msg => {
    const isSender = msg.sender._id.toString() === userId.toString();
    const otherUser = isSender ? msg.receiver : msg.sender;
    const otherUserId = otherUser._id.toString();

    if (!chatsMap.has(otherUserId)) {
      chatsMap.set(otherUserId, {
        user: otherUser,
        lastMessage: msg
      });
    }
  });

  const recentChats = Array.from(chatsMap.values());
  res.json(recentChats);
});

// @desc    Get pending chat requests
// @route   GET /api/users/chat/requests
// @access  Private
const getPendingRequests = asyncHandler(async (req, res) => {
  const ChatConnection = require('../models/ChatConnection');

  const requests = await ChatConnection.find({
    receiverId: req.user._id,
    status: 'pending'
  }).populate('requesterId', 'name username profilePicture');

  res.json(requests);
});

// @desc    Send chat request
// @route   POST /api/users/chat/request/send
// @access  Private
const sendChatRequest = asyncHandler(async (req, res) => {
  const { receiverId } = req.body;
  const requesterId = req.user._id;

  if (!receiverId) {
    res.status(400);
    throw new Error('Receiver ID is required');
  }

  // Check if receiver exists
  const receiver = await User.findById(receiverId);
  if (!receiver) {
    res.status(404);
    throw new Error('User not found');
  }

  // Prevent self-request
  if (requesterId.toString() === receiverId) {
    res.status(400);
    throw new Error('Cannot send request to yourself');
  }

  // Generate roomId (consistent for both users)
  const ChatConnection = require('../models/ChatConnection');
  const sortedIds = [requesterId.toString(), receiverId].sort();
  const roomId = `${sortedIds[0]}_${sortedIds[1]}`;

  // Check if connection already exists
  const existingConnection = await ChatConnection.findOne({
    roomId
  });

  if (existingConnection) {
    if (existingConnection.status === 'accepted') {
      res.status(400);
      throw new Error('Chat connection already exists');
    } else if (existingConnection.status === 'pending') {
      res.status(400);
      throw new Error('Request already pending');
    } else if (existingConnection.status === 'rejected') {
      // Allow re-requesting after rejection
      existingConnection.status = 'pending';
      existingConnection.requesterId = requesterId;
      existingConnection.receiverId = receiverId;
      await existingConnection.save();

      return res.status(200).json({
        message: 'Chat request sent',
        connection: existingConnection
      });
    }
  }

  // Create new connection request
  const connection = await ChatConnection.create({
    requesterId,
    receiverId,
    status: 'pending',
    roomId
  });

  res.status(201).json({
    message: 'Chat request sent successfully',
    connection
  });
});

// @desc    Respond to chat request (accept/reject)
// @route   POST /api/users/chat/respond
// @access  Private
const respondToChatRequest = asyncHandler(async (req, res) => {
  const { connectionId, action } = req.body; // action: 'accept' or 'reject'
  const userId = req.user._id;

  if (!connectionId || !action) {
    res.status(400);
    throw new Error('Connection ID and action are required');
  }

  if (!['accept', 'reject'].includes(action)) {
    res.status(400);
    throw new Error('Invalid action. Use "accept" or "reject"');
  }

  const ChatConnection = require('../models/ChatConnection');
  const connection = await ChatConnection.findById(connectionId);

  if (!connection) {
    res.status(404);
    throw new Error('Connection request not found');
  }

  // Verify user is the receiver
  if (connection.receiverId.toString() !== userId.toString()) {
    res.status(403);
    throw new Error('Not authorized to respond to this request');
  }

  // Check if already responded
  if (connection.status !== 'pending') {
    res.status(400);
    throw new Error(`Request already ${connection.status}`);
  }

  // Update status
  connection.status = action === 'accept' ? 'accepted' : 'rejected';
  await connection.save();

  res.json({
    message: `Chat request ${action}ed successfully`,
    connection
  });
});


module.exports = {
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
};

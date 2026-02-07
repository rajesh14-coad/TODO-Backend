const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');
const PersonalMessage = require('../models/PersonalMessage');
const ChatSettings = require('../models/ChatSettings');

// @desc    Search users by username
// @route   GET /api/chat/search
// @access  Private
const searchUsers = asyncHandler(async (req, res) => {
  const { username } = req.query;
  const currentUserId = req.user._id;

  if (!username) return res.status(400).json({ message: 'Username required' });

  const currentUser = await User.findById(currentUserId);
  const users = await User.find({
    username: { $regex: username, $options: 'i' },
    _id: { $ne: currentUserId }
  }).select('username name profilePicture isOnline');

  const usersWithStatus = users.map(user => {
    let status = 'none';
    if (currentUser.friends.includes(user._id)) status = 'friends';
    else if (currentUser.pendingSentRequests.includes(user._id)) status = 'pending_sent';
    else if (currentUser.pendingReceivedRequests.includes(user._id)) status = 'pending_received';

    return { ...user.toObject(), connectionStatus: status };
  });

  res.json(usersWithStatus);
});

// @desc    Send chat request
// @route   POST /api/chat/request/send
// @access  Private
const sendChatRequest = asyncHandler(async (req, res) => {
  const { receiverId } = req.body; // Can be recipientId or receiverId. Keeping receiverId to match old frontend
  const senderId = req.user._id;

  if (senderId.toString() === receiverId) {
    res.status(400); throw new Error('Cannot add self');
  }

  const sender = await User.findById(senderId);
  const receiver = await User.findById(receiverId);

  if (!receiver) {
    res.status(404); throw new Error('User not found');
  }

  if (sender.friends.includes(receiverId)) {
    res.status(400); throw new Error('Already friends');
  }
  if (sender.pendingSentRequests.includes(receiverId)) {
    res.status(400); throw new Error('Request already sent');
  }
  if (sender.pendingReceivedRequests.includes(receiverId)) {
    res.status(400); throw new Error('User already sent you a request');
  }

  sender.pendingSentRequests.push(receiverId);
  receiver.pendingReceivedRequests.push(senderId);

  await sender.save();
  await receiver.save();

  // Socket Notification
  const io = req.app.get('io');
  if (io) {
    io.to(receiverId).emit('new_request', {
      _id: sender._id,
      username: sender.username,
      name: sender.name,
      profilePicture: sender.profilePicture
    });
  }

  res.json({ message: 'Request sent' });
});

// @desc    Respond to chat request (accept/reject)
// @route   POST /api/chat/request/respond
// @access  Private
const respondToChatRequest = asyncHandler(async (req, res) => {
  const { connectionId, action } = req.body; // connectionId is now treated as TARGET USER ID
  const userId = req.user._id;
  const targetUserId = connectionId;

  const currentUser = await User.findById(userId);
  const targetUser = await User.findById(targetUserId);

  if (!targetUser) { res.status(404); throw new Error('User not found'); }

  if (action === 'accept') {
    // Add to friends
    if (!currentUser.friends.includes(targetUserId)) currentUser.friends.push(targetUserId);
    if (!targetUser.friends.includes(userId)) targetUser.friends.push(userId);

    // Remove from pending
    currentUser.pendingReceivedRequests = currentUser.pendingReceivedRequests.filter(id => id.toString() !== targetUserId);
    targetUser.pendingSentRequests = targetUser.pendingSentRequests.filter(id => id.toString() !== userId.toString());

    await currentUser.save();
    await targetUser.save();

    // Socket Notification
    const io = req.app.get('io');
    if (io) {
      io.to(targetUserId).emit('request_accepted', {
        _id: currentUser._id,
        username: currentUser.username,
        name: currentUser.name
      });
    }
  } else if (action === 'reject') {
    currentUser.pendingReceivedRequests = currentUser.pendingReceivedRequests.filter(id => id.toString() !== targetUserId);
    targetUser.pendingSentRequests = targetUser.pendingSentRequests.filter(id => id.toString() !== userId.toString());

    await currentUser.save();
    await targetUser.save();
  }

  res.json({ message: `Request ${action}ed` });
});

// @desc    Cancel chat request
// @route   POST /api/chat/request/cancel
// @access  Private
const cancelChatRequest = asyncHandler(async (req, res) => {
  const { connectionId } = req.body; // targetUserId
  const userId = req.user._id;
  const targetUserId = connectionId;

  const currentUser = await User.findById(userId);
  const targetUser = await User.findById(targetUserId);

  currentUser.pendingSentRequests = currentUser.pendingSentRequests.filter(id => id.toString() !== targetUserId);
  targetUser.pendingReceivedRequests = targetUser.pendingReceivedRequests.filter(id => id.toString() !== userId.toString());

  await currentUser.save();
  await targetUser.save();
  res.json({ message: 'Cancelled' });
});

// @desc    Get pending requests
// @route   GET /api/chat/requests
// @access  Private
const getPendingRequests = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await User.findById(userId)
    .populate('pendingSentRequests', 'username name profilePicture')
    .populate('pendingReceivedRequests', 'username name profilePicture');

  res.json({
    sent: user.pendingSentRequests || [],
    received: user.pendingReceivedRequests || []
  });
});

// @desc    Get recent chats (friends list)
// @route   GET /api/chat/recent
// @access  Private
const getRecentChats = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).populate('friends', 'username name profilePicture isOnline');
  res.json(user.friends || []);
});

// ========== NEW: MESSAGE PERSISTENCE & AUTO-DELETE ==========

// @desc    Get personal message history
// @route   GET /api/chat/messages/:roomId
// @access  Private
const getPersonalMessages = asyncHandler(async (req, res) => {
  const { roomId } = req.params;
  const userId = req.user._id;

  // Verify user is part of this room
  const [user1Id, user2Id] = roomId.split('_').sort();
  if (userId.toString() !== user1Id && userId.toString() !== user2Id) {
    res.status(403);
    throw new Error('Unauthorized access to this chat');
  }

  // Fetch last 50 messages
  const messages = await PersonalMessage.find({ roomId })
    .sort({ timestamp: -1 })
    .limit(50)
    .populate('sender', 'username profilePicture')
    .populate('receiver', 'username profilePicture');

  // Reverse to show oldest first
  res.json(messages.reverse());
});

// @desc    Mark message as read (triggers auto-delete if mode is 'after_view')
// @route   POST /api/chat/messages/read
// @access  Private
const markMessageAsRead = asyncHandler(async (req, res) => {
  const { messageId } = req.body;
  const userId = req.user._id;

  const message = await PersonalMessage.findById(messageId);

  if (!message) {
    res.status(404);
    throw new Error('Message not found');
  }

  // Only receiver can mark as read
  if (message.receiver.toString() !== userId.toString()) {
    res.status(403);
    throw new Error('Unauthorized');
  }

  message.read = true;
  message.readAt = new Date();

  // Auto-delete if mode is 'after_view'
  if (message.deleteMode === 'after_view') {
    await PersonalMessage.findByIdAndDelete(messageId);
    res.json({ message: 'Message read and deleted', deleted: true });
  } else {
    await message.save();
    res.json({ message: 'Message marked as read', deleted: false });
  }
});

// @desc    Update chat settings (default or per-chat)
// @route   POST /api/chat/settings
// @access  Private
const updateChatSettings = asyncHandler(async (req, res) => {
  const { defaultDeleteMode, roomId, deleteMode } = req.body;
  const userId = req.user._id;

  let settings = await ChatSettings.findOne({ userId });

  if (!settings) {
    settings = new ChatSettings({ userId });
  }

  // Update default mode
  if (defaultDeleteMode) {
    settings.defaultDeleteMode = defaultDeleteMode;
  }

  // Update per-chat mode
  if (roomId && deleteMode) {
    const existingIndex = settings.chatSpecificSettings.findIndex(
      (s) => s.roomId === roomId
    );

    if (existingIndex !== -1) {
      settings.chatSpecificSettings[existingIndex].deleteMode = deleteMode;
    } else {
      settings.chatSpecificSettings.push({ roomId, deleteMode });
    }
  }

  await settings.save();
  res.json(settings);
});

// @desc    Get chat settings
// @route   GET /api/chat/settings
// @access  Private
const getChatSettings = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  let settings = await ChatSettings.findOne({ userId });

  if (!settings) {
    settings = new ChatSettings({ userId });
    await settings.save();
  }

  res.json(settings);
});

const blockUser = asyncHandler(async (req, res) => res.json({}));
const unblockUser = asyncHandler(async (req, res) => res.json({}));
const getBlockedUsers = asyncHandler(async (req, res) => res.json([]));

module.exports = {
  searchUsers,
  sendChatRequest,
  respondToChatRequest,
  getPendingRequests,
  getRecentChats,
  blockUser,
  unblockUser,
  getBlockedUsers,
  cancelChatRequest,
  // New exports
  getPersonalMessages,
  markMessageAsRead,
  updateChatSettings,
  getChatSettings,
};

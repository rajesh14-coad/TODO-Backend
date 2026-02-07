const asyncHandler = require('express-async-handler');
const User = require('../models/userModel');

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
  cancelChatRequest
};

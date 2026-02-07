const asyncHandler = require('express-async-handler');
const Team = require('../models/Team');
const User = require('../models/userModel');
const Message = require('../models/Message');

// Generate unique 6-character code
const generateTeamCode = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// @desc    Create new team
// @route   POST /api/teams
// @access  Private
const createTeam = asyncHandler(async (req, res) => {
  const { groupName } = req.body;
  const hostId = req.user._id; // Securely get hostId from authenticated user

  if (!groupName) {
    res.status(400);
    throw new Error('Group name is required');
  }

  // Check if admin already has a team with this name (Case Insensitive)
  const existingTeam = await Team.findOne({
    groupName: { $regex: new RegExp(`^${groupName.trim()}$`, 'i') },
    hostId: hostId
  });

  if (existingTeam) {
    res.status(400);
    throw new Error('You already have a team with this name. Please try a different name.');
  }

  // Generate unique code
  let code = generateTeamCode();
  let codeExists = await Team.findOne({ code });

  while (codeExists) {
    code = generateTeamCode();
    codeExists = await Team.findOne({ code });
  }

  // Create new team explicitly
  const team = new Team({
    groupName: groupName.trim(),
    code,
    hostId,
    members: [hostId],
    sharedTasks: [],
  });

  const savedTeam = await team.save();

  if (savedTeam) {
    res.status(201).json({
      _id: savedTeam._id,
      groupName: savedTeam.groupName,
      code: savedTeam.code,
      hostId: savedTeam.hostId,
      members: savedTeam.members,
      sharedTasks: savedTeam.sharedTasks,
      realTimeMemberCount: savedTeam.realTimeMemberCount,
      realTimeTaskCount: savedTeam.realTimeTaskCount,
    });
  } else {
    res.status(400);
    throw new Error('Invalid team data - Failed to save');
  }
});

// @desc    Get user's teams with real-time stats
// @route   GET /api/teams or GET /api/teams/user/:userId
// @access  Private
const getUserTeams = asyncHandler(async (req, res) => {
  // STRICT PRIVACY: Only allow user to view their own teams.
  const userId = req.user._id;

  const teams = await Team.find({ members: userId })
    .populate('members', 'username name profilePicture');

  // Return teams with real-time counts
  const teamsWithStats = teams.map(team => ({
    _id: team._id,
    groupName: team.groupName,
    code: team.code,
    hostId: team.hostId,
    members: team.members,
    sharedTasks: team.sharedTasks,
    realTimeMemberCount: team.realTimeMemberCount,
    realTimeTaskCount: team.realTimeTaskCount,
    createdAt: team.createdAt,
    updatedAt: team.updatedAt,
  }));

  res.json(teamsWithStats);
});

// @desc    Get team by ID
// @route   GET /api/teams/:teamId
// @access  Private
const getTeamById = asyncHandler(async (req, res) => {
  const team = await Team.findById(req.params.teamId)
    .populate('members', 'username name profilePicture email');

  if (team) {
    // STRICT PRIVACY: Only members can view team details
    const isMember = team.members.some(member =>
      member._id.toString() === req.user._id.toString()
    );

    if (!isMember) {
      res.status(403);
      throw new Error('Not authorized to view this team');
    }

    res.json({
      _id: team._id,
      groupName: team.groupName,
      code: team.code,
      hostId: team.hostId,
      members: team.members,
      sharedTasks: team.sharedTasks,
      realTimeMemberCount: team.realTimeMemberCount,
      realTimeTaskCount: team.realTimeTaskCount,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
    });
  } else {
    res.status(404);
    throw new Error('Team not found');
  }
});

// @desc    Join team with code
// @route   POST /api/teams/join
// @access  Private
const joinTeam = asyncHandler(async (req, res) => {
  const { code } = req.body;
  const userId = req.user._id; // Get from authenticated user

  if (!code) {
    res.status(400);
    throw new Error('Code is required');
  }

  const team = await Team.findOne({ code: code.toUpperCase() })
    .populate('members', 'username name profilePicture');

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if already a member - use ObjectId comparison
  const isMember = team.members.some(member =>
    member._id.toString() === userId.toString()
  );

  if (isMember) {
    res.status(400);
    throw new Error('Already a member of this team');
  }

  team.members.push(userId);
  await team.save();

  // Populate the newly added member
  const updatedTeam = await Team.findById(team._id)
    .populate('members', 'username name profilePicture');

  res.json({
    _id: updatedTeam._id,
    groupName: updatedTeam.groupName,
    code: updatedTeam.code,
    hostId: updatedTeam.hostId,
    members: updatedTeam.members,
    sharedTasks: updatedTeam.sharedTasks,
    realTimeMemberCount: updatedTeam.realTimeMemberCount,
    realTimeTaskCount: updatedTeam.realTimeTaskCount,
  });
});

// @desc    Delete team (Admin only)
// @route   DELETE /api/teams/:teamId
// @access  Private
const deleteTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const userId = req.user._id; // Get from authenticated user

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // ADMIN ONLY: Check if user is the team creator (admin)
  if (team.hostId.toString() !== userId.toString()) {
    res.status(403);
    throw new Error('Only the team admin can delete the team');
  }

  await Team.findByIdAndDelete(teamId);

  res.json({
    success: true,
    message: 'Team and all tasks deleted successfully'
  });
});

// @desc    Remove member from team (Admin only)
// @route   POST /api/teams/:teamId/remove/:memberId
// @access  Private
const removeMember = asyncHandler(async (req, res) => {
  const { teamId, memberId } = req.params;
  const userId = req.user._id.toString(); // Get from authenticated user

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if user is admin
  if (team.hostId.toString() !== userId) {
    res.status(403);
    throw new Error('Only admin can remove members');
  }

  // Cannot remove admin
  if (memberId === team.hostId.toString()) {
    res.status(400);
    throw new Error('Cannot remove team admin');
  }

  // Check if member exists
  const memberExists = team.members.some(m => m.toString() === memberId);
  if (!memberExists) {
    res.status(404);
    throw new Error('Member not found in team');
  }

  // Remove member
  team.members = team.members.filter(id => id.toString() !== memberId);
  await team.save();

  res.json({
    _id: team._id,
    groupName: team.groupName,
    members: team.members,
    realTimeMemberCount: team.realTimeMemberCount,
    message: 'Member removed successfully',
  });
});

// @desc    Add shared task
// @route   POST /api/teams/:teamId/tasks
// @access  Private
const addSharedTask = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const taskData = req.body;

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  team.sharedTasks.push(taskData);
  await team.save();

  res.status(201).json({
    _id: team._id,
    sharedTasks: team.sharedTasks,
    realTimeTaskCount: team.realTimeTaskCount,
  });
});

// @desc    Update shared task
// @route   PUT /api/teams/:teamId/tasks/:taskId
// @access  Private
const updateSharedTask = asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;
  const taskData = req.body;

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  const task = team.sharedTasks.id(taskId);

  if (!task) {
    res.status(404);
    throw new Error('Task not found');
  }

  // Update task fields
  Object.keys(taskData).forEach(key => {
    task[key] = taskData[key];
  });

  await team.save();

  res.json({
    _id: team._id,
    sharedTasks: team.sharedTasks,
    realTimeTaskCount: team.realTimeTaskCount,
  });
});

// @desc    Delete shared task
// @route   DELETE /api/teams/:teamId/tasks/:taskId
// @access  Private
const deleteSharedTask = asyncHandler(async (req, res) => {
  const { teamId, taskId } = req.params;

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  team.sharedTasks = team.sharedTasks.filter(
    task => task._id.toString() !== taskId
  );

  await team.save();

  res.json({
    _id: team._id,
    sharedTasks: team.sharedTasks,
    realTimeTaskCount: team.realTimeTaskCount,
    message: 'Task deleted successfully',
  });
});

// @desc    Transfer team ownership (Admin only)
// @route   POST /api/teams/:teamId/transfer-admin
// @access  Private
const transferOwnership = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { newAdminId } = req.body;
  const currentAdminId = req.user._id.toString();

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if current user is admin
  if (team.hostId !== currentAdminId) {
    res.status(403);
    throw new Error('Only current admin can transfer ownership');
  }

  // Check if new admin is a member
  if (!team.members.some(member => member.toString() === newAdminId)) {
    res.status(400);
    throw new Error('New admin must be a member of the team');
  }

  team.hostId = newAdminId;
  await team.save();

  res.json({
    message: 'Team ownership transferred successfully',
    team: {
      _id: team._id,
      groupName: team.groupName,
      hostId: team.hostId
    }
  });
});

// @desc    Create Test Data (Dev only)
// @route   POST /api/teams/dev/seed
// @access  Public
const createTestTeam = asyncHandler(async (req, res) => {
  const testGroupName = "Test Squad";

  // 1. Create Dummy Users if not exist
  const dummyUsersData = [
    { name: "Alex Developer", username: "alex_dev", email: "alex@test.com", password: "password123" },
    { name: "Sam Pro", username: "sam_pro", email: "sam@test.com", password: "password123" },
    { name: "Rita design", username: "rita_99", email: "rita@test.com", password: "password123" },
    { name: "John Doe", username: "johndoe", email: "john@test.com", password: "password123" },
    { name: "Jane Smith", username: "janesmith", email: "jane@test.com", password: "password123" }
  ];

  const dummyUserIds = [];

  for (const userData of dummyUsersData) {
    let user = await User.findOne({ email: userData.email });
    if (!user) {
      user = await User.create(userData);
    }
    dummyUserIds.push(user._id.toString());
  }

  const adminId = dummyUserIds[0]; // Alex is admin

  // 2. Create Team
  // Check if test team exists
  let team = await Team.findOne({ groupName: testGroupName, hostId: adminId });

  if (team) {
    // Reset members
    team.members = dummyUserIds;
    await team.save();
  } else {
    // Create new
    let code = generateTeamCode();
    team = await Team.create({
      groupName: testGroupName,
      code,
      hostId: adminId,
      members: dummyUserIds,
      sharedTasks: [
        { title: "Review Code", category: "Development", assignedTo: dummyUserIds[1] },
        { title: "Design Logo", category: "Design", assignedTo: dummyUserIds[2] }
      ]
    });
  }

  res.json({
    message: "Test Team Created Successfully",
    teamCode: team.code,
    adminUsername: "alex_dev",
    members: dummyUserIds.length
  });
});

// @desc    Get team messages
// @route   GET /api/teams/:teamId/messages
// @access  Private
const getTeamMessages = asyncHandler(async (req, res) => {
  const { teamId } = req.params;

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if member - use ObjectId comparison
  const isMember = team.members.some(memberId =>
    memberId.toString() === req.user._id.toString()
  );

  if (!isMember) {
    res.status(403);
    throw new Error('Not authorized to view messages');
  }

  const messages = await Message.find({ teamId })
    .populate('sender', 'username profilePicture')
    .sort({ timestamp: 1 });

  res.json(messages);
});

// @desc    Convert message to task
// @route   POST /api/teams/:teamId/convert-msg-to-task
// @access  Private
const convertMessageToTask = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { messageId, messageText } = req.body; // Can accept either ID or raw text

  const team = await Team.findById(teamId);
  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  let taskTitle = '';

  if (messageId) {
    const message = await Message.findById(messageId);
    if (!message) {
      res.status(404);
      throw new Error('Message not found');
    }
    taskTitle = message.text;
  } else if (messageText) {
    taskTitle = messageText;
  } else {
    res.status(400);
    throw new Error('Message content or ID is required');
  }

  // Basic logic to sanitize/extract title if needed
  // For now, accept the full text as title
  const newTask = {
    title: taskTitle.substring(0, 100), // Limit title length
    description: `Created from message: "${taskTitle}"`,
    category: 'General',
    assignedTo: null,
    completed: false,
    completedBy: null,
    createdAt: new Date()
  };

  team.sharedTasks.push(newTask);
  await team.save();

  // Get the newly created task (last one)
  const createdTask = team.sharedTasks[team.sharedTasks.length - 1];

  res.status(201).json({
    message: 'Task created from message',
    task: createdTask
  });
});


// @desc    Rename team
// @route   PUT /api/teams/:teamId
// @access  Private
const renameTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { groupName } = req.body;
  const userId = req.user._id;

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if admin
  if (team.hostId.toString() !== userId.toString()) {
    res.status(403);
    throw new Error('Only the team admin can rename the team');
  }

  if (groupName) {
    // Check for duplicates
    const existingTeam = await Team.findOne({
      groupName: { $regex: new RegExp(`^${groupName.trim()}$`, 'i') },
      hostId: userId,
      _id: { $ne: teamId }
    });

    if (existingTeam) {
      res.status(400);
      throw new Error('You already have a team with this name. Please try a different name.');
    }
    team.groupName = groupName.trim();
  }

  const updatedTeam = await team.save();
  res.json({
    _id: updatedTeam._id,
    groupName: updatedTeam.groupName,
    code: updatedTeam.code,
    hostId: updatedTeam.hostId,
    members: updatedTeam.members
  });
});

// @desc    Add member to team (Admin only)
// @route   POST /api/teams/:teamId/add-member
// @access  Private
const addMember = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { username } = req.body;
  const userId = req.user._id.toString();

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if admin
  if (team.hostId.toString() !== userId) {
    res.status(403);
    throw new Error('Only team admin can add members');
  }

  const userToAdd = await User.findOne({ username });
  if (!userToAdd) {
    res.status(404);
    throw new Error('User not found');
  }

  // Check if already member
  if (team.members.some(member => member.toString() === userToAdd._id.toString())) {
    res.status(400);
    throw new Error('User is already a member');
  }

  team.members.push(userToAdd._id);
  await team.save();

  const updatedTeam = await Team.findById(teamId)
    .populate('members', 'username name profilePicture');

  res.json({
    _id: updatedTeam._id,
    members: updatedTeam.members,
    realTimeMemberCount: updatedTeam.realTimeMemberCount,
    message: 'Member added successfully'
  });
});

module.exports = {
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
};

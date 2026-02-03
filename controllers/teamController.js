const asyncHandler = require('express-async-handler');
const Team = require('../models/Team');
const User = require('../models/userModel');

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
    throw new Error('Team with this name already exists');
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
// @route   GET /api/teams/user/:userId
// @access  Private
const getUserTeams = asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const teams = await Team.find({ members: userId });

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
  const team = await Team.findById(req.params.teamId);

  if (team) {
    // Fetch details for all members
    const membersDetails = await User.find({
      _id: { $in: team.members }
    }).select('name username email profilePicture');

    // Create a map for O(1) lookup
    const memberMap = {};
    membersDetails.forEach(member => {
      memberMap[member._id.toString()] = member;
    });

    // Map members array to include full details
    const membersWithDetails = team.members.map(memberId => {
      const details = memberMap[memberId.toString()];
      return details ? {
        _id: details._id,
        name: details.name,
        username: details.username,
        email: details.email,
        profilePicture: details.profilePicture
      } : { _id: memberId, name: 'Unknown User', username: 'unknown' };
    });

    res.json({
      _id: team._id,
      groupName: team.groupName,
      code: team.code,
      hostId: team.hostId,
      members: membersWithDetails,
      memberIds: team.members,
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
  const { code, userId } = req.body;

  if (!code || !userId) {
    res.status(400);
    throw new Error('Code and user ID are required');
  }

  const team = await Team.findOne({ code: code.toUpperCase() });

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if already a member
  if (team.members.includes(userId)) {
    res.status(400);
    throw new Error('Already a member of this team');
  }

  team.members.push(userId);
  await team.save();

  res.json({
    _id: team._id,
    groupName: team.groupName,
    code: team.code,
    hostId: team.hostId,
    members: team.members,
    sharedTasks: team.sharedTasks,
    realTimeMemberCount: team.realTimeMemberCount,
    realTimeTaskCount: team.realTimeTaskCount,
  });
});

// @desc    Delete team (Admin only)
// @route   DELETE /api/teams/:teamId
// @access  Private
const deleteTeam = asyncHandler(async (req, res) => {
  const { teamId } = req.params;
  const { userId } = req.body;

  if (!userId) {
    res.status(400);
    throw new Error('User ID is required');
  }

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if user is admin
  if (team.hostId !== userId) {
    res.status(403);
    throw new Error('Only admin can delete the team');
  }

  // Delete the team using deleteOne for better reliability
  const deleteResult = await Team.deleteOne({ _id: teamId });

  if (deleteResult.deletedCount === 0) {
    res.status(500);
    throw new Error('Failed to delete team');
  }

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
  const { userId } = req.body;

  const team = await Team.findById(teamId);

  if (!team) {
    res.status(404);
    throw new Error('Team not found');
  }

  // Check if user is admin
  if (team.hostId !== userId) {
    res.status(403);
    throw new Error('Only admin can remove members');
  }

  // Cannot remove admin
  if (memberId === team.hostId) {
    res.status(400);
    throw new Error('Cannot remove team admin');
  }

  // Check if member exists
  if (!team.members.includes(memberId)) {
    res.status(404);
    throw new Error('Member not found in team');
  }

  // Remove member
  team.members = team.members.filter(id => id !== memberId);
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
  if (!team.members.includes(newAdminId)) {
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
  const testGroupName = "Beta Testers";
  const testCode = "BETA12";

  // 1. Create Dummy Users if not exist
  const dummyUsersData = [
    { name: "Rohan Developer", username: "rohan_dev", email: "rohan@test.com", password: "password123" },
    { name: "Amit Pro", username: "amit_99", email: "amit@test.com", password: "password123" },
    { name: "Sara Tasker", username: "sara_tasker", email: "sara@test.com", password: "password123" }
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
  // Check if test team exists (by name)
  let team = await Team.findOne({ groupName: testGroupName });

  if (team) {
    // Reset members and update code
    team.hostId = adminId;
    team.members = dummyUserIds;
    team.code = testCode;
    await team.save();
  } else {
    // Create new
    let code = testCode;
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
    adminUsername: "rohan_dev",
    members: dummyUserIds.length
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
  createTestTeam
};

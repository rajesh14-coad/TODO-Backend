const mongoose = require('mongoose');
const dotenv = require('dotenv');
const colors = require('colors');
const User = require('../models/userModel');
const Team = require('../models/Team');

dotenv.config();

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log(`MongoDB Connected: ${conn.connection.host}`.cyan.underline);
  } catch (error) {
    console.error(`Error: ${error.message}`.red.underline.bold);
    process.exit(1);
  }
};

const seedData = async () => {
  await connectDB();

  try {
    console.log('🌱 Seeding Beta Testers Team...');

    // 1. Create Dummy Users
    const users = [
      { name: "Rohan Developer", username: "rohan_dev", email: "rohan@test.com", password: "password123" },
      { name: "Amit Pro", username: "amit_99", email: "amit@test.com", password: "password123" },
      { name: "Sara Tasker", username: "sara_tasker", email: "sara@test.com", password: "password123" }
    ];

    const userIds = [];

    for (const u of users) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create(u);
        console.log(`✅ Created user: ${u.username}`);
      } else {
        console.log(`ℹ️ User exists: ${u.username}`);
      }
      userIds.push(user._id);
    }

    const adminId = userIds[0];

    // 2. Create Team
    const teamCode = "TEST123";
    let team = await Team.findOne({ code: teamCode });

    if (team) {
      console.log('ℹ️ Team exists, updating members...');
      team.groupName = "Beta Testers";
      team.hostId = adminId;
      team.members = [...new Set([...team.members, ...userIds])];
      await team.save();
    } else {
      console.log('✅ Creating new Beta Testers team...');
      team = await Team.create({
        groupName: "Beta Testers",
        code: teamCode,
        hostId: adminId,
        members: userIds,
        sharedTasks: [
          { title: "Fix Login Bug", category: "Development", priority: "high", assignedTo: userIds[1], completed: false },
          { title: "Design Home Icon", category: "Design", priority: "medium", assignedTo: userIds[2], completed: false }
        ]
      });
    }

    console.log(`🎉 Beta Testers Team Ready! Code: ${team.code}`);
    process.exit();

  } catch (error) {
    console.error(`${error}`.red.inverse);
    process.exit(1);
  }
};

seedData();

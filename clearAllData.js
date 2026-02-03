require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('./models/Team');
const User = require('./models/userModel');
const Message = require('./models/Message');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

const clearAllData = async () => {
  try {
    await connectDB();
    console.log('🗑️  Starting Full Database Cleanup...');

    // 1. Delete all Teams
    const teamResult = await Team.deleteMany({});
    console.log(`✅ Deleted ${teamResult.deletedCount} teams`);

    // 2. Delete all Users (Except maybe admin if needed? Instructions say ALL dummy users)
    // Caution: This deletes ALL users including the current dev account.
    // The prompt says "delete all dummy users... fresh database".
    // I will delete ALL users assuming user wants a fresh start.
    const userResult = await User.deleteMany({});
    console.log(`✅ Deleted ${userResult.deletedCount} users`);

    // 3. Delete all Messages
    const msgResult = await Message.deleteMany({});
    console.log(`✅ Deleted ${msgResult.deletedCount} messages`);

    console.log('✨ Database is now fresh and empty!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing data:', error.message);
    process.exit(1);
  }
};

clearAllData();

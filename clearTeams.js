require('dotenv').config();
const mongoose = require('mongoose');
const Team = require('./models/Team');

// Connect to database
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
};

// Clear all teams (use with caution!)
const clearAllTeams = async () => {
  try {
    await connectDB();

    console.log('🗑️  Starting to clear all teams...');

    const result = await Team.deleteMany({});

    console.log(`✅ Successfully deleted ${result.deletedCount} teams`);
    console.log('✅ Database cleaned successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing teams:', error.message);
    process.exit(1);
  }
};

// Clear only test/junk teams (teams with specific patterns)
const clearJunkTeams = async () => {
  try {
    await connectDB();

    console.log('🗑️  Starting to clear junk/test teams...');

    // Delete teams with common test names
    const result = await Team.deleteMany({
      $or: [
        { groupName: /test/i },
        { groupName: /demo/i },
        { groupName: /sample/i },
        { groupName: /junk/i },
        { groupName: /temp/i },
      ]
    });

    console.log(`✅ Successfully deleted ${result.deletedCount} junk teams`);
    console.log('✅ Database cleaned successfully!');

    process.exit(0);
  } catch (error) {
    console.error('❌ Error clearing junk teams:', error.message);
    process.exit(1);
  }
};

// Run the appropriate function based on command line argument
const args = process.argv.slice(2);

if (args.includes('--all')) {
  console.log('⚠️  WARNING: This will delete ALL teams!');
  clearAllTeams();
} else if (args.includes('--junk')) {
  clearJunkTeams();
} else {
  console.log('Usage:');
  console.log('  node clearTeams.js --junk   (Clear test/demo teams only)');
  console.log('  node clearTeams.js --all    (Clear ALL teams - use with caution!)');
  process.exit(0);
}

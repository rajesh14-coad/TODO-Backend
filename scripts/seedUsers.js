require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/userModel');

const dummyUsers = [
  {
    username: 'amit_99',
    name: 'Amit Sharma',
    email: 'amit@test.com',
    password: 'password123',
    mobile: '9876543210'
  },
  {
    username: 'sara_tasker',
    name: 'Sara Khan',
    email: 'sara@test.com',
    password: 'password123',
    mobile: '9876543211'
  },
  {
    username: 'rohan_dev',
    name: 'Rohan Verma',
    email: 'rohan@test.com',
    password: 'password123',
    mobile: '9876543212'
  }
];

const seedUsers = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ MongoDB Connected');

    // Check and create users
    for (const userData of dummyUsers) {
      const existingUser = await User.findOne({
        $or: [
          { email: userData.email },
          { username: userData.username }
        ]
      });

      if (existingUser) {
        console.log(`⚠️  User ${userData.username} already exists, skipping...`);
      } else {
        const user = await User.create(userData);
        console.log(`✅ Created user: ${user.username} (${user.email})`);
      }
    }

    console.log('\n🎉 Seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding users:', error);
    process.exit(1);
  }
};

seedUsers();

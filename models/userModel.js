const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    mobile: {
      type: String,
      required: function () {
        // Mobile is required only for regular users, not for guests or Google users
        return !this.isGuest && !this.googleId;
      },
      unique: true,
      sparse: true, // Allows null values but enforces uniqueness when present
      validate: {
        validator: function (v) {
          // If mobile is provided, it must be exactly 10 digits
          if (!v) return true; // Allow null/undefined
          return /^[0-9]{10}$/.test(v);
        },
        message: 'Mobile number must be exactly 10 digits'
      }
    },
    password: {
      type: String,
    },
    googleId: {
      type: String,
    },
    profilePicture: {
      type: String,
    },
    isGuest: {
      type: Boolean,
      default: false,
    },
    lastUsernameChange: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) {
    return false;
  }
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.pre('save', async function () {
  // Skip password hashing if password doesn't exist or hasn't been modified
  if (!this.password || !this.isModified('password')) {
    return;
  }

  // Hash the password
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

const User = mongoose.model('User', userSchema);

module.exports = User;

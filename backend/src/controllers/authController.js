import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { authenticateUser, getUserInfo } from "../utils/xiboClient.js";
import LoginAttempt from "../models/LoginAttempt.js";

// Registration is not needed - users are managed in Xibo CMS
export const register = async (req, res) => {
  res.status(400).json({
    message:
      "User registration is not available. Please use your existing Xibo CMS credentials to login.",
    hint: "Users are managed in the Xibo CMS platform.",
  });
};

export const login = async (req, res) => {
  let loginAttemptData = {
    username: null,
    email: null,
    passwordHash: null,
    success: false,
    ipAddress:
      req.ip ||
      req.connection.remoteAddress ||
      req.headers["x-forwarded-for"] ||
      "unknown",
    userAgent: req.headers["user-agent"] || "unknown",
    xiboUserId: null,
    errorMessage: null,
  };

  try {
    // Check if req.body exists
    if (!req.body) {
      loginAttemptData.errorMessage = "Request body is missing";
      await saveLoginAttempt(loginAttemptData);
      return res.status(400).json({ message: "Request body is missing" });
    }

    // Support both 'email' and 'username' fields
    const { email, username, password } = req.body;
    const loginIdentifier = email || username;

    // Store login identifier
    loginAttemptData.username = loginIdentifier;
    loginAttemptData.email = email || null;

    // Hash password for storage (security best practice)
    loginAttemptData.passwordHash = await bcrypt.hash(password, 10);

    // Validate required fields
    if (!loginIdentifier || !password) {
      loginAttemptData.errorMessage =
        "Email/username and password are required";
      await saveLoginAttempt(loginAttemptData);
      return res.status(400).json({
        message: "Email/username and password are required",
        received: {
          email: !!email,
          username: !!username,
          password: !!password,
        },
      });
    }

    // Authenticate with Xibo API
    const authResult = await authenticateUser(loginIdentifier, password);

    if (!authResult.success) {
      loginAttemptData.success = false;
      loginAttemptData.errorMessage =
        authResult.message || "Invalid credentials";
      await saveLoginAttempt(loginAttemptData);
      return res.status(401).json({
        message: authResult.message || "Invalid credentials",
      });
    }

    // Get user info from authentication result
    let userInfo;
    if (authResult.user) {
      // Use user data from authentication result
      userInfo = {
        userId: authResult.user.userId || authResult.user.id,
        userName:
          authResult.user.userName || authResult.user.name || loginIdentifier,
        email: authResult.user.email || loginIdentifier,
      };
      loginAttemptData.xiboUserId = userInfo.userId || null;
    } else {
      // Fallback: try to get user info from /user/me endpoint
      try {
        userInfo = await getUserInfo(authResult.access_token);
        loginAttemptData.xiboUserId = userInfo.userId || null;
      } catch (error) {
        // If we can't get user info, use login identifier
        userInfo = {
          userId: null,
          userName: loginIdentifier,
          email: loginIdentifier,
        };
      }
    }

    // Create JWT token for our application
    const token = jwt.sign(
      {
        id: userInfo.userId || loginIdentifier,
        username: userInfo.userName || loginIdentifier,
        email: userInfo.email || loginIdentifier,
        xiboToken: authResult.access_token, // Store Xibo token for API calls
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1d",
      }
    );

    // Save successful login attempt
    loginAttemptData.success = true;
    loginAttemptData.xiboUserId = userInfo.userId || loginIdentifier;
    await saveLoginAttempt(loginAttemptData);

    res.json({
      token,
      user: {
        username: userInfo.userName || loginIdentifier,
        email: userInfo.email || loginIdentifier,
        userId: userInfo.userId || null,
      },
    });
  } catch (err) {
    console.error("Login error:", err.message);

    // Save failed login attempt
    loginAttemptData.success = false;
    loginAttemptData.errorMessage = err.message;
    await saveLoginAttempt(loginAttemptData).catch(console.error);

    if (err.response) {
      return res.status(err.response.status || 500).json({
        message: err.response.data?.message || "Authentication failed",
        error: err.message,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

// Helper function to save login attempt (non-blocking)
async function saveLoginAttempt(attemptData) {
  try {
    // Check if database is connected
    if (mongoose.connection.readyState !== 1) {
      console.warn("⚠️  Database not connected - login attempt not saved");
      return;
    }
    await LoginAttempt.create(attemptData);
  } catch (error) {
    // Log error but don't block the login process
    console.error("Failed to save login attempt:", error.message);
  }
}

// Get login history (for admin/audit purposes)
export const getLoginHistory = async (req, res) => {
  try {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        message: "Database connection not available.",
        error: "Database not connected",
      });
    }

    const { username, limit = 100, skip = 0 } = req.query;

    const query = {};
    if (username) {
      query.username = username;
    }

    const loginAttempts = await LoginAttempt.find(query)
      .select("-passwordHash") // Don't send password hash in response
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await LoginAttempt.countDocuments(query);

    res.json({
      total,
      limit: parseInt(limit),
      skip: parseInt(skip),
      loginAttempts,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

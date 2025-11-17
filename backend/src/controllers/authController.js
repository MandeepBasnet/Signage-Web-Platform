import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { authenticateUser, getUserInfo } from "../utils/xiboClient.js";

// Registration is not needed - users are managed in Xibo CMS
export const register = async (req, res) => {
  res.status(400).json({
    message:
      "User registration is not available. Please use your existing Xibo CMS credentials to login.",
    hint: "Users are managed in the Xibo CMS platform.",
  });
};

export const login = async (req, res) => {
  try {
    // Check if req.body exists
    if (!req.body) {
      return res.status(400).json({ message: "Request body is missing" });
    }

    // Support both 'email' and 'username' fields
    const { email, username, password } = req.body;
    const loginIdentifier = email || username;

    // Validate required fields
    if (!loginIdentifier || !password) {
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
      return res.status(401).json({
        message: authResult.message || "Invalid credentials",
        details: authResult.details || null,
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
    } else {
      // Fallback: try to get user info from /user/me endpoint
      try {
        userInfo = await getUserInfo(authResult.access_token);
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

    if (err.response) {
      return res.status(err.response.status || 500).json({
        message: err.response.data?.message || "Authentication failed",
        error: err.message,
      });
    }
    res.status(500).json({ message: err.message });
  }
};

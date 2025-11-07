import mongoose from "mongoose";

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn("⚠️  MONGO_URI not found in environment variables");
      return;
    }

    // Connection options to prevent buffering timeout
    const options = {
      serverSelectionTimeoutMS: 5000, // Timeout after 5s instead of 30s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    };

    await mongoose.connect(process.env.MONGO_URI, options);
    console.log("✅ MongoDB connected");
  } catch (error) {
    console.error("MongoDB connection failed:", error.message);
    console.warn("⚠️  Server will continue without database connection");
    console.warn(
      "⚠️  Database operations will fail until connection is established"
    );
    // Don't exit - allow server to run for testing
  }
};

// Helper function to check if database is connected
export const isDBConnected = () => {
  return mongoose.connection.readyState === 1; // 1 = connected
};

export default connectDB;

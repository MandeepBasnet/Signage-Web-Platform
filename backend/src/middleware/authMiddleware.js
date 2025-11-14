import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  const auth = req.headers.authorization;

  if (!auth) {
    return res.status(401).json({
      error: "No token",
      message:
        "Authorization header is missing. Please include: Authorization: Bearer <token>",
    });
  }

  // Check if it starts with "Bearer "
  if (!auth.startsWith("Bearer ")) {
    return res.status(401).json({
      error: "Invalid token format",
      message:
        "Token must be prefixed with 'Bearer '. Format: Authorization: Bearer <token>",
    });
  }

  const token = auth.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      error: "No token",
      message: "Token is missing after 'Bearer '",
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
    if (err) {
      console.error("Token verification error:", {
        error: err.message,
        name: err.name,
        tokenLength: token.length,
        tokenPreview: token.substring(0, 20) + "...",
      });

      let errorMessage = "Invalid token";
      if (err.name === "TokenExpiredError") {
        errorMessage = "Token has expired. Please login again.";
      } else if (err.name === "JsonWebTokenError") {
        errorMessage = "Invalid token format. Please login again.";
      }

      return res.status(403).json({
        error: errorMessage,
        details:
          process.env.NODE_ENV === "development" ? err.message : undefined,
      });
    }

    req.user = decoded;
    next();
  });
};

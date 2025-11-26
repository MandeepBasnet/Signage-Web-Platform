import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.split(" ")[1];
  } else if (req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      error: "No token",
      message:
        "Authorization header is missing or token not provided.",
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

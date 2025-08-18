// middleware/auth.js
const jwt = require("jsonwebtoken");
const User = require("../models/users.model");
const JWT_SECRET_ACCESS = process.env.JWT_SECRET_ACCESS;
const apiError = require("../utils/apiError");

function authMiddleware(allowedUsers = ["user"]) {
  return async function (req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Missing Authorization header" });
    }

    const [scheme, token] = authHeader.split(" ");
    if (scheme !== "Bearer" || !token || token === "null" || token === "undefined") {
      return res.status(401).json({ message: "Invalid Authorization format" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET_ACCESS);
    
      const user = await User.findById(decoded.id).select("role tokenVersion");
      if (!user) {
        return next(new apiError("Invalid or expired token, please login again", 401));
      }

      if ((user.tokenVersion || 0) !== (decoded.tokenVersion || 0)) {
        
        return next(new apiError("Token revoked. Please login again.", 401));
      }

      req.user = { ...decoded, role: user.role };
      if (allowedUsers && !allowedUsers.includes(user.role)) {
        return res.status(403).json({ message: "Access denied: You do not have permission" });
      }

      next();
    } catch (err) {
      return next(new apiError("Invalid or expired token, please login again", 401));
    }
  };
}

module.exports = authMiddleware;

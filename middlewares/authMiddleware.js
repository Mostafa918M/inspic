const jwt = require("jsonwebtoken");
const JWT_SECRET_ACCESS = process.env.JWT_SECRET_ACCESS;
const apiError = require("../utils/apiError");
function authMiddleware(allowedUsers = ["user"]) {
  return function (req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
      return res.status(401).json({ message: "Missing Authorization header" });
    }

    const [scheme, token] = authHeader.split(" ");
    if (
      scheme !== "Bearer" ||
      !token ||
      token === "null" ||
      token === "undefined"
    ) {
      return res.status(401).json({ message: "Invalid Authorization format" });
    }

    try {
      const decoded = jwt.verify(token, JWT_SECRET_ACCESS);
      req.user = decoded;
      if (allowedUsers && !allowedUsers.includes(decoded.role)) {
        return res
          .status(403)
          .json({ message: "Access denied: You do not have permission" });
      }
      next();
    } catch (err) {
      return next(
        new apiError("Invalid or expired token, please login again", 401)
      );
    }
  };
}

module.exports = authMiddleware;
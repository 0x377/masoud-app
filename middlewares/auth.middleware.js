import { verifyToken } from "../utils/auth.js";
import User from "../models/User.js";
import Session from "../models/Session.js";

export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers?.authorization || req.headers?.Authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        status: "error",
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);

    if (!decoded || decoded.type !== "access") {
      return res.status(401).json({
        success: false,
        message: "Invalid token",
      });
    }

    // Find user
    const user = await User.findByPk(decoded.userId, {
      include: [{ model: Person }],
    });

    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({
        status: "error",
        message: "User not found or inactive",
      });
    }

    // Check if session is valid
    const session = await Session.findOne({
      where: {
        user_id: user.id,
        is_active: true,
      },
    });

    if (!session) {
      return res.status(401).json({
        status: "error",
        message: "Session expired",
      });
    }

    // Update last activity
    user.last_activity_at = new Date();
    await user.save();

    session.last_activity = Math.floor(Date.now() / 1000);
    session.last_seen_at = new Date();
    await session.save();

    // Attach user to request
    req.user = user;
    req.session = session;

    next();
  } catch (error) {
    console.error("Authentication error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: "error",
        message: "Unauthorized",
      });
    }

    const userRoles = [
      req.user.user_type,
      ...(req.user.additional_roles || []),
    ];

    if (!roles.some((role) => userRoles.includes(role))) {
      return res.status(403).json({
        status: "error",
        message: "Insufficient permissions",
      });
    }

    next();
  };
};

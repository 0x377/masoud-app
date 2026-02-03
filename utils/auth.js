import jwt from "jsonwebtoken";

export const verifyToken = (token) => {
  try {
    if (!token) {
      throw new Error("Token not provided");
    }

    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    throw new Error("Invalid or expired token");
  }
};

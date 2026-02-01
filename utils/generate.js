import bcrypt from "bcryptjs";
import crypto from "crypto";

// Hash password
const hashPassword = async (password) => {
  const saltRounds = 10;
  return await bcrypt.hash(password, saltRounds);
};

// Verify password
const verifyPassword = async (plainPassword, hashedPassword) => {
  return await bcrypt.compare(plainPassword, hashedPassword);
};

// Generate MFA secret
const generateMFASecret = () => {
  return crypto.randomBytes(20).toString("base64");
};

// Generate backup codes
const generateBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(4).toString("hex").toUpperCase());
  }
  return codes;
};

export { hashPassword, verifyPassword, generateBackupCodes, generateMFASecret };

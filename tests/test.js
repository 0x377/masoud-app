import crypto from "crypto";
import { constructFromSymbol } from "date-fns/constants";

const generateMFASecret = () => {
  return crypto.randomBytes(32).toString("base64");
};

// Generate backup codes
const generateBackupCodes = (count = 10) => {
  const codes = [];
  for (let i = 0; i < count; i++) {
    codes.push(crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 8));
  }
  return codes;
};

// console.log(generateMFASecret());
console.log(generateBackupCodes());

import express from "express";
import { login, logout } from "../controllers/auth/login.controller.js";
import { register } from "../controllers/auth/register.controller.js";
import {
  forgotPassword,
  resetPassword,
} from "../controllers/auth/password.controller.js";
import { verifyEmail } from "../controllers/auth/verify.controller.js";
import { refreshToken } from "../controllers/auth/token.controller.js";

const router = express.Router();

router.post("/login", login);
router.post("/logout", logout);
router.post("/register", register);
router.post("/verify-email", verifyEmail);
router.post("/forgot-password", forgotPassword);
router.get("/reset-password/:token", resetPassword);
router.post("/refresh-token", refreshToken);

export default router;

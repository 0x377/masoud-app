import express from "express";
import { verifyCode } from "../controllers/msg.controller.js";

const router = express.Router();

router.post("/verify-code", verifyCode);

export default router;

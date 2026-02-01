import express from "express";
import familyTreeRoutes from "./family/familyTreeRoutes.js";
import familyRelationshipRoutes from "./family/familyRelationshipRoutes.js";
import familyTreeNodeRoutes from "./family/familyTreeNodeRoutes.js";
import authRoutes from "./auth.route.js";
import waqfRouter from "./waqf.route.js";

const router = express.Router();

// API version prefix
const API_PREFIX = "/api";

// Family tree routes
router.use("/family-trees", familyTreeRoutes);
router.use("/relationships", familyRelationshipRoutes);
router.use("/nodes", familyTreeNodeRoutes);
router.use("/auth", authRoutes);
router.use("/wq", waqfRouter);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Family Tree API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;

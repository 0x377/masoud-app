import express from "express";
import familyTreeRoutes from "./family/familyTreeRoutes.js";
import familyRelationshipRoutes from "./family/familyRelationshipRoutes.js";
import familyTreeNodeRoutes from "./family/familyTreeNodeRoutes.js";
import authRoutes from "./auth.route.js";
import waqfRouter from "./waqf.route.js";
import executiveRoutes from "./executive/executiveRoutes.js";
import committeeRoutes from "./executive/committeeRoutes.js";
import rcommitteeRoutes from "./reconciliation/committeeRoutes.js";
import caseRoutes from "./reconciliation/caseRoutes.js";
import reportRoutes from "./reconciliation/reportRoutes.js";

const router = express.Router();

// API version prefix
const API_PREFIX = "/api";

// Family tree routes
router.use("/family-trees", familyTreeRoutes);
router.use("/relationships", familyRelationshipRoutes);
router.use("/nodes", familyTreeNodeRoutes);

// Authentication routes
router.use("/auth", authRoutes);

// Waqf routes
router.use("/wq", waqfRouter);

// Executive management routes
router.use("/executives", executiveRoutes);
router.use("/committees", committeeRoutes);

// Reconciliation routes
router.use("/reconciliation/committees", rcommitteeRoutes);
router.use("/reconciliation/cases", caseRoutes);
router.use("/reconciliation/reports", reportRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Family Tree API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;

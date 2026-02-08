import express from "express";
import familyTreeRoutes from "./family/familyTree.route.js";
import familyRelationshipRoutes from "./family/familyRelationship.route.js";
import familyTreeNodeRoutes from "./family/familyTreeNode.route.js";
import authRoutes from "./auth.route.js";
import waqfRouter from "./waqf.route.js";
import executiveRoutes from "./executive/executive.route.js";
import committeeRoutes from "./executive/committee.route.js";
import rcommitteeRoutes from "./reconciliation/committee.route.js";
import caseRoutes from "./reconciliation/case.route.js";
import reportRoutes from "./reconciliation/report.route.js";
import msgRoutes from "./msg.route.js";

const router = express.Router();

// Family tree routes
router.use("/family-trees", familyTreeRoutes);
router.use("/relationships", familyRelationshipRoutes);
router.use("/nodes", familyTreeNodeRoutes);

// Authentication routes
router.use("/auth", authRoutes);

// Waqf routes
router.use("/waqf", waqfRouter);

// Executive management routes
router.use("/executives", executiveRoutes);
router.use("/committees", committeeRoutes);

// Reconciliation routes
router.use("/reconciliation/committees", rcommitteeRoutes);
router.use("/reconciliation/cases", caseRoutes);
router.use("/reconciliation/reports", reportRoutes);

// send verify message
router.use("/msg", msgRoutes);

// Health check route
router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "Family Tree API is running",
    timestamp: new Date().toISOString(),
  });
});

export default router;

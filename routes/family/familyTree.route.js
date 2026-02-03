import express from "express";
import FamilyTreeController from "../../controllers/family/FamilyTreeController.js";
import { authenticate, authorize } from "../../middlewares/auth.middleware.js";
import {
  checkTreeAccess,
  checkTreeCreator,
  validateTreeInput,
} from "../../middlewares/familyTree.middleware.js";

const router = express.Router();

// Public routes (accessible without authentication)
router.get("/public", FamilyTreeController.searchFamilyTrees);
router.get("/:treeId/public", FamilyTreeController.getFamilyTree);

// Protected routes (require authentication)
router.use(authenticate);

// Tree management routes
router.post("/", validateTreeInput, FamilyTreeController.createFamilyTree);
router.get("/", FamilyTreeController.searchFamilyTrees);
router.get("/my-trees", FamilyTreeController.searchFamilyTrees);
router.get("/:treeId", checkTreeAccess, FamilyTreeController.getFamilyTree);
router.put(
  "/:treeId",
  checkTreeCreator,
  validateTreeInput,
  FamilyTreeController.updateFamilyTree,
);
router.delete(
  "/:treeId",
  checkTreeCreator,
  FamilyTreeController.deleteFamilyTree,
);

// Tree operations routes
router.get(
  "/:treeId/statistics",
  checkTreeAccess,
  FamilyTreeController.getTreeStatistics,
);
router.get(
  "/:treeId/export",
  checkTreeAccess,
  FamilyTreeController.exportTreeData,
);
router.post("/:treeId/share", checkTreeCreator, FamilyTreeController.shareTree);
router.get(
  "/:treeId/branches",
  checkTreeAccess,
  FamilyTreeController.getTreeBranches,
);
router.patch(
  "/:treeId/settings",
  checkTreeCreator,
  FamilyTreeController.updateTreeSettings,
);
router.get(
  "/:treeId/nodes",
  checkTreeAccess,
  FamilyTreeController.getTreeNodes,
);

// Admin routes
router.get(
  "/admin/all",
  authorize(["admin", "superadmin"]),
  FamilyTreeController.searchFamilyTrees,
);

export default router;

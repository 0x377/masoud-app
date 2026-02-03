import express from "express";
import FamilyTreeNodeController from "../../controllers/family/FamilyTreeNodeController.js";
import { authenticate } from "../../middlewares/auth.middleware.js";
import { checkNodeAccess } from "../../middlewares/familyTree.middleware.js";

const router = express.Router();

// Protected routes (require authentication)
router.use(authenticate);

// Node management routes
router.post("/", FamilyTreeNodeController.createNode);
router.get("/:nodeId", checkNodeAccess, FamilyTreeNodeController.getNode);
router.put("/:nodeId", checkNodeAccess, FamilyTreeNodeController.updateNode);
router.delete("/:nodeId", checkNodeAccess, FamilyTreeNodeController.deleteNode);

// Node operations routes
router.post(
  "/:nodeId/add-child",
  checkNodeAccess,
  FamilyTreeNodeController.addChild,
);
router.post(
  "/:nodeId/add-spouse",
  checkNodeAccess,
  FamilyTreeNodeController.addSpouse,
);
router.get(
  "/:nodeId/ancestry",
  checkNodeAccess,
  FamilyTreeNodeController.getAncestryPath,
);
router.get(
  "/:nodeId/descendants",
  checkNodeAccess,
  FamilyTreeNodeController.getDescendants,
);
router.get(
  "/:nodeId/children",
  checkNodeAccess,
  FamilyTreeNodeController.getChildren,
);
router.patch(
  "/:nodeId/position",
  checkNodeAccess,
  FamilyTreeNodeController.updateNodePosition,
);

// Search routes
router.post(
  "/search/:treeId",
  checkNodeAccess,
  FamilyTreeNodeController.searchNodesInTree,
);

export default router;

import express from "express";
import FamilyRelationshipController from "../../controllers/family/FamilyRelationshipController.js";
import { authenticate, authorize } from "../../middleware/auth.middleware.js";
import { checkRelationshipAccess } from "../../middleware/familyTree.middleware.js";

const router = express.Router();

// Public routes (accessible without authentication)
router.get(
  "/calculate-degree/:personId1/:personId2",
  FamilyRelationshipController.calculateRelationshipDegree,
);

// Protected routes (require authentication)
router.use(authenticate);

// Relationship management routes
router.post("/", FamilyRelationshipController.createRelationship);
router.get("/search", FamilyRelationshipController.searchRelationships);
router.get("/:relationshipId", FamilyRelationshipController.getRelationship);
router.put(
  "/:relationshipId",
  checkRelationshipAccess,
  FamilyRelationshipController.updateRelationship,
);
router.delete(
  "/:relationshipId",
  checkRelationshipAccess,
  FamilyRelationshipController.deleteRelationship,
);

// Person relationships routes
router.get(
  "/person/:personId",
  FamilyRelationshipController.getPersonRelationships,
);
router.get(
  "/person/:personId/immediate-family",
  FamilyRelationshipController.getImmediateFamily,
);
router.get(
  "/person/:personId/ancestors",
  FamilyRelationshipController.getAncestors,
);
router.get(
  "/person/:personId/descendants",
  FamilyRelationshipController.getDescendants,
);

// Relationship operations routes
router.post(
  "/:relationshipId/verify",
  authorize(["admin", "verifier"]),
  FamilyRelationshipController.verifyRelationship,
);
router.post(
  "/:relationshipId/status",
  checkRelationshipAccess,
  FamilyRelationshipController.updateRelationshipStatus,
);

// Bulk operations routes
router.post("/bulk", FamilyRelationshipController.bulkCreateRelationships);
router.post(
  "/import",
  authorize(["admin"]),
  FamilyRelationshipController.importRelationships,
);
router.get("/export", FamilyRelationshipController.exportRelationships);

// Statistics routes
router.get(
  "/statistics/summary",
  FamilyRelationshipController.getRelationshipStatistics,
);
router.get(
  "/statistics/types",
  FamilyRelationshipController.getRelationshipTypeStatistics,
);

// Admin routes
router.get(
  "/admin/all",
  authorize(["admin", "superadmin"]),
  FamilyRelationshipController.searchRelationships,
);

export default router;

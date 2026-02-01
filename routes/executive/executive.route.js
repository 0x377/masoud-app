import express from 'express';
import ExecutiveController from '../../controllers/executive/ExecutiveController.js';
import ExecutivePositionController from '../../controllers/executive/ExecutivePositionController.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { upload } from '../../middleware/upload.js';

const router = express.Router();

// Public routes
router.get('/statistics', ExecutiveController.getExecutiveStatistics);
router.get('/positions/predefined', ExecutivePositionController.getPredefinedPositions);

// Protected routes
router.use(authenticate);

// Executive management routes
router.post('/', authorize(['admin', 'hr']), ExecutiveController.createExecutive);
router.get('/search', ExecutiveController.searchExecutives);
router.get('/department/:department', ExecutiveController.getExecutivesByDepartment);
router.get('/hierarchy', authorize(['admin', 'hr']), ExecutiveController.getOrganizationalHierarchy);
router.get('/expiring-terms', authorize(['admin', 'hr']), ExecutiveController.getExecutivesWithExpiringTerms);
router.get('/active-count', ExecutiveController.getActiveExecutivesCount);

// Individual executive routes
router.get('/:executiveId', ExecutiveController.getExecutive);
router.put('/:executiveId', authorize(['admin', 'hr']), ExecutiveController.updateExecutive);
router.delete('/:executiveId', authorize(['admin']), ExecutiveController.deleteExecutive);

// Executive operations
router.post('/:executiveId/promote', authorize(['admin']), ExecutiveController.promoteExecutive);
router.post('/:executiveId/transfer', authorize(['admin', 'hr']), ExecutiveController.transferExecutive);
router.get('/person/:personId/timeline', ExecutiveController.getExecutiveTimeline);

// Document routes
router.post('/:executiveId/documents', 
  authorize(['admin', 'hr']), 
  upload.single('document'),
  ExecutiveController.uploadDocument
);
router.get('/:executiveId/documents', ExecutiveController.getExecutiveDocuments);

// Position management routes
router.post('/positions', authorize(['admin']), ExecutivePositionController.createPosition);
router.get('/positions/available', ExecutivePositionController.getAvailablePositions);
router.get('/positions/statistics', ExecutivePositionController.getPositionStatistics);

export default router;

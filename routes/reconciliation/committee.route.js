import express from 'express';
import ReconciliationCommitteeController from '../../controllers/reconciliation/ReconciliationCommitteeController.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes (statistics only)
router.get('/statistics/:committeeId', ReconciliationCommitteeController.getCommitteeStatistics);

// Protected routes
router.use(authenticate);

// Committee management routes
router.post('/', authorize(['admin', 'committee_admin']), ReconciliationCommitteeController.createCommittee);
router.get('/', ReconciliationCommitteeController.searchCommittees);
router.get('/:committeeId', ReconciliationCommitteeController.getCommittee);
router.put('/:committeeId', authorize(['admin', 'committee_admin']), ReconciliationCommitteeController.updateCommittee);
router.delete('/:committeeId', authorize(['admin']), ReconciliationCommitteeController.deleteCommittee);

// Committee member management
router.post('/:committeeId/members', authorize(['admin', 'committee_admin']), ReconciliationCommitteeController.addMember);
router.delete('/:committeeId/members/:personId', authorize(['admin', 'committee_admin']), ReconciliationCommitteeController.removeMember);

// Committee operations
router.put('/:committeeId/chairman', authorize(['admin', 'committee_admin']), ReconciliationCommitteeController.updateChairman);
router.post('/:committeeId/report', authorize(['admin', 'committee_admin']), ReconciliationCommitteeController.generateCommitteeReport);

export default router;

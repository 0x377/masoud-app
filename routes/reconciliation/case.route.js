import express from 'express';
import ReconciliationCaseController from '../../controllers/reconciliation/ReconciliationCaseController.js';
import CaseSessionController from '../../controllers/reconciliation/CaseSessionController.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = express.Router();

// Public routes (statistics only)
router.get('/statistics', ReconciliationCaseController.getCaseStatistics);

// Protected routes
router.use(authenticate);

// Case management routes
router.post('/', authorize(['admin', 'mediator', 'case_officer']), ReconciliationCaseController.createCase);
router.get('/', ReconciliationCaseController.searchCases);
router.get('/follow-up', authorize(['admin', 'mediator']), ReconciliationCaseController.getCasesRequiringFollowUp);
router.get('/:caseId', ReconciliationCaseController.getCase);
router.put('/:caseId', authorize(['admin', 'mediator']), ReconciliationCaseController.updateCase);
router.delete('/:caseId', authorize(['admin']), ReconciliationCaseController.deleteCase);

// Case operations
router.put('/:caseId/status', authorize(['admin', 'mediator']), ReconciliationCaseController.updateCaseStatus);
router.put('/:caseId/mediator', authorize(['admin', 'committee_admin']), ReconciliationCaseController.assignMediator);
router.put('/:caseId/settle', authorize(['admin', 'mediator']), ReconciliationCaseController.settleCase);
router.get('/:caseId/timeline', ReconciliationCaseController.getCaseTimeline);

// Session routes
router.post('/:caseId/sessions', authorize(['admin', 'mediator']), CaseSessionController.createSession);
router.get('/:caseId/sessions', CaseSessionController.getCaseSessions);
router.get('/sessions/search', CaseSessionController.searchSessions);
router.get('/sessions/upcoming', CaseSessionController.getUpcomingSessions);
router.get('/sessions/statistics', CaseSessionController.getSessionStatistics);

// Individual session routes
router.get('/sessions/:sessionId', CaseSessionController.getSession);
router.put('/sessions/:sessionId', authorize(['admin', 'mediator']), CaseSessionController.updateSession);
router.put('/sessions/:sessionId/outcome', authorize(['admin', 'mediator']), CaseSessionController.updateSessionOutcome);
router.delete('/sessions/:sessionId', authorize(['admin']), CaseSessionController.deleteSession);

// Mediator routes
router.get('/mediator/:mediatorId/workload', ReconciliationCaseController.getMediatorWorkload);

export default router;

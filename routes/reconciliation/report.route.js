import express from 'express';
import ReportController from '../../controllers/reconciliation/ReportController.js';
import { authenticate, authorize } from '../../middleware/auth.js';

const router = express.Router();

router.use(authenticate);

// Report generation routes
router.post('/monthly', authorize(['admin', 'report_generator']), ReportController.generateMonthlyReport);
router.post('/committee-performance', authorize(['admin', 'report_generator']), ReportController.generateCommitteePerformanceReport);
router.post('/mediator-performance', authorize(['admin', 'report_generator']), ReportController.generateMediatorPerformanceReport);

// Report management routes
router.get('/', ReportController.searchReports);
router.get('/:reportId', ReportController.getReport);
router.delete('/:reportId', authorize(['admin']), ReportController.deleteReport);
router.get('/:reportId/export', ReportController.exportReport);

export default router;

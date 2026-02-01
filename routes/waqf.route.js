import express from 'express';
import WaqfController from '../controllers/WaqfController.js';
import { authenticate, authorize } from '../middleware/auth.js';

const router = express.Router();
const waqfController = new WaqfController();

// Apply authentication middleware to all routes
router.use(authenticate);

// Waqf CRUD operations
router.post('/waqf', authorize('SUPER_ADMIN', 'EXECUTIVE'), waqfController.createWaqf);
router.get('/waqf', authorize('FAMILY_MEMBER'), waqfController.searchWaqf);
router.get('/waqf/:id', authorize('FAMILY_MEMBER'), waqfController.getWaqf);
router.put('/waqf/:id', authorize('SUPER_ADMIN', 'EXECUTIVE'), waqfController.updateWaqf);

// Waqf transactions
router.post('/waqf/:id/income', authorize('FINANCE_MANAGER', 'TREASURER'), waqfController.recordIncome);
router.post('/waqf/:id/distribute', authorize('FINANCE_MANAGER', 'TREASURER'), waqfController.distributeToBeneficiary);
router.get('/waqf/:id/transactions', authorize('FAMILY_MEMBER'), waqfController.getWaqfTransactions);
router.put('/transactions/:id/approve', authorize('FINANCE_MANAGER', 'TREASURER'), waqfController.approveTransaction);

// Beneficiaries
router.post('/waqf/:id/beneficiaries', authorize('SUPER_ADMIN', 'EXECUTIVE'), waqfController.addBeneficiary);
router.get('/waqf/:id/beneficiaries', authorize('FAMILY_MEMBER'), waqfController.getWaqfBeneficiaries);

// Committee
router.get('/waqf/:id/committee', authorize('FAMILY_MEMBER'), waqfController.getWaqfCommittee);

// Statistics
router.get('/waqf/:id/statistics', authorize('FAMILY_MEMBER'), waqfController.getWaqfStatistics);

export default router;

import express from 'express';
import ExecutiveCommittee from '../../models/executive/ExecutiveCommittee.js';
import { authenticate, authorize } from '../../middlewares/auth.middleware.js';

const router = express.Router();

router.use(authenticate);

// Add executive to committee
router.post('/:committeeId/members/:executiveId', authorize(['admin']), async (req, res) => {
  try {
    const { committeeId, executiveId } = req.params;
    const { role } = req.body;

    const committeeModel = new ExecutiveCommittee();
    const result = await committeeModel.addExecutiveToCommittee(executiveId, committeeId, role || 'MEMBER');

    res.json({
      success: true,
      message: 'Executive added to committee successfully',
      data: result
    });
  } catch (error) {
    console.error('Add executive to committee error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

// Get executive committees
router.get('/executive/:executiveId', async (req, res) => {
  try {
    const { executiveId } = req.params;

    const committeeModel = new ExecutiveCommittee();
    const committees = await committeeModel.getExecutiveCommittees(executiveId);

    res.json({
      success: true,
      data: committees
    });
  } catch (error) {
    console.error('Get executive committees error:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

export default router;

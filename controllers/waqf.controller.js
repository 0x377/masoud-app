import { 
  FamilyWaqf, 
  WaqfTransaction, 
  WaqfBeneficiary, 
  WaqfManagementCommittee 
} from '../models/index.js';

class WaqfController {
  constructor() {
    this.waqfModel = new FamilyWaqf();
    this.transactionModel = new WaqfTransaction();
    this.beneficiaryModel = new WaqfBeneficiary();
    this.committeeModel = new WaqfManagementCommittee();
  }

  // Create a new waqf
  async createWaqf(req, res) {
    try {
      const { 
        name_arabic, 
        description, 
        waqf_type, 
        establishment_date, 
        founder_id,
        current_value 
      } = req.body;
      
      const userId = req.user.id;

      const waqf = await this.waqfModel.createWaqf({
        name_arabic,
        description,
        waqf_type,
        establishment_date,
        founder_id,
        current_value
      }, userId);

      res.status(201).json({
        success: true,
        data: waqf,
        message: 'Waqf created successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get waqf details
  async getWaqf(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const waqf = await this.waqfModel.getWaqfWithDetails(id, userId);

      res.json({
        success: true,
        data: waqf
      });
    } catch (error) {
      res.status(error.message.includes('not found') ? 404 : 403).json({
        success: false,
        error: error.message
      });
    }
  }

  // Record income transaction
  async recordIncome(req, res) {
    try {
      const { waqf_id, amount, description, transaction_date, category } = req.body;
      const userId = req.user.id;

      const transaction = await this.transactionModel.createTransaction({
        waqf_id,
        transaction_type: 'INCOME',
        amount,
        description,
        transaction_date,
        category
      }, userId);

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Income recorded successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Distribute to beneficiary
  async distributeToBeneficiary(req, res) {
    try {
      const { waqf_id, beneficiary_id, amount, description } = req.body;
      const userId = req.user.id;

      const transaction = await this.transactionModel.createTransaction({
        waqf_id,
        transaction_type: 'DISTRIBUTION',
        amount,
        description,
        beneficiary_id,
        category: 'BENEFICIARY_DISTRIBUTION'
      }, userId);

      // Auto-approve if user has permission
      if (req.user.user_type === 'SUPER_ADMIN' || req.user.user_type === 'FINANCE_MANAGER') {
        await this.transactionModel.approveTransaction(transaction.transaction_id, userId);
      }

      res.status(201).json({
        success: true,
        data: transaction,
        message: 'Distribution recorded successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Add beneficiary
  async addBeneficiary(req, res) {
    try {
      const { waqf_id, person_id, share_percentage, relationship } = req.body;
      const userId = req.user.id;

      const beneficiary = await this.beneficiaryModel.addBeneficiary({
        waqf_id,
        person_id,
        share_percentage,
        relationship,
        distribution_frequency: 'MONTHLY'
      }, userId);

      res.status(201).json({
        success: true,
        data: beneficiary,
        message: 'Beneficiary added successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get waqf transactions
  async getWaqfTransactions(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 50, type, category } = req.query;

      const filters = { waqf_id: id };
      if (type) filters.transaction_type = type;
      if (category) filters.category = category;

      const result = await this.transactionModel.searchTransactions(filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get waqf beneficiaries
  async getWaqfBeneficiaries(req, res) {
    try {
      const { id } = req.params;
      const { page = 1, limit = 20 } = req.query;

      const result = await this.beneficiaryModel.getBeneficiariesByWaqf(id, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result.data,
        total_shares: result.total_shares,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get waqf committee
  async getWaqfCommittee(req, res) {
    try {
      const { id } = req.params;

      const committee = await this.committeeModel.getCommitteeByWaqf(id);

      res.json({
        success: true,
        data: committee
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Approve transaction
  async approveTransaction(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user.id;

      const transaction = await this.transactionModel.approveTransaction(id, userId);

      res.json({
        success: true,
        data: transaction,
        message: 'Transaction approved successfully'
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  }

  // Get waqf statistics
  async getWaqfStatistics(req, res) {
    try {
      const { id } = req.params;

      // Get waqf details with statistics
      const waqf = await this.waqfModel.getWaqfWithDetails(id);

      // Get transactions summary
      const transactionsSummary = await this.transactionModel.getTransactionsSummary(id, 'YEAR');

      // Get committee statistics
      const committeeStats = await this.committeeModel.getCommitteeStatistics(id);

      res.json({
        success: true,
        data: {
          waqf: waqf,
          transactions_summary: transactionsSummary,
          committee_stats: committeeStats
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  // Search waqf
  async searchWaqf(req, res) {
    try {
      const { 
        page = 1, 
        limit = 20, 
        waqf_type, 
        status, 
        search,
        sort_by 
      } = req.query;

      const filters = {};
      if (waqf_type) filters.waqf_type = waqf_type;
      if (status) filters.status = status;
      if (search) filters.search = search;
      if (sort_by) filters.sort_by = sort_by;

      const result = await this.waqfModel.searchWaqf(filters, {
        page: parseInt(page),
        limit: parseInt(limit)
      });

      res.json({
        success: true,
        data: result.data,
        pagination: result.pagination
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

export default WaqfController;

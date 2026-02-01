import BaseModel from '../BaseModel.js';

class ReconciliationReport extends BaseModel {
  constructor() {
    super('reconciliation_reports', 'report_id');
    this.jsonFields = ['data', 'charts', 'metadata'];
  }

  // Report types
  static REPORT_TYPES = {
    MONTHLY: 'MONTHLY',
    QUARTERLY: 'QUARTERLY',
    YEARLY: 'YEARLY',
    COMMITTEE_PERFORMANCE: 'COMMITTEE_PERFORMANCE',
    MEDIATOR_PERFORMANCE: 'MEDIATOR_PERFORMANCE',
    CASE_TYPE_ANALYSIS: 'CASE_TYPE_ANALYSIS',
    CUSTOM: 'CUSTOM'
  };

  // Generate monthly report
  async generateMonthlyReport(year, month, userId) {
    const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Last day of month

    const ReconciliationCase = (await import('./ReconciliationCase.js')).default;
    const caseModel = new ReconciliationCase();

    // Get case statistics for the month
    const caseStats = await caseModel.getCaseStatistics({
      filing_date_from: startDate,
      filing_date_to: endDate
    });

    // Get committee statistics
    const ReconciliationCommittee = (await import('./ReconciliationCommittee.js')).default;
    const committeeModel = new ReconciliationCommittee();
    const committees = await committeeModel.searchCommittees({}, { includeStats: true });

    // Calculate success rate by case type
    const successByType = caseStats.type_distribution.map(type => ({
      case_type: type.case_type,
      total_cases: type.count,
      settled_cases: type.settled,
      success_rate: type.count > 0 ? ((type.settled / type.count) * 100).toFixed(2) : 0
    }));

    // Get top performing mediators
    const topMediators = caseStats.mediator_performance.slice(0, 5);

    // Generate report data
    const reportData = {
      period: {
        start_date: startDate,
        end_date: endDate,
        type: 'MONTHLY',
        label: `${year}-${month.toString().padStart(2, '0')}`
      },
      summary: caseStats.summary,
      committees_performance: committees.committees.map(c => ({
        committee_id: c.committee_id,
        name_arabic: c.name_arabic,
        ...c.statistics
      })),
      case_type_analysis: successByType,
      top_mediators: topMediators,
      charts: {
        case_status_distribution: this.generateStatusDistributionChart(caseStats.summary),
        case_type_distribution: this.generateTypeDistributionChart(caseStats.type_distribution),
        success_rate_trend: await this.getSuccessRateTrend(12) // Last 12 months
      }
    };

    // Save report
    const report = await this.create({
      report_type: 'MONTHLY',
      report_title: `تقرير شهر ${month} - ${year}`,
      report_title_en: `Monthly Report - ${month}/${year}`,
      period_start: startDate,
      period_end: endDate,
      data: reportData,
      charts: reportData.charts,
      generated_by: userId,
      metadata: {
        generation_date: new Date().toISOString(),
        filters_applied: { year, month }
      }
    });

    return report;
  }

  // Generate committee performance report
  async generateCommitteePerformanceReport(committeeId, startDate, endDate, userId) {
    const ReconciliationCommittee = (await import('./ReconciliationCommittee.js')).default;
    const committeeModel = new ReconciliationCommittee();
    
    const report = await committeeModel.generateCommitteeReport(committeeId, startDate, endDate);

    // Save report
    const savedReport = await this.create({
      report_type: 'COMMITTEE_PERFORMANCE',
      report_title: `تقرير أداء اللجنة - ${report.committee.name_arabic}`,
      report_title_en: `Committee Performance Report - ${report.committee.name_english}`,
      committee_id: committeeId,
      period_start: startDate,
      period_end: endDate,
      data: report,
      generated_by: userId,
      metadata: {
        generation_date: new Date().toISOString(),
        committee_id: committeeId
      }
    });

    return savedReport;
  }

  // Generate mediator performance report
  async generateMediatorPerformanceReport(mediatorId, startDate, endDate, userId) {
    const ReconciliationCase = (await import('./ReconciliationCase.js')).default;
    const caseModel = new ReconciliationCase();

    // Get mediator details
    const mediatorSql = `
      SELECT 
        p.*,
        u.email as user_email
      FROM persons p
      LEFT JOIN users u ON p.person_id = u.person_id
      WHERE p.person_id = ?
      AND p.deleted_at IS NULL
    `;
    
    const [mediator] = await this.executeQuery(mediatorSql, [mediatorId]);
    if (!mediator) {
      throw new Error('Mediator not found');
    }

    // Get mediator workload
    const workload = await caseModel.getMediatorWorkload(mediatorId);

    // Get cases handled in period
    const cases = await caseModel.searchCases({
      mediator_id: mediatorId,
      filing_date_from: startDate,
      filing_date_to: endDate
    }, { includeDetails: false });

    // Calculate additional statistics
    const settlementAmounts = cases.cases
      .filter(c => c.settlement_amount)
      .map(c => parseFloat(c.settlement_amount));
    
    const avgSettlement = settlementAmounts.length > 0
      ? settlementAmounts.reduce((a, b) => a + b) / settlementAmounts.length
      : 0;

    const reportData = {
      mediator: mediator,
      period: { start_date: startDate, end_date: endDate },
      workload: workload,
      cases_summary: {
        total_cases: cases.pagination.total,
        settled_cases: cases.cases.filter(c => c.status === 'SETTLED').length,
        avg_settlement_amount: avgSettlement
      },
      cases: cases.cases,
      recommendations: this.generateMediatorRecommendations(workload, cases.cases)
    };

    // Save report
    const savedReport = await this.create({
      report_type: 'MEDIATOR_PERFORMANCE',
      report_title: `تقرير أداء الوسيط - ${mediator.full_name_arabic}`,
      report_title_en: `Mediator Performance Report - ${mediator.full_name_english}`,
      mediator_id: mediatorId,
      period_start: startDate,
      period_end: endDate,
      data: reportData,
      generated_by: userId,
      metadata: {
        generation_date: new Date().toISOString(),
        mediator_id: mediatorId
      }
    });

    return savedReport;
  }

  // Generate status distribution chart data
  generateStatusDistributionChart(summary) {
    return {
      type: 'pie',
      data: {
        labels: ['New', 'Assigned', 'In Progress', 'Mediation', 'Settled', 'Dismissed', 'Escalated'],
        datasets: [{
          data: [
            summary.new_cases || 0,
            summary.assigned_cases || 0,
            summary.in_progress_cases || 0,
            summary.mediation_cases || 0,
            summary.settled_cases || 0,
            summary.dismissed_cases || 0,
            summary.escalated_cases || 0
          ],
          backgroundColor: [
            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', '#9966FF', '#FF9F40', '#C9CBCF'
          ]
        }]
      }
    };
  }

  // Generate type distribution chart data
  generateTypeDistributionChart(typeDistribution) {
    return {
      type: 'bar',
      data: {
        labels: typeDistribution.map(t => t.case_type),
        datasets: [{
          label: 'Cases by Type',
          data: typeDistribution.map(t => t.count),
          backgroundColor: '#36A2EB'
        }]
      }
    };
  }

  // Get success rate trend
  async getSuccessRateTrend(months = 12) {
    const trendData = [];
    const today = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = new Date(year, month, 0).toISOString().split('T')[0];

      const sql = `
        SELECT 
          COUNT(*) as total_cases,
          COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_cases
        FROM reconciliation_cases
        WHERE filing_date BETWEEN ? AND ?
        AND deleted_at IS NULL
      `;
      
      const [stats] = await this.executeQuery(sql, [startDate, endDate]);

      const successRate = stats.total_cases > 0
        ? ((stats.settled_cases / stats.total_cases) * 100).toFixed(2)
        : 0;

      trendData.push({
        period: `${year}-${month.toString().padStart(2, '0')}`,
        total_cases: stats.total_cases,
        settled_cases: stats.settled_cases,
        success_rate: parseFloat(successRate)
      });
    }

    return trendData;
  }

  // Generate mediator recommendations
  generateMediatorRecommendations(workload, cases) {
    const recommendations = [];

    // Check workload
    if (workload.total_active_cases >= 10) {
      recommendations.push({
        type: 'WORKLOAD',
        priority: 'HIGH',
        message: 'Very high workload. Consider reducing case assignments.',
        suggestion: 'Limit new case assignments until workload decreases.'
      });
    } else if (workload.total_active_cases >= 7) {
      recommendations.push({
        type: 'WORKLOAD',
        priority: 'MEDIUM',
        message: 'High workload. Monitor closely.',
        suggestion: 'Consider scheduling more frequent breaks between sessions.'
      });
    }

    // Check success rate
    const successRate = parseFloat(workload.success_rate);
    if (successRate < 30) {
      recommendations.push({
        type: 'PERFORMANCE',
        priority: 'HIGH',
        message: 'Low success rate. Additional training may be needed.',
        suggestion: 'Recommend mediation skills training or peer review.'
      });
    } else if (successRate < 50) {
      recommendations.push({
        type: 'PERFORMANCE',
        priority: 'MEDIUM',
        message: 'Moderate success rate. Room for improvement.',
        suggestion: 'Consider pairing with high-performing mediator for mentoring.'
      });
    }

    // Check handling time
    if (workload.average_handling_days > 90) {
      recommendations.push({
        type: 'EFFICIENCY',
        priority: 'HIGH',
        message: 'Cases taking too long to resolve.',
        suggestion: 'Review case management approach and scheduling.'
      });
    }

    // Check case type performance
    const caseTypes = {};
    cases.forEach(caseRecord => {
      if (!caseTypes[caseRecord.case_type]) {
        caseTypes[caseRecord.case_type] = { total: 0, settled: 0 };
      }
      caseTypes[caseRecord.case_type].total++;
      if (caseRecord.status === 'SETTLED') {
        caseTypes[caseRecord.case_type].settled++;
      }
    });

    Object.entries(caseTypes).forEach(([type, stats]) => {
      const typeSuccessRate = (stats.settled / stats.total) * 100;
      if (typeSuccessRate < 30 && stats.total >= 3) {
        recommendations.push({
          type: 'SPECIALIZATION',
          priority: 'LOW',
          message: `Low success rate with ${type} cases.`,
          suggestion: `Consider additional training or specialization in ${type.toLowerCase()} dispute resolution.`
        });
      }
    });

    return recommendations;
  }

  // Search reports
  async searchReports(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 20
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        rr.*,
        u.email as generated_by_email,
        p.full_name_arabic as generated_by_name
      FROM ${this.tableName} rr
      LEFT JOIN users u ON rr.generated_by = u.user_id
      LEFT JOIN persons p ON u.person_id = p.person_id
      WHERE rr.deleted_at IS NULL
    `;
    
    const params = [];

    // Apply filters
    if (filters.report_type) {
      sql += ' AND rr.report_type = ?';
      params.push(filters.report_type);
    }

    if (filters.committee_id) {
      sql += ' AND rr.committee_id = ?';
      params.push(filters.committee_id);
    }

    if (filters.mediator_id) {
      sql += ' AND rr.mediator_id = ?';
      params.push(filters.mediator_id);
    }

    if (filters.period_start_from) {
      sql += ' AND rr.period_start >= ?';
      params.push(filters.period_start_from);
    }

    if (filters.period_start_to) {
      sql += ' AND rr.period_start <= ?';
      params.push(filters.period_start_to);
    }

    if (filters.generated_by) {
      sql += ' AND rr.generated_by = ?';
      params.push(filters.generated_by);
    }

    if (filters.search) {
      sql += ' AND (rr.report_title LIKE ? OR rr.report_title_en LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Sort
    sql += ' ORDER BY rr.created_at DESC';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const reports = await this.executeQuery(sql, params);
    const processedReports = reports.map(record => this.processResult(record));

    return {
      reports: processedReports,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1
      }
    };
  }

  // Get report with data
  async getReportWithData(reportId) {
    const report = await this.findById(reportId);
    if (!report) {
      throw new Error('Report not found');
    }

    // Get generator details
    let generator = null;
    if (report.generated_by) {
      const generatorSql = `
        SELECT 
          u.user_id,
          u.email,
          u.user_type,
          p.full_name_arabic,
          p.full_name_english
        FROM users u
        LEFT JOIN persons p ON u.person_id = p.person_id
        WHERE u.user_id = ?
        AND u.deleted_at IS NULL
      `;
      
      const [generatorResult] = await this.executeQuery(generatorSql, [report.generated_by]);
      generator = generatorResult;
    }

    return {
      ...report,
      generated_by_details: generator
    };
  }
}

export default ReconciliationReport;

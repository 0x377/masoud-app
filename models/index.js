import db from "../config/database.js";

// Import all models
import Person from "./Person.js";
import User from "./User.js";
import PersonalAccessToken from "./PersonalAccessToken.js";
import Session from "./Session.js";
import VerificationCode from "./VerificationCode.js";
import LoginHistory from "./LoginHistory.js";
import SecurityLog from "./SecurityLog.js";
import PasswordHistory from "./PasswordHistory.js";
import PasswordResetToken from "./PasswordResetToken.js";
import UserPermission from "./UserPermission.js";

// Donation models
import DonationCategory from "./donation/DonationCategory.js";
import DonationCampaign from "./donation/DonationCampaign.js";
import Donation from "./donation/Donation.js";
import DonationStatistics from "./donation/DonationStatistics.js";

// Waqf models
import FamilyWaqf from "./waqf/FamilyWaqf.js";
import WaqfTransaction from "./waqf/WaqfTransaction.js";
import WaqfBeneficiary from "./waqf/WaqfBeneficiary.js";
import WaqfManagementCommittee from "./waqf/WaqfManagementCommittee.js";

// Family Tree
import FamilyRelationship from "./familytree/FamilyRelationship.js";
import FamilyTree from "./familytree/FamilyTree.js";
import FamilyTreeNode from "./familytree/FamilyTreeNode.js";

// Executive
import ExecutiveCommittee from "./executive/ExecutiveCommittee.js";
import ExecutiveDocument from "./executive/ExecutiveDocument.js";
import ExecutiveManagement from "./executive/ExecutiveManagement.js";
import ExecutivePosition from "./executive/ExecutivePosition.js";

// Reconciliation
import ReconciliationCommittee from "./reconciliation/ReconciliationCommittee.js";
import ReconciliationReport from "./reconciliation/ReconciliationReport.js";
import ReconciliationCase from "./reconciliation/ReconciliationCase.js";
import CaseSession from "./reconciliation/CaseSession.js";
import CaseDocument from "./reconciliation/CaseDocument.js";

// Export all models
export {
  db,
  Person,
  User,
  PersonalAccessToken,
  Session,
  VerificationCode,
  LoginHistory,
  SecurityLog,
  PasswordHistory,
  PasswordResetToken,
  UserPermission,
  DonationCategory,
  DonationCampaign,
  Donation,
  DonationStatistics,
  FamilyWaqf,
  WaqfTransaction,
  WaqfBeneficiary,
  WaqfManagementCommittee,
  FamilyTree,
  FamilyTreeNode,
  FamilyRelationship,
  ExecutiveCommittee,
  ExecutiveManagement,
  ExecutiveDocument,
  ExecutivePosition,
  ReconciliationCommittee,
  ReconciliationReport,
  ReconciliationCase,
  CaseDocument,
  CaseSession,
};

// Export default with all models
export default {
  db,
  Person,
  User,
  PersonalAccessToken,
  Session,
  VerificationCode,
  LoginHistory,
  SecurityLog,
  PasswordHistory,
  PasswordResetToken,
  UserPermission,
  DonationCategory,
  DonationCampaign,
  Donation,
  DonationStatistics,
  FamilyWaqf,
  WaqfTransaction,
  WaqfBeneficiary,
  WaqfManagementCommittee,
  FamilyTree,
  FamilyTreeNode,
  FamilyRelationship,
  ExecutiveCommittee,
  ExecutiveManagement,
  ExecutiveDocument,
  ExecutivePosition,
  ReconciliationCommittee,
  ReconciliationReport,
  ReconciliationCase,
  CaseDocument,
  CaseSession,
};

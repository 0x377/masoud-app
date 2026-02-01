<?php

use App\Http\Controllers\Auth\AuthController;
use App\Http\Controllers\Auth\RegisteredUserController;
use App\Http\Controllers\Auth\LoginController;
use App\Http\Controllers\Auth\VerifyEmailController;
use App\Http\Controllers\Auth\PasswordResetLinkController;
use App\Http\Controllers\Auth\NewPasswordController;
use App\Http\Controllers\Auth\PasswordController;
use App\Http\Controllers\FamilyController;
use App\Http\Controllers\DonationController;
use App\Http\Controllers\CommitteeController;
use App\Http\Controllers\CreditCardController;
use App\Http\Controllers\BankAccountController;
use App\Http\Controllers\MediaCenterController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\WaqfController;
use App\Http\Middleware\Cors;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// Test route - should work without authentication
Route::get('/test', function () {
    return response()->json([
        'api' => 'working',
        'time' => now()->toDateTimeString(),
        'message' => 'API is responding'
    ]);
});

// CORS test route
Route::middleware([Cors::class])->get('/test-cors', function () {
    return response()->json([
        'status' => '200 OK',
        'message' => 'CORS is working!',
        'timestamp' => now()->toDateTimeString()
    ]);
});

// Public Routes - No authentication required
Route::prefix('v1')->group(function () {
    
    // Health Check
    Route::get('/health', function () {
        return response()->json([
            'status' => 'healthy',
            'timestamp' => now()->toISOString(),
            'service' => 'Masoud Family Platform API',
            'version' => '1.0.0'
        ]);
    });

    // Authentication Routes (Public)
    Route::prefix('auth')->group(function () {
        // Register
        Route::post('/register', [RegisteredUserController::class, 'register']);
        Route::post('/check-email', [RegisteredUserController::class, 'checkEmail']);
        Route::post('/check-national-id', [RegisteredUserController::class, 'checkNationalId']);

        // Login
        Route::post('/login', [LoginController::class, 'store']);
        Route::post('/refresh-token', [LoginController::class, 'refreshToken']);
        Route::post('/verify-token', [LoginController::class, 'verifyToken']);

        // Password Reset (Public access)
        Route::post('/forgot-password', [PasswordResetLinkController::class, 'sendResetLink'])
            ->middleware('throttle:5,1');
        Route::post('/validate-reset-token', [NewPasswordController::class, 'validateResetToken'])
            ->middleware('throttle:10,1');
        Route::post('/reset-password', [NewPasswordController::class, 'resetPassword'])
            ->middleware('throttle:3,1');

        // Email Verification (Public access)
        Route::get('/verify-email/{token}', [VerifyEmailController::class, 'verifyEmail']);
        Route::post('/resend-verification', [VerifyEmailController::class, 'sendVerificationEmail'])
            ->middleware('throttle:6,1');
        Route::get('/check-verification-status', [VerifyEmailController::class, 'checkVerificationStatus']);
        
        // Social Login (Optional)
        Route::post('/login/{provider}', [LoginController::class, 'socialLogin'])
            ->where('provider', 'google|facebook|twitter');
    });

    // Donation Platform (الخانة الأولى - مفتوحة للجميع)
    Route::prefix('donations')->group(function () {
        Route::get('/', [DonationController::class, 'index']);
        Route::post('/', [DonationController::class, 'store']);
        Route::get('/statistics', [DonationController::class, 'statistics']);
        Route::get('/campaigns', [DonationController::class, 'getCampaigns']);
        Route::get('/campaigns/{id}', [DonationController::class, 'getCampaignDetails']);
        Route::get('/recent', [DonationController::class, 'getRecentDonations']);
        Route::get('/top-donors', [DonationController::class, 'getTopDonors']);
    });

    // Public Information
    Route::prefix('public')->group(function () {
        Route::get('/about', function () {
            return response()->json([
                'platform_name' => 'منصة عائلة المسعود',
                'description' => 'منصة متكاملة لإدارة شؤون العائلة والخدمات الاجتماعية',
                'version' => '1.0.0',
                'contact_email' => 'info@masoud-family.com'
            ]);
        });
        
        Route::get('/news', [MediaCenterController::class, 'getPublicNews']);
        Route::get('/activities', [CommitteeController::class, 'getPublicActivities']);
    });
});

// Protected Routes - Require Authentication
Route::prefix('v1')->middleware(['auth:api', 'verified'])->group(function () {
    
    // User Profile
    Route::prefix('profile')->group(function () {
        Route::get('/', [ProfileController::class, 'show']);
        Route::put('/', [ProfileController::class, 'update']);
        Route::post('/avatar', [ProfileController::class, 'updateAvatar']);
        Route::post('/change-password', [PasswordController::class, 'changePassword']);
        Route::get('/activity', [ProfileController::class, 'getActivity']);
        Route::get('/notifications', [ProfileController::class, 'getNotifications']);
        Route::put('/notifications/{id}/read', [ProfileController::class, 'markNotificationAsRead']);
    });

    // Dashboard
    Route::get('/dashboard', [DashboardController::class, 'index']);
    Route::get('/dashboard/stats', [DashboardController::class, 'getStatistics']);

    // Family Management (إدارة العائلة)
    Route::prefix('family')->group(function () {
        // Family Tree
        Route::get('/tree', [FamilyController::class, 'getFamilyTree']);
        Route::get('/tree/{personId}', [FamilyController::class, 'getPersonDetails']);
        Route::post('/tree/add-person', [FamilyController::class, 'addPerson']);
        Route::put('/tree/{personId}', [FamilyController::class, 'updatePerson']);
        Route::delete('/tree/{personId}', [FamilyController::class, 'deletePerson']);
        
        // Family Members
        Route::get('/members', [FamilyController::class, 'getMembers']);
        Route::get('/members/{memberId}', [FamilyController::class, 'getMemberDetails']);
        Route::post('/members', [FamilyController::class, 'addMember']);
        Route::put('/members/{memberId}', [FamilyController::class, 'updateMember']);
        
        // Relationships
        Route::post('/relationships', [FamilyController::class, 'addRelationship']);
        Route::get('/relationships/{personId}', [FamilyController::class, 'getRelationships']);
        
        // Birthdays & Events
        Route::get('/birthdays', [FamilyController::class, 'getUpcomingBirthdays']);
        Route::get('/events', [FamilyController::class, 'getFamilyEvents']);
    });

    // Family Archive (أرشيف العائلة - الخانة الرابعة)
    Route::prefix('archive')->group(function () {
        Route::get('/complete-tree', [FamilyController::class, 'getCompleteFamilyTree']);
        Route::get('/meetings', [FamilyController::class, 'getFamilyMeetings']);
        Route::get('/meetings/{meetingId}', [FamilyController::class, 'getMeetingDetails']);
        Route::post('/meetings', [FamilyController::class, 'createMeeting']);
        Route::post('/meetings/{meetingId}/minutes', [FamilyController::class, 'addMeetingMinutes']);
        
        // Sports Archive
        Route::get('/sports', [FamilyController::class, 'getSportsArchive']);
        Route::get('/sports/tournaments', [FamilyController::class, 'getTournaments']);
        Route::get('/sports/achievements', [FamilyController::class, 'getSportsAchievements']);
        
        // Documents Archive
        Route::get('/documents', [FamilyController::class, 'getFamilyDocuments']);
        Route::post('/documents', [FamilyController::class, 'uploadDocument']);
        Route::get('/documents/{documentId}', [FamilyController::class, 'getDocument']);
        Route::delete('/documents/{documentId}', [FamilyController::class, 'deleteDocument']);
        
        // Photos & Media
        Route::get('/photos', [FamilyController::class, 'getFamilyPhotos']);
        Route::post('/photos', [FamilyController::class, 'uploadPhoto']);
        Route::delete('/photos/{photoId}', [FamilyController::class, 'deletePhoto']);
    });

    // Donation Management (Protected operations)
    Route::prefix('donations')->group(function () {
        Route::get('/my-donations', [DonationController::class, 'getUserDonations']);
        Route::get('/receipt/{donationId}', [DonationController::class, 'generateReceipt']);
        Route::post('/recurring', [DonationController::class, 'setupRecurringDonation']);
        Route::delete('/recurring/{id}', [DonationController::class, 'cancelRecurringDonation']);
    });

    // Waqf Management (وقف العائلة - الخانة الثالثة)
    Route::prefix('waqf')->group(function () {
        Route::get('/', [WaqfController::class, 'index']);
        Route::get('/projects', [WaqfController::class, 'getProjects']);
        Route::get('/projects/{projectId}', [WaqfController::class, 'getProjectDetails']);
        Route::post('/projects', [WaqfController::class, 'createProject']);
        Route::put('/projects/{projectId}', [WaqfController::class, 'updateProject']);
        Route::post('/projects/{projectId}/donate', [WaqfController::class, 'donateToProject']);
        
        // Waqf Funds Management
        Route::get('/funds', [WaqfController::class, 'getFunds']);
        Route::get('/funds/{fundId}', [WaqfController::class, 'getFundDetails']);
        Route::post('/funds', [WaqfController::class, 'createFund']);
        
        // Waqf Reports
        Route::get('/reports', [WaqfController::class, 'generateReports']);
        Route::get('/financial-statement', [WaqfController::class, 'getFinancialStatement']);
    });

    // Board of Directors (أعضاء مجلس الإدارة - الخانة الثانية)
    Route::prefix('board')->middleware(['check.role:BOARD_MEMBER,SUPER_ADMIN'])->group(function () {
        Route::get('/members', [CommitteeController::class, 'getBoardMembers']);
        Route::get('/members/{memberId}', [CommitteeController::class, 'getBoardMemberDetails']);
        Route::post('/members', [CommitteeController::class, 'addBoardMember']);
        Route::put('/members/{memberId}', [CommitteeController::class, 'updateBoardMember']);
        
        // Board Meetings
        Route::get('/meetings', [CommitteeController::class, 'getBoardMeetings']);
        Route::post('/meetings', [CommitteeController::class, 'createBoardMeeting']);
        Route::get('/meetings/{meetingId}', [CommitteeController::class, 'getBoardMeetingDetails']);
        Route::post('/meetings/{meetingId}/minutes', [CommitteeController::class, 'addBoardMeetingMinutes']);
        
        // Board Decisions
        Route::get('/decisions', [CommitteeController::class, 'getBoardDecisions']);
        Route::post('/decisions', [CommitteeController::class, 'createBoardDecision']);
        Route::put('/decisions/{decisionId}/status', [CommitteeController::class, 'updateDecisionStatus']);
        
        // Board Reports
        Route::get('/reports', [CommitteeController::class, 'generateBoardReports']);
        Route::get('/financial-reports', [CommitteeController::class, 'getFinancialReports']);
    });

    // Executive Management (الإدارة التنفيذية - الخانة الخامسة)
    Route::prefix('executive')->middleware(['check.role:EXECUTIVE,SUPER_ADMIN'])->group(function () {
        Route::get('/dashboard', [CommitteeController::class, 'executiveDashboard']);
        Route::get('/reports', [CommitteeController::class, 'generateExecutiveReports']);
        
        // Management Operations
        Route::get('/operations', [CommitteeController::class, 'getOperations']);
        Route::post('/operations', [CommitteeController::class, 'createOperation']);
        Route::put('/operations/{operationId}/status', [CommitteeController::class, 'updateOperationStatus']);
        
        // Strategic Planning
        Route::get('/strategic-plans', [CommitteeController::class, 'getStrategicPlans']);
        Route::post('/strategic-plans', [CommitteeController::class, 'createStrategicPlan']);
        
        // Performance Metrics
        Route::get('/metrics', [CommitteeController::class, 'getPerformanceMetrics']);
        Route::get('/kpis', [CommitteeController::class, 'getKPIs']);
    });

    // Financial Management (المدير المالي - الخانة السادسة)
    Route::prefix('financial')->middleware(['check.role:FINANCIAL_MANAGER,SUPER_ADMIN'])->group(function () {
        // Bank Accounts Management
        Route::get('/bank-accounts', [BankAccountController::class, 'index']);
        Route::get('/bank-accounts/{accountId}', [BankAccountController::class, 'show']);
        Route::post('/bank-accounts', [BankAccountController::class, 'store']);
        Route::put('/bank-accounts/{accountId}', [BankAccountController::class, 'update']);
        Route::delete('/bank-accounts/{accountId}', [BankAccountController::class, 'destroy']);
        Route::post('/bank-accounts/{accountId}/transactions', [BankAccountController::class, 'addTransaction']);
        Route::get('/bank-accounts/{accountId}/transactions', [BankAccountController::class, 'getTransactions']);
        Route::get('/bank-accounts/{accountId}/statement', [BankAccountController::class, 'generateStatement']);
        
        // Financial Reports
        Route::get('/reports/balance-sheet', [BankAccountController::class, 'getBalanceSheet']);
        Route::get('/reports/income-statement', [BankAccountController::class, 'getIncomeStatement']);
        Route::get('/reports/cash-flow', [BankAccountController::class, 'getCashFlow']);
        Route::get('/reports/budget-vs-actual', [BankAccountController::class, 'getBudgetVsActual']);
        
        // Financial Operations
        Route::post('/transfers', [BankAccountController::class, 'transferFunds']);
        Route::post('/payments', [BankAccountController::class, 'processPayment']);
        Route::get('/transactions', [BankAccountController::class, 'getAllTransactions']);
        Route::get('/transactions/{transactionId}', [BankAccountController::class, 'getTransactionDetails']);
        
        // Budget Management
        Route::get('/budgets', [BankAccountController::class, 'getBudgets']);
        Route::post('/budgets', [BankAccountController::class, 'createBudget']);
        Route::put('/budgets/{budgetId}', [BankAccountController::class, 'updateBudget']);
        Route::get('/budgets/{budgetId}/analysis', [BankAccountController::class, 'analyzeBudget']);
    });

    // Social Committee (اللجنة الاجتماعية - الخانة السابعة)
    Route::prefix('social')->middleware(['check.role:SOCIAL_COMMITTEE,SUPER_ADMIN'])->group(function () {
        // Marriage Aid
        Route::get('/marriage-aids', [CommitteeController::class, 'getMarriageAids']);
        Route::get('/marriage-aids/{aidId}', [CommitteeController::class, 'getMarriageAidDetails']);
        Route::post('/marriage-aids', [CommitteeController::class, 'createMarriageAid']);
        Route::put('/marriage-aids/{aidId}/status', [CommitteeController::class, 'updateMarriageAidStatus']);
        Route::post('/marriage-aids/apply', [CommitteeController::class, 'applyForMarriageAid']);
        
        // Family Aid
        Route::get('/family-aids', [CommitteeController::class, 'getFamilyAids']);
        Route::post('/family-aids', [CommitteeController::class, 'createFamilyAid']);
        Route::put('/family-aids/{aidId}/status', [CommitteeController::class, 'updateFamilyAidStatus']);
        Route::post('/family-aids/apply', [CommitteeController::class, 'applyForFamilyAid']);
        
        // Aid Requests Review
        Route::get('/aid-requests', [CommitteeController::class, 'getAidRequests']);
        Route::get('/aid-requests/{requestId}', [CommitteeController::class, 'getAidRequestDetails']);
        Route::post('/aid-requests/{requestId}/review', [CommitteeController::class, 'reviewAidRequest']);
        Route::put('/aid-requests/{requestId}/status', [CommitteeController::class, 'updateAidRequestStatus']);
        
        // Social Services
        Route::get('/services', [CommitteeController::class, 'getSocialServices']);
        Route::post('/services', [CommitteeController::class, 'createSocialService']);
        Route::get('/services/{serviceId}/beneficiaries', [CommitteeController::class, 'getServiceBeneficiaries']);
        
        // Reports
        Route::get('/reports/aid-distribution', [CommitteeController::class, 'getAidDistributionReport']);
        Route::get('/reports/beneficiaries', [CommitteeController::class, 'getBeneficiariesReport']);
    });

    // Cultural Committee (اللجنة الثقافية - الخانة الثامنة)
    Route::prefix('cultural')->middleware(['check.role:CULTURAL_COMMITTEE,SUPER_ADMIN'])->group(function () {
        // Initiatives
        Route::get('/initiatives', [CommitteeController::class, 'getCulturalInitiatives']);
        Route::post('/initiatives', [CommitteeController::class, 'createCulturalInitiative']);
        Route::put('/initiatives/{initiativeId}', [CommitteeController::class, 'updateCulturalInitiative']);
        
        // Quran Competition
        Route::get('/quran-competition', [CommitteeController::class, 'getQuranCompetition']);
        Route::post('/quran-competition/register', [CommitteeController::class, 'registerForQuranCompetition']);
        Route::post('/quran-competition/scores', [CommitteeController::class, 'submitCompetitionScores']);
        
        // Academic Excellence Awards
        Route::get('/academic-awards', [CommitteeController::class, 'getAcademicAwards']);
        Route::post('/academic-awards/nominate', [CommitteeController::class, 'nominateForAcademicAward']);
        Route::put('/academic-awards/{awardId}/status', [CommitteeController::class, 'updateAwardStatus']);
        
        // Your Advisor Initiative
        Route::get('/advisor-sessions', [CommitteeController::class, 'getAdvisorSessions']);
        Route::post('/advisor-sessions/book', [CommitteeController::class, 'bookAdvisorSession']);
        Route::get('/advisor-sessions/{sessionId}', [CommitteeController::class, 'getAdvisorSessionDetails']);
        
        // Cultural Events
        Route::get('/events', [CommitteeController::class, 'getCulturalEvents']);
        Route::post('/events', [CommitteeController::class, 'createCulturalEvent']);
        Route::post('/events/{eventId}/register', [CommitteeController::class, 'registerForEvent']);
    });

    // Reconciliation Committee (لجنة إصلاح ذات البين - الخانة التاسعة)
    Route::prefix('reconciliation')->middleware(['check.role:RECONCILIATION_COMMITTEE,SUPER_ADMIN'])->group(function () {
        // Consultations
        Route::get('/consultations', [CommitteeController::class, 'getConsultations']);
        Route::post('/consultations', [CommitteeController::class, 'createConsultation']);
        Route::get('/consultations/{consultationId}', [CommitteeController::class, 'getConsultationDetails']);
        Route::put('/consultations/{consultationId}/status', [CommitteeController::class, 'updateConsultationStatus']);
        Route::post('/consultations/{consultationId}/resolution', [CommitteeController::class, 'submitResolution']);
        
        // Cases
        Route::get('/cases', [CommitteeController::class, 'getReconciliationCases']);
        Route::get('/cases/{caseId}', [CommitteeController::class, 'getCaseDetails']);
        Route::post('/cases', [CommitteeController::class, 'createCase']);
        Route::put('/cases/{caseId}/status', [CommitteeController::class, 'updateCaseStatus']);
        Route::post('/cases/{caseId}/sessions', [CommitteeController::class, 'addCaseSession']);
        
        // Committee Members
        Route::get('/members', [CommitteeController::class, 'getReconciliationMembers']);
        Route::post('/members', [CommitteeController::class, 'addReconciliationMember']);
        
        // Reports
        Route::get('/reports/cases-summary', [CommitteeController::class, 'getCasesSummary']);
        Route::get('/reports/success-rate', [CommitteeController::class, 'getSuccessRate']);
    });

    // Sports Committee (اللجنة الرياضية - الخانة الثامنة - الثانية)
    Route::prefix('sports')->middleware(['check.role:SPORTS_COMMITTEE,SUPER_ADMIN'])->group(function () {
        // Tournaments
        Route::get('/tournaments', [CommitteeController::class, 'getSportsTournaments']);
        Route::post('/tournaments', [CommitteeController::class, 'createTournament']);
        Route::get('/tournaments/{tournamentId}', [CommitteeController::class, 'getTournamentDetails']);
        Route::post('/tournaments/{tournamentId}/register', [CommitteeController::class, 'registerForTournament']);
        Route::post('/tournaments/{tournamentId}/matches', [CommitteeController::class, 'addTournamentMatch']);
        
        // Teams
        Route::get('/teams', [CommitteeController::class, 'getSportsTeams']);
        Route::post('/teams', [CommitteeController::class, 'createTeam']);
        Route::post('/teams/{teamId}/members', [CommitteeController::class, 'addTeamMember']);
        
        // Training Sessions
        Route::get('/trainings', [CommitteeController::class, 'getTrainingSessions']);
        Route::post('/trainings', [CommitteeController::class, 'createTrainingSession']);
        Route::post('/trainings/{sessionId}/attendance', [CommitteeController::class, 'markAttendance']);
        
        // Sports Facilities
        Route::get('/facilities', [CommitteeController::class, 'getSportsFacilities']);
        Route::post('/facilities/book', [CommitteeController::class, 'bookFacility']);
        
        // Achievements
        Route::get('/achievements', [CommitteeController::class, 'getSportsAchievements']);
        Route::post('/achievements', [CommitteeController::class, 'addAchievement']);
    });

    // Media Center (المركز الإعلامي - الخانة العاشرة)
    Route::prefix('media')->middleware(['check.role:MEDIA_CENTER,SUPER_ADMIN'])->group(function () {
        // News Management
        Route::get('/news', [MediaCenterController::class, 'index']);
        Route::post('/news', [MediaCenterController::class, 'store']);
        Route::get('/news/{newsId}', [MediaCenterController::class, 'show']);
        Route::put('/news/{newsId}', [MediaCenterController::class, 'update']);
        Route::delete('/news/{newsId}', [MediaCenterController::class, 'destroy']);
        Route::post('/news/{newsId}/publish', [MediaCenterController::class, 'publish']);
        
        // Announcements
        Route::get('/announcements', [MediaCenterController::class, 'getAnnouncements']);
        Route::post('/announcements', [MediaCenterController::class, 'createAnnouncement']);
        Route::put('/announcements/{announcementId}', [MediaCenterController::class, 'updateAnnouncement']);
        
        // Gallery
        Route::get('/gallery', [MediaCenterController::class, 'getGallery']);
        Route::post('/gallery', [MediaCenterController::class, 'uploadToGallery']);
        Route::delete('/gallery/{mediaId}', [MediaCenterController::class, 'deleteFromGallery']);
        
        // Publications
        Route::get('/publications', [MediaCenterController::class, 'getPublications']);
        Route::post('/publications', [MediaCenterController::class, 'createPublication']);
        Route::get('/publications/{publicationId}/download', [MediaCenterController::class, 'downloadPublication']);
        
        // Social Media
        Route::get('/social-media/posts', [MediaCenterController::class, 'getSocialMediaPosts']);
        Route::post('/social-media/posts', [MediaCenterController::class, 'createSocialMediaPost']);
        Route::get('/social-media/analytics', [MediaCenterController::class, 'getSocialMediaAnalytics']);
    });

    // Credit Cards Management
    Route::prefix('credit-cards')->group(function () {
        Route::get('/', [CreditCardController::class, 'index']);
        Route::post('/', [CreditCardController::class, 'store']);
        Route::delete('/{id}', [CreditCardController::class, 'destroy']);
        Route::put('/{id}/default', [CreditCardController::class, 'setDefault']);
    });
    
    // Logout
    Route::post('/auth/logout', [LoginController::class, 'destroy']);
});

// ============== REMOVED DUPLICATE ROUTES BELOW ==============
// The following routes were duplicated and have been removed:
// 1. Duplicate Family Archive routes (already defined in v1 protected routes)
// 2. Duplicate Hall Booking System routes (need to be moved to proper location)
// 3. Duplicate Reports System routes
// 4. Duplicate Admin Routes
// 5. Duplicate Logout route (already added above)
// 6. Duplicate CORS test route (moved to top)
// ============================================================

// Add Hall Booking System to protected routes
Route::prefix('v1')->middleware(['auth:api', 'verified'])->group(function () {
    Route::prefix('hall-booking')->group(function () {
        Route::get('/halls', [CommitteeController::class, 'getHalls']);
        Route::get('/halls/{hallId}/availability', [CommitteeController::class, 'checkHallAvailability']);
        Route::post('/halls/{hallId}/book', [CommitteeController::class, 'bookHall']);
        Route::get('/my-bookings', [CommitteeController::class, 'getMyBookings']);
        Route::put('/bookings/{bookingId}/cancel', [CommitteeController::class, 'cancelBooking']);
        Route::get('/bookings/{bookingId}', [CommitteeController::class, 'getBookingDetails']);
    });
});

// Reports System - Protected
Route::prefix('v1')->middleware(['auth:api', 'verified', 'check.role:SUPER_ADMIN,EXECUTIVE'])->group(function () {
    Route::prefix('reports')->group(function () {
        Route::get('/financial', [CommitteeController::class, 'generateFinancialReports']);
        Route::get('/activities', [CommitteeController::class, 'generateActivitiesReport']);
        Route::get('/members', [CommitteeController::class, 'generateMembersReport']);
        Route::get('/donations', [DonationController::class, 'generateDonationsReport']);
        Route::get('/waqf', [WaqfController::class, 'generateWaqfReport']);
        Route::get('/social-aid', [CommitteeController::class, 'generateSocialAidReport']);
        
        // Export Reports
        Route::post('/export/financial', [CommitteeController::class, 'exportFinancialReport']);
        Route::post('/export/members', [CommitteeController::class, 'exportMembersReport']);
    });
});

// Admin Routes (Super Admin Only)
Route::prefix('v1')->middleware(['auth:api', 'verified', 'check.role:SUPER_ADMIN'])->group(function () {
    Route::prefix('admin')->group(function () {
        // User Management
        Route::get('/users', [AuthController::class, 'getAllUsers']);
        Route::get('/users/{userId}', [AuthController::class, 'getUserDetails']);
        Route::put('/users/{userId}', [AuthController::class, 'updateUser']);
        Route::put('/users/{userId}/status', [AuthController::class, 'updateUserStatus']);
        Route::put('/users/{userId}/role', [AuthController::class, 'updateUserRole']);
        
        // System Settings
        Route::get('/settings', [AuthController::class, 'getSystemSettings']);
        Route::put('/settings', [AuthController::class, 'updateSystemSettings']);
        
        // Backup & Restore
        Route::post('/backup', [AuthController::class, 'createBackup']);
        Route::get('/backups', [AuthController::class, 'getBackups']);
        Route::post('/restore/{backupId}', [AuthController::class, 'restoreBackup']);
        
        // System Logs
        Route::get('/logs', [AuthController::class, 'getSystemLogs']);
        Route::get('/logs/{logId}', [AuthController::class, 'getLogDetails']);
        
        // Analytics
        Route::get('/analytics', [AuthController::class, 'getAnalytics']);
        Route::get('/analytics/usage', [AuthController::class, 'getUsageAnalytics']);
    });
});

// Fallback Route
Route::fallback(function () {
    return response()->json([
        'success' => false,
        'message' => 'Route not found',
        'error_code' => 'ROUTE_NOT_FOUND',
        'documentation_url' => url('/api-docs')
    ], 404);
});

// Apply CORS middleware to all API routes globally
// This should be handled in bootstrap/app.php or via global middleware

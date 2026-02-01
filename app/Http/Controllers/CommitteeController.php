<?php

namespace App\Http\Controllers;

use App\Http\Requests\CreateMeetingRequest;
use App\Http\Requests\ReviewAidRequest;
use App\Models\BoardMember;
use App\Models\SocialCommitteeMember;
use App\Models\MarriageAidRequest;
use App\Models\FamilyMeeting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CommitteeController extends Controller
{
    /**
     * أعضاء مجلس الإدارة (الخانة الثانية)
     */
    public function getBoardMembers(Request $request)
    {
        $members = BoardMember::with(['person', 'user'])
            ->where('is_current', true)
            ->orderBy('position')
            ->get();
        
        $meetings = FamilyMeeting::where('meeting_type', 'BOARD')
            ->orderBy('meeting_date', 'desc')
            ->limit(5)
            ->get();
        
        return response()->json([
            'board_members' => $members,
            'recent_meetings' => $meetings,
            'total_members' => $members->count(),
            'upcoming_meetings' => FamilyMeeting::where('meeting_type', 'BOARD')
                ->whereDate('meeting_date', '>=', now())
                ->count()
        ]);
    }
<<<<<<< HEAD
    
=======

>>>>>>> 6e447c6 (Init...)
    /**
     * إنشاء اجتماع مجلس الإدارة
     */
    public function createMeeting(CreateMeetingRequest $request)
    {
        $user = $request->user();
        
        $meeting = FamilyMeeting::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'meeting_type' => 'BOARD',
            'title' => $request->title,
            'description' => $request->description,
            'meeting_date' => $request->meeting_date,
            'location' => $request->location,
            'organizer_id' => $user->id,
            'agenda' => $request->agenda,
            'expected_attendees' => $request->expected_attendees,
            'metadata' => [
                'created_by' => $user->full_name_arabic,
                'user_type' => $user->user_type,
            ]
        ]);
        
        // إرسال دعوات الحضور
        $this->sendMeetingInvitations($meeting);
        
        return response()->json([
            'message' => 'تم إنشاء الاجتماع بنجاح',
            'meeting' => $meeting
        ], 201);
    }
    
    /**
     * قرارات مجلس الإدارة
     */
    public function getDecisions(Request $request)
    {
        $decisions = \App\Models\BoardDecision::with(['meeting', 'proposedBy.person'])
            ->orderBy('decision_date', 'desc')
            ->paginate($request->input('per_page', 10));
        
        return response()->json([
            'decisions' => $decisions,
            'pending_decisions' => \App\Models\BoardDecision::where('status', 'PENDING')->count(),
            'implemented_decisions' => \App\Models\BoardDecision::where('status', 'IMPLEMENTED')->count(),
        ]);
    }
    
    /**
     * اللجنة الاجتماعية - طلبات الإعانة (الخانة السابعة)
     */
    public function getAidRequests(Request $request)
    {
        $query = MarriageAidRequest::with(['applicant', 'user.person', 'reviewer.person']);
        
        if ($request->has('status')) {
            $query->where('status', $request->status);
        }
        
        if ($request->has('type')) {
            $query->whereHas('socialCommitteeMember', function($q) use ($request) {
                $q->where('aid_type', $request->type);
            });
        }
        
        $requests = $query->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 15));
        
        $stats = [
            'total_requests' => MarriageAidRequest::count(),
            'pending_requests' => MarriageAidRequest::where('status', 'PENDING')->count(),
            'approved_requests' => MarriageAidRequest::where('status', 'APPROVED')->count(),
            'total_amount_requested' => MarriageAidRequest::sum('requested_amount'),
            'total_amount_approved' => MarriageAidRequest::where('status', 'APPROVED')->sum('approved_amount'),
        ];
        
        return response()->json([
            'aid_requests' => $requests,
            'statistics' => $stats
        ]);
    }
    
    /**
     * مراجعة طلب إعانة زواج
     */
    public function reviewAidRequest(ReviewAidRequest $request, $id)
    {
        DB::beginTransaction();
        
        try {
            $aidRequest = MarriageAidRequest::findOrFail($id);
            $user = $request->user();
            
            // التحقق من أن المراجع عضو في اللجنة الاجتماعية
            if (!$user->user_type === 'SOCIAL_COMMITTEE' && !$user->user_type === 'SUPER_ADMIN') {
                return response()->json([
                    'message' => 'غير مصرح لك بمراجعة طلبات الإعانة'
                ], 403);
            }
            
            $aidRequest->update([
                'status' => $request->status,
                'approved_amount' => $request->approved_amount,
                'reviewed_by' => $user->id,
                'reviewed_at' => now(),
                'notes' => $request->notes,
            ]);
            
            // إذا تم الموافقة، إنشاء سند صرف
            if ($request->status === 'APPROVED') {
                $this->createPaymentVoucher($aidRequest);
                
                // إرسال إشعار للمتقدم
                $this->sendApprovalNotification($aidRequest);
            }
            
            DB::commit();
            
            return response()->json([
                'message' => 'تم مراجعة الطلب بنجاح',
                'aid_request' => $aidRequest->fresh()
            ]);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'message' => 'حدث خطأ أثناء مراجعة الطلب',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * إعانات الزواج (الخانة السابعة)
     */
    public function getMarriageAids(Request $request)
    {
        $aids = MarriageAidRequest::where('status', 'APPROVED')
            ->with(['applicant', 'reviewer.person'])
            ->orderBy('marriage_date', 'desc')
            ->paginate($request->input('per_page', 10));
        
        $summary = [
            'total_aids_given' => MarriageAidRequest::where('status', 'APPROVED')->count(),
            'total_amount_distributed' => MarriageAidRequest::where('status', 'APPROVED')->sum('approved_amount'),
            'average_aid_amount' => MarriageAidRequest::where('status', 'APPROVED')->avg('approved_amount'),
            'aids_this_year' => MarriageAidRequest::where('status', 'APPROVED')
                ->whereYear('marriage_date', date('Y'))
                ->count(),
        ];
        
        return response()->json([
            'marriage_aids' => $aids,
            'summary' => $summary
        ]);
    }
    
    /**
     * إنشاء إعانة زواج جديدة
     */
    public function createMarriageAid(Request $request)
    {
        $validated = $request->validate([
            'applicant_id' => 'required|exists:persons,person_id',
            'requested_amount' => 'required|numeric|min:0',
            'marriage_date' => 'required|date|after:today',
            'marriage_course_certificate' => 'nullable|file|mimes:pdf|max:2048',
            'national_id_copy' => 'required|file|mimes:pdf,jpg,png|max:2048',
            'notes' => 'nullable|string',
        ]);
        
        $user = $request->user();
        $applicant = \App\Models\Person::find($validated['applicant_id']);
        
        // التحقق من شروط إعانة الزواج
        $eligibility = $this->checkMarriageAidEligibility($applicant, $validated);
        
        if (!$eligibility['eligible']) {
            return response()->json([
                'message' => 'غير مؤهل للحصول على إعانة الزواج',
                'reasons' => $eligibility['reasons']
            ], 422);
        }
        
        DB::beginTransaction();
        
        try {
            // تحميل الملفات
            $certificatePath = null;
            $idCopyPath = null;
            
            if ($request->hasFile('marriage_course_certificate')) {
                $certificatePath = $request->file('marriage_course_certificate')->store('marriage-aids/certificates');
            }
            
            if ($request->hasFile('national_id_copy')) {
                $idCopyPath = $request->file('national_id_copy')->store('marriage-aids/id-copies');
            }
            
            $marriageAid = MarriageAidRequest::create([
                'id' => \Illuminate\Support\Str::uuid(),
                'applicant_id' => $applicant->person_id,
                'user_id' => $user->id,
                'requested_amount' => $validated['requested_amount'],
                'marriage_date' => $validated['marriage_date'],
                'marriage_course_certificate' => $certificatePath,
                'national_id_copy' => $idCopyPath,
                'notes' => $validated['notes'],
                'status' => 'PENDING',
            ]);
            
            DB::commit();
            
            // إرسال إشعار لأعضاء اللجنة الاجتماعية
            $this->notifySocialCommittee($marriageAid);
            
            return response()->json([
                'message' => 'تم تقديم طلب إعانة الزواج بنجاح',
                'marriage_aid' => $marriageAid,
                'next_steps' => 'سيتم مراجعة طلبك من قبل اللجنة الاجتماعية خلال ٣ أيام عمل'
            ], 201);
            
        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'message' => 'حدث خطأ أثناء تقديم الطلب',
                'error' => $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * لوحة تحكم الإدارة التنفيذية (الخانة الخامسة)
     */
    public function executiveDashboard(Request $request)
    {
        $user = $request->user();
        
        if (!$user->user_type === 'EXECUTIVE' && !$user->user_type === 'SUPER_ADMIN') {
            return response()->json([
                'message' => 'غير مصرح لك بالوصول إلى لوحة التحكم التنفيذية'
            ], 403);
        }
        
        $dashboardData = [
            'financial_summary' => $this->getFinancialSummary(),
            'donation_stats' => $this->getDonationStatistics(),
            'committee_activities' => $this->getCommitteeActivities(),
            'pending_actions' => $this->getPendingActions(),
            'recent_events' => $this->getRecentEvents(),
        ];
        
        return response()->json([
            'dashboard' => $dashboardData,
            'executive_info' => [
                'name' => $user->full_name_arabic,
                'position' => 'المدير التنفيذي',
                'since' => $user->created_at->format('Y-m-d'),
            ]
        ]);
    }
    
    /**
     * توليد التقارير
     */
    public function generateReports(Request $request)
    {
        $request->validate([
            'report_type' => 'required|in:financial,donations,committees,family,annual',
            'start_date' => 'required|date',
            'end_date' => 'required|date|after_or_equal:start_date',
            'format' => 'sometimes|in:pdf,excel,json',
        ]);
        
        $reportType = $request->report_type;
        $startDate = $request->start_date;
        $endDate = $request->end_date;
        $format = $request->format ?? 'json';
        
        $reportData = [];
        
        switch ($reportType) {
            case 'financial':
                $reportData = $this->generateFinancialReport($startDate, $endDate);
                break;
                
            case 'donations':
                $reportData = $this->generateDonationsReport($startDate, $endDate);
                break;
                
            case 'committees':
                $reportData = $this->generateCommitteesReport($startDate, $endDate);
                break;
                
            case 'family':
                $reportData = $this->generateFamilyReport($startDate, $endDate);
                break;
                
            case 'annual':
                $reportData = $this->generateAnnualReport($startDate, $endDate);
                break;
        }
        
        if ($format === 'pdf') {
            return $this->generatePdfReport($reportData, $reportType);
        } elseif ($format === 'excel') {
            return $this->generateExcelReport($reportData, $reportType);
        }
        
        return response()->json([
            'report_type' => $reportType,
            'period' => [
                'start_date' => $startDate,
                'end_date' => $endDate,
            ],
            'data' => $reportData,
            'generated_at' => now()->format('Y-m-d H:i:s'),
            'generated_by' => $request->user()->full_name_arabic,
        ]);
    }
    
    /**
     * التحقق من أهلية إعانة الزواج
     */
    private function checkMarriageAidEligibility($applicant, $data)
    {
        $reasons = [];
        $eligible = true;
        
        // التحقق من العمر
        $age = $applicant->age;
        $maxAge = config('family.marriage_aid.max_age_for_aid', 35);
        
        if ($age > $maxAge) {
            $reasons[] = "العمر يتجاوز الحد الأقصى ({$maxAge} سنة)";
            $eligible = false;
        }
        
        // التحقق من أن الزواج الأول
        $previousMarriages = \App\Models\Marriage::where(function($query) use ($applicant) {
            $query->where('husband_id', $applicant->person_id)
                  ->orWhere('wife_id', $applicant->person_id);
        })->count();
        
        if ($previousMarriages > 0) {
            $reasons[] = 'إعانة الزواج للزواج الأول فقط';
            $eligible = false;
        }
        
        // التحقق من دورة المقبلين على الزواج
        if (config('family.marriage_aid.marriage_course_required') && !$data['marriage_course_certificate']) {
            $reasons[] = 'شهادة دورة المقبلين على الزواج مطلوبة';
            $eligible = false;
        }
        
        return [
            'eligible' => $eligible,
            'reasons' => $reasons
        ];
    }
    
    /**
     * إرسال دعوات الاجتماع
     */
    private function sendMeetingInvitations(FamilyMeeting $meeting)
    {
        $boardMembers = BoardMember::where('is_current', true)
            ->with(['user'])
            ->get();
        
        foreach ($boardMembers as $member) {
            // إرسال بريد إلكتروني
            \Illuminate\Support\Facades\Mail::to($member->user->email)
                ->send(new \App\Mail\MeetingInvitation($meeting, $member->user));
            
            // إرسال إشعار في النظام
            \App\Models\Notification::create([
                'id' => \Illuminate\Support\Str::uuid(),
                'user_id' => $member->user_id,
                'type' => 'MEETING_INVITATION',
                'title' => 'دعوة لحضور اجتماع مجلس الإدارة',
                'message' => "أنت مدعو لحضور اجتماع: {$meeting->title}",
                'data' => [
                    'meeting_id' => $meeting->id,
                    'meeting_date' => $meeting->meeting_date,
                    'location' => $meeting->location,
                ],
                'read_at' => null,
            ]);
        }
    }
    
    /**
     * إنشاء سند صرف
     */
    private function createPaymentVoucher(MarriageAidRequest $aidRequest)
    {
        $voucher = \App\Models\PaymentVoucher::create([
            'id' => \Illuminate\Support\Str::uuid(),
            'voucher_number' => 'VCH-' . date('Ymd') . '-' . strtoupper(substr(uniqid(), -6)),
            'aid_request_id' => $aidRequest->id,
            'applicant_id' => $aidRequest->applicant_id,
            'amount' => $aidRequest->approved_amount,
            'payment_method' => 'BANK_TRANSFER',
            'status' => 'PENDING',
            'bank_account' => $aidRequest->bank_account,
            'notes' => 'إعانة زواج',
            'approved_by' => $aidRequest->reviewed_by,
            'approved_at' => now(),
        ]);
        
        return $voucher;
    }
    
    /**
     * الملخص المالي
     */
    private function getFinancialSummary()
    {
        return [
            'total_donations' => Donation::where('status', 'COMPLETED')->sum('amount'),
            'total_expenses' => \App\Models\Expense::sum('amount'),
            'marriage_aid_expenses' => MarriageAidRequest::where('status', 'APPROVED')->sum('approved_amount'),
            'family_aid_expenses' => \App\Models\FamilyAid::sum('amount'),
            'balance' => Donation::where('status', 'COMPLETED')->sum('amount') - 
                         (\App\Models\Expense::sum('amount') + 
                          MarriageAidRequest::where('status', 'APPROVED')->sum('approved_amount') +
                          \App\Models\FamilyAid::sum('amount')),
            'top_expense_categories' => \App\Models\Expense::select('category', DB::raw('SUM(amount) as total'))
                ->groupBy('category')
                ->orderBy('total', 'desc')
                ->limit(5)
                ->get(),
        ];
    }
    
    /**
     * إحصاءات التبرعات
     */
    private function getDonationStatistics()
    {
        return [
            'total_donors' => Donation::where('status', 'COMPLETED')->distinct('donor_id')->count(),
            'monthly_average' => Donation::where('status', 'COMPLETED')
                ->where('created_at', '>=', now()->subYear())
                ->avg('amount'),
            'donations_by_month' => Donation::select(
                DB::raw("DATE_TRUNC('month', created_at) as month"),
                DB::raw('COUNT(*) as count'),
                DB::raw('SUM(amount) as total')
            )
                ->where('status', 'COMPLETED')
                ->where('created_at', '>=', now()->subYear())
                ->groupBy(DB::raw("DATE_TRUNC('month', created_at)"))
                ->orderBy('month', 'desc')
                ->get(),
            'recurring_donors' => Donation::select('donor_id', DB::raw('COUNT(*) as donation_count'))
                ->where('status', 'COMPLETED')
                ->groupBy('donor_id')
                ->havingRaw('COUNT(*) > 1')
                ->count(),
        ];
    }
    
    /**
     * نشاطات اللجان
     */
    private function getCommitteeActivities()
    {
        return [
            'social_committee' => [
                'total_aids' => MarriageAidRequest::count(),
                'pending_reviews' => MarriageAidRequest::where('status', 'PENDING')->count(),
                'last_activity' => MarriageAidRequest::latest()->first()?->created_at,
            ],
            'cultural_committee' => [
                'total_events' => \App\Models\CulturalEvent::count(),
                'upcoming_events' => \App\Models\CulturalEvent::where('event_date', '>=', now())->count(),
                'quran_competitions' => \App\Models\QuranCompetition::count(),
            ],
            'sports_committee' => [
                'total_tournaments' => \App\Models\SportsTournament::count(),
                'active_teams' => \App\Models\SportsTeam::where('is_active', true)->count(),
                'upcoming_matches' => \App\Models\SportsMatch::where('match_date', '>=', now())->count(),
            ],
            'reconciliation_committee' => [
                'total_cases' => \App\Models\ReconciliationCase::count(),
                'resolved_cases' => \App\Models\ReconciliationCase::where('status', 'RESOLVED')->count(),
                'active_cases' => \App\Models\ReconciliationCase::where('status', 'ACTIVE')->count(),
            ],
        ];
    }
    
    /**
     * الإجراءات المعلقة
     */
    private function getPendingActions()
    {
        return [
            'pending_aid_requests' => MarriageAidRequest::where('status', 'PENDING')->count(),
            'pending_meeting_minutes' => FamilyMeeting::whereNull('minutes_file')->count(),
            'pending_expense_approvals' => \App\Models\Expense::where('status', 'PENDING')->count(),
            'pending_membership_requests' => \App\Models\MembershipRequest::where('status', 'PENDING')->count(),
        ];
    }
    
    /**
     * الأحداث الأخيرة
     */
    private function getRecentEvents()
    {
        return [
            'recent_donations' => Donation::with(['donor.person'])
                ->where('status', 'COMPLETED')
                ->orderBy('paid_at', 'desc')
                ->limit(5)
                ->get(),
            'recent_marriages' => Marriage::with(['husband', 'wife'])
                ->orderBy('marriage_date', 'desc')
                ->limit(5)
                ->get(),
            'recent_births' => Person::where('birth_date', '>=', now()->subMonths(6))
                ->orderBy('birth_date', 'desc')
                ->limit(5)
                ->get(),
            'upcoming_events' => \App\Models\FamilyEvent::where('event_date', '>=', now())
                ->orderBy('event_date')
                ->limit(5)
                ->get(),
        ];
    }
}

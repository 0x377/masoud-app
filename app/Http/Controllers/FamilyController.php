<?php

namespace App\Http\Controllers;

use App\Http\Requests\AddFamilyMemberRequest;
use App\Http\Requests\AddRelationshipRequest;
use App\Models\Person;
use App\Models\FamilyRelationship;
use App\Models\Marriage;
use App\Models\FamilyUnit;
use App\Services\FamilyTreeService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use \App\Models\User;
use \Illuminate\Support\Str;

class FamilyController extends Controller
{
    protected $familyTreeService;

    public function __construct(FamilyTreeService $familyTreeService)
    {
        $this->familyTreeService = $familyTreeService;
    }

    /**
     * get family tree
     * input request, persion id
     * select all persion where if persion id is equl
     */
    public function getFamilyTree(Request $request, $personId)
    {
        $person = Person::where('person_id', $personId)
            ->orWhere('national_id', $personId)
            ->firstOrFail();

        $depth = $request->input('depth', 3);

        $tree = $this->familyTreeService->generateTree($person->person_id, $depth);

        return response()->json([
            'person' => $person,
            'tree' => $tree,
            'statistics' => $this->getFamilyStatistics($person)
        ]);
    }

    /**
     * get family members
     */
    public function getFamilyMembers(Request $request)
    {
        $query = Person::query();
        
        if ($request->has('gender')) {
            $query->where('gender', $request->gender);
        }
        
        if ($request->has('is_alive')) {
            $query->where('is_alive', $request->boolean('is_alive'));
        }
        
        if ($request->has('min_age') || $request->has('max_age')) {
            $query->whereNotNull('birth_date');
            
            if ($request->has('min_age')) {
                $minDate = now()->subYears($request->min_age)->toDateString();
                $query->where('birth_date', '<=', $minDate);
            }
            
            if ($request->has('max_age')) {
                $maxDate = now()->subYears($request->max_age + 1)->toDateString();
                $query->where('birth_date', '>=', $maxDate);
            }
        }
        
        if ($request->has('search')) {
            $search = $request->search;
            $query->where(function($q) use ($search) {
                $q->where('full_name_arabic', 'LIKE', "%{$search}%")
                  ->orWhere('full_name_english', 'LIKE', "%{$search}%")
                  ->orWhere('national_id', 'LIKE', "%{$search}%");
            });
        }
        
        $members = $query->with(['user', 'marriagesAsHusband', 'marriagesAsWife'])
            ->orderBy('birth_date', 'desc')
            ->paginate($request->input('per_page', 20));

        return response()->json([
            'members' => $members,
            'total_count' => Person::count(),
            'alive_count' => Person::where('is_alive', true)->count(),
            'male_count' => Person::where('gender', 'M')->where('is_alive', true)->count(),
            'female_count' => Person::where('gender', 'F')->where('is_alive', true)->count(),
        ]);
    }

    /**
     * add family member
     */
    public function addFamilyMember(AddFamilyMemberRequest $request)
    {
        DB::beginTransaction();
        
        try {
            $user = User::create([
                'id' => Str::uuid(),
                'national_id' => $request->national_id,
                'full_name_arabic' => $request->full_name_arabic,
                'full_name_english' => $request->full_name_english,
                'email' => $request->email,
                'password' => \Illuminate\Support\Facades\Hash::make($request->password),
                'gender' => $request->gender,
                'birth_date' => $request->birth_date,
                'phone_number' => $request->phone_number,
                'user_type' => 'FAMILY_MEMBER',
            ]);

            // create person
            $person = Person::create([
                'person_id' => $user->id,
                'national_id' => $user->national_id,
                'full_name_arabic' => $user->full_name_arabic,
                'full_name_english' => $user->full_name_english,
                'gender' => $user->gender,
                'birth_date' => $user->birth_date,
                'phone_number' => $user->phone_number,
                'email' => $user->email,
                'birth_place' => $request->birth_place,
                'blood_type' => $request->blood_type,
                'current_address' => $request->current_address,
            ]);

            // إضافة العلاقات الأسرية إذا وجدت
            if ($request->has('father_id')) {
                $this->familyTreeService->addFatherRelationship($person->person_id, $request->father_id);
            }
            
            if ($request->has('mother_id')) {
                $this->familyTreeService->addMotherRelationship($person->person_id, $request->mother_id);
            }

            DB::commit();

            return response()->json([
                'message' => 'تم إضافة الفرد بنجاح',
                'person' => $person->load(['user', 'relationships.relatedPerson']),
                'user' => $user
            ], 201);

        } catch (\Exception $e) {
            DB::rollBack();
            
            return response()->json([
                'message' => 'حدث خطأ أثناء إضافة الفرد',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Add Relationship
     * check if exist before relation
     * check if right relation
     */
    public function addRelationship(AddRelationshipRequest $request)
    {
        $validated = $request->validated();

        $existing = FamilyRelationship::where('person_id', $validated['person_id'])
            ->where('related_person_id', $validated['related_person_id'])
            ->where('relationship_type', $validated['relationship_type'])
            ->first();

        if ($existing) {
            return response()->json([
                'message' => 'العلاقة موجودة مسبقاً'
            ], 409);
        }

        if ($validated['person_id'] === $validated['related_person_id']) {
            return response()->json([
                'message' => 'لا يمكن إنشاء علاقة مع النفس'
            ], 422);
        }

        $relationship = FamilyRelationship::create([
            'relationship_id' => \Illuminate\Support\Str::uuid(),
            'person_id' => $validated['person_id'],
            'related_person_id' => $validated['related_person_id'],
            'relationship_type' => $validated['relationship_type'],
            'is_biological' => $validated['is_biological'] ?? true,
            'start_date' => $validated['start_date'] ?? null,
            'notes' => $validated['notes'] ?? null,
        ]);

        $this->familyTreeService->addReciprocalRelationship($relationship);

        return response()->json([
            'message' => 'تم إضافة العلاقة بنجاح',
            'relationship' => $relationship->load(['person', 'relatedPerson'])
        ], 201);
    }

    /**
     * get family statistics
     */
    private function getFamilyStatistics(Person $person)
    {
        return [
            'total_ancestors' => $this->familyTreeService->countAncestors($person->person_id),
            'total_descendants' => $this->familyTreeService->countDescendants($person->person_id),
            'immediate_family' => $this->familyTreeService->getImmediateFamily($person->person_id),
            'generations_count' => $this->familyTreeService->countGenerations($person->person_id),
        ];
    }

    /**
     * البحث عن فرد في العائلة
     */
    public function searchFamilyMember(Request $request)
    {
        $request->validate([
            'query' => 'required|string|min:2'
        ]);

        $results = Person::where('full_name_arabic', 'LIKE', "%{$request->query}%")
            ->orWhere('full_name_english', 'LIKE', "%{$request->query}%")
            ->orWhere('national_id', 'LIKE', "%{$request->query}%")
            ->orWhere('phone_number', 'LIKE', "%{$request->query}%")
            ->with(['user'])
            ->limit(20)
            ->get();

        return response()->json([
            'results' => $results,
            'count' => $results->count()
        ]);
    }

    /**
     * الحصول على شجرة العائلة الكاملة (أرشيف العائلة)
     */
    public function getCompleteFamilyTree(Request $request)
    {
        $user = $request->user();
        
        // التحقق من الصلاحية للوصول للأرشيف
        if (!$user->canAccessFamilyArchive()) {
            return response()->json([
                'message' => 'غير مصرح لك بالوصول إلى أرشيف العائلة'
            ], 403);
        }

        $tree = $this->familyTreeService->generateCompleteFamilyTree();
        
        return response()->json([
            'tree' => $tree,
            'summary' => $this->getFamilyArchiveSummary()
        ]);
    }

    /**
     * الحصول على اجتماعات العائلة
     */
    public function getFamilyMeetings(Request $request)
    {
        $meetings = \App\Models\FamilyMeeting::query()
            ->with(['organizer.person'])
            ->orderBy('meeting_date', 'desc')
            ->paginate($request->input('per_page', 10));

        return response()->json([
            'meetings' => $meetings
        ]);
    }

    /**
     * الحصول على أرشيف الرياضة
     */
    public function getSportsArchive(Request $request)
    {
        $archive = \App\Models\SportsArchive::query()
            ->with(['teamMembers.person'])
            ->orderBy('year', 'desc')
            ->paginate($request->input('per_page', 10));

        return response()->json([
            'sports_archive' => $archive
        ]);
    }

    /**
     * الحصول على مستندات العائلة
     */
    public function getFamilyDocuments(Request $request)
    {
        $documents = \App\Models\FamilyDocument::query()
            ->with(['uploadedBy.person'])
            ->orderBy('created_at', 'desc')
            ->paginate($request->input('per_page', 10));

        return response()->json([
            'documents' => $documents
        ]);
    }

    /**
     * إحصائيات أرشيف العائلة
     */
    private function getFamilyArchiveSummary()
    {
        return [
            'total_meetings' => \App\Models\FamilyMeeting::count(),
            'total_sports_events' => \App\Models\SportsArchive::count(),
            'total_documents' => \App\Models\FamilyDocument::count(),
            'oldest_document_year' => \App\Models\FamilyDocument::min('year'),
            'latest_meeting_date' => \App\Models\FamilyMeeting::max('meeting_date'),
        ];
    }
}

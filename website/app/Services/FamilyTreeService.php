<?php

namespace App\Services;

use App\Models\Person;
use App\Models\FamilyRelationship;
use App\Models\Marriage;
use Illuminate\Support\Facades\DB;

class FamilyTreeService
{
    /**
     * توليد شجرة العائلة لشخص معين
     */
    public function generateTree($personId, $maxDepth = 3)
    {
        $person = Person::findOrFail($personId);
        
        $tree = [
            'person' => $this->formatPerson($person),
            'parents' => $this->getParentsTree($personId, $maxDepth - 1),
            'children' => $this->getChildrenTree($personId, $maxDepth - 1),
            'spouse' => $this->getSpouseTree($personId),
            'siblings' => $this->getSiblingsTree($personId),
            'depth' => $maxDepth,
        ];

        return $tree;
    }
    
    /**
     * توليد شجرة العائلة الكاملة
     */
    public function generateCompleteFamilyTree()
    {
        $founders = Person::whereDoesntHave('relationships', function($query) {
            $query->whereIn('relationship_type', ['FATHER', 'MOTHER']);
        })->get();
        
        $tree = [
            'founders' => $founders->map(function($founder) {
                return $this->buildDescendantsTree($founder->person_id, 5);
            }),
            'total_members' => Person::count(),
            'total_families' => Marriage::where('status', 'ACTIVE')->count(),
            'oldest_member' => Person::where('is_alive', true)->orderBy('birth_date')->first(),
            'youngest_member' => Person::where('is_alive', true)->orderByDesc('birth_date')->first(),
        ];
        
        return $tree;
    }
    
    /**
     * الحصول على شجرة الآباء
     */
    private function getParentsTree($personId, $depth)
    {
        if ($depth <= 0) {
            return [];
        }
        
        $parents = FamilyRelationship::where('person_id', $personId)
            ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
            ->with(['relatedPerson'])
            ->get();
        
        $parentsTree = [];
        
        foreach ($parents as $parentRelation) {
            $parent = $parentRelation->relatedPerson;
            
            $parentTree = [
                'person' => $this->formatPerson($parent),
                'relationship' => $parentRelation->relationship_type,
                'is_biological' => $parentRelation->is_biological,
                'parents' => $this->getParentsTree($parent->person_id, $depth - 1),
                'children' => [], // نمنع العودة لنفس الشخص
                'spouse' => $this->getSpouseTree($parent->person_id),
            ];
            
            $parentsTree[] = $parentTree;
        }
        
        return $parentsTree;
    }
    
    /**
     * الحصول على شجرة الأبناء
     */
    private function getChildrenTree($personId, $depth)
    {
        if ($depth <= 0) {
            return [];
        }
        
        $children = FamilyRelationship::where('related_person_id', $personId)
            ->whereIn('relationship_type', ['SON', 'DAUGHTER'])
            ->with(['person'])
            ->get();
        
        $childrenTree = [];
        
        foreach ($children as $childRelation) {
            $child = $childRelation->person;
            
            $childTree = [
                'person' => $this->formatPerson($child),
                'relationship' => $childRelation->relationship_type,
                'is_biological' => $childRelation->is_biological,
                'parents' => [], // نمنع العودة لنفس الشخص
                'children' => $this->getChildrenTree($child->person_id, $depth - 1),
                'spouse' => $this->getSpouseTree($child->person_id),
            ];
            
            $childrenTree[] = $childTree;
        }
        
        return $childrenTree;
    }
    
    /**
     * الحصول على شجرة الزوج/الزوجة
     */
    private function getSpouseTree($personId)
    {
        $person = Person::find($personId);
        
        if (!$person) {
            return null;
        }
        
        if ($person->gender === 'M') {
            $marriage = Marriage::where('husband_id', $personId)
                ->where('status', 'ACTIVE')
                ->with(['wife'])
                ->first();
            
            if ($marriage) {
                return [
                    'person' => $this->formatPerson($marriage->wife),
                    'marriage_date' => $marriage->marriage_date,
                    'marriage_location' => $marriage->marriage_location,
                    'children_count' => $marriage->children_count,
                ];
            }
        } else {
            $marriage = Marriage::where('wife_id', $personId)
                ->where('status', 'ACTIVE')
                ->with(['husband'])
                ->first();
            
            if ($marriage) {
                return [
                    'person' => $this->formatPerson($marriage->husband),
                    'marriage_date' => $marriage->marriage_date,
                    'marriage_location' => $marriage->marriage_location,
                    'children_count' => $marriage->children_count,
                ];
            }
        }
        
        return null;
    }
    
    /**
     * الحصول على شجرة الأشقاء
     */
    private function getSiblingsTree($personId)
    {
        $person = Person::find($personId);
        
        if (!$person) {
            return [];
        }
        
        // الحصول على آباء الشخص
        $parentRelations = FamilyRelationship::where('person_id', $personId)
            ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
            ->pluck('related_person_id');
        
        if ($parentRelations->isEmpty()) {
            return [];
        }
        
        // الحصول على جميع أبناء هؤلاء الآباء
        $siblings = FamilyRelationship::whereIn('related_person_id', $parentRelations)
            ->whereIn('relationship_type', ['SON', 'DAUGHTER'])
            ->where('person_id', '!=', $personId)
            ->with(['person'])
            ->get();
        
        return $siblings->map(function($siblingRelation) use ($parentRelations) {
            $sibling = $siblingRelation->person;
            
            // تحديد نوع الأخوة (كامل أم غير كامل)
            $siblingParents = FamilyRelationship::where('person_id', $sibling->person_id)
                ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
                ->pluck('related_person_id');
            
            $commonParents = $parentRelations->intersect($siblingParents)->count();
            
            return [
                'person' => $this->formatPerson($sibling),
                'relationship' => $siblingRelation->relationship_type,
                'sibling_type' => $commonParents == 2 ? 'FULL' : ($commonParents == 1 ? 'HALF' : 'STEP'),
            ];
        })->toArray();
    }
    
    /**
     * بناء شجرة النسل
     */
    private function buildDescendantsTree($personId, $maxDepth)
    {
        if ($maxDepth <= 0) {
            return null;
        }
        
        $person = Person::find($personId);
        
        if (!$person) {
            return null;
        }
        
        $tree = [
            'person' => $this->formatPerson($person),
            'spouse' => $this->getSpouseTree($personId),
            'children' => $this->getChildrenTree($personId, 1),
        ];
        
        // بناء شجرة النسل للأبناء
        foreach ($tree['children'] as &$child) {
            $child['descendants'] = $this->buildDescendantsTree($child['person']['id'], $maxDepth - 1);
        }
        
        return $tree;
    }
    
    /**
     * تنسيق بيانات الشخص
     */
    private function formatPerson(Person $person)
    {
        return [
            'id' => $person->person_id,
            'national_id' => $person->national_id,
            'full_name_arabic' => $person->full_name_arabic,
            'full_name_english' => $person->full_name_english,
            'gender' => $person->gender,
            'birth_date' => $person->birth_date,
            'age' => $person->age,
            'is_alive' => $person->is_alive,
            'photo_url' => $person->photo_path ? asset('storage/' . $person->photo_path) : null,
        ];
    }
    
    /**
     * إضافة علاقة أب
     */
    public function addFatherRelationship($childId, $fatherId, $isBiological = true)
    {
        // التحقق من أن الأب ذكر
        $father = Person::findOrFail($fatherId);
        if ($father->gender !== 'M') {
            throw new \Exception('الأب يجب أن يكون ذكراً');
        }
        
        // التحقق من أن الابن ذكر
        $child = Person::findOrFail($childId);
        if ($child->gender !== 'M') {
            throw new \Exception('هذه العلاقة للأبناء الذكور فقط');
        }
        
        // التحقق من عدم وجود أب بالفعل
        $existingFather = FamilyRelationship::where('person_id', $childId)
            ->where('relationship_type', 'FATHER')
            ->first();
            
        if ($existingFather) {
            throw new \Exception('الشخص لديه أب بالفعل');
        }
        
        DB::beginTransaction();
        
        try {
            // إضافة علاقة الأب
            FamilyRelationship::create([
                'relationship_id' => \Illuminate\Support\Str::uuid(),
                'person_id' => $childId,
                'related_person_id' => $fatherId,
                'relationship_type' => 'FATHER',
                'is_biological' => $isBiological,
            ]);
            
            // إضافة العلاقة العكسية (الابن)
            FamilyRelationship::create([
                'relationship_id' => \Illuminate\Support\Str::uuid(),
                'person_id' => $fatherId,
                'related_person_id' => $childId,
                'relationship_type' => 'SON',
                'is_biological' => $isBiological,
            ]);
            
            // تحديث جدول الأنساب
            $this->updateAncestryClosure($childId, $fatherId, 'FATHER');
            
            DB::commit();
            
            return true;
            
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
    
    /**
     * إضافة علاقة أم
     */
    public function addMotherRelationship($childId, $motherId, $isBiological = true)
    {
        // التحقق من أن الأم أنثى
        $mother = Person::findOrFail($motherId);
        if ($mother->gender !== 'F') {
            throw new \Exception('الأم يجب أن تكون أنثى');
        }
        
        // التحقق من عدم وجود أم بالفعل
        $existingMother = FamilyRelationship::where('person_id', $childId)
            ->where('relationship_type', 'MOTHER')
            ->first();
            
        if ($existingMother) {
            throw new \Exception('الشخص لديه أم بالفعل');
        }
        
        DB::beginTransaction();
        
        try {
            $child = Person::findOrFail($childId);
            $childGender = $child->gender;
            
            // إضافة علاقة الأم
            FamilyRelationship::create([
                'relationship_id' => \Illuminate\Support\Str::uuid(),
                'person_id' => $childId,
                'related_person_id' => $motherId,
                'relationship_type' => 'MOTHER',
                'is_biological' => $isBiological,
            ]);
            
            // إضافة العلاقة العكسية (ابن/ابنة)
            FamilyRelationship::create([
                'relationship_id' => \Illuminate\Support\Str::uuid(),
                'person_id' => $motherId,
                'related_person_id' => $childId,
                'relationship_type' => $childGender === 'M' ? 'SON' : 'DAUGHTER',
                'is_biological' => $isBiological,
            ]);
            
            // تحديث جدول الأنساب
            $this->updateAncestryClosure($childId, $motherId, 'MOTHER');
            
            DB::commit();
            
            return true;
            
        } catch (\Exception $e) {
            DB::rollBack();
            throw $e;
        }
    }
    
    /**
     * إضافة علاقة عكسية
     */
    public function addReciprocalRelationship(FamilyRelationship $relationship)
    {
        $reciprocalTypes = [
            'FATHER' => 'SON',
            'MOTHER' => ['SON', 'DAUGHTER'],
            'SON' => 'FATHER',
            'DAUGHTER' => 'MOTHER',
            'HUSBAND' => 'WIFE',
            'WIFE' => 'HUSBAND',
            'BROTHER' => 'BROTHER',
            'SISTER' => 'SISTER',
        ];
        
        $type = $relationship->relationship_type;
        
        if (!isset($reciprocalTypes[$type])) {
            return;
        }
        
        $reciprocalType = $reciprocalTypes[$type];
        
        // إذا كانت الأم، نحدد إذا كانت ابن أو ابنة
        if ($type === 'MOTHER') {
            $child = Person::find($relationship->person_id);
            $reciprocalType = $child->gender === 'M' ? 'SON' : 'DAUGHTER';
        }
        
        // التحقق من عدم وجود العلاقة العكسية مسبقاً
        $existing = FamilyRelationship::where('person_id', $relationship->related_person_id)
            ->where('related_person_id', $relationship->person_id)
            ->where('relationship_type', $reciprocalType)
            ->exists();
            
        if ($existing) {
            return;
        }
        
        FamilyRelationship::create([
            'relationship_id' => \Illuminate\Support\Str::uuid(),
            'person_id' => $relationship->related_person_id,
            'related_person_id' => $relationship->person_id,
            'relationship_type' => $reciprocalType,
            'is_biological' => $relationship->is_biological,
            'start_date' => $relationship->start_date,
            'end_date' => $relationship->end_date,
            'notes' => $relationship->notes,
        ]);
    }
    
    /**
     * تحديث جدول الأنساب
     */
    private function updateAncestryClosure($descendantId, $ancestorId, $relationshipType)
    {
        if (!in_array($relationshipType, ['FATHER', 'MOTHER'])) {
            return;
        }
        
        // إضافة العلاقة المباشرة
        DB::table('ancestry_closure')->insert([
            'ancestor_id' => $ancestorId,
            'descendant_id' => $descendantId,
            'depth' => 1,
        ]);
        
        // إضافة جميع أسلاف السلف كأسلاف للنازل
        $ancestorAncestors = DB::table('ancestry_closure')
            ->where('descendant_id', $ancestorId)
            ->get();
            
        foreach ($ancestorAncestors as $ancestorAncestor) {
            DB::table('ancestry_closure')->insert([
                'ancestor_id' => $ancestorAncestor->ancestor_id,
                'descendant_id' => $descendantId,
                'depth' => $ancestorAncestor->depth + 1,
            ]);
        }
        
        // إضافة السلف كسلف لجميع نزلاء النازل
        $descendantDescendants = DB::table('ancestry_closure')
            ->where('ancestor_id', $descendantId)
            ->get();
            
        foreach ($descendantDescendants as $descendantDescendant) {
            DB::table('ancestry_closure')->insert([
                'ancestor_id' => $ancestorId,
                'descendant_id' => $descendantDescendant->descendant_id,
                'depth' => $descendantDescendant->depth + 1,
            ]);
        }
    }
    
    /**
     * عد الأسلاف
     */
    public function countAncestors($personId)
    {
        return DB::table('ancestry_closure')
            ->where('descendant_id', $personId)
            ->distinct('ancestor_id')
            ->count('ancestor_id');
    }
    
    /**
     * عد النسل
     */
    public function countDescendants($personId)
    {
        return DB::table('ancestry_closure')
            ->where('ancestor_id', $personId)
            ->distinct('descendant_id')
            ->count('descendant_id');
    }
    
    /**
     * الحصول على العائلة المباشرة
     */
    public function getImmediateFamily($personId)
    {
        $person = Person::findOrFail($personId);
        
        $parents = $this->getParents($personId);
        $children = $this->getChildren($personId);
        $spouse = $this->getSpouse($personId);
        $siblings = $this->getSiblings($personId);
        
        return [
            'person' => $this->formatPerson($person),
            'parents' => $parents,
            'children' => $children,
            'spouse' => $spouse,
            'siblings' => $siblings,
        ];
    }
    
    /**
     * عد الأجيال
     */
    public function countGenerations($personId)
    {
        $maxDepthUp = DB::table('ancestry_closure')
            ->where('descendant_id', $personId)
            ->max('depth');
            
        $maxDepthDown = DB::table('ancestry_closure')
            ->where('ancestor_id', $personId)
            ->max('depth');
            
        return [
            'ancestors_generations' => $maxDepthUp ?: 0,
            'descendants_generations' => $maxDepthDown ?: 0,
            'total_generations' => ($maxDepthUp ?: 0) + ($maxDepthDown ?: 0) + 1,
        ];
    }
    
    /**
     * الحصول على الآباء
     */
    private function getParents($personId)
    {
        return FamilyRelationship::where('person_id', $personId)
            ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
            ->with(['relatedPerson'])
            ->get()
            ->map(function($relation) {
                return [
                    'person' => $this->formatPerson($relation->relatedPerson),
                    'relationship' => $relation->relationship_type,
                    'is_biological' => $relation->is_biological,
                ];
            });
    }
    
    /**
     * الحصول على الأبناء
     */
    private function getChildren($personId)
    {
        return FamilyRelationship::where('related_person_id', $personId)
            ->whereIn('relationship_type', ['SON', 'DAUGHTER'])
            ->with(['person'])
            ->get()
            ->map(function($relation) {
                return [
                    'person' => $this->formatPerson($relation->person),
                    'relationship' => $relation->relationship_type,
                    'is_biological' => $relation->is_biological,
                ];
            });
    }
    
    /**
     * الحصول على الزوج/الزوجة
     */
    private function getSpouse($personId)
    {
        $person = Person::find($personId);
        
        if (!$person) {
            return null;
        }
        
        if ($person->gender === 'M') {
            $marriage = Marriage::where('husband_id', $personId)
                ->where('status', 'ACTIVE')
                ->with(['wife'])
                ->first();
                
            if ($marriage) {
                return [
                    'person' => $this->formatPerson($marriage->wife),
                    'marriage_date' => $marriage->marriage_date,
                ];
            }
        } else {
            $marriage = Marriage::where('wife_id', $personId)
                ->where('status', 'ACTIVE')
                ->with(['husband'])
                ->first();
                
            if ($marriage) {
                return [
                    'person' => $this->formatPerson($marriage->husband),
                    'marriage_date' => $marriage->marriage_date,
                ];
            }
        }
        
        return null;
    }
    
    /**
     * الحصول على الأشقاء
     */
    private function getSiblings($personId)
    {
        $parents = FamilyRelationship::where('person_id', $personId)
            ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
            ->pluck('related_person_id');
            
        if ($parents->isEmpty()) {
            return collect();
        }
        
        return FamilyRelationship::whereIn('related_person_id', $parents)
            ->whereIn('relationship_type', ['SON', 'DAUGHTER'])
            ->where('person_id', '!=', $personId)
            ->with(['person'])
            ->get()
            ->map(function($relation) use ($parents) {
                $siblingParents = FamilyRelationship::where('person_id', $relation->person_id)
                    ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
                    ->pluck('related_person_id');
                    
                $commonParents = $parents->intersect($siblingParents)->count();
                
                return [
                    'person' => $this->formatPerson($relation->person),
                    'relationship' => $relation->relationship_type,
                    'sibling_type' => $commonParents == 2 ? 'FULL' : ($commonParents == 1 ? 'HALF' : 'STEP'),
                ];
            });
    }
    
    /**
     * البحث عن علاقات القرابة
     */
    public function findRelationship($person1Id, $person2Id)
    {
        // الحصول على المسار بين الشخصين
        $path = $this->findPathBetweenPersons($person1Id, $person2Id);
        
        if (empty($path)) {
            return null;
        }
        
        // تحويل المسار إلى علاقة مفهومة
        $relationship = $this->pathToRelationship($path);
        
        return [
            'path' => $path,
            'relationship' => $relationship,
            'distance' => count($path) - 1,
        ];
    }
    
    /**
     * إيجاد المسار بين شخصين
     */
    private function findPathBetweenPersons($startId, $endId)
    {
        if ($startId === $endId) {
            return [$startId];
        }
        
        // استخدام BFS للعثور على المسار
        $queue = new \SplQueue();
        $visited = [$startId];
        $parent = [$startId => null];
        
        $queue->enqueue($startId);
        
        while (!$queue->isEmpty()) {
            $current = $queue->dequeue();
            
            // الحصول على الجيران (الآباء والأبناء والأزواج)
            $neighbors = $this->getNeighbors($current);
            
            foreach ($neighbors as $neighbor) {
                if (!in_array($neighbor, $visited)) {
                    $visited[] = $neighbor;
                    $parent[$neighbor] = $current;
                    $queue->enqueue($neighbor);
                    
                    if ($neighbor === $endId) {
                        // بناء المسار العكسي
                        $path = [];
                        $node = $endId;
                        
                        while ($node !== null) {
                            $path[] = $node;
                            $node = $parent[$node];
                        }
                        
                        return array_reverse($path);
                    }
                }
            }
        }
        
        return null;
    }
    
    /**
     * الحصول على الجيران في شجرة العائلة
     */
    private function getNeighbors($personId)
    {
        $neighbors = [];
        
        // الآباء
        $parents = FamilyRelationship::where('person_id', $personId)
            ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
            ->pluck('related_person_id');
            
        $neighbors = array_merge($neighbors, $parents->toArray());
        
        // الأبناء
        $children = FamilyRelationship::where('related_person_id', $personId)
            ->whereIn('relationship_type', ['SON', 'DAUGHTER'])
            ->pluck('person_id');
            
        $neighbors = array_merge($neighbors, $children->toArray());
        
        // الزوج/الزوجة
        $person = Person::find($personId);
        if ($person) {
            if ($person->gender === 'M') {
                $wife = Marriage::where('husband_id', $personId)
                    ->where('status', 'ACTIVE')
                    ->value('wife_id');
                    
                if ($wife) {
                    $neighbors[] = $wife;
                }
            } else {
                $husband = Marriage::where('wife_id', $personId)
                    ->where('status', 'ACTIVE')
                    ->value('husband_id');
                    
                if ($husband) {
                    $neighbors[] = $husband;
                }
            }
        }
        
        return array_unique($neighbors);
    }
    
    /**
     * تحويل المسار إلى علاقة
     */
    private function pathToRelationship($path)
    {
        if (count($path) < 2) {
            return 'نفس الشخص';
        }
        
        $relations = [];
        
        for ($i = 0; $i < count($path) - 1; $i++) {
            $from = $path[$i];
            $to = $path[$i + 1];
            
            $relation = FamilyRelationship::where('person_id', $from)
                ->where('related_person_id', $to)
                ->first();
                
            if ($relation) {
                $relations[] = $this->translateRelationship($relation->relationship_type);
            } else {
                // قد تكون العلاقة عكسية
                $reverseRelation = FamilyRelationship::where('person_id', $to)
                    ->where('related_person_id', $from)
                    ->first();
                    
                if ($reverseRelation) {
                    $relations[] = $this->getReciprocalTerm($reverseRelation->relationship_type);
                } else {
                    $relations[] = 'علاقة غير معروفة';
                }
            }
        }
        
        return implode(' ← ', $relations);
    }
    
    /**
     * ترجمة العلاقة
     */
    private function translateRelationship($type)
    {
        $translations = [
            'FATHER' => 'أب',
            'MOTHER' => 'أم',
            'SON' => 'ابن',
            'DAUGHTER' => 'ابنة',
            'HUSBAND' => 'زوج',
            'WIFE' => 'زوجة',
            'BROTHER' => 'أخ',
            'SISTER' => 'أخت',
        ];
        
        return $translations[$type] ?? $type;
    }
    
    /**
     * الحصول على مصطلح العلاقة العكسية
     */
    private function getReciprocalTerm($type)
    {
        $reciprocalTerms = [
            'FATHER' => 'ابن/ابنة',
            'MOTHER' => 'ابن/ابنة',
            'SON' => 'أب',
            'DAUGHTER' => 'أم',
            'HUSBAND' => 'زوجة',
            'WIFE' => 'زوج',
            'BROTHER' => 'أخ',
            'SISTER' => 'أخت',
        ];
        
        return $reciprocalTerms[$type] ?? $type;
    }
}

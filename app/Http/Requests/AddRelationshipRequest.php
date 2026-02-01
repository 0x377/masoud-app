<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class AddRelationshipRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        $user = $this->user();
        
        // التحقق من أن المستخدم لديه صلاحية إضافة علاقات
        return $user && (
            $user->user_type === 'FAMILY_MEMBER' || 
            $user->user_type === 'BOARD_MEMBER' ||
            $user->user_type === 'SUPER_ADMIN'
        );
    }

    /**
     * Get the validation rules that apply to the request.
     */
    public function rules(): array
    {
        return [
            'person_id' => [
                'required',
                'uuid',
                'exists:persons,person_id',
                function ($attribute, $value, $fail) {
                    // التحقق من أن الشخص موجود وليس محظوراً
                    $person = \App\Models\Person::find($value);
                    if ($person && $person->is_banned) {
                        $fail('الشخص محظور ولا يمكن إضافة علاقات له.');
                    }
                }
            ],
            
            'related_person_id' => [
                'required',
                'uuid',
                'exists:persons,person_id',
                'different:person_id',
                function ($attribute, $value, $fail) {
                    // التحقق من أن الشخص المرتبط موجود وليس محظوراً
                    $person = \App\Models\Person::find($value);
                    if ($person && $person->is_banned) {
                        $fail('الشخص المرتبط محظور ولا يمكن إضافة علاقة معه.');
                    }
                    
                    // التحقق من أن الشخصين ليسا نفس الجنس للعلاقات الزوجية
                    if ($this->relationship_type === 'HUSBAND' || $this->relationship_type === 'WIFE') {
                        $person1 = \App\Models\Person::find($this->person_id);
                        $person2 = \App\Models\Person::find($value);
                        
                        if ($person1 && $person2 && $person1->gender === $person2->gender) {
                            $fail('العلاقة الزوجية تتطلب أشخاص من جنسين مختلفين.');
                        }
                    }
                }
            ],
            
            'relationship_type' => [
                'required',
                'string',
                Rule::in([
                    'FATHER', 'MOTHER', 'SON', 'DAUGHTER',
                    'HUSBAND', 'WIFE', 'BROTHER', 'SISTER',
                    'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON', 'GRANDDAUGHTER',
                    'UNCLE', 'AUNT', 'NEPHEW', 'NIECE', 'COUSIN'
                ]),
                function ($attribute, $value, $fail) {
                    $person = \App\Models\Person::find($this->person_id);
                    $relatedPerson = \App\Models\Person::find($this->related_person_id);
                    
                    if (!$person || !$relatedPerson) {
                        return;
                    }
                    
                    // التحقق من توافق الجنس مع نوع العلاقة
                    switch ($value) {
                        case 'FATHER':
                        case 'GRANDFATHER':
                        case 'UNCLE':
                        case 'NEPHEW':
                        case 'BROTHER':
                            if ($relatedPerson->gender !== 'M') {
                                $fail('هذه العلاقة تتطلب أن يكون الشخص المرتبط ذكراً.');
                            }
                            break;
                            
                        case 'MOTHER':
                        case 'GRANDMOTHER':
                        case 'AUNT':
                        case 'NIECE':
                        case 'SISTER':
                            if ($relatedPerson->gender !== 'F') {
                                $fail('هذه العلاقة تتطلب أن يكون الشخص المرتبط أنثى.');
                            }
                            break;
                            
                        case 'SON':
                        case 'GRANDSON':
                            if ($person->gender !== 'M') {
                                $fail('هذه العلاقة تتطلب أن يكون الشخص ذكراً.');
                            }
                            break;
                            
                        case 'DAUGHTER':
                        case 'GRANDDAUGHTER':
                            if ($person->gender !== 'F') {
                                $fail('هذه العلاقة تتطلب أن يكون الشخص أنثى.');
                            }
                            break;
                            
                        case 'HUSBAND':
                            if ($person->gender !== 'F' || $relatedPerson->gender !== 'M') {
                                $fail('علاقة الزوج تتطلب أن يكون الزوج ذكراً والزوجة أنثى.');
                            }
                            break;
                            
                        case 'WIFE':
                            if ($person->gender !== 'M' || $relatedPerson->gender !== 'F') {
                                $fail('علاقة الزوجة تتطلب أن يكون الزوج ذكراً والزوجة أنثى.');
                            }
                            break;
                    }
                    
                    // التحقق من الأعمار للعلاقات الأبوية
                    if (in_array($value, ['FATHER', 'MOTHER', 'GRANDFATHER', 'GRANDMOTHER'])) {
                        if ($person->birth_date && $relatedPerson->birth_date) {
                            $personAge = $person->age;
                            $relatedAge = $relatedPerson->age;
                            
                            if ($personAge >= $relatedAge) {
                                $fail('العمر غير منطقي لهذه العلاقة.');
                            }
                            
                            // الأب يجب أن يكون أكبر من الابن بـ 15 سنة على الأقل
                            $minAgeDifference = 15;
                            if (($relatedAge - $personAge) < $minAgeDifference) {
                                $fail('فارق السن غير كافٍ لهذه العلاقة.');
                            }
                        }
                    }
                    
                    // التحقق من عدم وجود علاقات متناقضة
                    $this->validateConflictingRelationships($value, $person, $relatedPerson, $fail);
                }
            ],
            
            'is_biological' => [
                'sometimes',
                'boolean',
                function ($attribute, $value, $fail) {
                    // العلاقات مثل الأخوة لا يمكن أن تكون غير بيولوجية إذا كانت كاملة
                    if ($this->relationship_type === 'BROTHER' || $this->relationship_type === 'SISTER') {
                        if (!$value) {
                            // يمكن أن تكون علاقة أخوة غير بيولوجية إذا كانت غير كاملة
                            // لكن نحتاج لمزيد من التحقق
                        }
                    }
                }
            ],
            
            'start_date' => [
                'nullable',
                'date',
                'before_or_equal:today',
                function ($attribute, $value, $fail) {
                    if ($value) {
                        $person = \App\Models\Person::find($this->person_id);
                        $relatedPerson = \App\Models\Person::find($this->related_person_id);
                        
                        if ($person && $person->birth_date && $value < $person->birth_date) {
                            $fail('تاريخ بدء العلاقة لا يمكن أن يكون قبل تاريخ ميلاد الشخص.');
                        }
                        
                        if ($relatedPerson && $relatedPerson->birth_date && $value < $relatedPerson->birth_date) {
                            $fail('تاريخ بدء العلاقة لا يمكن أن يكون قبل تاريخ ميلاد الشخص المرتبط.');
                        }
                    }
                }
            ],
            
            'end_date' => [
                'nullable',
                'date',
                'after:start_date',
                function ($attribute, $value, $fail) {
                    if ($value && $this->start_date && $value <= $this->start_date) {
                        $fail('تاريخ انتهاء العلاقة يجب أن يكون بعد تاريخ البدء.');
                    }
                    
                    if ($value && $value > now()->toDateString()) {
                        $fail('تاريخ انتهاء العلاقة لا يمكن أن يكون في المستقبل.');
                    }
                    
                    // التحقق من تاريخ الوفاة إذا كان الشخص متوفى
                    $person = \App\Models\Person::find($this->person_id);
                    $relatedPerson = \App\Models\Person::find($this->related_person_id);
                    
                    if ($person && $person->death_date && $value && $value > $person->death_date) {
                        $fail('تاريخ انتهاء العلاقة لا يمكن أن يكون بعد تاريخ وفاة الشخص.');
                    }
                    
                    if ($relatedPerson && $relatedPerson->death_date && $value && $value > $relatedPerson->death_date) {
                        $fail('تاريخ انتهاء العلاقة لا يمكن أن يكون بعد تاريخ وفاة الشخص المرتبط.');
                    }
                }
            ],
            
            'notes' => [
                'nullable',
                'string',
                'max:1000'
            ],
            
            'marriage_id' => [
                'nullable',
                'uuid',
                'exists:marriages,marriage_id',
                'required_if:relationship_type,HUSBAND,WIFE',
                function ($attribute, $value, $fail) {
                    if (in_array($this->relationship_type, ['HUSBAND', 'WIFE'])) {
                        if (!$value) {
                            $fail('معرّف الزواج مطلوب للعلاقة الزوجية.');
                        } else {
                            $marriage = \App\Models\Marriage::find($value);
                            if ($marriage) {
                                $person = \App\Models\Person::find($this->person_id);
                                $relatedPerson = \App\Models\Person::find($this->related_person_id);
                                
                                if ($marriage->husband_id !== $person->person_id && 
                                    $marriage->husband_id !== $relatedPerson->person_id) {
                                    $fail('الزواج لا يتطابق مع الأشخاص المحددين.');
                                }
                                
                                if ($marriage->wife_id !== $person->person_id && 
                                    $marriage->wife_id !== $relatedPerson->person_id) {
                                    $fail('الزواج لا يتطابق مع الأشخاص المحددين.');
                                }
                            }
                        }
                    }
                }
            ],
            
            'document_proof' => [
                'nullable',
                'file',
                'mimes:pdf,jpg,jpeg,png',
                'max:5120', // 5MB
                function ($attribute, $value, $fail) {
                    // للعلاقات المهمة مثل الأبوة، قد تكون الوثائق مطلوبة
                    if (in_array($this->relationship_type, ['FATHER', 'MOTHER', 'HUSBAND', 'WIFE'])) {
                        if (!$value && !$this->is_biological) {
                            $fail('وثيقة إثبات العلاقة مطلوبة للعلاقات غير البيولوجية.');
                        }
                    }
                }
            ],
            
            'verified_by' => [
                'nullable',
                'uuid',
                'exists:users,id',
                function ($attribute, $value, $fail) {
                    if ($value) {
                        $user = \App\Models\User::find($value);
                        if ($user && !in_array($user->user_type, ['BOARD_MEMBER', 'EXECUTIVE', 'SUPER_ADMIN'])) {
                            $fail('المستخدم غير مصرح له بالتحقق من العلاقات.');
                        }
                    }
                }
            ],
        ];
    }

    /**
     * التحقق من العلاقات المتناقضة
     */
    private function validateConflictingRelationships($relationshipType, $person, $relatedPerson, $fail)
    {
        $existingRelationships = \App\Models\FamilyRelationship::where('person_id', $person->person_id)
            ->where('related_person_id', $relatedPerson->person_id)
            ->get();
            
        if ($existingRelationships->isNotEmpty()) {
            $fail('هناك علاقة موجودة مسبقاً بين هذين الشخصين.');
        }
        
        // التحقق من العلاقات المتعارضة
        $conflictingPairs = [
            'FATHER' => ['MOTHER', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER'],
            'MOTHER' => ['FATHER', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER'],
            'SON' => ['FATHER', 'MOTHER', 'DAUGHTER', 'BROTHER', 'SISTER'],
            'DAUGHTER' => ['FATHER', 'MOTHER', 'SON', 'BROTHER', 'SISTER'],
            'HUSBAND' => ['WIFE', 'SON', 'DAUGHTER'],
            'WIFE' => ['HUSBAND', 'SON', 'DAUGHTER'],
            'BROTHER' => ['FATHER', 'MOTHER', 'SON', 'DAUGHTER'],
            'SISTER' => ['FATHER', 'MOTHER', 'SON', 'DAUGHTER'],
        ];
        
        foreach ($existingRelationships as $existing) {
            if (isset($conflictingPairs[$relationshipType]) && 
                in_array($existing->relationship_type, $conflictingPairs[$relationshipType])) {
                $fail("العلاقة '$relationshipType' تتعارض مع العلاقة الحالية '{$existing->relationship_type}'.");
            }
        }
        
        // التحقق من عدم وجود علاقات دائرية (مثل شخص يكون أباً لنفسه)
        if ($person->person_id === $relatedPerson->person_id) {
            $fail('لا يمكن إنشاء علاقة مع النفس.');
        }
        
        // التحقق من عدم وجود علاقات متكررة في التسلسل الهرمي
        if (in_array($relationshipType, ['FATHER', 'MOTHER'])) {
            $ancestors = $this->getAncestors($relatedPerson->person_id);
            if (in_array($person->person_id, $ancestors)) {
                $fail('لا يمكن أن يكون الشخص سلفاً لسلفه (علاقة دائرية).');
            }
        }
        
        if (in_array($relationshipType, ['SON', 'DAUGHTER'])) {
            $descendants = $this->getDescendants($relatedPerson->person_id);
            if (in_array($person->person_id, $descendants)) {
                $fail('لا يمكن أن يكون الشخص نسلاً لنسله (علاقة دائرية).');
            }
        }
        
        // التحقق من عدد الآباء (شخص لا يمكن أن يكون له أكثر من أب وأم بيولوجيين)
        if (in_array($relationshipType, ['FATHER', 'MOTHER'])) {
            $parentCount = \App\Models\FamilyRelationship::where('person_id', $person->person_id)
                ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
                ->where('is_biological', true)
                ->count();
                
            if ($parentCount >= 2 && $this->is_biological) {
                $fail('الشخص لديه بالفعل أب وأم بيولوجيين.');
            }
        }
    }
    
    /**
     * الحصول على أسلاف الشخص
     */
    private function getAncestors($personId, $depth = 10)
    {
        $ancestors = [];
        $queue = [$personId];
        $visited = [];
        $currentDepth = 0;
        
        while (!empty($queue) && $currentDepth < $depth) {
            $current = array_shift($queue);
            
            if (in_array($current, $visited)) {
                continue;
            }
            
            $visited[] = $current;
            
            $parents = \App\Models\FamilyRelationship::where('person_id', $current)
                ->whereIn('relationship_type', ['FATHER', 'MOTHER'])
                ->pluck('related_person_id')
                ->toArray();
                
            foreach ($parents as $parent) {
                if (!in_array($parent, $ancestors)) {
                    $ancestors[] = $parent;
                    $queue[] = $parent;
                }
            }
            
            $currentDepth++;
        }
        
        return $ancestors;
    }
    
    /**
     * الحصول على نسل الشخص
     */
    private function getDescendants($personId, $depth = 10)
    {
        $descendants = [];
        $queue = [$personId];
        $visited = [];
        $currentDepth = 0;
        
        while (!empty($queue) && $currentDepth < $depth) {
            $current = array_shift($queue);
            
            if (in_array($current, $visited)) {
                continue;
            }
            
            $visited[] = $current;
            
            $children = \App\Models\FamilyRelationship::where('related_person_id', $current)
                ->whereIn('relationship_type', ['SON', 'DAUGHTER'])
                ->pluck('person_id')
                ->toArray();
                
            foreach ($children as $child) {
                if (!in_array($child, $descendants)) {
                    $descendants[] = $child;
                    $queue[] = $child;
                }
            }
            
            $currentDepth++;
        }
        
        return $descendants;
    }

    /**
     * Get custom messages for validator errors.
     */
    public function messages(): array
    {
        return [
            'person_id.required' => 'معرّف الشخص مطلوب.',
            'person_id.uuid' => 'معرّف الشخص يجب أن يكون صيغة UUID صحيحة.',
            'person_id.exists' => 'الشخص غير موجود في قاعدة البيانات.',
            'person_id.different' => 'لا يمكن إنشاء علاقة مع النفس.',
            
            'related_person_id.required' => 'معرّف الشخص المرتبط مطلوب.',
            'related_person_id.uuid' => 'معرّف الشخص المرتبط يجب أن يكون صيغة UUID صحيحة.',
            'related_person_id.exists' => 'الشخص المرتبط غير موجود في قاعدة البيانات.',
            'related_person_id.different' => 'الشخص المرتبط يجب أن يكون مختلفاً عن الشخص.',
            
            'relationship_type.required' => 'نوع العلاقة مطلوب.',
            'relationship_type.in' => 'نوع العلاقة غير صحيح.',
            
            'is_biological.boolean' => 'حقل العلاقة البيولوجية يجب أن يكون true أو false.',
            
            'start_date.date' => 'تاريخ البدء يجب أن يكون تاريخاً صحيحاً.',
            'start_date.before_or_equal' => 'تاريخ البدء لا يمكن أن يكون في المستقبل.',
            
            'end_date.date' => 'تاريخ الانتهاء يجب أن يكون تاريخاً صحيحاً.',
            'end_date.after' => 'تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء.',
            
            'notes.string' => 'الملاحظات يجب أن تكون نصاً.',
            'notes.max' => 'الملاحظات يجب ألا تتجاوز 1000 حرف.',
            
            'marriage_id.uuid' => 'معرّف الزواج يجب أن يكون صيغة UUID صحيحة.',
            'marriage_id.exists' => 'الزواج غير موجود في قاعدة البيانات.',
            'marriage_id.required_if' => 'معرّف الزواج مطلوب للعلاقة الزوجية.',
            
            'document_proof.file' => 'وثيقة الإثبات يجب أن تكون ملفاً.',
            'document_proof.mimes' => 'وثيقة الإثمساحة يجب أن تكون بصيغة PDF, JPG, JPEG, أو PNG.',
            'document_proof.max' => 'حجم وثيقة الإثبات يجب ألا يتجاوز 5 ميجابايت.',
            
            'verified_by.uuid' => 'معرّف المصرّح يجب أن يكون صيغة UUID صحيحة.',
            'verified_by.exists' => 'المستخدم المصرّح غير موجود في قاعدة البيانات.',
        ];
    }

    /**
     * Get custom attributes for validator errors.
     */
    public function attributes(): array
    {
        return [
            'person_id' => 'معرّف الشخص',
            'related_person_id' => 'معرّف الشخص المرتبط',
            'relationship_type' => 'نوع العلاقة',
            'is_biological' => 'علاقة بيولوجية',
            'start_date' => 'تاريخ البدء',
            'end_date' => 'تاريخ الانتهاء',
            'notes' => 'الملاحظات',
            'marriage_id' => 'معرّف الزواج',
            'document_proof' => 'وثيقة الإثبات',
            'verified_by' => 'المصرّح',
        ];
    }

    /**
     * Prepare the data for validation.
     */
    protected function prepareForValidation(): void
    {
        // تنظيف البيانات المدخلة
        $this->merge([
            'person_id' => $this->person_id ? trim($this->person_id) : null,
            'related_person_id' => $this->related_person_id ? trim($this->related_person_id) : null,
            'relationship_type' => $this->relationship_type ? strtoupper(trim($this->relationship_type)) : null,
            'is_biological' => $this->boolean('is_biological'),
            'start_date' => $this->start_date ? $this->normalizeDate($this->start_date) : null,
            'end_date' => $this->end_date ? $this->normalizeDate($this->end_date) : null,
            'notes' => $this->notes ? strip_tags(trim($this->notes)) : null,
        ]);
    }

    /**
     * Normalize date format
     */
    private function normalizeDate($date)
    {
        try {
            return \Carbon\Carbon::parse($date)->format('Y-m-d');
        } catch (\Exception $e) {
            return $date;
        }
    }

    /**
     * Get the validated data from the request.
     */
    public function validated($key = null, $default = null)
    {
        $validated = parent::validated($key, $default);
        
        // إضافة بيانات إضافية
        $validated['relationship_id'] = \Illuminate\Support\Str::uuid();
        $validated['created_by'] = $this->user()->id;
        
        // إذا كان هناك ملف وثيقة، حفظه
        if ($this->hasFile('document_proof')) {
            $path = $this->file('document_proof')->store('relationship-documents');
            $validated['document_proof_path'] = $path;
        }
        
        // إذا كان هناك مصادق، إضافة تاريخ المصادقة
        if (isset($validated['verified_by'])) {
            $validated['verified_at'] = now();
        }
        
        return $validated;
    }

    /**
     * Handle a failed validation attempt.
     */
    protected function failedValidation(\Illuminate\Contracts\Validation\Validator $validator)
    {
        throw new \Illuminate\Http\Exceptions\HttpResponseException(
            response()->json([
                'success' => false,
                'message' => 'فشل التحقق من البيانات',
                'errors' => $validator->errors(),
                'input' => $this->all()
            ], 422)
        );
    }

    /**
     * Handle a failed authorization attempt.
     */
    protected function failedAuthorization()
    {
        throw new \Illuminate\Http\Exceptions\HttpResponseException(
            response()->json([
                'success' => false,
                'message' => 'غير مصرح لك بإضافة علاقات عائلية.',
                'required_permissions' => ['FAMILY_MEMBER', 'BOARD_MEMBER', 'SUPER_ADMIN']
            ], 403)
        );
    }
}

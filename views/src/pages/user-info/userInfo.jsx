import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Save,
  User,
  Calendar,
  Home,
  Briefcase,
  GraduationCap,
  Users,
  Camera,
  UserCircle,
  UserPlus,
  UserMinus,
  Heart,
  Globe,
  BookOpen,
  Activity,
  Smartphone,
  Mail,
  MapPin,
  Award,
  Target,
} from "lucide-react";
import "./UserInfo.css";

export default function UserInfo() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    // المعلومات الشخصية
    national_id: "",
    full_name_arabic: "",
    full_name_english: "",
    gender: "M",
    birth_date: "",
    birth_place: "",
    marital_status: "single",
    blood_type: "",
    phone_number: "",
    email: "",
    current_address: "",
    photo_path: "",

    // معلومات الأسرة
    father_name: "",
    mother_name: "",
    spouse_name: "",
    children_count: 0,
    family_notes: "",

    // معلومات التعليم
    education_level: "",
    field_of_study: "",
    university: "",
    graduation_year: "",
    additional_certificates: "",

    // معلومات العمل
    job_title: "",
    company: "",
    work_address: "",
    work_experience: "",
    salary_range: "",

    // معلومات إضافية
    hobbies: "",
    skills: "",
    languages: "",
    health_status: "",
    social_media: "",
    personal_goals: "",
  });

  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [photoPreview, setPhotoPreview] = useState("");

  // تحميل البيانات المحفوظة
  useEffect(() => {
    const savedData = localStorage.getItem("user_registration_data");
    if (savedData) {
      const parsedData = JSON.parse(savedData);
      setFormData((prev) => ({ ...prev, ...parsedData }));
    }
  }, []);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    // مسح الخطأ عند التعديل
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        // 2MB limit
        setErrors((prev) => ({
          ...prev,
          photo: "حجم الصورة كبير جداً (الحد الأقصى 2MB)",
        }));
        return;
      }

      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setFormData((prev) => ({
          ...prev,
          photo_path: reader.result,
        }));
      };
      reader.readAsDataURL(file);
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.national_id) {
      newErrors.national_id = "الرقم الوطني مطلوب";
    } else if (!/^\d{14}$/.test(formData.national_id)) {
      newErrors.national_id = "يجب أن يتكون من 14 رقم";
    }

    if (!formData.full_name_arabic.trim()) {
      newErrors.full_name_arabic = "الاسم بالعربية مطلوب";
    }

    if (!formData.birth_date) {
      newErrors.birth_date = "تاريخ الميلاد مطلوب";
    }

    if (!formData.phone_number) {
      newErrors.phone_number = "رقم الهاتف مطلوب";
    }

    if (!formData.email) {
      newErrors.email = "البريد الإلكتروني مطلوب";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = "البريد الإلكتروني غير صحيح";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      // Scroll to first error
      const firstError = Object.keys(validationErrors)[0];
      const element = document.getElementById(firstError);
      if (element) {
        element.scrollIntoView({ behavior: "smooth", block: "center" });
      }
      return;
    }

    setLoading(true);

    try {
      // حفظ البيانات في localStorage
      localStorage.setItem("user_complete_profile", JSON.stringify(formData));

      // محاكاة API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // عرض رسالة النجاح
      alert("🎉 تم حفظ المعلومات بنجاح!");

      // التوجيه للصفحة الرئيسية
      navigate("/dashboard");
    } catch (error) {
      console.error("Error saving data:", error);
      alert("حدث خطأ أثناء حفظ البيانات. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const bloodTypes = ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"];
  const maritalStatuses = [
    { value: "single", label: "أعزب" },
    { value: "married", label: "متزوج" },
    { value: "divorced", label: "مطلق" },
    { value: "widowed", label: "أرمل" },
  ];
  const educationLevels = [
    "بدون مؤهل",
    "ابتدائي",
    "متوسط",
    "ثانوي",
    "دبلوم",
    "بكالوريوس",
    "ماجستير",
    "دكتوراه",
  ];
  const salaryRanges = [
    "أقل من 5,000",
    "5,000 - 10,000",
    "10,000 - 15,000",
    "15,000 - 20,000",
    "20,000 - 25,000",
    "25,000 - 30,000",
    "أكثر من 30,000",
  ];

  return (
    <div className="user-info-container">
      {/* شريط التقدم */}
      {/* <div className="progress-bar">
        <div className="progress-step active">
          <div className="step-number">1</div>
          <div className="step-label">التسجيل</div>
        </div>
        <div className="progress-line active"></div>
        <div className="progress-step active">
          <div className="step-number">2</div>
          <div className="step-label">المعلومات الشخصية</div>
        </div>
        <div className="progress-line"></div>
        <div className="progress-step">
          <div className="step-number">3</div>
          <div className="step-label">الانتهاء</div>
        </div>
      </div> */}

      <header className="user-info-header">
        <div className="header-content">
          <UserCircle size={40} className="header-icon" />
          <div>
            <h1>أكمل ملفك الشخصي</h1>
            <p className="header-subtitle">
              يرجى تعبئة جميع المعلومات المطلوبة لإكمال التسجيل
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSubmit} className="user-info-form">
        {/* القسم 1: المعلومات الشخصية */}
        <section className="form-section">
          <div className="section-header">
            <User size={24} />
            <h2>المعلومات الشخصية</h2>
          </div>

          <div className="form-grid">
            <div className="form-group" id="national_id">
              <label>
                <span className="label-icon">🆔</span>
                الرقم الوطني <span className="required">*</span>
              </label>
              <input
                type="text"
                name="national_id"
                value={formData.national_id}
                onChange={handleInputChange}
                placeholder="12345678901234"
                maxLength={14}
                className={errors.national_id ? "error" : ""}
              />
              {errors.national_id && (
                <span className="error-message">{errors.national_id}</span>
              )}
            </div>

            <div className="form-group" id="full_name_arabic">
              <label>
                <span className="label-icon">👤</span>
                الاسم بالعربية <span className="required">*</span>
              </label>
              <input
                type="text"
                name="full_name_arabic"
                value={formData.full_name_arabic}
                onChange={handleInputChange}
                placeholder="مسعود العلي المسعود"
                className={errors.full_name_arabic ? "error" : ""}
              />
              {errors.full_name_arabic && (
                <span className="error-message">{errors.full_name_arabic}</span>
              )}
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">👤</span>
                الاسم بالإنجليزية
              </label>
              <input
                type="text"
                name="full_name_english"
                value={formData.full_name_english}
                onChange={handleInputChange}
                placeholder="Masoud Al-Masoud"
              />
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">⚤</span>
                الجنس
              </label>
              <div className="radio-group">
                <label className="radio-option">
                  <input
                    type="radio"
                    name="gender"
                    value="M"
                    checked={formData.gender === "M"}
                    onChange={handleInputChange}
                  />
                  <span className="radio-label">ذكر</span>
                </label>
                <label className="radio-option">
                  <input
                    type="radio"
                    name="gender"
                    value="F"
                    checked={formData.gender === "F"}
                    onChange={handleInputChange}
                  />
                  <span className="radio-label">أنثى</span>
                </label>
              </div>
            </div>

            <div className="form-group" id="birth_date">
              <label>
                <span className="label-icon">📅</span>
                تاريخ الميلاد <span className="required">*</span>
              </label>
              <input
                type="date"
                name="birth_date"
                value={formData.birth_date}
                onChange={handleInputChange}
                className={errors.birth_date ? "error" : ""}
              />
              {errors.birth_date && (
                <span className="error-message">{errors.birth_date}</span>
              )}
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">📍</span>
                مكان الميلاد
              </label>
              <input
                type="text"
                name="birth_place"
                value={formData.birth_place}
                onChange={handleInputChange}
                placeholder="الرياض"
              />
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">💍</span>
                الحالة الاجتماعية
              </label>
              <select
                name="marital_status"
                value={formData.marital_status}
                onChange={handleInputChange}
              >
                {maritalStatuses.map((status) => (
                  <option key={status.value} value={status.value}>
                    {status.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">🩸</span>
                فصيلة الدم
              </label>
              <select
                name="blood_type"
                value={formData.blood_type}
                onChange={handleInputChange}
              >
                <option value="">اختر فصيلة الدم</option>
                {bloodTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* معلومات الاتصال */}
          <div className="contact-info">
            <h3>
              <Smartphone size={20} />
              معلومات الاتصال
            </h3>
            <div className="form-grid">
              <div className="form-group" id="phone_number">
                <label>
                  <span className="label-icon">📱</span>
                  رقم الهاتف <span className="required">*</span>
                </label>
                <input
                  type="tel"
                  name="phone_number"
                  value={formData.phone_number}
                  onChange={handleInputChange}
                  placeholder="05XXXXXXXX"
                  className={errors.phone_number ? "error" : ""}
                />
                {errors.phone_number && (
                  <span className="error-message">{errors.phone_number}</span>
                )}
              </div>

              <div className="form-group" id="email">
                <label>
                  <span className="label-icon">📧</span>
                  البريد الإلكتروني <span className="required">*</span>
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  placeholder="example@domain.com"
                  className={errors.email ? "error" : ""}
                />
                {errors.email && (
                  <span className="error-message">{errors.email}</span>
                )}
              </div>
            </div>
          </div>

          {/* الصورة الشخصية */}
          <div className="photo-upload-section">
            <h3>
              <Camera size={20} />
              الصورة الشخصية
            </h3>
            <div className="photo-container">
              <div className="photo-preview">
                {photoPreview ? (
                  <img src={photoPreview} alt="صورة المستخدم" />
                ) : (
                  <div className="photo-placeholder">
                    <User size={40} />
                    <span>اضغط لرفع صورة</span>
                  </div>
                )}
              </div>
              <div className="upload-controls">
                <label className="upload-btn">
                  <Camera size={16} />
                  اختر صورة
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    style={{ display: "none" }}
                  />
                </label>
                <p className="upload-hint">الحجم الأقصى: 2MB (JPEG, PNG)</p>
                {errors.photo && (
                  <span className="error-message">{errors.photo}</span>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* القسم 2: معلومات الأسرة */}
        <section className="form-section">
          <div className="section-header">
            <Users size={24} />
            <h2>معلومات الأسرة</h2>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>
                <UserPlus size={20} />
                اسم الأب
              </label>
              <input
                type="text"
                name="father_name"
                value={formData.father_name}
                onChange={handleInputChange}
                placeholder="اسم الأب الكامل"
              />
            </div>

            <div className="form-group">
              <label>
                <UserPlus size={20} />
                اسم الأم
              </label>
              <input
                type="text"
                name="mother_name"
                value={formData.mother_name}
                onChange={handleInputChange}
                placeholder="اسم الأم الكامل"
              />
            </div>

            <div className="form-group">
              <label>
                <User size={20} />
                اسم الزوج/الزوجة
              </label>
              <input
                type="text"
                name="spouse_name"
                value={formData.spouse_name}
                onChange={handleInputChange}
                placeholder="اسم الزوج/الزوجة"
              />
            </div>

            <div className="form-group">
              <label>
                <UserMinus size={20} />
                عدد الأبناء
              </label>
              <input
                type="number"
                name="children_count"
                value={formData.children_count}
                onChange={handleInputChange}
                placeholder="0"
                min="0"
                max="20"
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              <span className="label-icon">📝</span>
              ملاحظات عائلية
            </label>
            <textarea
              name="family_notes"
              value={formData.family_notes}
              onChange={handleInputChange}
              placeholder="ملاحظات إضافية عن الأسرة..."
              rows="2"
            />
          </div>
        </section>

        {/* القسم 3: معلومات التعليم */}
        <section className="form-section">
          <div className="section-header">
            <GraduationCap size={24} />
            <h2>معلومات التعليم</h2>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>
                <span className="label-icon">🎓</span>
                المؤهل العلمي
              </label>
              <select
                name="education_level"
                value={formData.education_level}
                onChange={handleInputChange}
              >
                <option value="">اختر المؤهل</option>
                {educationLevels.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>
                <BookOpen size={20} />
                التخصص
              </label>
              <input
                type="text"
                name="field_of_study"
                value={formData.field_of_study}
                onChange={handleInputChange}
                placeholder="هندسة الحاسب"
              />
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">🏫</span>
                الجامعة/المعهد
              </label>
              <input
                type="text"
                name="university"
                value={formData.university}
                onChange={handleInputChange}
                placeholder="جامعة الملك سعود"
              />
            </div>

            <div className="form-group">
              <label>
                <Calendar size={20} />
                سنة التخرج
              </label>
              <input
                type="number"
                name="graduation_year"
                value={formData.graduation_year}
                onChange={handleInputChange}
                placeholder="2020"
                min="1900"
                max="2100"
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              <Award size={20} />
              شهادات ودورات إضافية
            </label>
            <textarea
              name="additional_certificates"
              value={formData.additional_certificates}
              onChange={handleInputChange}
              placeholder="أي شهادات أو دورات تدريبية إضافية..."
              rows="2"
            />
          </div>
        </section>

        {/* القسم 4: معلومات العمل */}
        <section className="form-section">
          <div className="section-header">
            <Briefcase size={24} />
            <h2>معلومات العمل</h2>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>
                <span className="label-icon">💼</span>
                المسمى الوظيفي
              </label>
              <input
                type="text"
                name="job_title"
                value={formData.job_title}
                onChange={handleInputChange}
                placeholder="مدير تنفيذي"
              />
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">🏢</span>
                الشركة/المؤسسة
              </label>
              <input
                type="text"
                name="company"
                value={formData.company}
                onChange={handleInputChange}
                placeholder="شركة المسعود"
              />
            </div>

            <div className="form-group">
              <label>
                <MapPin size={20} />
                عنوان العمل
              </label>
              <input
                type="text"
                name="work_address"
                value={formData.work_address}
                onChange={handleInputChange}
                placeholder="عنوان مكان العمل"
              />
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">📊</span>
                نطاق الراتب
              </label>
              <select
                name="salary_range"
                value={formData.salary_range}
                onChange={handleInputChange}
              >
                <option value="">اختر نطاق الراتب</option>
                {salaryRanges.map((range) => (
                  <option key={range} value={range}>
                    {range} ر.س
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>
              <span className="label-icon">📈</span>
              الخبرة العملية
            </label>
            <textarea
              name="work_experience"
              value={formData.work_experience}
              onChange={handleInputChange}
              placeholder="الخبرات والمهارات العملية..."
              rows="2"
            />
          </div>
        </section>

        {/* القسم 5: معلومات إضافية */}
        <section className="form-section">
          <div className="section-header">
            <Activity size={24} />
            <h2>معلومات إضافية</h2>
          </div>

          <div className="form-grid">
            <div className="form-group">
              <label>
                <span className="label-icon">⚽</span>
                الهوايات
              </label>
              <input
                type="text"
                name="hobbies"
                value={formData.hobbies}
                onChange={handleInputChange}
                placeholder="القراءة، الرياضة، السفر..."
              />
            </div>

            <div className="form-group">
              <label>
                <span className="label-icon">🛠️</span>
                المهارات
              </label>
              <input
                type="text"
                name="skills"
                value={formData.skills}
                onChange={handleInputChange}
                placeholder="القيادة، البرمجة، التصميم..."
              />
            </div>

            <div className="form-group">
              <label>
                <Globe size={20} />
                اللغات
              </label>
              <input
                type="text"
                name="languages"
                value={formData.languages}
                onChange={handleInputChange}
                placeholder="العربية، الإنجليزية، الفرنسية..."
              />
            </div>

            <div className="form-group">
              <label>
                <Heart size={20} />
                الحالة الصحية
              </label>
              <input
                type="text"
                name="health_status"
                value={formData.health_status}
                onChange={handleInputChange}
                placeholder="الحالة الصحية العامة..."
              />
            </div>
          </div>

          <div className="form-group">
            <label>
              <span className="label-icon">🌐</span>
              وسائل التواصل الاجتماعي
            </label>
            <input
              type="text"
              name="social_media"
              value={formData.social_media}
              onChange={handleInputChange}
              placeholder="@username أو روابط التواصل"
            />
          </div>

          <div className="form-group">
            <label>
              <Target size={20} />
              الأهداف الشخصية
            </label>
            <textarea
              name="personal_goals"
              value={formData.personal_goals}
              onChange={handleInputChange}
              placeholder="ما هي أهدافك وتطلعاتك المستقبلية؟"
              rows="2"
            />
          </div>
        </section>

        {/* العنوان */}
        <section className="form-section">
          <div className="section-header">
            <Home size={24} />
            <h2>العنوان الحالي</h2>
          </div>

          <div className="form-group">
            <label>
              <MapPin size={20} />
              العنوان التفصيلي
            </label>
            <textarea
              name="current_address"
              value={formData.current_address}
              onChange={handleInputChange}
              placeholder="المدينة - الحي - الشارع - رقم المنزل"
              rows="3"
            />
          </div>
        </section>

        {/* زر الحفظ */}
        <div className="submit-section">
          <button type="submit" className="save-btn" disabled={loading}>
            {loading ? (
              <>
                <div className="spinner"></div>
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save size={20} />
                <span>حفظ المعلومات</span>
              </>
            )}
          </button>

          <p className="form-note">
            ⓘ سيتم حفظ جميع المعلومات بشكل آمن ويمكنك تعديلها لاحقاً من صفحة
            الملف الشخصي
          </p>
        </div>
      </form>
    </div>
  );
}

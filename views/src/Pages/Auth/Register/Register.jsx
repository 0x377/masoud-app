import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../../Hooks/useAuth"; // Updated path for Redux hook
import {
  User,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Building,
  Check,
  Shield,
} from "lucide-react";
import "./Register.css";

const Register = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    // firstName: "",
    // lastName: "",
    fullName: "",
    email: "",
    phone: "",
    company: "",
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
    receiveUpdates: true,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [step, setStep] = useState(1);
  const [touched, setTouched] = useState({});
  const [verificationSent, setVerificationSent] = useState(false);

  // Use Redux auth hook instead of context
  const {
    register: registerUser,
    isLoading,
    error: authError,
    clearError,
    isAuthenticated,
  } = useAuth();

  // Clear auth errors on component mount
  useEffect(() => {
    clearError();

    // If already authenticated, redirect
    if (isAuthenticated) {
      const from = location.state?.from || "/dashboard";
      navigate(from, { replace: true });
    }
  }, [clearError, isAuthenticated, navigate, location]);

  // Parse any redirect from location state
  const from = location.state?.from || "/dashboard";

  const handleBlur = (field) => {
    setTouched((prev) => ({ ...prev, [field]: true }));

    // Validate field on blur
    if (
      field === "email" ||
      field === "phone" ||
      // field === "firstName" ||
      field === "fullName"
    ) {
      validateField(field, formData[field]);
    }
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Mark field as touched
    setTouched((prev) => ({ ...prev, [name]: true }));

    // Calculate password strength
    if (name === "password") {
      calculatePasswordStrength(newValue);

      // Validate confirm password if password changes
      if (formData.confirmPassword) {
        validateConfirmPassword(newValue, formData.confirmPassword);
      }
    }

    // Validate confirm password when it changes
    if (name === "confirmPassword" && formData.password) {
      validateConfirmPassword(formData.password, newValue);
    }

    // Clear error for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Clear general errors
    if (errors.general) {
      setErrors((prev) => ({ ...prev, general: "" }));
    }
  };

  const validateField = (field, value) => {
    let error = "";

    switch (field) {
      case "firstName":
        if (!value.trim()) {
          error = "الاسم الأول مطلوب";
        } else if (value.trim().length < 2) {
          error = "الاسم الأول يجب أن يكون على الأقل حرفين";
        } else if (
          !/^[\u0600-\u06FF\s]+$/.test(value.trim()) &&
          !/^[A-Za-z\s]+$/.test(value.trim())
        ) {
          error = "الاسم يجب أن يحتوي على أحرف عربية أو إنجليزية فقط";
        }
        break;

      case "lastName":
        if (!value.trim()) {
          error = "اسم العائلة مطلوب";
        } else if (value.trim().length < 2) {
          error = "اسم العائلة يجب أن يكون على الأقل حرفين";
        } else if (
          !/^[\u0600-\u06FF\s]+$/.test(value.trim()) &&
          !/^[A-Za-z\s]+$/.test(value.trim())
        ) {
          error = "اسم العائلة يجب أن يحتوي على أحرف عربية أو إنجليزية فقط";
        }
        break;

      case "fullName":
        if (!value.trim()) {
          error = "اسم العائلة مطلوب";
        } else if (value.trim().length < 2) {
          error = "اسم العائلة يجب أن يكون على الأقل حرفين";
        } else if (
          !/^[\u0600-\u06FF\s]+$/.test(value.trim()) &&
          !/^[A-Za-z\s]+$/.test(value.trim())
        ) {
          error = "اسم العائلة يجب أن يحتوي على أحرف عربية أو إنجليزية فقط";
        }
        break;

      case "email":
        if (!value.trim()) {
          error = "البريد الإلكتروني مطلوب";
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          error = "البريد الإلكتروني غير صحيح";
        } else if (value.length > 100) {
          error = "البريد الإلكتروني طويل جداً";
        }
        break;

      case "phone":
        if (!value.trim()) {
          error = "رقم الهاتف مطلوب";
        } else {
          const cleanedPhone = value.replace(/\s/g, "");
          if (!/^[\+]?[1-9][\d]{9,14}$/.test(cleanedPhone)) {
            error = "رقم الهاتف غير صحيح (مثال: +966501234567)";
          } else if (!cleanedPhone.startsWith("+")) {
            error = "يرجى إضافة رمز الدولة (مثال: +966)";
          }
        }
        break;

      case "password":
        if (!value) {
          error = "كلمة المرور مطلوبة";
        } else if (value.length < 8) {
          error = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
        } else if (!/(?=.*[a-z])/.test(value)) {
          error = "يجب أن تحتوي على حرف صغير واحد على الأقل";
        } else if (!/(?=.*[A-Z])/.test(value)) {
          error = "يجب أن تحتوي على حرف كبير واحد على الأقل";
        } else if (!/(?=.*\d)/.test(value)) {
          error = "يجب أن تحتوي على رقم واحد على الأقل";
        } else if (!/(?=.*[@$!%*?&])/.test(value)) {
          error = "يجب أن تحتوي على رمز خاص واحد على الأقل (@$!%*?&)";
        } else if (value.includes(" ")) {
          error = "كلمة المرور يجب ألا تحتوي على مسافات";
        }
        break;
    }

    if (error) {
      setErrors((prev) => ({ ...prev, [field]: error }));
    } else if (errors[field]) {
      const newErrors = { ...errors };
      delete newErrors[field];
      setErrors(newErrors);
    }

    return !error;
  };

  const validateConfirmPassword = (password, confirmPassword) => {
    let error = "";

    if (!confirmPassword) {
      error = "تأكيد كلمة المرور مطلوب";
    } else if (password !== confirmPassword) {
      error = "كلمات المرور غير متطابقة";
    }

    if (error) {
      setErrors((prev) => ({ ...prev, confirmPassword: error }));
    } else if (errors.confirmPassword) {
      const newErrors = { ...errors };
      delete newErrors.confirmPassword;
      setErrors(newErrors);
    }

    return !error;
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;

    // Length
    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;

    // Character types
    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 20;
    if (/[0-9]/.test(password)) strength += 20;
    if (/[^A-Za-z0-9]/.test(password)) strength += 10;

    // Variety bonus
    const charTypes = [
      /[A-Z]/.test(password),
      /[a-z]/.test(password),
      /[0-9]/.test(password),
      /[^A-Za-z0-9]/.test(password),
    ].filter(Boolean).length;

    if (charTypes >= 3) strength += 10;

    // Penalties
    if (/(.)\1{2,}/.test(password)) strength -= 10; // Repeated characters
    if (
      formData.email &&
      password
        .toLowerCase()
        .includes(formData.email.split("@")[0].toLowerCase())
    ) {
      strength -= 10; // Contains part of email
    }
    if (
      formData.firstName &&
      password.toLowerCase().includes(formData.firstName.toLowerCase())
    ) {
      strength -= 10; // Contains first name
    }
    if (
      formData.lastName &&
      password.toLowerCase().includes(formData.lastName.toLowerCase())
    ) {
      strength -= 10; // Contains last name
    }

    setPasswordStrength(Math.max(0, Math.min(strength, 100)));
  };

  const validateStep1 = () => {
    const newErrors = {};
    let isValid = true;

    ["firstName", "lastName", "email", "phone"].forEach((field) => {
      if (!validateField(field, formData[field])) {
        isValid = false;
        newErrors[field] = errors[field] || "";
      }
    });

    return { isValid, errors: newErrors };
  };

  const validateStep2 = () => {
    const newErrors = {};
    let isValid = true;

    // Validate password
    if (!validateField("password", formData.password)) {
      isValid = false;
      newErrors.password = errors.password || "";
    }

    // Validate confirm password
    if (!validateConfirmPassword(formData.password, formData.confirmPassword)) {
      isValid = false;
      newErrors.confirmPassword = errors.confirmPassword || "";
    }

    // Validate terms
    if (!formData.agreeToTerms) {
      isValid = false;
      newErrors.agreeToTerms = "يجب الموافقة على الشروط والأحكام";
    }

    return { isValid, errors: newErrors };
  };

  const nextStep = () => {
    const validation = validateStep1();

    if (!validation.isValid) {
      setErrors(validation.errors);

      // Scroll to first error
      const firstErrorField = Object.keys(validation.errors)[0];
      setTimeout(() => {
        const element = document.getElementById(firstErrorField);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.focus();
        }
      }, 100);
      return;
    }

    // Clear previous errors
    setErrors({});
    setStep(2);
  };

  const prevStep = () => {
    setStep(1);
    setErrors({});
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    if (step === 1) {
      nextStep();
      return;
    }

    // Validate step 2
    const validation = validateStep2();
    if (!validation.isValid) {
      setErrors(validation.errors);

      // Scroll to first error
      const firstErrorField = Object.keys(validation.errors)[0];
      setTimeout(() => {
        const element = document.getElementById(firstErrorField);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
          element.focus();
        }
      }, 100);
      return;
    }

    clearError();

    try {
      if (userData.password !== userData.password_confirmation) {
        setErrors({password: "Not match passwords"})
      }
      // Prepare user data for registration
      const userData = {
        // full_name_arabic: `${formData.firstName} ${formData.lastName}`,
        // full_name_english: `${formData.firstName} ${formData.lastName}`,
        fullName: formData.fullName,
        email: formData.email,
        phone_number: formData.phone,
        password: formData.password,
        company: formData.company || "",
        user_type: "FAMILY_MEMBER",
        terms_accepted: formData.agreeToTerms,
        receive_updates: formData.receiveUpdates,
      };

      // Call register function from Redux auth hook
      const result = await registerUser(userData);

      if (result.type === "auth/register/fulfilled") {
        setVerificationSent(true);

        // Don't redirect immediately - wait for email verification
        // Instead, show verification message
        // setTimeout(() => {
        //   navigate("/verify-email", {
        //     state: {
        //       email: formData.email,
        //       from: from,
        //     },
        //   });
        // }, 2000);
      } else if (result.type === "auth/register/rejected") {
        setErrors({ general: result.payload || "فشل التسجيل" });
      }
    } catch (error) {
      console.error("Registration error:", error);
      setErrors({
        general: error.message || "حدث خطأ غير متوقع أثناء التسجيل",
      });
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 40) return "#ef4444"; // red
    if (passwordStrength < 70) return "#f59e0b"; // orange
    return "#10b981"; // green
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 40) return "ضعيفة";
    if (passwordStrength < 70) return "متوسطة";
    return "قوية";
  };

  const isFieldValid = (field) => {
    return touched[field] && !errors[field];
  };

  const isFieldInvalid = (field) => {
    return touched[field] && errors[field];
  };

  if (verificationSent) {
    return (
      <div className="register-container">
        <div className="register-card">
          <div className="success-animation">
            <Shield size={80} color="#10b981" />
          </div>
          <h2 className="success-title">تم إنشاء حسابك! ✅</h2>
          <p className="success-message">
            مرحباً بك {formData.firstName}، تم إنشاء حسابك بنجاح.
            <br />
            تم إرسال رابط التحقق إلى بريدك الإلكتروني:{" "}
            <strong>{formData.email}</strong>
            <br />
            <small className="verification-note">
              يرجى التحقق من بريدك الإلكتروني وتفعيل حسابك للمتابعة.
            </small>
          </p>
          <div className="verification-actions">
            <button
              onClick={() => navigate("/login")}
              className="back-to-login-btn"
            >
              العودة إلى تسجيل الدخول
            </button>
            <button
              onClick={() =>
                navigate("/verify-email", { state: { email: formData.email } })
              }
              className="verify-now-btn"
            >
              التحقق الآن
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-pages">
      <div className="register-container">
        <div className="register-header">
          <h2>إنشاء حساب جديد</h2>
          <p>انضم إلى منصة مسعود</p>
        </div>

        {/* Progress Bar */}
        <div className="progress-bar">
          <div className="progress-steps">
            <div
              className={`step ${step >= 1 ? "active" : ""} ${step > 1 ? "completed" : ""}`}
            >
              <div className="step-number">{step > 1 ? "✓" : "1"}</div>
              <div className="step-label">المعلومات الشخصية</div>
            </div>
            <div className="step-line">
              <div
                className="step-line-progress"
                style={{ width: step > 1 ? "100%" : "0%" }}
              />
            </div>
            <div className={`step ${step >= 2 ? "active" : ""}`}>
              <div className="step-number">2</div>
              <div className="step-label">كلمة المرور</div>
            </div>
          </div>
        </div>

        {errors.general && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <span>{errors.general}</span>
          </div>
        )}

        {authError && !errors.general && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <span>{authError}</span>
          </div>
        )}

        <form
          onSubmit={
            step === 2
              ? handleSubmit
              : (e) => {
                  e.preventDefault();
                  nextStep();
                }
          }
          className="register-form"
          noValidate
        >
          {step === 1 && (
            <div className="form-step">
              {/* <div className="form-row">
                <div className="form-group">
                  <label htmlFor="firstName">
                    <User size={18} />
                    <span>الاسم الأول *</span>
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    onBlur={() => handleBlur("firstName")}
                    placeholder="محمد"
                    className={`${isFieldInvalid("firstName") ? "error" : ""} ${isFieldValid("firstName") ? "success" : ""}`}
                    autoComplete="given-name"
                    required
                  />
                  {isFieldValid("firstName") && (
                    <div className="field-success">
                      <CheckCircle size={14} />
                    </div>
                  )}
                  {isFieldInvalid("firstName") && (
                    <span className="error-message">
                      <AlertCircle size={14} />
                      {errors.firstName}
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="lastName">
                    <User size={18} />
                    <span>اسم العائلة *</span>
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    onBlur={() => handleBlur("lastName")}
                    placeholder="أحمد"
                    className={`${isFieldInvalid("lastName") ? "error" : ""} ${isFieldValid("lastName") ? "success" : ""}`}
                    autoComplete="family-name"
                    required
                  />
                  {isFieldValid("lastName") && (
                    <div className="field-success">
                      <CheckCircle size={14} />
                    </div>
                  )}
                  {isFieldInvalid("lastName") && (
                    <span className="error-message">
                      <AlertCircle size={14} />
                      {errors.lastName}
                    </span>
                  )}
                </div>
              </div> */}

              <div className="form-group">
                <label htmlFor="fullName">
                  <User size={18} />
                  <span>الاسم بالكامل *</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  onBlur={() => handleBlur("fullName")}
                  placeholder="محمد احمد المسعود"
                  className={`${isFieldInvalid("fullName") ? "error" : ""} ${isFieldValid("email") ? "success" : ""}`}
                  autoComplete="given-name"
                  required
                />
                {isFieldValid("fullName") && (
                  <div className="field-success">
                    <CheckCircle size={14} />
                  </div>
                )}
                {isFieldInvalid("fullName") && (
                  <span className="error-message">
                    <AlertCircle size={14} />
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="email">
                  <Mail size={18} />
                  <span>البريد الإلكتروني *</span>
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  onBlur={() => handleBlur("email")}
                  placeholder="example@domain.com"
                  className={`${isFieldInvalid("email") ? "error" : ""} ${isFieldValid("email") ? "success" : ""}`}
                  dir="ltr"
                  autoComplete="email"
                  required
                />
                {isFieldValid("email") && (
                  <div className="field-success">
                    <CheckCircle size={14} />
                  </div>
                )}
                {isFieldInvalid("email") && (
                  <span className="error-message">
                    <AlertCircle size={14} />
                    {errors.email}
                  </span>
                )}
              </div>

              <div className="form-group">
                <label htmlFor="phone">
                  <Phone size={18} />
                  <span>رقم الهاتف *</span>
                </label>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  onBlur={() => handleBlur("phone")}
                  placeholder="+966501234567"
                  className={`${isFieldInvalid("phone") ? "error" : ""} ${isFieldValid("phone") ? "success" : ""}`}
                  dir="ltr"
                  autoComplete="tel"
                  required
                />
                {isFieldValid("phone") && (
                  <div className="field-success">
                    <CheckCircle size={14} />
                  </div>
                )}
                {isFieldInvalid("phone") && (
                  <span className="error-message">
                    <AlertCircle size={14} />
                    {errors.phone}
                  </span>
                )}
              </div>

              <button
                type="button"
                className="next-btn"
                onClick={nextStep}
                disabled={isLoading}
              >
                {isLoading ? "جاري التحقق..." : "التالي"}
                <span className="arrow">←</span>
              </button>
            </div>
          )}

          {step === 2 && (
            <div className="form-step">
              <div className="form-group">
                <label htmlFor="password">
                  <Lock size={18} />
                  <span>كلمة المرور *</span>
                </label>
                <div className="password-input">
                  <input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onBlur={() => handleBlur("password")}
                    placeholder="أدخل كلمة مرور قوية"
                    className={`${isFieldInvalid("password") ? "error" : ""} ${isFieldValid("password") ? "success" : ""}`}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                    aria-label={
                      showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                    }
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>

                {/* Password Strength Indicator */}
                {formData.password && (
                  <div className="password-strength">
                    <div className="strength-bar">
                      <div
                        className="strength-fill"
                        style={{
                          width: `${passwordStrength}%`,
                          backgroundColor: getPasswordStrengthColor(),
                        }}
                      ></div>
                    </div>
                    <div className="strength-info">
                      <span>قوة كلمة المرور: </span>
                      <span
                        style={{
                          color: getPasswordStrengthColor(),
                          fontWeight: 700,
                        }}
                      >
                        {getPasswordStrengthText()}
                      </span>
                      <span style={{ color: getPasswordStrengthColor() }}>
                        ({Math.round(passwordStrength)}%)
                      </span>
                    </div>
                  </div>
                )}

                {isFieldInvalid("password") && (
                  <span className="error-message">
                    <AlertCircle size={14} />
                    {errors.password}
                  </span>
                )}

                {/* Password Requirements */}
                {/* <div className="password-requirements">
                  <h4>متطلبات كلمة المرور:</h4>
                  <ul>
                    <li
                      className={formData.password.length >= 8 ? "valid" : ""}
                    >
                      {formData.password.length >= 8 ? (
                        <CheckCircle size={14} color="#10b981" />
                      ) : (
                        <AlertCircle size={14} color="#ef4444" />
                      )}
                      <span>8 أحرف على الأقل</span>
                    </li>
                    <li
                      className={/[A-Z]/.test(formData.password) ? "valid" : ""}
                    >
                      {/[A-Z]/.test(formData.password) ? (
                        <CheckCircle size={14} color="#10b981" />
                      ) : (
                        <AlertCircle size={14} color="#ef4444" />
                      )}
                      <span>حرف كبير واحد على الأقل (A-Z)</span>
                    </li>
                    <li
                      className={/[a-z]/.test(formData.password) ? "valid" : ""}
                    >
                      {/[a-z]/.test(formData.password) ? (
                        <CheckCircle size={14} color="#10b981" />
                      ) : (
                        <AlertCircle size={14} color="#ef4444" />
                      )}
                      <span>حرف صغير واحد على الأقل (a-z)</span>
                    </li>
                    <li
                      className={/[0-9]/.test(formData.password) ? "valid" : ""}
                    >
                      {/[0-9]/.test(formData.password) ? (
                        <CheckCircle size={14} color="#10b981" />
                      ) : (
                        <AlertCircle size={14} color="#ef4444" />
                      )}
                      <span>رقم واحد على الأقل (0-9)</span>
                    </li>
                    <li
                      className={
                        /[^A-Za-z0-9]/.test(formData.password) ? "valid" : ""
                      }
                    >
                      {/[^A-Za-z0-9]/.test(formData.password) ? (
                        <CheckCircle size={14} color="#10b981" />
                      ) : (
                        <AlertCircle size={14} color="#ef4444" />
                      )}
                      <span>رمز خاص واحد على الأقل (@$!%*?&)</span>
                    </li>
                    <li
                      className={
                        !formData.password.includes(" ") ? "valid" : ""
                      }
                    >
                      {!formData.password.includes(" ") ? (
                        <CheckCircle size={14} color="#10b981" />
                      ) : (
                        <AlertCircle size={14} color="#ef4444" />
                      )}
                      <span>بدون مسافات</span>
                    </li>
                  </ul>
                </div> */}
              </div>

              <div className="form-group">
                <label htmlFor="confirmPassword">
                  <Lock size={18} />
                  <span>تأكيد كلمة المرور *</span>
                </label>
                <div className="password-input">
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    id="confirmPassword"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onBlur={() => handleBlur("confirmPassword")}
                    placeholder="أعد إدخال كلمة المرور"
                    className={`${isFieldInvalid("confirmPassword") ? "error" : ""} ${isFieldValid("confirmPassword") ? "success" : ""}`}
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    tabIndex="-1"
                    aria-label={
                      showConfirmPassword ? "إخفاء التأكيد" : "إظهار التأكيد"
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff size={20} />
                    ) : (
                      <Eye size={20} />
                    )}
                  </button>
                </div>
                {isFieldInvalid("confirmPassword") && (
                  <span className="error-message">
                    <AlertCircle size={14} />
                    {errors.confirmPassword}
                  </span>
                )}
              </div>

              <div className="form-group checkbox-group">
                <label
                  className={`checkbox-label ${isFieldInvalid("agreeToTerms") ? "error" : ""}`}
                >
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleChange}
                  />
                  <span>
                    أوافق على{" "}
                    <Link to="/terms" className="terms-link">
                      الشروط والأحكام
                    </Link>{" "}
                    و{" "}
                    <Link to="/privacy" className="terms-link">
                      سياسة الخصوصية
                    </Link>{" "}
                    *
                  </span>
                </label>
                {isFieldInvalid("agreeToTerms") && (
                  <span className="error-message">
                    <AlertCircle size={14} />
                    {errors.agreeToTerms}
                  </span>
                )}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="prev-btn"
                  onClick={prevStep}
                  disabled={isLoading}
                >
                  <span className="arrow">→</span>
                  السابق
                </button>
                <button
                  type="submit"
                  className="submit-btn"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <>
                      <span className="spinner"></span>
                      جاري إنشاء الحساب...
                    </>
                  ) : (
                    "إنشاء الحساب"
                  )}
                </button>
              </div>
            </div>
          )}
        </form>

        <div className="login-link">
          <span>لديك حساب بالفعل؟</span>
          <Link to="/login" className="link">
            تسجيل الدخول
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Register;

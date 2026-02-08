import React, { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import {
  User,
  Mail,
  Lock,
  Phone,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Check,
  X,
} from "lucide-react";
import "./Register.css";
import { useRoot } from "../../../context/rootContesxt";

const Register = () => {
  const { register, error, loading, clearError } = useRoot();
  const [registrationResult, setRegistrationResult] = useState(null);

  const [formData, setFormData] = useState({
    full_name: "", // Changed to match backend field name
    email: "",
    phone_number: "", // Changed to match backend field name
    password: "",
    confirmPassword: "",
    agreeToTerms: false,
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [passwordRequirements, setPasswordRequirements] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
  });

  const timeoutRef = useRef(null);
  const formDataRef = useRef(formData);

  // Update ref when formData changes
  useEffect(() => {
    formDataRef.current = formData;
  }, [formData]);

  // Clear error from context on unmount
  useEffect(() => {
    return () => {
      clearError();
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [clearError]);

  // Handle context error changes
  useEffect(() => {
    if (error) {
      timeoutRef.current = setTimeout(() => {
        const errorElement = document.querySelector(".error-alert");
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [error]);

  // Handle backend validation errors
  useEffect(() => {
    if (registrationResult?.errors) {
      // Map backend field names to frontend field names
      const backendErrors = {};
      Object.keys(registrationResult.errors).forEach((key) => {
        const frontendKey =
          key === "full_name"
            ? "full_name"
            : key === "phone_number"
              ? "phone_number"
              : key === "password_confirmation"
                ? "confirmPassword"
                : key === "terms_accepted"
                  ? "agreeToTerms"
                  : key;
        backendErrors[frontendKey] = registrationResult.errors[key];
      });
      setErrors(backendErrors);
    }
  }, [registrationResult]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === "checkbox" ? checked : value;

    setFormData((prev) => ({
      ...prev,
      [name]: newValue,
    }));

    // Clear errors for this field
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Clear context error
    if (error) {
      clearError();
    }

    // Clear registration result
    if (registrationResult) {
      setRegistrationResult(null);
    }

    // Calculate password strength and requirements
    if (name === "password") {
      calculatePasswordStrength(newValue);
      checkPasswordRequirements(newValue);

      // Validate confirm password if password changes
      if (formDataRef.current.confirmPassword) {
        validateConfirmPassword(newValue, formDataRef.current.confirmPassword);
      }
    }

    // Validate confirm password when it changes
    if (name === "confirmPassword" && formDataRef.current.password) {
      validateConfirmPassword(formDataRef.current.password, newValue);
    }
  };

  const calculatePasswordStrength = (password) => {
    let strength = 0;

    if (password.length >= 8) strength += 20;
    if (password.length >= 12) strength += 10;

    if (/[A-Z]/.test(password)) strength += 20;
    if (/[a-z]/.test(password)) strength += 20;
    if (/[0-9]/.test(password)) strength += 20;
    if (/[^A-Za-z0-9]/.test(password)) strength += 10;

    setPasswordStrength(Math.min(strength, 100));
  };

  const checkPasswordRequirements = (password) => {
    setPasswordRequirements({
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      special: /[^A-Za-z0-9]/.test(password),
    });
  };

  const validateForm = () => {
    const newErrors = {};

    // Full Name validation
    if (!formData.full_name.trim()) {
      newErrors.full_name = "الاسم بالكامل مطلوب";
    } else if (formData.full_name.trim().length < 2) {
      newErrors.full_name = "الاسم يجب أن يكون على الأقل حرفين";
    }

    // Email validation
    if (!formData.email.trim()) {
      newErrors.email = "البريد الإلكتروني مطلوب";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = "البريد الإلكتروني غير صحيح";
    }

    // Phone validation - Saudi phone format
    if (!formData.phone_number.trim()) {
      newErrors.phone_number = "رقم الهاتف مطلوب";
    } else {
      const cleanedPhone = formData.phone_number.replace(/\s/g, "");
      if (!/^(?:\+966|0)5[0-9]{8}$/.test(cleanedPhone)) {
        newErrors.phone_number =
          "رقم الهاتف غير صحيح (يجب أن يبدأ بـ 05 أو +9665)";
      }
    }

    // Password validation
    if (!formData.password) {
      newErrors.password = "كلمة المرور مطلوبة";
    } else if (formData.password.length < 8) {
      newErrors.password = "كلمة المرور يجب أن تكون 8 أحرف على الأقل";
    } else if (!/(?=.*[a-z])/.test(formData.password)) {
      newErrors.password = "يجب أن تحتوي على حرف صغير واحد على الأقل";
    } else if (!/(?=.*[A-Z])/.test(formData.password)) {
      newErrors.password = "يجب أن تحتوي على حرف كبير واحد على الأقل";
    } else if (!/(?=.*\d)/.test(formData.password)) {
      newErrors.password = "يجب أن تحتوي على رقم واحد على الأقل";
    } else if (!/(?=.*[@$!%*?&])/.test(formData.password)) {
      newErrors.password = "يجب أن تحتوي على رمز خاص واحد على الأقل";
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "تأكيد كلمة المرور مطلوب";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "كلمات المرور غير متطابقة";
    }

    // Terms validation
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = "يجب الموافقة على الشروط والأحكام";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateConfirmPassword = (password, confirmPassword) => {
    if (password !== confirmPassword) {
      setErrors((prev) => ({
        ...prev,
        confirmPassword: "كلمات المرور غير متطابقة",
      }));
      return false;
    }
    if (errors.confirmPassword) {
      const newErrors = { ...errors };
      delete newErrors.confirmPassword;
      setErrors(newErrors);
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    clearError();
    setRegistrationResult(null);

    // Validate form
    if (!validateForm()) {
      // Scroll to first error
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        const firstErrorField = Object.keys(errors)[0];
        const element = document.getElementById(firstErrorField);
        if (element) {
          element.scrollIntoView({ behavior: "smooth", block: "center" });
        }
      }, 100);
      return;
    }

    try {
      // Prepare data for API - match backend field names
      const userData = {
        full_name: formData.full_name,
        email: formData.email,
        password: formData.password,
        password_confirmation: formData.confirmPassword,
        phone_number: formData.phone_number.replace(/\s/g, ""),
        terms_accepted: formData.agreeToTerms,
      };

      console.log("Submitting registration data:", userData);

      // Call register function from context
      const result = await register(userData);
      setRegistrationResult(result);

      if (result.success) {
        import.meta.env.VITE_NODE_ENV === "development" &&
          console.log("Registration successful:", result.data);
        // Registration is successful, context will handle navigation
      } else {
        console.log("Registration failed:", result);
        // Show backend validation errors if any
        if (result.errors) {
          const backendErrors = {};
          Object.keys(result.errors).forEach((key) => {
            const frontendKey =
              key === "full_name"
                ? "full_name"
                : key === "phone_number"
                  ? "phone_number"
                  : key === "password_confirmation"
                    ? "confirmPassword"
                    : key === "terms_accepted"
                      ? "agreeToTerms"
                      : key;
            backendErrors[frontendKey] = result.errors[key];
          });
          setErrors(backendErrors);
        }
      }
    } catch (err) {
      console.error("Registration error:", err);
      setRegistrationResult({
        success: false,
        message: err.message || "حدث خطأ أثناء التسجيل",
      });
    }
  };

  const getPasswordStrengthColor = () => {
    if (passwordStrength < 40) return "#ef4444";
    if (passwordStrength < 70) return "#f59e0b";
    return "#10b981";
  };

  const getPasswordStrengthText = () => {
    if (passwordStrength < 40) return "ضعيفة";
    if (passwordStrength < 70) return "متوسطة";
    return "قوية";
  };

  const isFieldValid = (field) => {
    return formData[field] && !errors[field];
  };

  return (
    <div className="register-container">
      <div className="register-header">
        <h2>إنشاء حساب جديد</h2>
        <p>انضم إلى منصة مسعود</p>
      </div>

      {error && (
        <div className="error-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {registrationResult?.success === false && !error && (
        <div className="error-alert">
          <AlertCircle size={18} />
          <span>{registrationResult.message || "فشل إنشاء الحساب"}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="register-form" noValidate>
        <div className="form-group">
          <label htmlFor="full_name">
            <User size={18} />
            <span>الاسم بالكامل *</span>
          </label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="محمد احمد المسعود"
            className={`${errors.full_name ? "error" : ""} ${isFieldValid("full_name") ? "success" : ""}`}
            autoComplete="name"
            required
          />
          {isFieldValid("full_name") && (
            <div className="field-success">
              <CheckCircle size={14} />
              <span>الاسم صالح</span>
            </div>
          )}
          {errors.full_name && (
            <span className="error-message">
              <AlertCircle size={14} />
              {errors.full_name}
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
            placeholder="example@domain.com"
            className={`${errors.email ? "error" : ""} ${isFieldValid("email") ? "success" : ""}`}
            dir="ltr"
            autoComplete="email"
            required
          />
          {isFieldValid("email") && (
            <div className="field-success">
              <CheckCircle size={14} />
              <span>البريد الإلكتروني صالح</span>
            </div>
          )}
          {errors.email && (
            <span className="error-message">
              <AlertCircle size={14} />
              {errors.email}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="phone_number">
            <Phone size={18} />
            <span>رقم الهاتف *</span>
          </label>
          <input
            type="tel"
            id="phone_number"
            name="phone_number"
            value={formData.phone_number}
            onChange={handleChange}
            placeholder="05XXXXXXXX أو +9665XXXXXXXX"
            className={`${errors.phone_number ? "error" : ""} ${isFieldValid("phone_number") ? "success" : ""}`}
            dir="ltr"
            autoComplete="tel"
            required
          />
          {isFieldValid("phone_number") && (
            <div className="field-success">
              <CheckCircle size={14} />
              <span>رقم الهاتف صالح</span>
            </div>
          )}
          {errors.phone_number && (
            <span className="error-message">
              <AlertCircle size={14} />
              {errors.phone_number}
            </span>
          )}
        </div>

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
              placeholder="أدخل كلمة مرور قوية"
              className={`${errors.password ? "error" : ""} ${isFieldValid("password") ? "success" : ""}`}
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

          {formData.password && (
            <>
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

              <div className="password-requirements">
                <h4>متطلبات كلمة المرور:</h4>
                <ul>
                  <li
                    className={`requirement-item ${passwordRequirements.length ? "valid" : "invalid"}`}
                  >
                    {passwordRequirements.length ? (
                      <Check size={14} />
                    ) : (
                      <X size={14} />
                    )}
                    <span>8 أحرف على الأقل</span>
                  </li>
                  <li
                    className={`requirement-item ${passwordRequirements.uppercase ? "valid" : "invalid"}`}
                  >
                    {passwordRequirements.uppercase ? (
                      <Check size={14} />
                    ) : (
                      <X size={14} />
                    )}
                    <span>حرف كبير واحد على الأقل</span>
                  </li>
                  <li
                    className={`requirement-item ${passwordRequirements.lowercase ? "valid" : "invalid"}`}
                  >
                    {passwordRequirements.lowercase ? (
                      <Check size={14} />
                    ) : (
                      <X size={14} />
                    )}
                    <span>حرف صغير واحد على الأقل</span>
                  </li>
                  <li
                    className={`requirement-item ${passwordRequirements.number ? "valid" : "invalid"}`}
                  >
                    {passwordRequirements.number ? (
                      <Check size={14} />
                    ) : (
                      <X size={14} />
                    )}
                    <span>رقم واحد على الأقل</span>
                  </li>
                  <li
                    className={`requirement-item ${passwordRequirements.special ? "valid" : "invalid"}`}
                  >
                    {passwordRequirements.special ? (
                      <Check size={14} />
                    ) : (
                      <X size={14} />
                    )}
                    <span>رمز خاص واحد على الأقل</span>
                  </li>
                </ul>
              </div>
            </>
          )}

          {errors.password && (
            <span className="error-message">
              <AlertCircle size={14} />
              {errors.password}
            </span>
          )}
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
              placeholder="أعد إدخال كلمة المرور"
              className={`${errors.confirmPassword ? "error" : ""} ${isFieldValid("confirmPassword") && formData.confirmPassword ? "success" : ""}`}
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
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <span className="error-message">
              <AlertCircle size={14} />
              {errors.confirmPassword}
            </span>
          )}
        </div>

        <div className="form-group checkbox-group">
          <label
            className={`checkbox-label ${errors.agreeToTerms ? "error" : ""}`}
          >
            <input
              type="checkbox"
              name="agreeToTerms"
              checked={formData.agreeToTerms}
              onChange={handleChange}
              className={errors.agreeToTerms ? "error" : ""}
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
          {errors.agreeToTerms && (
            <span className="error-message">
              <AlertCircle size={14} />
              {errors.agreeToTerms}
            </span>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? (
            <>
              <span className="spinner"></span>
              جاري إنشاء الحساب...
            </>
          ) : (
            "إنشاء الحساب"
          )}
        </button>
      </form>

      <div className="login-link">
        <span>لديك حساب بالفعل؟</span>
        <Link to="/login" className="link">
          تسجيل الدخول
        </Link>
      </div>

      <div className="security-notice">
        <CheckCircle size={18} />
        <span>نحن نحافظ على خصوصيتك وأمان بياناتك</span>
      </div>
    </div>
  );
};

export default Register;

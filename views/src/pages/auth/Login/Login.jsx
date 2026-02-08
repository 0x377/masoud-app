// Login.jsx
import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, AlertCircle } from "lucide-react";
import "./Login.css";
import { useRoot } from "../../../context/rootContesxt.jsx";

const Login = () => {
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const navigate = useNavigate();
  const { login, error, isLoading, clearError } = useRoot();

  // Clear errors when component mounts or when form data changes
  useEffect(() => {
    clearError();
    // Clear validation errors when user starts typing
    if (formData.email && validationErrors.email) {
      setValidationErrors((prev) => ({ ...prev, email: "" }));
    }
    if (formData.password && validationErrors.password) {
      setValidationErrors((prev) => ({ ...prev, password: "" }));
    }
  }, [formData.email, formData.password, clearError]);

  const validateForm = () => {
    const errors = {};

    // Email validation
    if (!formData.email.trim()) {
      errors.email = "البريد الإلكتروني مطلوب";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      errors.email = "البريد الإلكتروني غير صالح";
    }

    // Password validation
    if (!formData.password) {
      errors.password = "كلمة المرور مطلوبة";
    } else if (formData.password.length < 6) {
      errors.password = "كلمة المرور يجب أن تكون على الأقل 6 أحرف";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Clear specific field error when user types
    if (validationErrors[name]) {
      setValidationErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // Clear context error when user starts typing
    if (error) {
      clearError();
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Clear previous errors
    clearError();
    setValidationErrors({});

    // Validate form
    if (!validateForm()) {
      // Focus on first error field
      const firstErrorField = Object.keys(validationErrors)[0];
      if (firstErrorField) {
        document.getElementById(firstErrorField)?.focus();
      }
      return;
    }

    setIsSubmitting(true);

    try {
      // Call login from context
      // await login(formData.email, formData.password);
      console.log(await login(formData.email, formData.password));

      // Note: Navigation is handled inside the login function in context
      // If you need to do something after successful login, you can add it here
    } catch (err) {
      console.error("Login error:", err);
      // Error is already handled by the context
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if form is valid for enabling submit button
  const isFormValid =
    formData.email && formData.password && formData.password.length >= 6;

  return (
    <div className="login-container">
      <div className="login-header">
        <h2>مرحباً بعودتك 👋</h2>
        <p>سجل الدخول إلى حسابك للمتابعة</p>
      </div>

      {error && (
        <div className="error-alert">
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="login-form" noValidate>
        <div className="form-group">
          <label htmlFor="email">
            <Mail size={18} />
            <span>البريد الإلكتروني</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            value={formData.email}
            onChange={handleInputChange}
            placeholder="example@domain.com"
            className={validationErrors.email ? "error" : ""}
            dir="ltr"
            autoComplete="email"
            disabled={isLoading || isSubmitting}
            aria-invalid={!!validationErrors.email}
            aria-describedby={
              validationErrors.email ? "email-error" : undefined
            }
          />
          {validationErrors.email && (
            <span id="email-error" className="error-message">
              <AlertCircle size={14} />
              {validationErrors.email}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="password">
            <Lock size={18} />
            <span>كلمة المرور</span>
          </label>
          <div className="password-input">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="أدخل كلمة المرور"
              className={validationErrors.password ? "error" : ""}
              autoComplete="current-password"
              disabled={isLoading || isSubmitting}
              aria-invalid={!!validationErrors.password}
              aria-describedby={
                validationErrors.password ? "password-error" : undefined
              }
            />
            <button
              type="button"
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex="-1"
              aria-label={
                showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
              }
              disabled={isLoading || isSubmitting}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {validationErrors.password && (
            <span id="password-error" className="error-message">
              <AlertCircle size={14} />
              {validationErrors.password}
            </span>
          )}
        </div>

        <div className="form-options">
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              disabled={isLoading || isSubmitting}
            />
            <span>تذكرني على هذا الجهاز</span>
          </label>
          <Link to="/forgot-password" className="forgot-password">
            نسيت كلمة المرور؟
          </Link>
        </div>

        <button
          type="submit"
          className="submit-btn"
          disabled={isLoading || isSubmitting || !isFormValid}
          aria-busy={isLoading || isSubmitting}
        >
          {isLoading || isSubmitting ? (
            <>
              <span className="spinner"></span>
              <span>جاري تسجيل الدخول...</span>
            </>
          ) : (
            <>
              <Lock size={18} />
              <span>تسجيل الدخول</span>
            </>
          )}
        </button>

        <div className="register-link">
          <span>ليس لديك حساب؟</span>
          <Link to="/register" className="link">
            إنشاء حساب جديد
          </Link>
        </div>
      </form>

      {/* Security notice */}
      <div className="security-notice">
        <AlertCircle size={16} />
        <span>تأكد من أنك تستخدم اتصالاً آمناً قبل إدخال بياناتك</span>
      </div>
    </div>
  );
};

export default Login;

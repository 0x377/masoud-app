import React, { useState, useEffect, useCallback } from "react";
import { Link, useNavigate, useParams, useLocation } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Shield,
  Key,
  RefreshCw,
  ArrowLeft,
  HelpCircle,
  Clock,
} from "lucide-react";
import { useAuth } from "../../../Hooks/useAuth";
import "./ResetPassword.css";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { resetPassword, isLoading, error: authError, clearError } = useAuth();

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);
  const [tokenLoading, setTokenLoading] = useState(true);
  const [passwordStrength, setPasswordStrength] = useState(0);
  const [timer, setTimer] = useState(300); // 5 minutes timeout
  const [additionalOptions, setAdditionalOptions] = useState({
    logoutOtherDevices: true,
    requireReauth: false,
    notifyOnChange: true,
  });

  const passwordStrengthColors = {
    weak: "#ef4444",
    medium: "#f59e0b",
    strong: "#10b981",
    veryStrong: "#059669",
  };

  const passwordStrengthMessages = {
    weak: "ضعيفة",
    medium: "متوسطة",
    strong: "قوية",
    veryStrong: "قوية جداً",
  };

  // Validate token on component mount
  useEffect(() => {
    const validateToken = async () => {
      setTokenLoading(true);
      try {
        // In real app, validate token with backend
        // const response = await fetch(`/api/validate-reset-token/${token}`);
        // const data = await response.json();
        // setTokenValid(data.valid);

        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Mock validation
        if (!token || token === "invalid" || token === "expired") {
          setTokenValid(false);
          setErrors({
            general: "رابط إعادة التعيين غير صالح أو انتهت صلاحيته",
          });
        } else {
          // Get remaining time from token or set default
          const storedTimer = localStorage.getItem(`reset_timer_${token}`);
          if (storedTimer) {
            const remaining = parseInt(storedTimer, 10);
            if (remaining > 0) {
              setTimer(remaining);
            } else {
              setTokenValid(false);
              setErrors({ general: "انتهت صلاحية رابط إعادة التعيين" });
            }
          }
        }
      } catch (error) {
        console.error("Error validating token:", error);
        setTokenValid(false);
        setErrors({ general: "حدث خطأ في التحقق من الرابط" });
      } finally {
        setTokenLoading(false);
      }
    };

    validateToken();

    // Clear any previous auth errors
    clearError();
  }, [token, clearError]);

  // Timer for token expiration
  useEffect(() => {
    if (timer > 0 && tokenValid) {
      const interval = setInterval(() => {
        setTimer((prev) => {
          const newTime = prev - 1;
          // Update localStorage
          if (token) {
            localStorage.setItem(`reset_timer_${token}`, newTime.toString());
          }
          return newTime;
        });
      }, 1000);
      return () => clearInterval(interval);
    } else if (timer <= 0 && tokenValid) {
      setTokenValid(false);
      setErrors({ general: "انتهت صلاحية رابط إعادة التعيين" });
    }
  }, [timer, tokenValid, token]);

  // Redirect after success
  useEffect(() => {
    if (success) {
      const redirectTimer = setTimeout(() => {
        navigate("/login");
      }, 3000);
      return () => clearTimeout(redirectTimer);
    }
  }, [success, navigate]);

  // Calculate password strength
  const calculatePasswordStrength = useCallback((password) => {
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

    // Penalties for common patterns
    if (/(.)\1{2,}/.test(password)) strength -= 10; // Repeated characters
    if (/^[0-9]+$/.test(password)) strength -= 20; // Only numbers
    if (/^[a-zA-Z]+$/.test(password)) strength -= 20; // Only letters

    setPasswordStrength(Math.max(0, Math.min(strength, 100)));
  }, []);

  const getPasswordStrengthLevel = () => {
    if (passwordStrength < 40) return "weak";
    if (passwordStrength < 70) return "medium";
    if (passwordStrength < 90) return "strong";
    return "veryStrong";
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === "checkbox") {
      setAdditionalOptions((prev) => ({
        ...prev,
        [name]: checked,
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: value,
      }));

      // Clear field error
      if (errors[name]) {
        setErrors((prev) => ({ ...prev, [name]: "" }));
      }

      // Clear general errors
      if (errors.general) {
        setErrors((prev) => ({ ...prev, general: "" }));
      }

      // Calculate password strength
      if (name === "password") {
        calculatePasswordStrength(value);
      }

      // Real-time password match validation
      if (
        (name === "confirmPassword" || name === "password") &&
        formData.password &&
        formData.confirmPassword
      ) {
        if (formData.password !== formData.confirmPassword) {
          setErrors((prev) => ({
            ...prev,
            confirmPassword: "كلمات المرور غير متطابقة",
          }));
        } else if (errors.confirmPassword === "كلمات المرور غير متطابقة") {
          setErrors((prev) => ({ ...prev, confirmPassword: "" }));
        }
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Password validation
    if (!formData.password) {
      newErrors.password = "كلمة المرور مطلوبة";
    } else if (formData.password.length < 8) {
      newErrors.password = "يجب أن تكون كلمة المرور 8 أحرف على الأقل";
    } else if (!/(?=.*[a-z])/.test(formData.password)) {
      newErrors.password = "يجب أن تحتوي على حرف صغير واحد على الأقل";
    } else if (!/(?=.*[A-Z])/.test(formData.password)) {
      newErrors.password = "يجب أن تحتوي على حرف كبير واحد على الأقل";
    } else if (!/(?=.*\d)/.test(formData.password)) {
      newErrors.password = "يجب أن تحتوي على رقم واحد على الأقل";
    } else if (formData.password.includes(" ")) {
      newErrors.password = "كلمة المرور يجب ألا تحتوي على مسافات";
    } else if (passwordStrength < 40) {
      newErrors.password = "كلمة المرور ضعيفة جداً. اختر كلمة مرور أقوى.";
    }

    // Confirm password validation
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = "تأكيد كلمة المرور مطلوب";
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = "كلمات المرور غير متطابقة";
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!tokenValid) {
      setErrors({ general: "رابط إعادة التعيين غير صالح أو انتهت صلاحيته" });
      return;
    }

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);

      // Scroll to first error
      const firstErrorField = Object.keys(validationErrors)[0];
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
    clearError();

    try {
      // Call Redux auth hook
      const result = await resetPassword(token, formData.password);

      if (result.type === "auth/resetPassword/fulfilled") {
        // Success
        setSuccess(true);

        // Clear token from localStorage
        localStorage.removeItem(`reset_timer_${token}`);
        localStorage.removeItem("reset_request");

        // Store success in localStorage for login page
        localStorage.setItem("password_reset_success", "true");
        localStorage.setItem("password_reset_time", Date.now().toString());
      } else if (result.type === "auth/resetPassword/rejected") {
        // Handle specific errors
        const errorMessage =
          result.payload || "حدث خطأ أثناء إعادة تعيين كلمة المرور";

        if (
          errorMessage.includes("غير صالح") ||
          errorMessage.includes("انتهت")
        ) {
          setTokenValid(false);
          setErrors({ general: errorMessage });
        } else if (errorMessage.includes("مستخدم")) {
          setErrors({
            general: "هذا الرابط تم استخدامه مسبقاً. يرجى طلب رابط جديد.",
          });
        } else {
          setErrors({ general: errorMessage });
        }
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setErrors({
        general: "حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.",
      });
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleResendResetLink = async () => {
    try {
      // Get email from location state or localStorage
      const resetRequest = JSON.parse(
        localStorage.getItem("reset_request") || "{}",
      );
      const email = resetRequest.contact || "";

      if (!email) {
        setErrors({
          general:
            "لم يتم العثور على البريد الإلكتروني. يرجى طلب رابط جديد من صفحة نسيت كلمة المرور.",
        });
        return;
      }

      // Call forgot password again
      // This would be a separate API call in real app
      // await sendForgotPassword(email);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // Show success message
      setErrors({
        general: "تم إرسال رابط إعادة تعيين جديد إلى بريدك الإلكتروني.",
      });

      // Reset timer
      setTimer(300);
      setTokenValid(true);
    } catch (error) {
      setErrors({ general: "فشل إعادة إرسال الرابط. حاول مرة أخرى." });
    }
  };

  if (tokenLoading) {
    return (
      <div className="reset-password-container loading-state">
        <div className="loading-content">
          <div className="loading-spinner"></div>
          <h3>جاري التحقق من الرابط...</h3>
          <p>يرجى الانتظار أثناء التحقق من صلاحية رابط إعادة التعيين</p>
        </div>
      </div>
    );
  }

  if (!tokenValid) {
    return (
      <div className="reset-password-container invalid-token">
        <div className="token-invalid-header">
          <AlertCircle className="invalid-icon" size={60} color="#ef4444" />
          <h2>رابط غير صالح ⚠️</h2>
          <p>رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته</p>
        </div>

        <div className="invalid-token-content">
          <div className="reasons-section">
            <h4>قد يكون السبب:</h4>
            <ul className="reasons-list">
              <li>انتهاء صلاحية الرابط (صالح لمدة 5 دقائق فقط)</li>
              <li>الرابط تم استخدامه مسبقاً</li>
              <li>الرابط غير صحيح أو تالف</li>
              <li>تم تغيير كلمة المرور مسبقاً باستخدام هذا الرابط</li>
            </ul>
          </div>

          <div className="action-buttons">
            <button
              className="btn-primary"
              onClick={handleResendResetLink}
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <div className="btn-spinner-small"></div>
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <RefreshCw size={18} />
                  إعادة إرسال الرابط
                </>
              )}
            </button>

            <Link to="/forgot-password" className="btn-secondary">
              <Key size={18} />
              طلب رابط جديد
            </Link>
          </div>

          <div className="support-note">
            <AlertCircle size={16} color="#f59e0b" />
            <span>إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني</span>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-password-container success-state">
        <div className="success-header">
          <CheckCircle className="success-icon" size={70} color="#10b981" />
          <h2>تم إعادة التعيين بنجاح! 🎉</h2>
          <p>تم تغيير كلمة المرور الخاصة بحسابك بنجاح</p>
        </div>

        <div className="success-content">
          <div className="success-check-list">
            <div className="check-item">
              <CheckCircle size={20} color="#10b981" />
              <span>تم تحديث كلمة المرور بنجاح</span>
            </div>
            <div className="check-item">
              <CheckCircle size={20} color="#10b981" />
              <span>يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة</span>
            </div>
            <div className="check-item">
              <CheckCircle size={20} color="#10b981" />
              <span>تم إرسال إشعار تأكيد إلى بريدك الإلكتروني</span>
            </div>
            {additionalOptions.logoutOtherDevices && (
              <div className="check-item">
                <CheckCircle size={20} color="#10b981" />
                <span>تم تسجيل الخروج من جميع الأجهزة الأخرى</span>
              </div>
            )}
          </div>

          <div className="redirect-info">
            <p>سيتم تحويلك إلى صفحة تسجيل الدخول خلال 3 ثوان...</p>
            <div className="loading-bar">
              <div
                className="loading-progress"
                style={{ animation: "loading 3s linear forwards" }}
              ></div>
            </div>
          </div>

          <div className="immediate-actions">
            <Link to="/login" className="btn-primary">
              <Shield size={18} />
              تسجيل الدخول الآن
            </Link>

            <Link to="/" className="btn-secondary">
              <ArrowLeft size={18} />
              العودة للرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const strengthLevel = getPasswordStrengthLevel();
  const strengthColor = passwordStrengthColors[strengthLevel];
  const strengthMessage = passwordStrengthMessages[strengthLevel];

  return (
    <div className="auth-pages">
      <div className="reset-password-container">
        <div className="reset-password-header">
          <div className="header-icon">
            <Key size={40} color="#3b82f6" />
          </div>
          <h2>إنشاء كلمة مرور جديدة</h2>
          <p>أدخل كلمة مرور جديدة لحسابك</p>
        </div>

        <div className="token-info">
          <div className="token-timer">
            <Clock size={16} color="#f59e0b" />
            <span className="timer-label">ينتهي الرابط خلال:</span>
            <span className={`timer-value ${timer < 60 ? "warning" : ""}`}>
              {formatTime(timer)}
            </span>
          </div>
          <div className="security-badge">
            <Shield size={14} color="#10b981" />
            <span>صفحة آمنة</span>
          </div>
        </div>

        {(errors.general || authError) && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <span>{errors.general || authError}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="reset-password-form"
          noValidate
        >
          <div className="form-group">
            <label htmlFor="password" className="form-label">
              <Lock size={18} />
              <span>كلمة المرور الجديدة *</span>
            </label>

            <div className="password-input-wrapper">
              <input
                type={showPassword ? "text" : "password"}
                id="password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                placeholder="أدخل كلمة مرور جديدة"
                className={`form-input ${errors.password ? "error" : ""}`}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                tabIndex="-1"
                aria-label={
                  showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"
                }
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>

            {errors.password && (
              <span className="error-message">
                <AlertCircle size={14} />
                {errors.password}
              </span>
            )}

            {formData.password && (
              <div className="password-strength-indicator">
                <div className="strength-bar">
                  <div
                    className="strength-fill"
                    style={{
                      width: `${passwordStrength}%`,
                      backgroundColor: strengthColor,
                    }}
                  ></div>
                </div>
                <div className="strength-info">
                  <span>قوة كلمة المرور: </span>
                  <span style={{ color: strengthColor, fontWeight: 600 }}>
                    {strengthMessage}
                  </span>
                  <span
                    className="strength-percentage"
                    style={{ color: strengthColor }}
                  >
                    ({Math.round(passwordStrength)}%)
                  </span>
                </div>
              </div>
            )}

            <div className="password-requirements">
              <h4>متطلبات كلمة المرور:</h4>
              <ul>
                <li className={formData.password.length >= 8 ? "met" : ""}>
                  {formData.password.length >= 8 ? (
                    <CheckCircle size={14} color="#10b981" />
                  ) : (
                    <AlertCircle size={14} color="#ef4444" />
                  )}
                  <span>8 أحرف على الأقل</span>
                </li>
                <li className={/[A-Z]/.test(formData.password) ? "met" : ""}>
                  {/[A-Z]/.test(formData.password) ? (
                    <CheckCircle size={14} color="#10b981" />
                  ) : (
                    <AlertCircle size={14} color="#ef4444" />
                  )}
                  <span>حرف كبير واحد على الأقل (A-Z)</span>
                </li>
                <li className={/[a-z]/.test(formData.password) ? "met" : ""}>
                  {/[a-z]/.test(formData.password) ? (
                    <CheckCircle size={14} color="#10b981" />
                  ) : (
                    <AlertCircle size={14} color="#ef4444" />
                  )}
                  <span>حرف صغير واحد على الأقل (a-z)</span>
                </li>
                <li className={/[0-9]/.test(formData.password) ? "met" : ""}>
                  {/[0-9]/.test(formData.password) ? (
                    <CheckCircle size={14} color="#10b981" />
                  ) : (
                    <AlertCircle size={14} color="#ef4444" />
                  )}
                  <span>رقم واحد على الأقل (0-9)</span>
                </li>
                <li
                  className={
                    /[^A-Za-z0-9]/.test(formData.password) ? "met" : ""
                  }
                >
                  {/[^A-Za-z0-9]/.test(formData.password) ? (
                    <CheckCircle size={14} color="#10b981" />
                  ) : (
                    <AlertCircle size={14} color="#ef4444" />
                  )}
                  <span>رمز خاص (اختياري)</span>
                </li>
                <li className={!formData.password.includes(" ") ? "met" : ""}>
                  {!formData.password.includes(" ") ? (
                    <CheckCircle size={14} color="#10b981" />
                  ) : (
                    <AlertCircle size={14} color="#ef4444" />
                  )}
                  <span>بدون مسافات</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword" className="form-label">
              <Lock size={18} />
              <span>تأكيد كلمة المرور *</span>
            </label>

            <div className="password-input-wrapper">
              <input
                type={showConfirmPassword ? "text" : "password"}
                id="confirmPassword"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                placeholder="أعد إدخال كلمة المرور"
                className={`form-input ${errors.confirmPassword ? "error" : ""}`}
                autoComplete="new-password"
                required
              />
              <button
                type="button"
                className="password-toggle-btn"
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

            {formData.confirmPassword &&
              formData.password === formData.confirmPassword && (
                <div className="password-match">
                  <CheckCircle size={16} color="#10b981" />
                  <span>كلمات المرور متطابقة</span>
                </div>
              )}
          </div>

          <div className="form-options">
            <label className="checkbox-option">
              <input
                type="checkbox"
                id="logoutOtherDevices"
                name="logoutOtherDevices"
                checked={additionalOptions.logoutOtherDevices}
                onChange={handleChange}
              />
              <span>تسجيل الخروج من جميع الأجهزة الأخرى</span>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                id="requireReauth"
                name="requireReauth"
                checked={additionalOptions.requireReauth}
                onChange={handleChange}
              />
              <span>طلب المصادقة الثنائية عند التسجيل التالي</span>
            </label>

            <label className="checkbox-option">
              <input
                type="checkbox"
                id="notifyOnChange"
                name="notifyOnChange"
                checked={additionalOptions.notifyOnChange}
                onChange={handleChange}
              />
              <span>إرسال إشعار عند تغيير كلمة المرور</span>
            </label>
          </div>

          <button
            type="submit"
            className="submit-btn"
            disabled={isLoading || !tokenValid}
          >
            {isLoading ? (
              <>
                <div className="btn-spinner"></div>
                <span>جاري إعادة التعيين...</span>
              </>
            ) : (
              <>
                <Key size={18} />
                <span>إعادة تعيين كلمة المرور</span>
              </>
            )}
          </button>
        </form>

        <div className="form-footer">
          <div className="security-notice">
            <Shield size={16} color="#10b981" />
            <span>جميع البيانات مشفرة باستخدام AES-256</span>
          </div>

          <div className="help-links">
            <Link to="/login" className="help-link">
              <ArrowLeft size={16} />
              <span>العودة لتسجيل الدخول</span>
            </Link>

            <Link to="/forgot-password" className="help-link">
              <RefreshCw size={16} />
              <span>طلب رابط جديد</span>
            </Link>

            <Link to="/support" className="help-link">
              <HelpCircle size={16} />
              <span>المساعدة</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPassword;

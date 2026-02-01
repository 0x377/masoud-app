import React, { useState, useEffect } from "react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { Eye, EyeOff, Mail, Lock, AlertCircle, Shield } from "lucide-react";
import { useAuth } from "../../../Hooks/useAuth";
import "./Login.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  const {
    login,
    isLoading,
    error,
    clearError,
    isAuthenticated,
    verificationRequired,
  } = useAuth();

  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from || "/dashboard";

  useEffect(() => {
    clearError();

    // If already authenticated, redirect
    if (isAuthenticated) {
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from, clearError]);

  const validateForm = () => {
    const errors = {};

    if (!email) {
      errors.email = "البريد الإلكتروني مطلوب";
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      errors.email = "البريد الإلكتروني غير صالح";
    }

    if (!password) {
      errors.password = "كلمة المرور مطلوبة";
    } else if (password.length < 6) {
      errors.password = "كلمة المرور يجب أن تكون على الأقل 8 أحرف";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    const result = await login(email, password, rememberMe);

    if (result.type === "auth/login/fulfilled") {
      navigate(from, { replace: true });
    }
  };

  return (
    <div className="auth-pages">
      <div className="login-container">
        <div className="login-header">
          <h2>مرحباً بعودتك 👋</h2>
          <p>سجل الدخول إلى حسابك للمتابعة</p>
        </div>

        {verificationRequired && (
          <div
            className="error-alert"
            style={{
              background: "#fef3c7",
              borderColor: "#f59e0b",
              color: "#92400e",
            }}
          >
            <Shield size={18} />
            <span>
              يبدو أن حسابك يحتاج إلى التحقق.
              <Link
                to="/verify-email"
                style={{ marginRight: "5px", fontWeight: "bold" }}
              >
                اضغط هنا للتحقق
              </Link>
            </span>
          </div>
        )}

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
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@domain.com"
              className={validationErrors.email ? "error" : ""}
              dir="ltr"
              autoComplete="email"
            />
            {validationErrors.email && (
              <span className="error-message">
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
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="أدخل كلمة المرور"
                className={validationErrors.password ? "error" : ""}
                autoComplete="current-password"
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
            {validationErrors.password && (
              <span className="error-message">
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
              />
              <span>تذكرني على هذا الجهاز</span>
            </label>
            <Link to="/forgot-password" className="forgot-password">
              نسيت كلمة المرور؟
            </Link>
          </div>

          <button type="submit" className="submit-btn" disabled={isLoading}>
            {isLoading ? (
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
      </div>
    </div>
  );
};

export default Login;

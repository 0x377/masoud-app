import React, { useState, useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Home,
} from "lucide-react";
import "./ResetPassword.css";

const ResetPassword = () => {
  const { token } = useParams();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    password: "",
    confirmPassword: "",
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [tokenValid, setTokenValid] = useState(true);

  // تحديث عنوان الصفحة
  useEffect(() => {
    document.title = "إعادة تعيين كلمة المرور - منصة عائلة المسعود";

    // التحقق من الرمز المميز (Token)
    const validateToken = async () => {
      if (!token || token === "invalid") {
        setTokenValid(false);
        setErrors({ general: "رابط إعادة التعيين غير صالح" });
      }
    };

    validateToken();
  }, [token]);

  // إعادة التوجيه بعد النجاح
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate("/login");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // مسح أخطاء الحقل
    if (errors[name]) {
      setErrors((prev) => ({ ...prev, [name]: "" }));
    }

    // تحقق من تطابق كلمات المرور أثناء الكتابة
    if (name === "confirmPassword" && formData.password && value) {
      if (formData.password !== value) {
        setErrors((prev) => ({
          ...prev,
          confirmPassword: "كلمات المرور غير متطابقة",
        }));
      } else {
        setErrors((prev) => ({ ...prev, confirmPassword: "" }));
      }
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.password) {
      newErrors.password = "كلمة المرور مطلوبة";
    } else if (formData.password.length < 8) {
      newErrors.password = "يجب أن تكون 8 أحرف على الأقل";
    }

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
      setErrors({ general: "رابط إعادة التعيين غير صالح" });
      return;
    }

    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setLoading(true);
    setErrors({});

    try {
      // محاكاة طلب API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // في التطبيق الحقيقي: await api.resetPassword(token, formData.password);
      setSuccess(true);
    } catch (error) {
      setErrors({ general: "حدث خطأ أثناء إعادة التعيين" });
    } finally {
      setLoading(false);
    }
  };

  if (!tokenValid) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container invalid-token">
          <div className="invalid-header">
            <AlertCircle className="invalid-icon" size={64} />
            <h2>رابط غير صالح</h2>
            <p>رابط إعادة تعيين كلمة المرور غير صالح أو انتهت صلاحيته</p>
          </div>

          <div className="action-buttons">
            <Link to="/forgot-password" className="btn-primary">
              طلب رابط جديد
            </Link>

            <Link to="/" className="btn-secondary">
              <Home size={18} />
              العودة للصفحة الرئيسية
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="reset-password-page">
        <div className="reset-password-container success-state">
          <div className="success-header">
            <CheckCircle className="success-icon" size={70} />
            <h2>تم إعادة التعيين بنجاح!</h2>
            <p>تم تغيير كلمة المرور بنجاح</p>
          </div>

          <div className="success-content">
            <p className="redirect-notice">
              سيتم تحويلك إلى صفحة تسجيل الدخول خلال 3 ثوان...
            </p>

            <div className="action-buttons">
              <Link to="/login" className="btn-primary">
                تسجيل الدخول الآن
              </Link>

              <Link to="/" className="btn-secondary">
                <Home size={18} />
                الصفحة الرئيسية
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="reset-password-container">
      <header className="reset-password-header">
        <h1>
          <Lock size={32} />
          إعادة تعيين كلمة المرور
        </h1>
        <p>أدخل كلمة مرور جديدة لحسابك</p>
      </header>

      {errors.general && (
        <div className="error-alert">
          <AlertCircle size={20} />
          <span>{errors.general}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="reset-password-form">
        <div className="form-group">
          <label htmlFor="password">
            <Lock size={18} />
            كلمة المرور الجديدة
          </label>
          <div className="password-wrapper">
            <input
              type={showPassword ? "text" : "password"}
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              placeholder="كلمة المرور الجديدة"
              className={errors.password ? "error" : ""}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.password && (
            <div className="field-error">
              <AlertCircle size={14} />
              <span>{errors.password}</span>
            </div>
          )}
          <p className="password-hint">يجب أن تكون 8 أحرف على الأقل</p>
        </div>

        <div className="form-group">
          <label htmlFor="confirmPassword">
            <Lock size={18} />
            تأكيد كلمة المرور
          </label>
          <div className="password-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              id="confirmPassword"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              placeholder="أعد إدخال كلمة المرور"
              className={errors.confirmPassword ? "error" : ""}
            />
            <button
              type="button"
              className="toggle-password"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
            >
              {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          {errors.confirmPassword && (
            <div className="field-error">
              <AlertCircle size={14} />
              <span>{errors.confirmPassword}</span>
            </div>
          )}
        </div>

        <button type="submit" className="submit-btn" disabled={loading}>
          {loading ? (
            <>
              <div className="btn-spinner"></div>
              <span>جاري إعادة التعيين...</span>
            </>
          ) : (
            <>
              <Lock size={18} />
              <span>إعادة تعيين كلمة المرور</span>
            </>
          )}
        </button>
      </form>

      <div className="page-links">
        <Link to="/login" className="back-link">
          العودة لتسجيل الدخول
        </Link>

        <Link to="/" className="home-link">
          <Home size={16} />
          الصفحة الرئيسية
        </Link>
      </div>
    </div>
  );
};

export default ResetPassword;

import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Mail, ArrowRight, CheckCircle, AlertCircle, Home } from "lucide-react";
import "./ForgotPassword.css";

const ForgotPassword = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");

  // تحديث عنوان الصفحة
  useEffect(() => {
    document.title = "نسيت كلمة المرور - منصة عائلة المسعود";
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email.trim()) {
      setError("يرجى إدخال البريد الإلكتروني");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("البريد الإلكتروني غير صحيح");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // محاكاة طلب API
      await new Promise((resolve) => setTimeout(resolve, 1500));

      // في التطبيق الحقيقي: await api.sendResetLink(email);
      setSuccess(true);

      // إعادة التوجيه بعد 5 ثواني
      setTimeout(() => {
        navigate("/login");
      }, 5000);
    } catch (err) {
      setError("حدث خطأ أثناء الإرسال. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };
  2;

  return (
    <div className="forgot-password-container">
      <header className="forgot-password-header">
        <h1>
          <Mail size={32} />
          نسيت كلمة المرور
        </h1>
        <p>أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور</p>
      </header>

      {success ? (
        <div className="success-message">
          <CheckCircle className="success-icon" size={64} />
          <h2>تم الإرسال بنجاح!</h2>
          <p>تم إرسال رابط إعادة التعيين إلى:</p>
          <p className="email-sent">{email}</p>
          <p className="redirect-notice">
            سيتم تحويلك إلى صفحة تسجيل الدخول خلال 5 ثوان...
          </p>
          <Link to="/" className="home-link">
            <Home size={20} />
            العودة للصفحة الرئيسية
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <div className="error-alert">
              <AlertCircle size={20} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="forgot-password-form">
            <div className="form-group">
              <label htmlFor="email">
                <Mail size={18} />
                البريد الإلكتروني
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@domain.com"
                dir="ltr"
                autoComplete="email"
                required
              />
            </div>

            <button type="submit" className="submit-btn" disabled={loading}>
              {loading ? (
                <>
                  <div className="btn-spinner"></div>
                  <span>جاري الإرسال...</span>
                </>
              ) : (
                <>
                  <ArrowRight size={18} />
                  <span>إرسال رابط إعادة التعيين</span>
                </>
              )}
            </button>
          </form>

          <div className="page-links">
            <Link to="/login" className="back-link">
              <ArrowRight size={16} />
              العودة لتسجيل الدخول
            </Link>

            <Link to="/" className="home-link">
              <Home size={16} />
              الصفحة الرئيسية
            </Link>
          </div>
        </>
      )}
    </div>
  );
};

export default ForgotPassword;

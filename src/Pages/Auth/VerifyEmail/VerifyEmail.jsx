import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import {
  Mail,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Shield,
  Clock,
  ArrowRight,
  Smartphone,
  Key,
} from "lucide-react";
import { useAuth } from "../../../Hooks/useAuth";
import "./VerifyEmail.css";

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    verifyToken,
    resendVerification,
    isLoading,
    error: authError,
    clearError,
    user,
    verifyEmail,
  } = useAuth();

  const email = location.state?.email || user?.email || "";
  const verificationMethod = location.state?.method || "email"; // 'email' أو 'sms'

  const [verificationCode, setVerificationCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const [timer, setTimer] = useState(180); // 3 minutes
  const [codeSent, setCodeSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");
  const [showResendOptions, setShowResendOptions] = useState(false);
  const [alternativeMethod, setAlternativeMethod] =
    useState(verificationMethod);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);

  const inputRefs = useRef([]);
  const formRef = useRef();

  // Initialize refs
  useEffect(() => {
    inputRefs.current = inputRefs.current.slice(0, 6);
    for (let i = 0; i < 6; i++) {
      if (!inputRefs.current[i]) {
        inputRefs.current[i] = React.createRef();
      }
    }
  }, []);

  // Clear errors on mount
  useEffect(() => {
    clearError();
  }, [clearError]);

  // Timer for code expiration
  useEffect(() => {
    if (timer > 0 && !verified) {
      const interval = setInterval(() => {
        setTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer, verified]);

  // Lock timer for too many attempts
  useEffect(() => {
    if (lockTimer > 0 && locked) {
      const interval = setInterval(() => {
        setLockTimer((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    } else if (lockTimer <= 0 && locked) {
      setLocked(false);
      setRemainingAttempts(5);
    }
  }, [lockTimer, locked]);

  // Auto-send verification code on mount
  useEffect(() => {
    if (!codeSent && email && !verified) {
      handleSendCode();
    }
  }, [email, codeSent, verified]);

  // Handle auto-verification when code is complete
  useEffect(() => {
    const code = verificationCode.join("");
    if (code.length === 6 && !verified && !locked) {
      const autoVerifyTimer = setTimeout(() => {
        handleVerify();
      }, 500);
      return () => clearTimeout(autoVerifyTimer);
    }
  }, [verificationCode, verified, locked]);

  const handleSendCode = async (method = verificationMethod) => {
    if (locked) {
      setError(`الحساب مؤقتاً. حاول مرة أخرى بعد ${formatTime(lockTimer)}`);
      return;
    }

    setLoading(true);
    setError("");
    clearError();

    try {
      // In real app, call API to send verification code
      // const result = await resendVerification({ email, method });

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setCodeSent(true);
      setTimer(180); // Reset timer to 3 minutes
      setAlternativeMethod(method);
    } catch (err) {
      setError("فشل إرسال كود التحقق. حاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendCode = async () => {
    if (timer > 30) {
      // Prevent resend if more than 30 seconds remaining
      setError(`يمكنك إعادة الإرسال خلال ${formatTime(timer - 30)}`);
      return;
    }

    await handleSendCode(alternativeMethod);
  };

  const handleCodeChange = useCallback(
    (index, value) => {
      if (locked) {
        setError(`الحساب مؤقتاً. حاول مرة أخرى بعد ${formatTime(lockTimer)}`);
        return;
      }

      // Allow only digits
      if (value.length <= 1 && /^\d*$/.test(value)) {
        const newCode = [...verificationCode];
        newCode[index] = value;
        setVerificationCode(newCode);
        setError("");

        // Auto-focus next input
        if (value && index < 5) {
          inputRefs.current[index + 1].current.focus();
        }
      }
    },
    [verificationCode, locked, lockTimer],
  );

  const handleKeyDown = useCallback(
    (index, e) => {
      if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
        // Move to previous input on backspace
        inputRefs.current[index - 1].current.focus();
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        inputRefs.current[index - 1].current.focus();
      } else if (e.key === "ArrowRight" && index < 5) {
        e.preventDefault();
        inputRefs.current[index + 1].current.focus();
      } else if (e.key === "Enter" && verificationCode.join("").length === 6) {
        handleVerify();
      }
    },
    [verificationCode],
  );

  const handlePaste = useCallback((e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").trim();

    // Check if pasted data is a 6-digit code
    if (/^\d{6}$/.test(pastedData)) {
      const digits = pastedData.split("");
      setVerificationCode(digits);

      // Focus the last input
      setTimeout(() => {
        inputRefs.current[5].current.focus();
      }, 0);
    } else {
      setError("الرجاء لصق رمز مكون من 6 أرقام فقط");
    }
  }, []);

  const handleVerify = async () => {
    const code = verificationCode.join("");

    if (code.length !== 6) {
      setError("الرجاء إدخال كود التحقق المكون من 6 أرقام");
      return;
    }

    if (locked) {
      setError(`الحساب مؤقتاً. حاول مرة أخرى بعد ${formatTime(lockTimer)}`);
      return;
    }

    setLoading(true);
    setError("");
    clearError();

    try {
      verifyEmail(verificationCode);
      localStorage.setItem("email_verified", "true");
      localStorage.setItem("verified_email", email);
    } catch (err) {
      setError(err.message || "حدث خطأ أثناء التحقق. حاول مرة أخرى.");

      // Clear code on error
      setVerificationCode(["", "", "", "", "", ""]);
      inputRefs.current[0].current.focus();
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMethodChange = (method) => {
    setAlternativeMethod(method);
    setShowResendOptions(false);
    handleSendCode(method);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleVerify();
  };

  if (verified) {
    return (
      <div className="verify-email-container success-state">
        <div className="verify-header">
          <CheckCircle className="verified-icon" size={70} color="#10b981" />
          <h2>تم التحقق بنجاح! 🎉</h2>
          <p>تم التحقق من حسابك بنجاح</p>
        </div>

        <div className="success-message">
          <div className="success-content">
            <div className="success-item">
              <CheckCircle size={20} color="#10b981" />
              <span>تم التحقق من بريدك الإلكتروني: {email}</span>
            </div>
            <div className="success-item">
              <CheckCircle size={20} color="#10b981" />
              <span>يمكنك الآن الوصول إلى جميع ميزات المنصة</span>
            </div>
            <div className="success-item">
              <CheckCircle size={20} color="#10b981" />
              <span>تم تفعيل حسابك بالكامل</span>
            </div>
          </div>

          <div className="redirect-info">
            <p>يتم توجيهك تلقائياً خلال 3 ثوان...</p>
            <div className="loading-bar">
              <div
                className="loading-progress"
                style={{ animation: "loading 3s linear forwards" }}
              ></div>
            </div>
          </div>

          <div className="immediate-actions">
            <button
              className="btn-primary"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowRight size={18} />
              الانتقال للوحة التحكم الآن
            </button>

            <button
              className="btn-secondary"
              onClick={() => navigate("/profile")}
            >
              <Shield size={18} />
              إكمال الملف الشخصي
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-pages">
      <div className="verify-email-container">
        <div className="verify-header">
          <Shield className="shield-icon" size={60} color="#3b82f6" />
          <h2>التحقق من الحساب</h2>
          <p>أدخل كود التحقق المرسل اليك</p>
        </div>

        {(error || authError) && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <span>{error || authError}</span>
          </div>
        )}

        {locked && (
          <div className="lock-alert">
            <AlertCircle size={18} />
            <div className="lock-info">
              <span className="lock-title">الحساب مؤقتاً</span>
              <span className="lock-time">
                يمكنك المحاولة مرة أخرى خلال: {formatTime(lockTimer)}
              </span>
            </div>
          </div>
        )}

        {!locked && (
          <>
            <form
              ref={formRef}
              onSubmit={handleManualSubmit}
              className="verification-form"
              noValidate
            >
              <div className="code-input-container">
                <label className="code-label">
                  أدخل الرمز المكون من 6 أرقام
                </label>
                <div className="code-inputs" onPaste={handlePaste} dir="ltr">
                  {verificationCode.map((digit, index) => (
                    <input
                      key={index}
                      ref={inputRefs.current[index]}
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength="1"
                      value={digit}
                      onChange={(e) => handleCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleKeyDown(index, e)}
                      className={`code-input ${digit ? "filled" : ""}`}
                      disabled={isLoading || locked}
                      autoComplete="one-time-code"
                      aria-label={`رقم التحقق ${index + 1}`}
                    />
                  ))}
                </div>

                {remainingAttempts < 5 && (
                  <div className="attempts-info">
                    <span className="attempts-text">
                      المحاولات المتبقية: {remainingAttempts}
                    </span>
                  </div>
                )}
              </div>

              <div className="timer-section">
                <div className="timer">
                  <Clock size={16} color="#f59e0b" />
                  <span className="timer-label">ينتهي الكود خلال:</span>
                  <span
                    className={`timer-value ${timer < 60 ? "warning" : ""}`}
                  >
                    {formatTime(timer)}
                  </span>
                </div>

                <button
                  type="button"
                  className={`resend-btn ${timer > 30 || isLoading ? "disabled" : ""}`}
                  onClick={handleResendCode}
                  disabled={timer > 30 || isLoading || locked}
                >
                  {isLoading ? (
                    <div className="btn-spinner-small"></div>
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  <span>إعادة إرسال الكود</span>
                </button>
              </div>

              <div className="verification-actions">
                <button
                  type="submit"
                  className="verify-btn"
                  disabled={
                    isLoading ||
                    verificationCode.join("").length !== 6 ||
                    locked
                  }
                >
                  {isLoading ? (
                    <>
                      <div className="btn-spinner"></div>
                      <span>جاري التحقق...</span>
                    </>
                  ) : (
                    <>
                      <Key size={18} />
                      <span>تحقق</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmail;

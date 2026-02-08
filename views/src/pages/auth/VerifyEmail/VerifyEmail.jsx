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
import "./VerifyEmail.css";
import { useRoot } from "../../../context/rootContesxt";
import toast from "react-hot-toast";

const VerifyEmail = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Get context functions
  const { verifyEmail, error: authError, clearError, user } = useRoot();

  const email = location.state?.email || user?.email || "";
  const verificationMethod = location.state?.method || "email";

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
  const [verified, setVerified] = useState(true);
  const [localError, setLocalError] = useState("");
  const [showResendOptions, setShowResendOptions] = useState(false);
  const [alternativeMethod, setAlternativeMethod] =
    useState(verificationMethod);
  const [remainingAttempts, setRemainingAttempts] = useState(5);
  const [locked, setLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

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
    if (clearError) clearError();
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
    if (!codeSent && email && !verified && !locked) {
      sendVerificationCodeRequest();
    }
  }, [email, codeSent, verified, locked]);

  // Handle auto-verification when code is complete
  useEffect(() => {
    const code = verificationCode.join("");
    if (code.length === 6 && !verified && !locked && !isLoading) {
      const autoVerifyTimer = setTimeout(() => {
        handleVerify();
      }, 500);
      return () => clearTimeout(autoVerifyTimer);
    }
  }, [verificationCode, verified, locked, isLoading]);

  // Function to send verification code
  const sendVerificationCodeRequest = async (method = verificationMethod) => {
    if (locked) {
      setLocalError(
        `الحساب مؤقتاً. حاول مرة أخرى بعد ${formatTime(lockTimer)}`,
      );
      return;
    }

    setSendingCode(true);
    setLocalError("");
    if (clearError) clearError();

    try {
      // You would call your actual API here
      // Example: await sendVerificationCode(email, method);

      // For now, simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));

      setCodeSent(true);
      setTimer(180); // Reset timer to 3 minutes
      setAlternativeMethod(method);
      setLocalError("");

      // Clear any existing verification code
      setVerificationCode(["", "", "", "", "", ""]);

      // Focus on first input
      const firstInput = inputRefs.current[0]?.current;
      if (firstInput) {
        setTimeout(() => firstInput.focus(), 100);
      }
    } catch (err) {
      setLocalError("فشل إرسال كود التحقق. حاول مرة أخرى.");
      console.error("Error sending verification code:", err);
    } finally {
      setSendingCode(false);
    }
  };

  const handleResendCode = async () => {
    if (timer > 30) {
      setLocalError(`يمكنك إعادة الإرسال خلال ${formatTime(timer - 30)}`);
      return;
    }

    await sendVerificationCodeRequest(alternativeMethod);
  };

  const handleCodeChange = useCallback(
    (index, value) => {
      if (locked) {
        setLocalError(
          `الحساب مؤقتاً. حاول مرة أخرى بعد ${formatTime(lockTimer)}`,
        );
        return;
      }

      // Allow only digits
      if (value.length <= 1 && /^\d*$/.test(value)) {
        const newCode = [...verificationCode];
        newCode[index] = value;
        setVerificationCode(newCode);
        setLocalError("");

        // Auto-focus next input
        if (value && index < 5) {
          const nextInput = inputRefs.current[index + 1]?.current;
          if (nextInput) {
            nextInput.focus();
          }
        }
      }
    },
    [verificationCode, locked, lockTimer],
  );

  const handleKeyDown = useCallback(
    (index, e) => {
      if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
        // Move to previous input on backspace
        const prevInput = inputRefs.current[index - 1]?.current;
        if (prevInput) {
          prevInput.focus();
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        e.preventDefault();
        const prevInput = inputRefs.current[index - 1]?.current;
        if (prevInput) {
          prevInput.focus();
        }
      } else if (e.key === "ArrowRight" && index < 5) {
        e.preventDefault();
        const nextInput = inputRefs.current[index + 1]?.current;
        if (nextInput) {
          nextInput.focus();
        }
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
        const lastInput = inputRefs.current[5]?.current;
        if (lastInput) {
          lastInput.focus();
        }
      }, 0);
      setLocalError("");
    } else {
      setLocalError("الرجاء لصق رمز مكون من 6 أرقام فقط");
    }
  }, []);

  const handleVerify = async () => {
    const code = verificationCode.join("");

    if (code.length !== 6) {
      setLocalError("الرجاء إدخال كود التحقق المكون من 6 أرقام");
      return;
    }

    if (locked) {
      setLocalError(
        `الحساب مؤقتاً. حاول مرة أخرى بعد ${formatTime(lockTimer)}`,
      );
      return;
    }

    if (!email) {
      setLocalError("لا يوجد بريد إلكتروني للتحقق");
      return;
    }

    setIsLoading(true);
    setLocalError("");
    if (clearError) clearError();

    try {
      // Call verifyEmail from context with both email and code
      const { success } = await verifyEmail(email, code);
      if (success) {
        toast.success("Verification Code Successfull");
      }

      // Mark as verified
      setVerified(true);
      setLocalError("");

      // Store verification status
      localStorage.setItem("email_verified", "true");
      localStorage.setItem("verified_email", email);

      // Navigate after delay
      // setTimeout(() => {
      //   navigate("/dashboard", { replace: true });
      // }, 3000);
    } catch (err) {
      // Handle verification error
      const errorMessage =
        err.message || "حدث خطأ أثناء التحقق. حاول مرة أخرى.";
      setLocalError(errorMessage);

      // Decrease remaining attempts
      setRemainingAttempts((prev) => {
        const newAttempts = prev - 1;
        if (newAttempts <= 0) {
          setLocked(true);
          setLockTimer(300); // 5 minutes lock
        }
        return newAttempts;
      });

      // Clear code on error
      setVerificationCode(["", "", "", "", "", ""]);
      const firstInput = inputRefs.current[0]?.current;
      if (firstInput) {
        firstInput.focus();
      }
    } finally {
      setIsLoading(false);
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
    sendVerificationCodeRequest(method);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    handleVerify();
  };

  // Combined error from local state and context
  const combinedError = localError || authError;

  return (
    <div className="verify-email-container">
      <div className="verify-header">
        <Shield className="shield-icon" size={60} color="#3b82f6" />
        <h2>التحقق من الحساب</h2>
        <p>أدخل كود التحقق المرسل إلى {email}</p>
      </div>

      {combinedError && (
        <div className="error-alert">
          <AlertCircle size={18} />
          <span>{combinedError}</span>
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
              <label className="code-label">أدخل الرمز المكون من 6 أرقام</label>
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
                    disabled={isLoading || locked || !codeSent}
                    autoComplete="one-time-code"
                    aria-label={`رقم التحقق ${index + 1}`}
                  />
                ))}
              </div>

              {!codeSent && (
                <div className="code-not-sent">
                  <p>لم يصلك الكود بعد؟</p>
                  <button
                    type="button"
                    className="send-code-btn"
                    onClick={() => sendVerificationCodeRequest()}
                    disabled={sendingCode}
                  >
                    {sendingCode ? (
                      <>
                        <div className="btn-spinner-small"></div>
                        <span>جاري الإرسال...</span>
                      </>
                    ) : (
                      <>
                        <Mail size={16} />
                        <span>إرسال كود التحقق</span>
                      </>
                    )}
                  </button>
                </div>
              )}

              {remainingAttempts < 5 && !locked && (
                <div className="attempts-info">
                  <span className="attempts-text">
                    المحاولات المتبقية: {remainingAttempts}
                  </span>
                </div>
              )}
            </div>

            {codeSent && (
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
                  disabled={timer > 30 || isLoading || locked || sendingCode}
                >
                  {sendingCode ? (
                    <div className="btn-spinner-small"></div>
                  ) : (
                    <RefreshCw size={16} />
                  )}
                  <span>إعادة إرسال الكود</span>
                </button>
              </div>
            )}

            <div className="verification-actions">
              <button
                type="submit"
                className="verify-btn"
                disabled={
                  isLoading ||
                  verificationCode.join("").length !== 6 ||
                  locked ||
                  !email ||
                  !codeSent
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

          {/* Additional options */}
          <div className="additional-options">
            <Link to="/register" className="option-link">
              ليس هذا البريد الإلكتروني الصحيح؟
            </Link>

            <button
              type="button"
              className="option-link"
              onClick={() => setShowResendOptions(!showResendOptions)}
            >
              إرسال الكود بطريقة أخرى
            </button>

            {showResendOptions && (
              <div className="resend-options">
                <button
                  className="resend-option"
                  onClick={() => handleMethodChange("email")}
                  disabled={alternativeMethod === "email" || sendingCode}
                >
                  <Mail size={16} />
                  <span>إرسال عبر البريد الإلكتروني</span>
                </button>
                <button
                  className="resend-option"
                  onClick={() => handleMethodChange("sms")}
                  disabled={alternativeMethod === "sms" || sendingCode}
                >
                  <Smartphone size={16} />
                  <span>إرسال عبر رسالة نصية</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default VerifyEmail;

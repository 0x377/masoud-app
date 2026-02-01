import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Mail, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  Shield,
  HelpCircle,
  Clock,
  Smartphone,
  Send,
  RefreshCw,
  Key,
  Globe,
  Lock
} from 'lucide-react';
import { useAuth } from '../../../Hooks/useAuth'; // Updated to use Redux auth hook
import './ForgotPassword.css';

const ForgotPassword = () => {
  const navigate = useNavigate();
  const { forgotPassword: sendForgotPassword, isLoading: authLoading, error: authError, clearError } = useAuth();
  
  const [formData, setFormData] = useState({
    email: '',
    method: 'email', // 'email' أو 'sms'
    phone: '',
    countryCode: '+966'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showMethodOptions, setShowMethodOptions] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [resendAvailable, setResendAvailable] = useState(true);
  const [requestId, setRequestId] = useState('');
  const [securityQuestions, setSecurityQuestions] = useState([]);
  const [showSecurityQuestions, setShowSecurityQuestions] = useState(false);
  const [additionalOptions, setAdditionalOptions] = useState({
    logoutDevices: true,
    notifyMe: false,
    require2fa: false,
    trackActivity: true
  });
  const [showAdvancedOptions, setShowAdvancedOptions] = useState(false);

  // Clear auth errors on component mount
  useEffect(() => {
    clearError();
    
    // Check if there's a pending reset request
    const resetRequest = localStorage.getItem('reset_request');
    if (resetRequest) {
      const request = JSON.parse(resetRequest);
      const now = Date.now();
      const expiresAt = request.timestamp + request.expiresIn;
      
      if (now < expiresAt) {
        // Still valid, show success state
        setSuccess(true);
        setRequestId(request.id);
        setFormData(prev => ({
          ...prev,
          method: request.method,
          [request.method === 'email' ? 'email' : 'phone']: request.contact
        }));
        
        // Calculate remaining time for resend
        const remainingSeconds = Math.floor((expiresAt - now) / 1000);
        if (remainingSeconds > 0) {
          setCountdown(remainingSeconds);
          setResendAvailable(false);
        }
      } else {
        // Expired, remove it
        localStorage.removeItem('reset_request');
      }
    }
  }, [clearError]);

  // Countdown timer for resend
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setResendAvailable(true);
    }
  }, [countdown]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setAdditionalOptions(prev => ({
        ...prev,
        [name]: checked
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        [name]: value
      }));
    }
    
    // Clear errors when user starts typing
    if (error) setError('');
  };

  const validateForm = useCallback(() => {
    if (formData.method === 'email') {
      if (!formData.email.trim()) {
        return 'البريد الإلكتروني مطلوب';
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
        return 'البريد الإلكتروني غير صحيح';
      }
      if (formData.email.length > 100) {
        return 'البريد الإلكتروني طويل جداً';
      }
    } else {
      const fullPhone = formData.countryCode + formData.phone.replace(/\D/g, '');
      if (!formData.phone.trim()) {
        return 'رقم الهاتف مطلوب';
      }
      if (!/^[\+]?[1-9][\d]{9,14}$/.test(fullPhone)) {
        return 'رقم الهاتف غير صحيح';
      }
      if (!fullPhone.startsWith('+')) {
        return 'يرجى اختيار رمز الدولة الصحيح';
      }
    }
    return '';
  }, [formData]);

  const handleMethodChange = (method) => {
    setFormData(prev => ({ 
      ...prev, 
      method, 
      phone: method === 'sms' ? prev.phone : '',
      countryCode: method === 'sms' ? prev.countryCode : '+966'
    }));
    setError('');
  };

  const fetchSecurityQuestions = async (email) => {
    try {
      setLoading(true);
      
      // Simulate API call to fetch security questions
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // In real app, this would come from API
      const questions = [
        { 
          id: 1, 
          question: 'ما هو اسم مدرستك الابتدائية؟',
          hint: 'ادخل الاسم كما هو مسجل في حسابك'
        },
        { 
          id: 2, 
          question: 'ما هو اسم أول حيوان أليف قمت بتربيته؟',
          hint: 'يمكن أن يكون كلب، قطة، طائر، إلخ'
        },
        { 
          id: 3, 
          question: 'ما هو مكان ولادتك؟',
          hint: 'اسم المدينة أو المحافظة'
        }
      ];
      
      setSecurityQuestions(questions);
      setShowSecurityQuestions(true);
    } catch (err) {
      console.error('Error fetching security questions:', err);
      setError('حدث خطأ في جلب أسئلة التحقق');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    
    setLoading(true);
    setError('');
    clearError();
    
    try {
      // Prepare contact information based on method
      const contact = formData.method === 'email' 
        ? formData.email 
        : formData.countryCode + formData.phone.replace(/\D/g, '');
      
      // Call Redux auth hook for forgot password
      const result = await sendForgotPassword(contact);
      
      if (result.type === 'auth/forgotPassword/fulfilled') {
        // Generate unique request ID
        const generatedRequestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setRequestId(generatedRequestId);
        
        // Save request details to localStorage
        const requestDetails = {
          id: generatedRequestId,
          contact: contact,
          method: formData.method,
          timestamp: Date.now(),
          expiresIn: 15 * 60 * 1000, // 15 minutes
          additionalOptions: additionalOptions
        };
        
        localStorage.setItem('reset_request', JSON.stringify(requestDetails));
        
        // Set success state
        setSuccess(true);
        setCountdown(60); // 60 seconds for resend
        setResendAvailable(false);
        
        // Auto-redirect after 10 seconds
        setTimeout(() => {
          navigate('/login');
        }, 10000);
        
      } else if (result.type === 'auth/forgotPassword/rejected') {
        const errorMessage = result.payload || 'حدث خطأ أثناء إرسال الرابط';
        
        // Check if additional verification is needed
        if (errorMessage.includes('تحقق') || errorMessage.includes('أمني')) {
          await fetchSecurityQuestions(formData.email);
        } else {
          setError(errorMessage);
        }
      }
      
    } catch (err) {
      console.error('Forgot password error:', err);
      
      // Check error type for specific handling
      if (err.message && err.message.includes('محظور')) {
        setError('هذا الحساب محظور مؤقتاً. حاول بعد 24 ساعة.');
      } else if (err.message && err.message.includes('غير موجود')) {
        setError('الحساب غير موجود. تحقق من المعلومات المدخلة.');
      } else if (err.message && err.message.includes('كثير')) {
        setError('لقد تجاوزت عدد المحاولات المسموح بها. حاول بعد ساعة.');
      } else {
        setError('حدث خطأ غير متوقع. حاول مرة أخرى لاحقاً.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!resendAvailable) return;
    
    setLoading(true);
    setError('');
    
    try {
      // Prepare contact information
      const contact = formData.method === 'email' 
        ? formData.email 
        : formData.countryCode + formData.phone.replace(/\D/g, '');
      
      // Call resend API
      const result = await sendForgotPassword(contact);
      
      if (result.type === 'auth/forgotPassword/fulfilled') {
        // Update request ID
        const newRequestId = `REQ-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setRequestId(newRequestId);
        
        // Update localStorage
        const existingRequest = JSON.parse(localStorage.getItem('reset_request') || '{}');
        localStorage.setItem('reset_request', JSON.stringify({
          ...existingRequest,
          id: newRequestId,
          timestamp: Date.now()
        }));
        
        // Reset countdown
        setSuccess(true);
        setCountdown(60);
        setResendAvailable(false);
        
      } else {
        setError('فشل إعادة الإرسال. حاول مرة أخرى.');
      }
      
    } catch (err) {
      setError('فشل إعادة الإرسال. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const handleSecurityAnswer = async (questionId, answer) => {
    if (!answer.trim()) {
      setError('يرجى إدخال إجابة');
      return;
    }
    
    setLoading(true);
    setError('');
    
    try {
      // Simulate API verification
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // In real app, verify with backend
      if (answer.trim().length < 2) {
        throw new Error('الإجابة قصيرة جداً');
      }
      
      // If answer is verified successfully
      setShowSecurityQuestions(false);
      setSecurityQuestions([]);
      
      // Continue with sending reset link
      const contact = formData.method === 'email' 
        ? formData.email 
        : formData.countryCode + formData.phone.replace(/\D/g, '');
      
      const result = await sendForgotPassword(contact);
      
      if (result.type === 'auth/forgotPassword/fulfilled') {
        const newRequestId = `REQ-SEC-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        setRequestId(newRequestId);
        
        const requestDetails = {
          id: newRequestId,
          contact: contact,
          method: formData.method,
          timestamp: Date.now(),
          expiresIn: 15 * 60 * 1000,
          additionalOptions: additionalOptions,
          verifiedWithSecurity: true
        };
        
        localStorage.setItem('reset_request', JSON.stringify(requestDetails));
        
        setSuccess(true);
        setCountdown(60);
        setResendAvailable(false);
      }
      
    } catch (err) {
      setError(err.message || 'الإجابة غير صحيحة. حاول مرة أخرى.');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const countryCodes = [
    { code: '+966', flag: '🇸🇦', name: 'السعودية' },
    { code: '+971', flag: '🇦🇪', name: 'الإمارات' },
    { code: '+973', flag: '🇧🇭', name: 'البحرين' },
    { code: '+974', flag: '🇶🇦', name: 'قطر' },
    { code: '+965', flag: '🇰🇼', name: 'الكويت' },
    { code: '+968', flag: '🇴🇲', name: 'عمان' },
    { code: '+20', flag: '🇪🇬', name: 'مصر' },
    { code: '+962', flag: '🇯🇴', name: 'الأردن' }
  ];

  if (showSecurityQuestions) {
    return (
      <div className="forgot-password-container security-questions">
        <div className="security-header">
          <Shield size={50} color="#3b82f6" />
          <h2>التحقق الأمني الإضافي</h2>
          <p>للمساعدة في حماية حسابك، يرجى الإجابة على الأسئلة التالية</p>
        </div>
        
        {error && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}
        
        <div className="questions-container">
          {securityQuestions.map((q) => (
            <div key={q.id} className="question-item">
              <p className="question-text">{q.question}</p>
              {q.hint && <p className="question-hint">{q.hint}</p>}
              <div className="answer-input">
                <input
                  type="text"
                  placeholder="أدخل إجابتك هنا"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      handleSecurityAnswer(q.id, e.target.value);
                    }
                  }}
                  disabled={loading}
                />
                <button
                  className="submit-answer"
                  onClick={(e) => {
                    const input = e.target.previousElementSibling;
                    handleSecurityAnswer(q.id, input.value);
                  }}
                  disabled={loading}
                >
                  {loading ? (
                    <div className="btn-spinner-small"></div>
                  ) : (
                    <ArrowRight size={18} />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
        
        <div className="security-note">
          <AlertCircle size={16} />
          <span>هذه المعلومات تساعدنا على التحقق من هويتك</span>
        </div>
        
        <div className="security-actions">
          <button
            className="btn-secondary"
            onClick={() => {
              setShowSecurityQuestions(false);
              setSecurityQuestions([]);
              setError('');
            }}
            disabled={loading}
          >
            العودة
          </button>
          <button
            className="btn-help"
            onClick={() => {
              // Show help modal or navigate to help page
              navigate('/help/security-questions');
            }}
          >
            <HelpCircle size={16} />
            <span>مساعدة</span>
          </button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="forgot-password-container success-state">
        <div className="success-header">
          <CheckCircle className="success-icon" size={70} color="#10b981" />
          <h2>تم الإرسال بنجاح! ✅</h2>
          <p>تم إرسال رابط إعادة تعيين كلمة المرور</p>
        </div>
        
        <div className="success-content">
          <div className="delivery-method">
            <div className="method-icon">
              {formData.method === 'email' ? (
                <Mail size={24} color="#3b82f6" />
              ) : (
                <Smartphone size={24} color="#10b981" />
              )}
            </div>
            <div className="method-info">
              <h4>تم الإرسال إلى:</h4>
              <p className="contact-info">
                {formData.method === 'email' ? formData.email : `${formData.countryCode} ${formData.phone}`}
              </p>
              <span className="method-label">
                {formData.method === 'email' ? 'بريد إلكتروني' : 'رسالة نصية'}
              </span>
            </div>
          </div>
          
          <div className="instructions">
            <h4>تعليمات:</h4>
            <ul>
              <li>افتح الرسالة واضغط على رابط إعادة التعيين</li>
              <li>الرابط صالح لمدة 15 دقيقة فقط</li>
              <li>إذا لم تجد الرسالة، تحقق من مجلد البريد العشوائي (Spam)</li>
              <li>لا تشارك الرابط مع أي شخص</li>
              {additionalOptions.logoutDevices && <li>سيتم تسجيل الخروج من جميع الأجهزة</li>}
              {additionalOptions.require2fa && <li>سيتم تفعيل المصادقة الثنائية</li>}
            </ul>
          </div>
          
          <div className="request-info">
            <div className="info-item">
              <span className="label">رقم الطلب:</span>
              <span className="value code">{requestId}</span>
            </div>
            <div className="info-item">
              <span className="label">وقت الإرسال:</span>
              <span className="value">{new Date().toLocaleTimeString('ar-SA')}</span>
            </div>
          </div>
          
          <div className="resend-section">
            {!resendAvailable ? (
              <div className="countdown-timer">
                <Clock size={18} />
                <span>يمكنك إعادة الإرسال خلال: {formatTime(countdown)}</span>
              </div>
            ) : (
              <button
                className="btn-resend"
                onClick={handleResend}
                disabled={loading}
              >
                {loading ? (
                  <div className="btn-spinner-small"></div>
                ) : (
                  <RefreshCw size={18} />
                )}
                <span>{loading ? 'جاري الإرسال...' : 'إعادة إرسال الرابط'}</span>
              </button>
            )}
          </div>
          
          <div className="redirect-info">
            <p>سيتم تحويلك إلى صفحة تسجيل الدخول خلال 10 ثوان...</p>
            <div className="loading-bar">
              <div className="loading-progress"></div>
            </div>
          </div>
          
          <div className="immediate-actions">
            <button
              className="btn-primary"
              onClick={() => navigate('/login')}
            >
              <ArrowRight size={18} />
              تسجيل الدخول الآن
            </button>
            
            <button
              className="btn-secondary"
              onClick={() => {
                setSuccess(false);
                setFormData({ 
                  email: '', 
                  method: 'email', 
                  phone: '',
                  countryCode: '+966'
                });
                setError('');
              }}
            >
              طلب رابط آخر
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-pages">
      <div className="forgot-password-container">
        <div className="forgot-password-header">
          <div className="header-icon">
            <Shield size={40} color="#3b82f6" />
          </div>
          <h2>نسيت كلمة المرور؟</h2>
          <p>أدخل بريدك الإلكتروني أو رقم هاتفك وسنرسل لك رابطاً لإعادة تعيين كلمة المرور</p>
        </div>
        
        <div className="recovery-options">
          <button
            className={`option-btn ${formData.method === 'email' ? 'active' : ''}`}
            onClick={() => handleMethodChange('email')}
            type="button"
          >
            <Mail size={20} />
            <span>البريد الإلكتروني</span>
          </button>
          
          <button
            className={`option-btn ${formData.method === 'sms' ? 'active' : ''}`}
            onClick={() => handleMethodChange('sms')}
            type="button"
          >
            <Smartphone size={20} />
            <span>رسالة نصية (SMS)</span>
          </button>
        </div>
        
        {(error || authError) && (
          <div className="error-alert">
            <AlertCircle size={18} />
            <span>{error || authError}</span>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="forgot-password-form" noValidate>
          {formData.method === 'email' ? (
            <div className="form-group">
              <label htmlFor="email" className="form-label">
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
                className="form-input"
                dir="ltr"
                autoComplete="email"
                required
              />
            </div>
          ) : (
            <div className="form-group">
              <label htmlFor="phone" className="form-label">
                <Smartphone size={18} />
                <span>رقم الهاتف *</span>
              </label>
              <div className="phone-input-wrapper">
                <select 
                  className="country-code"
                  name="countryCode"
                  value={formData.countryCode}
                  onChange={handleChange}
                >
                  {countryCodes.map(country => (
                    <option key={country.code} value={country.code}>
                      {country.flag} {country.code} {country.name}
                    </option>
                  ))}
                </select>
                <input
                  type="tel"
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleChange}
                  placeholder="5X XXX XXXX"
                  className="form-input"
                  dir="ltr"
                  autoComplete="tel"
                  required
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="submit-btn"
            disabled={loading || authLoading}
          >
            {loading || authLoading ? (
              <>
                <div className="btn-spinner"></div>
                <span>جاري الإرسال...</span>
              </>
            ) : (
              <>
                <Send size={18} />
                <span>إرسال رابط إعادة التعيين</span>
              </>
            )}
          </button>
        </form>

        <div className="form-footer">
          <div className="back-to-login">
            <Link to="/login" className="back-link">
              <ArrowRight size={18} />
              <span>العودة لتسجيل الدخول</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;

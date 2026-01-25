import React, { useState, useEffect } from 'react';
import masoudLogo from '/icon.svg';
import "./Home.css";
import { useNavigate } from 'react-router-dom';




// Inside your main component, create a renderNavItem function
const renderNavItem = (sectionKey) => {
  const section = sections[sectionKey];
  const status = getSectionStatus(section);
  const isLocked = status === 'locked';
  const isActive = activeSection === sectionKey;
  const isHovered = hoveredSection === sectionKey;

  return (
    <li 
      key={sectionKey} 
      className={`nav-item-container ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''}`}
      onMouseEnter={() => setHoveredSection(sectionKey)}
      onMouseLeave={() => setHoveredSection(null)}
    >
      <button
        className={`nav-item ${isActive ? 'active' : ''}`}
        onClick={() => handleSectionClick(sectionKey)}
        disabled={isLocked}
        style={{
          '--section-color': section.color,
          '--section-gradient': section.gradient
        }}
      >
        {/* Icon Container */}
        <div className="nav-icon-container">
          <span className="nav-icon">{section.icon}</span>
          
          {/* Status Badges */}
          {isLocked && (
            <span className="status-badge lock-badge" title="مقفل - لأفراد العائلة فقط">
              🔒
            </span>
          )}
          {status === 'private' && (
            <span className="status-badge private-badge" title="خاص بأفراد العائلة">
              👑
            </span>
          )}
          
          {/* Notifications */}
          {section.notifications > 0 && (
            <span className="notification-badge">
              {section.notifications > 9 ? '9+' : section.notifications}
            </span>
          )}
        </div>

        {/* Text Content (only shown in expanded and compact modes) */}
        {(viewMode === 'expanded' || viewMode === 'compact') && (
          <div className="nav-content">
            <div className="nav-title-row">
              <span className="nav-title">{section.title}</span>
              {viewMode === 'expanded' && isActive && (
                <span className="active-indicator">●</span>
              )}
            </div>
            
            {viewMode === 'expanded' && (
              <p className="nav-description">{section.description}</p>
            )}
          </div>
        )}

        {/* Hover Tooltip for icons-only mode */}
        {viewMode === 'icons-only' && isHovered && !isLocked && (
          <div className="tooltip">
            <div className="tooltip-content">
              <div className="tooltip-header">
                <span className="tooltip-icon">{section.icon}</span>
                <span className="tooltip-title">{section.title}</span>
              </div>
              <p className="tooltip-description">{section.description}</p>
              {status === 'private' && (
                <span className="tooltip-private">خاص بالعائلة</span>
              )}
            </div>
          </div>
        )}
      </button>

      {/* Progress Bar for active section (expanded mode only) */}
      {isActive && viewMode === 'expanded' && (
        <div className="active-progress"></div>
      )}
    </li>
  );
};

// Usage in your main component
// {Object.keys(filteredSections).map(sectionKey => renderNavItem(sectionKey))}


export default function Dashboard() {
  const [activeSection, setActiveSection] = useState('منصة التبرعات');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  const sections = {
    'منصة التبرعات': {
        title: 'منصة التبرعات',
        description: 'منصة تبرعات مفتوحة للجميع',
        icon: '💳',
        // content: 'منصة تبرعات إلكترونية آمنة ومتطورة تمكن أعضاء العائلة والزوار من التبرع عبر وسائل دفع متعددة مع متابعة التبرعات والإحصائيات.',
        path: '/donation',
        public: true,
        color: '#4CAF50',
        gradient: 'linear-gradient(135deg, #4CAF50 0%, #388E3C 100%)',
        notifications: 3
    },
    'أعضاء مجلس الإدارة': {
        title: 'أعضاء مجلس الإدارة',
        description: 'أسماء أعضاء مجلس الإدارة',
        icon: '👥',
        content: 'مجلس إدارة عائلة المسعود يتكون من كبار أعضاء العائلة ذوي الخبرة والإنجازات البارزة في مختلف المجالات.',
        path: '/board',
        public: false,
        color: '#2196F3',
        gradient: 'linear-gradient(135deg, #2196F3 0%, #1976D2 100%)',
        notifications: 0
    },
    'وقف العائلة': {
        title: 'وقف العائلة',
        description: 'معلومات عن وقف العائلة',
        icon: '🕌',
        content: 'وقف عائلة المسعود الخيري الذي يدعم المشاريع الخيرية والتعليمية والصحية لأفراد العائلة والمجتمع.',
        path: '/waqf',
        public: false,
        color: '#9C27B0',
        gradient: 'linear-gradient(135deg, #9C27B0 0%, #7B1FA2 100%)',
        notifications: 2
    },
    'أرشيف العائلة': {
        title: 'أرشيف العائلة',
        description: 'يشمل شجرة العائلة، أرشيف الاجتماعات، الأرشيف الرياضي',
        icon: '📚',
        content: 'أرشيف شامل يوثق تاريخ عائلة المسعود يشمل شجرة العائلة، محاضر الاجتماعات، الأنشطة الرياضية، والذكريات العائلية.',
        path: '/archive',
        public: false,
        color: '#FF9800',
        gradient: 'linear-gradient(135deg, #FF9800 0%, #F57C00 100%)',
        notifications: 5
    },
    'الإدارة التنفيذية': {
        title: 'الإدارة التنفيذية',
        description: 'المدير التنفيذي والسكرتير',
        icon: '💼',
        content: 'الفريق التنفيذي المسؤول عن تنفيذ قرارات مجلس الإدارة وإدارة شؤون العائلة اليومية.',
        path: '/executive',
        public: false,
        color: '#607D8B',
        gradient: 'linear-gradient(135deg, #607D8B 0%, #455A64 100%)',
        notifications: 1
    },
    'المدير المالي': {
        title: 'المدير المالي',
        description: 'المدير المالي والحسابات البنكية',
        icon: '💰',
        content: 'إدارة الشؤون المالية للعائلة والمتابعة المالية للحسابات البنكية والاستثمارات والمصروفات.',
        path: '/financial',
        public: false,
        color: '#FFC107',
        gradient: 'linear-gradient(135deg, #FFC107 0%, #FFA000 100%)',
        notifications: 0
    },
    'اللجنة الاجتماعية': {
        title: 'اللجنة الاجتماعية',
        description: 'إعانة الزواج وإعانة الأسرة',
        icon: '🤝',
        content: 'لجنة مسؤولة عن النشاطات الاجتماعية ودعم المناسبات العائلية وإعانات الزواج والأسرة.',
        path: '/social',
        public: false,
        color: '#E91E63',
        gradient: 'linear-gradient(135deg, #E91E63 0%, #C2185B 100%)',
        notifications: 4
    },
    'اللجنة الثقافية': {
        title: 'اللجنة الثقافية',
        description: 'مبادرات اللجنة الثقافية',
        icon: '📖',
        content: 'لجنة تهتم بتنظيم الفعاليات الثقافية والتعليمية وورش العمل والندوات للعائلة.',
        path: '/cultural',
        public: false,
        color: '#3F51B5',
        gradient: 'linear-gradient(135deg, #3F51B5 0%, #303F9F 100%)',
        notifications: 0
    },
    'لجنة إصلاح ذات البين': {
        title: 'لجنة إصلاح ذات البين',
        description: 'لجنة حل النزاعات داخل العائلة',
        icon: '⚖️',
        content: 'لجنة متخصصة في حل النزاعات العائلية وإصلاح ذات البين وفق مبادئ الشريعة والتقاليد العائلية.',
        path: '/reconciliation',
        public: false,
        color: '#009688',
        gradient: 'linear-gradient(135deg, #009688 0%, #00796B 100%)',
        notifications: 0
    },
    'اللجنة الرياضية': {
        title: 'اللجنة الرياضية',
        description: 'النشاطات الرياضية للعائلة',
        icon: '⚽',
        content: 'لجنة تنظيم الأنشطة الرياضية والبطولات الداخلية للعائلة وتشجيع المواهب الرياضية.',
        path: '/sports',
        public: false,
        color: '#8BC34A',
        gradient: 'linear-gradient(135deg, #8BC34A 0%, #689F38 100%)',
        notifications: 2
    }
  };

  const financialStats = [
    { label: 'الخدمة للنساء المالية', value: '125' },
    { label: 'دولة', value: '583' },
    { label: 'إجمالي المبلغ', value: '87,450' }
  ];

  const bankAccounts = [
    { label: 'الحساب العام', value: 'SA3180000252608013271122' },
    { label: 'حساب الزكاة', value: 'SA1380000252608018635255' },
    { label: 'حساب الوقف', value: 'SA2080000121608017406772' }
  ];

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle('dark-mode');
  };

  useEffect(() => {
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 992);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    // Auto-rotate through sections for demo purposes
    // const interval = setInterval(() => {
    //   const sectionKeys = Object.keys(sections);
    //   const currentIndex = sectionKeys.indexOf(activeSection);
    //   const nextIndex = (currentIndex + 1) % sectionKeys.length;
    //   setActiveSection(sectionKeys[nextIndex]);
    // }, 8000);
    
    return () => {
      // clearInterval(interval);
      window.removeEventListener('resize', checkMobile);
    };
  }, [activeSection]);

  const handleLogin = () => {
    setIsAuthenticated(true);
    alert('تم تسجيل الدخول بنجاح');
  };

  const handleRegister = () => {
    alert('إنشاء حساب جديد');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    alert('تم تسجيل الخروج');
  };

  return (
    <div className={`app ${isDarkMode ? 'dark' : 'light'}`}>
      {/* Header */}
      <header className="header">
        <div className="container header-container">
          <div className="logo-section">
            <div className="logo">
              <span className="logo-icon">
                <img src={masoudLogo} alt="مسعود لوجو" />
              </span>
              <div>
                <h1>عائلة المسعود</h1>
                <p className="tagline">منصة العائلة الإلكترونية</p>
              </div>
            </div>
            
            <div className="header-actions">
              <div className="auth-buttons">
                {isAuthenticated ? (
                  <>
                    <button className="btn-profile" onClick={() => alert('الملف الشخصي')}>
                      الملف الشخصي
                    </button>
                    <button className="btn-logout" onClick={handleLogout}>
                      تسجيل الخروج
                    </button>
                  </>
                ) : (
                  <>
                    <button className="btn-login" onClick={() => navigate('/login')}>
                      تسجيل الدخول
                    </button>
                    <button className="btn-register" onClick={() => navigate('/register')}>
                      إنشاء حساب
                    </button>
                  </>
                )}
              </div>

              <button className="dark-mode-toggle" onClick={toggleDarkMode}>
                {isDarkMode ? '☀️' : '🌙'}
              </button>
              
              <button 
                className="mobile-menu-btn" 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? '✕' : '☰'}
              </button>
            </div>
          </div>

          <div className="welcome-message">
            <div className="welcome-content">
              <span className="welcome-icon">👋</span>
              <div>
                <h2>أهلا زائرنا الكريم</h2>
                <p>مرحباً بكم في منصة مسعود الالكترونية</p>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar for Mobile */}
        {mobileMenuOpen && (
            <>
                {/* Overlay */}
                <div 
                    className="sidebar-overlay" 
                    onClick={() => setMobileMenuOpen(false)}
                ></div>

                {/* Sidebar */}
                  <aside className={`sidebar ${mobileMenuOpen ? 'open' : ''}`}>
                    <div className="sidebar-header">
                        <div className="sidebar-logo">
                            <div className="sidebar-logo-icon">
                                <img src={masoudLogo} alt="شعار عائلة المسعود" />
                            </div>
                            <div className="sidebar-logo-text">
                                <h3>عائلة المسعود</h3>
                                <p>منصة العائلة الإلكترونية</p>
                            </div>
                        </div>
                        <button 
                            className="sidebar-close"
                            onClick={() => setMobileMenuOpen(false)}
                            aria-label="إغلاق القائمة"
                        >
                            &times;
                        </button>
                    </div>

                    {/* Mobile Navigation */}
                    <nav className="sidebar-nav">
                        <ul className="sidebar-nav-list">
                            {Object.keys(sections).map(section => (
                                <li key={section} className="sidebar-nav-item">
                                    <button 
                                        className={`sidebar-nav-link ${activeSection === section ? 'active' : ''}`}
                                        onClick={() => {
                                            setActiveSection(section);
                                            setMobileMenuOpen(false);
                                        }}
                                    >
                                        <span className="sidebar-nav-icon">{sections[section].icon}</span>
                                        <span className="sidebar-nav-text">{sections[section].title}</span>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    {/* Mobile Auth Section */}
                    <div className="sidebar-auth-section">
                        {isAuthenticated ? (
                            <div className="sidebar-user-section">
                                <div className="sidebar-user-info">
                                    <span className="sidebar-user-avatar">👤</span>
                                    <div className="sidebar-user-details">
                                        <span className="sidebar-user-name">عضو العائلة</span>
                                        <span className="sidebar-user-email">user@example.com</span>
                                    </div>
                                </div>
                                <div className="sidebar-user-actions">
                                    <button className="sidebar-action-btn profile-btn" onClick={() => alert('الملف الشخصي')}>
                                        <span className="action-icon">👤</span>
                                        <span>الملف الشخصي</span>
                                    </button>
                                    <button className="sidebar-action-btn settings-btn" onClick={() => alert('الإعدادات')}>
                                        <span className="action-icon">⚙️</span>
                                        <span>الإعدادات</span>
                                    </button>
                                    <button className="sidebar-action-btn logout-btn" onClick={handleLogout}>
                                        <span className="action-icon">🚪</span>
                                        <span>تسجيل الخروج</span>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="sidebar-auth-buttons">
                                <button className="sidebar-auth-btn login-btn" onClick={() => navigate('/login')}>
                                    <span className="btn-icon">🔑</span>
                                    <span>تسجيل الدخول</span>
                                </button>
                                <button className="sidebar-auth-btn register-btn" onClick={() => navigate('/register')}>
                                    <span className="btn-icon">📝</span>
                                    <span>تسجيل جديد</span>
                                </button>
                            </div>
                        )}
                    </div>
                </aside>
            </>
        )}
      </header>

      {/* Main Content */}
      <main className="main-content">
        <div className="container main-container">
          {/* Desktop Sidebar Navigation */}
          <aside className="sidebar-desktop">
            <nav className="nav-menu">
              <ul>
                {Object.keys(sections).map(section => (
                  <li key={section}>
                    <button
                      className={`nav-item ${activeSection === section ? 'active' : ''}`}
                      onClick={() => {
                        setActiveSection(section);
                        if (window.innerWidth < 992) setMobileMenuOpen(false);
                      }}
                    >
                      <span className="nav-icon">{sections[section].icon}</span>
                      <span className="nav-text">{section}</span>
                      {/* {activeSection === section && <span className="active-indicator"></span>} */}
                    </button>
                  </li>
                ))}
             </ul>
            </nav>
          </aside>

          {/* Main Content Area */}
          <section className="content-area">
            <div className="content-header">
              <div className="section-title">
                <span className="section-icon">{sections[activeSection]?.icon || '💰'}</span>
                <div>
                  <h2>{sections[activeSection]?.title || 'التبرعات'}</h2>
                  <p className="section-description">
                    {sections[activeSection]?.description || 'معلومات شاملة حول السلامة الغذائية والمعايير المطبقة'}
                  </p>
                </div>
              </div>
            </div>

            <div className="content-card">
              <div className="content-body">

              <p className="section-description">
                <h3>حسابات الاسرة المعتمدة</h3>
                {bankAccounts.map((ba, index) => (
                  <p className="p1" key={index}>{ba.label}<br /><span>{ba.value}</span></p>
                ))}
              </p>


              </div>

            </div>

            {/* Additional Info Cards */}
            <div className="cards-grid">
              <div className="info-card">
                <div className="info-card-header">
                  <span className="info-icon">📅</span>
                  <h4>الفعاليات القادمة</h4>
                </div>
                <div className="info-card-body">
                  <p>ورشة عمل حول السلامة الغذائية - 15 ديسمبر 2024</p>
                  <p>المؤتمر السنوي للجودة - 20 يناير 2025</p>
                </div>
              </div>
              <div className="info-card">
                <div className="info-card-header">
                  <span className="info-icon">📞</span>
                  <h4>اتصل بنا</h4>
                </div>
                <div className="info-card-body">
                  <p>هاتف: 8001234567</p>
                  <p>البريد الإلكتروني: info@masoud.com</p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container footer-container">
          <div className="footer-section">
            <h4>روابط سريعة</h4>
            <ul>
              <li><a href="/">الصفحة الرئيسية</a></li>
              <li><a href="/donations">التبرعات</a></li>
              <li><a href="/login">تسجيل الدخول</a></li>
              <li><a href="/egister">انشاء حسب</a></li>
            </ul>
          </div>
          {/* <div className="footer-section">
            <h4>خدماتنا</h4>
            <ul>
              <li><a href="#">الاستشارات الغذائية</a></li>
              <li><a href="#">التدريب والتأهيل</a></li>
              <li><a href="#">الفحوصات المخبرية</a></li>
              <li><a href="#">إصدار الشهادات</a></li>
            </ul>
          </div> */}
          <div className="footer-section">
            <h4>تواصل معنا</h4>
            <p>شارع السلامة الغذائية، الرياض، السعودية</p>
            <p>الرمز البريدي: 11564</p>
            <p>هاتف: 0112345678</p>
          </div>
        </div>
        <div className="copyright">
          <p>© 2024 مسعود - جميع الحقوق محفوظة | تصميم وتطوير بوابة السلامة الغذائية</p>
        </div>
      </footer>
    </div>
  );
}

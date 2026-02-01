import React, { useState, useEffect } from "react";
import masoudLogo from "/icon.svg";
import "./Layout.css";
import { Outlet, useNavigate } from "react-router-dom";
import { sectionPages as sections } from "../../data/sections";

export default function Layout() {
  const [activeSection, setActiveSection] = useState("منصة التبرعات");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const navigate = useNavigate();

  const toggleDarkMode = () => {
    setIsDarkMode(!isDarkMode);
    document.body.classList.toggle("dark-mode");
  };

  useEffect(() => {
    // Check if mobile on mount and resize
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 992);
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);

    return () => {
      // clearInterval(interval);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  const handleLogout = () => {
    setIsAuthenticated(false);
    alert("تم تسجيل الخروج");
  };

  const redirectPublicPath = (section) => {
    if (!isAuthenticated && !section.public)
      navigate('/login');
    else
      navigate(section.path);
  };

  return (
    <div className={`app ${isDarkMode ? "dark" : "light"}`}>
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
                    <button
                      className="btn-profile"
                      onClick={() => alert("الملف الشخصي")}
                    >
                      الملف الشخصي
                    </button>
                    <button className="btn-logout">تسجيل الخروج</button>
                  </>
                ) : (
                  <>
                    <button
                      className="btn-login"
                      onClick={() => navigate("/login")}
                    >
                      تسجيل الدخول
                    </button>
                    <button
                      className="btn-register"
                      onClick={() => navigate("/register")}
                    >
                      إنشاء حساب
                    </button>
                  </>
                )}
              </div>

              <button className="dark-mode-toggle" onClick={toggleDarkMode}>
                {isDarkMode ? "☀️" : "🌙"}
              </button>

              <button
                className="mobile-menu-btn"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? "✕" : "☰"}
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
            <aside className={`sidebar ${mobileMenuOpen ? "open" : ""}`}>
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
                  {Object.keys(sections).map((section) => (
                    <li key={section} className="sidebar-nav-item">
                      <button
                        className={`sidebar-nav-link ${activeSection === section ? "active" : ""}`}
                        onClick={() => {
                          setActiveSection(section)
                          setMobileMenuOpen(false);
                          redirectPublicPath(section);
                        }}
                      >
                        <span className="sidebar-nav-icon">
                          {sections[section].icon}
                        </span>
                        <span className="sidebar-nav-text">
                          {sections[section].title}
                        </span>
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
                        <span className="sidebar-user-email">
                          user@example.com
                        </span>
                      </div>
                    </div>
                    <div className="sidebar-user-actions">
                      <button
                        className="sidebar-action-btn profile-btn"
                        onClick={() => alert("الملف الشخصي")}
                      >
                        <span className="action-icon">👤</span>
                        <span>الملف الشخصي</span>
                      </button>
                      <button
                        className="sidebar-action-btn settings-btn"
                        onClick={() => alert("الإعدادات")}
                      >
                        <span className="action-icon">⚙️</span>
                        <span>الإعدادات</span>
                      </button>
                      <button className="sidebar-action-btn logout-btn">
                        <span className="action-icon">🚪</span>
                        <span>تسجيل الخروج</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="sidebar-auth-buttons">
                    <button
                      className="sidebar-auth-btn login-btn"
                      onClick={() => navigate("/login")}
                    >
                      <span className="btn-icon">🔑</span>
                      <span>تسجيل الدخول</span>
                    </button>
                    <button
                      className="sidebar-auth-btn register-btn"
                      onClick={() => navigate("/register")}
                    >
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
                {Object.keys(sections).map((section) => (
                  <li key={section}>
                    <button
                      className={`nav-item ${activeSection === section ? "active" : ""}`}
                      onClick={() => {
                        setActiveSection(section);
                        if (window.innerWidth < 992) setMobileMenuOpen(false);
                        redirectPublicPath(section);
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
            <Outlet />
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
              <li>
                <a href="/">الصفحة الرئيسية</a>
              </li>
              <li>
                <a href="/donations">التبرعات</a>
              </li>
              <li>
                <a href="/login">تسجيل الدخول</a>
              </li>
              <li>
                <a href="/egister">انشاء حسب</a>
              </li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>تواصل معنا</h4>
            <p>شارع السلامة الغذائية، الرياض، السعودية</p>
            <p>الرمز البريدي: 11564</p>
            <p>هاتف: 0112345678</p>
          </div>
        </div>
        <div className="copyright">
          <p>
            © 2024 مسعود - جميع الحقوق محفوظة | تصميم وتطوير بوابة السلامة
            الغذائية
          </p>
        </div>
      </footer>
    </div>
  );
}

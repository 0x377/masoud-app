import Container from 'react-bootstrap/Container';
import './Header.css';
import { useState, useEffect } from "react";
import masoudLogo from '/icon.svg';
import { useNavigate } from 'react-router-dom';

export default function Header() {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    const [isAuthenticated] = useState(false);
    const [userDropdownOpen, setUserDropdownOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const navigate = useNavigate();

    // Check screen size on mount and resize
    useEffect(() => {
        const checkScreenSize = () => {
            setIsMobile(window.innerWidth < 992); // Bootstrap lg breakpoint
        };
        
        checkScreenSize();
        window.addEventListener('resize', checkScreenSize);
        return () => window.removeEventListener('resize', checkScreenSize);
    }, []);

    // Handle click outside for dropdowns
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (mobileMenuOpen && !event.target.closest('.mobile-menu-btn') && 
                !event.target.closest('.sidebar') && !event.target.closest('.sidebar-overlay')) {
                setMobileMenuOpen(false);
            }
            if (userDropdownOpen && !event.target.closest('.user-menu')) {
                setUserDropdownOpen(false);
            }
        };

        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [mobileMenuOpen, userDropdownOpen]);

    // Handle sidebar close on escape key
    useEffect(() => {
        const handleEscape = (event) => {
            if (event.key === 'Escape' && mobileMenuOpen) {
                setMobileMenuOpen(false);
            }
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [mobileMenuOpen]);

    const toggleDarkMode = () => {
        setIsDarkMode(prev => !prev);
        if (!isDarkMode) {
            document.body.classList.add('dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
        }
    };

    const navItems = [
        { id: 1, name: 'الرئيسية', icon: '🏠' },
        { id: 2, name: 'شجرة العائلة', icon: '🌳' },
        { id: 3, name: 'ألبوم الصور', icon: '📷' },
        { id: 4, name: 'الأخبار', icon: '📰' },
        { id: 5, name: 'الفعاليات', icon: '🎉' },
        { id: 6, name: 'المناسبات', icon: '📅' },
        { id: 7, name: 'اتصل بنا', icon: '📞' }
    ];

    return(
        <>
            <header className="header">
                <Container>
                    <div className="header-container">
                        {/* Logo Section */}
                        <div className="logo-section">
                            <div className="logo">
                                <span className="logo-icon">
                                    <img src={masoudLogo} alt="شعار عائلة المسعود" />
                                </span>
                                <div className="logo-text">
                                    <h1>عائلة المسعود</h1>
                                    <p className="tagline">منصة العائلة الإلكترونية</p>
                                </div>
                            </div>
                        </div>

                        {/* Right Section: Controls & Auth */}
                        <div className="header-right-section">
                            {/* Desktop Auth Buttons - Hidden on mobile */}
                            {!isMobile && (
                                <div className="desktop-auth">
                                    {isAuthenticated ? (
                                        <div className="user-menu">
                                            <button 
                                                className="user-btn"
                                                onClick={() => setUserDropdownOpen(!userDropdownOpen)}
                                                aria-expanded={userDropdownOpen}
                                            >
                                                <span className="user-icon">👤</span>
                                                <span className="user-name">عضو العائلة</span>
                                                <span className="dropdown-arrow">▼</span>
                                            </button>
                                            {userDropdownOpen && (
                                                <div className="dropdown-menu">
                                                    <button className="dropdown-item">
                                                        <span className="dropdown-icon">👤</span>
                                                        <span>الملف الشخصي</span>
                                                    </button>
                                                    <button className="dropdown-item">
                                                        <span className="dropdown-icon">⚙️</span>
                                                        <span>الإعدادات</span>
                                                    </button>
                                                    <button className="dropdown-item logout-btn">
                                                        <span className="dropdown-icon">🚪</span>
                                                        <span>تسجيل الخروج</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="auth-buttons">
                                            <button className="auth-btn login-btn" onClick={() => navigate('/login')}>
                                                <span className="btn-icon">🔑</span>
                                                <span>تسجيل الدخول</span>
                                            </button>
                                            <button className="auth-btn register-btn" onClick={() => navigate('/register')}>
                                                <span className="btn-icon">📝</span>
                                                <span>تسجيل جديد</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Header Controls */}
                            <div className="header-controls">
                                <button 
                                    className="dark-mode-toggle" 
                                    onClick={toggleDarkMode} 
                                    aria-label={isDarkMode ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الداكن'}
                                >
                                    {isDarkMode ? '☀️' : '🌙'}
                                </button>
                                
                                {/* Mobile Menu Button - Only visible on mobile */}
                                {isMobile && (
                                    <button 
                                        className={`mobile-menu-btn ${mobileMenuOpen ? 'open' : ''}`}
                                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                                        aria-label={mobileMenuOpen ? 'إغلاق القائمة' : 'فتح القائمة'}
                                        aria-expanded={mobileMenuOpen}
                                    >
                                        <span className="menu-icon-bar">-</span>
                                        <span className="menu-icon-bar">-</span>
                                        <span className="menu-icon-bar">-</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </Container>
            </header>

            {/* Sidebar for Mobile */}
            {isMobile && (
                <>
                    {/* Overlay - Only show on mobile */}
                    <div 
                        className={`sidebar-overlay ${mobileMenuOpen ? 'active' : ''}`} 
                        onClick={() => setMobileMenuOpen(false)}
                    ></div>
                    
                    {/* Sidebar - Only show on mobile */}
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
                                {navItems.map(item => (
                                    <li key={item.id} className="sidebar-nav-item">
                                        <a 
                                            href="#" 
                                            className="sidebar-nav-link"
                                            onClick={() => setMobileMenuOpen(false)}
                                        >
                                            <span className="sidebar-nav-icon">{item.icon}</span>
                                            <span className="sidebar-nav-text">{item.name}</span>
                                        </a>
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
                                        <button className="sidebar-action-btn profile-btn">
                                            <span className="action-icon">👤</span>
                                            <span>الملف الشخصي</span>
                                        </button>
                                        <button className="sidebar-action-btn settings-btn">
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

            {/* Spacer to prevent content from being hidden under fixed header */}
            <div className="header-spacer"></div>
        </>
    );
}

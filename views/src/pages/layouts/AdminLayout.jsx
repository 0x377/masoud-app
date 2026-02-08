import React, { useState, useEffect } from "react";
import { Outlet, useNavigate, Link, useLocation } from "react-router-dom";
import {
  Menu,
  X,
  Home,
  Users,
  FileText,
  Settings,
  BarChart,
  Bell,
  HelpCircle,
  LogOut,
  User,
  Shield,
  Calendar,
  MessageSquare,
  Database,
  CreditCard,
  BookOpen,
  Image,
  Mail,
  Lock,
  Globe,
  Moon,
  Sun,
  Search,
} from "lucide-react";
import "./AdminLayout.css";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // التحقق من تفضيل المستخدم المخزن أو النظام
    const savedMode = localStorage.getItem("admin_dark_mode");
    return (
      savedMode === "true" ||
      (!savedMode && window.matchMedia("(prefers-color-scheme: dark)").matches)
    );
  });

  // بيانات المستخدم
  const user = {
    name: "مسعود العلي",
    email: "admin@masoud-family.com",
    role: "مدير النظام",
    avatar: "👨‍💼",
  };

  // تطبيق وضع الألوان عند التغيير
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark-mode");
      document.documentElement.classList.remove("light-mode");
    } else {
      document.documentElement.classList.add("light-mode");
      document.documentElement.classList.remove("dark-mode");
    }
    localStorage.setItem("admin_dark_mode", darkMode);
  }, [darkMode]);

  // قائمة التنقل الجانبية
  const menuItems = [
    {
      id: "dashboard",
      title: "لوحة التحكم",
      icon: <Home size={20} />,
      path: "/admin/dashboard",
      badge: null,
    },
    {
      id: "users",
      title: "إدارة المستخدمين",
      icon: <Users size={20} />,
      path: "/admin/users",
      badge: "3",
    },
    {
      id: "content",
      title: "المحتوى",
      icon: <FileText size={20} />,
      path: "/admin/content",
      subItems: [
        { title: "المقالات", path: "/admin/content/articles" },
        { title: "الصفحات", path: "/admin/content/pages" },
        { title: "وسائل الإعلام", path: "/admin/content/media" },
      ],
    },
    {
      id: "finance",
      title: "المالية",
      icon: <CreditCard size={20} />,
      path: "/admin/finance",
      subItems: [
        { title: "التبرعات", path: "/admin/finance/donations" },
        { title: "المساعدات", path: "/admin/finance/aid" },
        { title: "التقارير", path: "/admin/finance/reports" },
      ],
    },
    {
      id: "family",
      title: "إدارة العائلة",
      icon: <Users size={20} />,
      path: "/admin/family",
      subItems: [
        { title: "شجرة العائلة", path: "/admin/family/tree" },
        { title: "الأعضاء", path: "/admin/family/members" },
        { title: "الاجتماعات", path: "/admin/family/meetings" },
      ],
    },
    {
      id: "committees",
      title: "اللجان",
      icon: <Users size={20} />,
      path: "/admin/committees",
      subItems: [
        { title: "اللجنة الاجتماعية", path: "/admin/committees/social" },
        { title: "اللجنة الثقافية", path: "/admin/committees/cultural" },
        { title: "اللجنة الرياضية", path: "/admin/committees/sports" },
        { title: "لجنة الإصلاح", path: "/admin/committees/reconciliation" },
      ],
    },
    {
      id: "events",
      title: "الفعاليات",
      icon: <Calendar size={20} />,
      path: "/admin/events",
    },
    {
      id: "messages",
      title: "الرسائل",
      icon: <MessageSquare size={20} />,
      path: "/admin/messages",
      badge: "12",
    },
    {
      id: "reports",
      title: "التقارير",
      icon: <BarChart size={20} />,
      path: "/admin/reports",
    },
    {
      id: "settings",
      title: "الإعدادات",
      icon: <Settings size={20} />,
      path: "/admin/settings",
      subItems: [
        { title: "عام", path: "/admin/settings/general" },
        { title: "الأمان", path: "/admin/settings/security" },
        { title: "التواصل", path: "/admin/settings/notifications" },
        { title: "المظهر", path: "/admin/settings/appearance" },
      ],
    },
  ];

  // العناصر الإضافية في القائمة
  const additionalItems = [
    {
      id: "help",
      title: "المساعدة",
      icon: <HelpCircle size={20} />,
      path: "/admin/help",
    },
    {
      id: "documentation",
      title: "التوثيق",
      icon: <BookOpen size={20} />,
      path: "/admin/docs",
    },
  ];

  const handleLogout = () => {
    // تنفيذ عملية تسجيل الخروج
    localStorage.removeItem("admin_token");
    navigate("/login");
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const isActive = (path) => {
    return (
      location.pathname === path || location.pathname.startsWith(`${path}/`)
    );
  };

  return (
    <div className={`admin-layout ${darkMode ? "dark-mode" : "light-mode"}`}>
      {/* شريط التنقل العلوي */}
      <header className="admin-header">
        <div className="header-left">
          <button
            className="menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="فتح/إغلاق القائمة"
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>

          <button
            className="sidebar-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="إظهار/إخفاء الشريط الجانبي"
          >
            <Menu size={20} />
          </button>

          <div className="header-logo">
            <Shield size={28} className="logo-icon" />
            <div className="logo-text">
              <h1>لوحة التحكم</h1>
              <p>عائلة المسعود</p>
            </div>
          </div>
        </div>

        <div className="header-center">
          <div className="search-box">
            <Search className="search-icon" size={20} />
            <input
              type="text"
              placeholder="ابحث هنا..."
              className="search-input"
            />
          </div>
        </div>

        <div className="header-right">
          {/* زر تبديل الوضع */}
          <button
            className="header-btn theme-toggle"
            onClick={toggleDarkMode}
            aria-label={darkMode ? "تفعيل الوضع الفاتح" : "تفعيل الوضع الداكن"}
          >
            {darkMode ? <Sun size={20} /> : <Moon size={20} />}
          </button>

          <button className="header-btn notifications" aria-label="الإشعارات">
            <Bell size={20} />
            <span className="notification-badge">3</span>
          </button>

          <button className="header-btn help" aria-label="المساعدة">
            <HelpCircle size={20} />
          </button>

          <div className="user-menu-wrapper">
            <button
              className="user-menu-toggle"
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              aria-label="قائمة المستخدم"
            >
              <div className="user-avatar">{user.avatar}</div>
              <div className="user-info">
                <span className="user-name">{user.name}</span>
                <span className="user-role">{user.role}</span>
              </div>
            </button>

            {userMenuOpen && (
              <div className="user-dropdown">
                <div className="dropdown-header">
                  <div className="dropdown-avatar">{user.avatar}</div>
                  <div>
                    <h4>{user.name}</h4>
                    <p>{user.email}</p>
                    <span className="user-role-badge">{user.role}</span>
                  </div>
                </div>

                <div className="dropdown-divider"></div>

                <Link to="/admin/profile" className="dropdown-item">
                  <User size={16} />
                  <span>الملف الشخصي</span>
                </Link>

                <Link to="/admin/settings" className="dropdown-item">
                  <Settings size={16} />
                  <span>الإعدادات</span>
                </Link>

                <div className="dropdown-divider"></div>

                <button onClick={toggleDarkMode} className="dropdown-item">
                  {darkMode ? <Sun size={16} /> : <Moon size={16} />}
                  <span>{darkMode ? "الوضع الفاتح" : "الوضع الداكن"}</span>
                </button>

                <div className="dropdown-divider"></div>

                <button onClick={handleLogout} className="dropdown-item logout">
                  <LogOut size={16} />
                  <span>تسجيل الخروج</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* القائمة الجانبية للجوال */}
      {mobileMenuOpen && (
        <div className="mobile-sidebar-overlay">
          <div className="mobile-sidebar">
            <div className="mobile-sidebar-header">
              <h3>القائمة</h3>
              <button
                className="close-mobile-menu"
                onClick={() => setMobileMenuOpen(false)}
              >
                <X size={24} />
              </button>
            </div>

            <nav className="mobile-sidebar-nav">
              {menuItems.map((item) => (
                <Link
                  key={item.id}
                  to={item.path}
                  className={`mobile-nav-item ${isActive(item.path) ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  <span className="mobile-nav-icon">{item.icon}</span>
                  <span className="mobile-nav-text">{item.title}</span>
                  {item.badge && (
                    <span className="mobile-nav-badge">{item.badge}</span>
                  )}
                </Link>
              ))}

              <div className="mobile-sidebar-divider"></div>

              <button
                onClick={toggleDarkMode}
                className="mobile-nav-item theme-toggle-mobile"
              >
                <span className="mobile-nav-icon">
                  {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                </span>
                <span className="mobile-nav-text">
                  {darkMode ? "الوضع الفاتح" : "الوضع الداكن"}
                </span>
              </button>
            </nav>
          </div>
        </div>
      )}

      {/* المحتوى الرئيسي */}
      <div className="admin-main">
        {/* الشريط الجانبي */}
        <aside className={`admin-sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-content">
            <div className="sidebar-header">
              <div className="sidebar-logo">
                <Shield size={32} className="sidebar-logo-icon" />
                <div
                  className="sidebar-logo-text"
                  style={
                    sidebarOpen ? { display: "block" } : { display: "block" }
                  }
                >
                  <h3>مسعود</h3>
                  <p>Admin</p>
                </div>
              </div>
            </div>

            <nav className="sidebar-nav">
              <ul className="sidebar-menu">
                {menuItems.map((item) => (
                  <li key={item.id} className="sidebar-menu-item">
                    <Link
                      to={item.path}
                      className={`sidebar-menu-link ${isActive(item.path) ? "active" : ""}`}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      {sidebarOpen && (
                        <span className="menu-text">{item.title}</span>
                      )}
                      {item.badge && (
                        <span className="menu-badge">{item.badge}</span>
                      )}
                    </Link>

                    {item.subItems && sidebarOpen && (
                      <ul className="submenu">
                        {item.subItems.map((subItem, index) => (
                          <li key={index}>
                            <Link
                              to={subItem.path}
                              className={`submenu-link ${isActive(subItem.path) ? "active" : ""}`}
                            >
                              {subItem.title}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>

              {sidebarOpen && (
                <div className="sidebar-divider">
                  <span>إضافي</span>
                </div>
              )}

              <ul className="sidebar-menu">
                {additionalItems.map((item) => (
                  <li key={item.id} className="sidebar-menu-item">
                    <Link
                      to={item.path}
                      className={`sidebar-menu-link ${isActive(item.path) ? "active" : ""}`}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      {sidebarOpen && (
                        <span className="menu-text">{item.title}</span>
                      )}
                    </Link>
                  </li>
                ))}

                <li className="sidebar-menu-item">
                  <button
                    onClick={toggleDarkMode}
                    className="sidebar-menu-link theme-toggle-sidebar"
                  >
                    <span className="menu-icon">
                      {darkMode ? <Sun size={20} /> : <Moon size={20} />}
                    </span>
                    {sidebarOpen && (
                      <span className="menu-text">
                        {darkMode ? "الوضع الفاتح" : "الوضع الداكن"}
                      </span>
                    )}
                  </button>
                </li>
              </ul>
            </nav>

            <div className="sidebar-footer">
              {sidebarOpen ? (
                <>
                  {/* <div className="sidebar-user">
                    <div className="sidebar-user-avatar">{user.avatar}</div>
                    <div className="sidebar-user-info">
                      <span className="sidebar-user-name">{user.name}</span>
                      <span className="sidebar-user-role">{user.role}</span>
                    </div>
                  </div> */}

                  <button
                    onClick={() => setSidebarOpen(false)}
                    className="sidebar-collapse-btn"
                    aria-label="طي الشريط الجانبي"
                  >
                    &lt;
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setSidebarOpen(true)}
                  className="sidebar-expand-btn"
                  aria-label="توسيع الشريط الجانبي"
                >
                  &gt;
                </button>
              )}
            </div>
          </div>
        </aside>

        {/* المحتوى */}
        <main className="admin-content">
          <div className="content-wrapper">
            <Outlet />
          </div>

          <footer className="admin-footer">
            <p>
              © {new Date().getFullYear()} عائلة المسعود. جميع الحقوق محفوظة.
            </p>
            <div className="footer-links">
              <Link to="/admin/privacy">الخصوصية</Link>
              <Link to="/admin/terms">الشروط</Link>
              <Link to="/admin/contact">اتصل بنا</Link>
            </div>
          </footer>
        </main>
      </div>
    </div>
  );
}

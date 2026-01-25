import { useState, useEffect } from 'react';
import './Sidebar.css';




export default function Sidebar({ isAuthenticated = false }) {
    const [activeSection, setActiveSection] = useState(null);
    const [hoveredSection, setHoveredSection] = useState(null);
    const [viewMode, setViewMode] = useState('expanded'); // 'expanded', 'compact', 'icons-only'
    const [searchQuery, setSearchQuery] = useState('');
    const [filteredSections, setFilteredSections] = useState({});
    const [showSearch, setShowSearch] = useState(false);

    // تعريف الأقسام بناءً على ملف PDF
    const sections = {
        'منصة التبرعات': {
            title: 'منصة التبرعات',
            description: 'منصة تبرعات مفتوحة للجميع',
            icon: '💳',
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
            path: '/sports',
            public: false,
            color: '#8BC34A',
            gradient: 'linear-gradient(135deg, #8BC34A 0%, #689F38 100%)',
            notifications: 2
        },
        'المركز الإعلامي': {
            title: 'المركز الإعلامي',
            description: 'الإعلام والنشاطات الإعلامية',
            icon: '📢',
            path: '/media',
            public: false,
            color: '#FF5722',
            gradient: 'linear-gradient(135deg, #FF5722 0%, #D84315 100%)',
            notifications: 3
        }
    };

    // Filter sections based on search
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredSections(sections);
        } else {
            const filtered = {};
            Object.keys(sections).forEach(key => {
                const section = sections[key];
                if (
                    section.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    section.description.toLowerCase().includes(searchQuery.toLowerCase())
                ) {
                    filtered[key] = section;
                }
            });
            setFilteredSections(filtered);
        }
    }, [searchQuery]);

    // Initialize filtered sections
    useEffect(() => {
        setFilteredSections(sections);
    }, []);

    const handleSectionClick = (sectionKey) => {
        const section = sections[sectionKey];
        const isLocked = !section.public && !isAuthenticated;
        
        if (!isLocked) {
            setActiveSection(sectionKey);
            console.log(`Navigating to: ${section.path}`);
            // Here you would normally use a router like:
            // navigate(section.path);
        }
    };

    const handleViewModeChange = (mode) => {
        setViewMode(mode);
    };

    const toggleSearch = () => {
        setShowSearch(!showSearch);
        if (showSearch) {
            setSearchQuery('');
        }
    };

    const getSectionStatus = (section) => {
        if (!section.public && !isAuthenticated) return 'locked';
        if (!section.public && isAuthenticated) return 'private';
        return 'public';
    };

    return (
        <div className={`sidebar-container ${viewMode}`}>
            <nav className="nav-menu">

                <ul className="nav-list">
                    {Object.keys(filteredSections).map(sectionKey => {
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
                    })}
                </ul>
            </nav>
        </div>
    );
}

import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  theme: 'light', // 'light' or 'dark'
  sidebarCollapsed: false,
  notificationsEnabled: true,
  language: 'ar', // 'ar' or 'en'
  fontSize: 'medium', // 'small', 'medium', 'large'
  currentView: 'dashboard', // current active view
  loading: false,
  error: null,
  drawerOpen: false, // for mobile drawer
  searchQuery: '',
  filters: {},
  sortBy: 'date', // 'date', 'name', 'recent'
  sortOrder: 'desc', // 'asc', 'desc'
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
      // Also update the HTML attribute for CSS variables
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', action.payload);
      }
    },
    toggleTheme: (state) => {
      state.theme = state.theme === 'light' ? 'dark' : 'light';
      if (typeof document !== 'undefined') {
        document.documentElement.setAttribute('data-theme', state.theme);
      }
    },
    toggleSidebar: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },
    setSidebarState: (state, action) => {
      state.sidebarCollapsed = action.payload;
    },
    toggleNotifications: (state) => {
      state.notificationsEnabled = !state.notificationsEnabled;
    },
    setLanguage: (state, action) => {
      state.language = action.payload;
      // Update HTML direction for RTL/LTR
      if (typeof document !== 'undefined') {
        document.documentElement.dir = action.payload === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = action.payload;
      }
    },
    setFontSize: (state, action) => {
      state.fontSize = action.payload;
    },
    setCurrentView: (state, action) => {
      state.currentView = action.payload;
    },
    setLoading: (state, action) => {
      state.loading = action.payload;
    },
    setError: (state, action) => {
      state.error = action.payload;
    },
    clearError: (state) => {
      state.error = null;
    },
    toggleDrawer: (state) => {
      state.drawerOpen = !state.drawerOpen;
    },
    setDrawerOpen: (state, action) => {
      state.drawerOpen = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearFilters: (state) => {
      state.filters = {};
    },
    setSortBy: (state, action) => {
      state.sortBy = action.payload;
    },
    setSortOrder: (state, action) => {
      state.sortOrder = action.payload;
    },
    toggleSortOrder: (state) => {
      state.sortOrder = state.sortOrder === 'asc' ? 'desc' : 'asc';
    },
    resetUI: (state) => {
      return {
        ...initialState,
        theme: state.theme, // Keep theme
        language: state.language, // Keep language
      };
    },
  },
});

export const {
  setTheme,
  toggleTheme,
  toggleSidebar,
  setSidebarState,
  toggleNotifications,
  setLanguage,
  setFontSize,
  setCurrentView,
  setLoading,
  setError,
  clearError,
  toggleDrawer,
  setDrawerOpen,
  setSearchQuery,
  setFilters,
  clearFilters,
  setSortBy,
  setSortOrder,
  toggleSortOrder,
  resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;

// Selectors
export const selectTheme = (state) => state.ui.theme;
export const selectSidebarCollapsed = (state) => state.ui.sidebarCollapsed;
export const selectNotificationsEnabled = (state) => state.ui.notificationsEnabled;
export const selectLanguage = (state) => state.ui.language;
export const selectFontSize = (state) => state.ui.fontSize;
export const selectCurrentView = (state) => state.ui.currentView;
export const selectLoading = (state) => state.ui.loading;
export const selectError = (state) => state.ui.error;
export const selectDrawerOpen = (state) => state.ui.drawerOpen;
export const selectSearchQuery = (state) => state.ui.searchQuery;
export const selectFilters = (state) => state.ui.filters;
export const selectSortBy = (state) => state.ui.sortBy;
export const selectSortOrder = (state) => state.ui.sortOrder;

// Combined selectors
export const selectUISettings = (state) => ({
  theme: state.ui.theme,
  language: state.ui.language,
  fontSize: state.ui.fontSize,
  sidebarCollapsed: state.ui.sidebarCollapsed,
});

export const selectSearchAndFilter = (state) => ({
  searchQuery: state.ui.searchQuery,
  filters: state.ui.filters,
  sortBy: state.ui.sortBy,
  sortOrder: state.ui.sortOrder,
});

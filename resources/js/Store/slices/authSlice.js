import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import axios from 'axios';
import { toast } from 'react-toastify';

// API Configuration
const API_BASE_URL = 'http://127.0.0.1:8000/api';

// Configure axios instance
export const authApi = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

console.log(authApi)

// Request interceptor for adding token
authApi.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for handling token refresh
authApi.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');
        
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken
        });
        
        const { accessToken, refreshToken: newRefreshToken } = response.data;
        
        localStorage.setItem('accessToken', accessToken);
        if (newRefreshToken) {
          localStorage.setItem('refreshToken', newRefreshToken);
        }
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return authApi(originalRequest);
      } catch (refreshError) {
        store.dispatch(logout());
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

// Async Thunks
export const login = createAsyncThunk(
  'auth/login',
  async ({ email, password, rememberMe }, { rejectWithValue }) => {
    try {
      const response = await authApi.post('/v1/auth/login', {
        email,
        password,
        rememberMe
      });

      const { user, accessToken, refreshToken } = response.data;
      
      // Store tokens
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      toast.success('تم تسجيل الدخول بنجاح!');
      return { user, accessToken, refreshToken };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'فشل تسجيل الدخول';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authApi.post('/auth/register', userData);
      const { user, accessToken, refreshToken } = response.data;
      
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('refreshToken', refreshToken);
      localStorage.setItem('user', JSON.stringify(user));
      
      toast.success('تم إنشاء الحساب بنجاح!');
      return { user, accessToken, refreshToken };
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'فشل إنشاء الحساب';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { auth } = getState();
      if (auth.accessToken) {
        await authApi.post('/auth/logout', {
          refreshToken: localStorage.getItem('refreshToken')
        });
      }
      
      // Clear storage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      toast.success('تم تسجيل الخروج بنجاح');
      return true;
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local storage even if API fails
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      return rejectWithValue('فشل تسجيل الخروج');
    }
  }
);

export const verifyToken = createAsyncThunk(
  'auth/verifyToken',
  async (_, { rejectWithValue }) => {
    try {
      await authApi.get('/auth/verify');
      return true;
    } catch (error) {
      return rejectWithValue('انتهت صلاحية الجلسة');
    }
  }
);

export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (userData, { rejectWithValue }) => {
    try {
      const response = await authApi.put('/auth/profile', userData);
      const updatedUser = response.data;
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      toast.success('تم تحديث الملف الشخصي بنجاح');
      return updatedUser;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'فشل تحديث الملف الشخصي';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const changePassword = createAsyncThunk(
  'auth/changePassword',
  async ({ currentPassword, newPassword }, { rejectWithValue }) => {
    try {
      await authApi.put('/auth/change-password', {
        currentPassword,
        newPassword
      });
      toast.success('تم تغيير كلمة المرور بنجاح');
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'فشل تغيير كلمة المرور';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const forgotPassword = createAsyncThunk(
  'auth/forgotPassword',
  async (email, { rejectWithValue }) => {
    try {
      await authApi.post('/auth/forgot-password', { email });
      toast.success('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'فشل إرسال رابط إعادة التعيين';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

export const resetPassword = createAsyncThunk(
  'auth/resetPassword',
  async ({ token, newPassword }, { rejectWithValue }) => {
    try {
      await authApi.post('/auth/reset-password', {
        token,
        newPassword
      });
      toast.success('تم إعادة تعيين كلمة المرور بنجاح');
      return true;
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'فشل إعادة تعيين كلمة المرور';
      toast.error(errorMessage);
      return rejectWithValue(errorMessage);
    }
  }
);

// Initial state
const initialState = {
  user: null,
  accessToken: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  verificationRequired: false,
  roles: [],
  permissions: [],
};

// Auth Slice
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, accessToken, refreshToken } = action.payload;
      state.user = user;
      state.accessToken = accessToken;
      state.refreshToken = refreshToken;
      state.isAuthenticated = true;
      state.roles = user?.roles || [];
      state.permissions = user?.permissions || [];
    },
    clearError: (state) => {
      state.error = null;
    },
    setVerificationRequired: (state, action) => {
      state.verificationRequired = action.payload;
    },
    loadUserFromStorage: (state) => {
      const storedUser = localStorage.getItem('user');
      const accessToken = localStorage.getItem('accessToken');

      if (storedUser && accessToken) {
        try {
          state.user = JSON.parse(storedUser);
          state.accessToken = accessToken;
          state.refreshToken = localStorage.getItem('refreshToken');
          state.isAuthenticated = true;
          state.roles = state.user?.roles || [];
          state.permissions = state.user?.permissions || [];
        } catch (error) {
          console.error('Failed to parse stored user:', error);
          state.isAuthenticated = false;
        }
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // Login
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.roles = action.payload.user?.roles || [];
        state.permissions = action.payload.user?.permissions || [];
        state.error = null;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Register
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.refreshToken = action.payload.refreshToken;
        state.isAuthenticated = true;
        state.roles = action.payload.user?.roles || [];
        state.permissions = action.payload.user?.permissions || [];
        state.error = null;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Logout
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
        state.isLoading = false;
        state.roles = [];
        state.permissions = [];
        state.error = null;
        state.verificationRequired = false;
      })
      .addCase(logout.rejected, (state) => {
        state.isLoading = false;
      })
      
      // Verify Token
      .addCase(verifyToken.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(verifyToken.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(verifyToken.rejected, (state, action) => {
        state.isLoading = false;
        if (action.payload === 'انتهت صلاحية الجلسة') {
          state.user = null;
          state.accessToken = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
          state.roles = [];
          state.permissions = [];
        }
      })
      
      // Update Profile
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.error = null;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Change Password
      .addCase(changePassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(changePassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(changePassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Forgot Password
      .addCase(forgotPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(forgotPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(forgotPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // Reset Password
      .addCase(resetPassword.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetPassword.fulfilled, (state) => {
        state.isLoading = false;
        state.error = null;
      })
      .addCase(resetPassword.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// Export actions
export const { 
  setCredentials, 
  clearError, 
  setVerificationRequired,
  loadUserFromStorage 
} = authSlice.actions;

// Selectors
export const selectCurrentUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.isLoading;
export const selectAuthError = (state) => state.auth.error;
export const selectUserRoles = (state) => state.auth.roles;
export const selectUserPermissions = (state) => state.auth.permissions;
export const selectVerificationRequired = (state) => state.auth.verificationRequired;
export const selectAccessToken = (state) => state.auth.accessToken;

// Helper selectors
export const hasRole = (state, role) => {
  const roles = selectUserRoles(state);
  return Array.isArray(roles) && roles.includes(role);
};

export const hasPermission = (state, permission) => {
  const permissions = selectUserPermissions(state);
  return Array.isArray(permissions) && permissions.includes(permission);
};

// Custom hooks selector
export const useAuth = () => {
  return {
    user: selectCurrentUser,
    isAuthenticated: selectIsAuthenticated,
    isLoading: selectAuthLoading,
    error: selectAuthError,
    roles: selectUserRoles,
    permissions: selectUserPermissions,
    verificationRequired: selectVerificationRequired,
    hasRole: (role) => hasRole(role),
    hasPermission: (permission) => hasPermission(permission),
  };
};

// Export reducer
export default authSlice.reducer;

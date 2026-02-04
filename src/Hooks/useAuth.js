import { useSelector, useDispatch } from 'react-redux';
import { 
  selectCurrentUser,
  selectIsAuthenticated,
  selectAuthLoading,
  selectAuthError,
  selectUserRoles,
  selectUserPermissions,
  selectVerificationRequired,
  login,
  register,
  logout,
  updateProfile,
  verifyEmail,
  forgotPassword,
  resetPassword,
  clearError,
  setVerificationRequired,
  verifyToken
} from '../Store/slices/authSlice';

export const useAuth = () => {
  const dispatch = useDispatch();

  const user = useSelector(selectCurrentUser);
  const isAuthenticated = useSelector(selectIsAuthenticated);
  const isLoading = useSelector(selectAuthLoading);
  const error = useSelector(selectAuthError);
  const roles = useSelector(selectUserRoles);
  const permissions = useSelector(selectUserPermissions);
  const verificationRequired = useSelector(selectVerificationRequired);

  const loginUser = async (email, password, rememberMe = false) => {
    return dispatch(login({ email, password, rememberMe }));
  };

  const registerUser = async (userData) => {
    return dispatch(register(userData));
  };

  const logoutUser = async () => {
    return dispatch(logout());
  };

  const updateUserProfile = async (userData) => {
    return dispatch(updateProfile(userData));
  };

  const verifyUserEmail = async (code) => {
    return dispatch(verifyEmail({ code }));
  };

  const sendForgotPassword = async (email) => {
    return dispatch(forgotPassword(email));
  };

  const resetUserPassword = async (token, newPassword) => {
    return dispatch(resetPassword({ token, newPassword }));
  };

  const clearAuthError = () => {
    dispatch(clearError());
  };

  const setUserVerificationRequired = (required) => {
    dispatch(setVerificationRequired(required));
  };

  const verifyUserToken = async () => {
    return dispatch(verifyToken());
  };

  const hasRole = (role) => {
    return Array.isArray(roles) && roles.includes(role);
  };

  const hasPermission = (permission) => {
    return Array.isArray(permissions) && permissions.includes(permission);
  };

  // Check if user has any of the given roles
  const hasAnyRole = (roleArray) => {
    if (!Array.isArray(roles) || !Array.isArray(roleArray)) return false;
    return roleArray.some(role => roles.includes(role));
  };

  // Check if user has all of the given roles
  const hasAllRoles = (roleArray) => {
    if (!Array.isArray(roles) || !Array.isArray(roleArray)) return false;
    return roleArray.every(role => roles.includes(role));
  };

  return {
    // State
    user,
    isAuthenticated,
    isLoading,
    error,
    roles,
    permissions,
    verificationRequired,
    
    // Actions
    login: loginUser,
    register: registerUser,
    logout: logoutUser,
    updateProfile: updateUserProfile,
    verifyEmail: verifyUserEmail,
    forgotPassword: sendForgotPassword,
    resetPassword: resetUserPassword,
    clearError: clearAuthError,
    setVerificationRequired: setUserVerificationRequired,
    verifyToken: verifyUserToken,
    
    // Helpers
    hasRole,
    hasPermission,
    hasAnyRole,
    hasAllRoles,
    
    // Convenience checkers
    isAdmin: hasRole('admin'),
    isModerator: hasRole('moderator'),
    isUser: hasRole('user'),
    
    // User info shortcuts
    userId: user?.id,
    userName: user?.name || user?.username,
    userEmail: user?.email,
    userAvatar: user?.avatar,
  };
};

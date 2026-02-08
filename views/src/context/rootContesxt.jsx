import React, { createContext, useContext, useState, useCallback } from "react";
import Cookies from "js-cookie";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export const RootContext = createContext(null);

// API Configuration
const API_BASE_URL = "http://localhost:4000/api";

// Configure axios instance
export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor for adding token
api.interceptors.request.use(
  (config) => {
    const token = Cookies.get("accessToken");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor for handling token refresh
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const refreshToken = Cookies.get("refreshToken");
        if (!refreshToken) throw new Error("No refresh token");

        const response = await axios.post(
          `${API_BASE_URL}/auth/refresh-token`,
          { refreshToken },
        );

        const { accessToken, refreshToken: newRefreshToken } = response.data;

        Cookies.set("accessToken", accessToken, { expires: 1 });
        if (newRefreshToken) {
          Cookies.set("refreshToken", newRefreshToken, { expires: 7 });
        }

        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        Cookies.remove("accessToken");
        Cookies.remove("refreshToken");
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  },
);

export default function RootProvider({ children }) {
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [active, setActive] = useState(null);
  const [userInfo, setUserInfo] = useState(false);
  const navigate = useNavigate();

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearSuccessMessage = useCallback(() => {
    setSuccessMessage(null);
  }, []);

  // Load user from localStorage on mount
  React.useEffect(() => {
    const savedUser = localStorage.getItem("user");
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error("Error parsing user data:", err);
        localStorage.removeItem("user");
      }
    }
  }, []);

  // Create a logout function reference that can be used before it's fully defined
  const logoutRef = React.useRef(() => {
    // Clear all stored data
    Cookies.remove("accessToken");
    Cookies.remove("refreshToken");
    localStorage.removeItem("user");
    localStorage.removeItem("userId");
    localStorage.removeItem("resetEmail");
    setUser(null);
    setError(null);
    setSuccessMessage(null);

    // Navigate to login
    navigate("/login");
  });

  const login = useCallback(
    async (email, password) => {
      setLoading(true);
      clearError();
      clearSuccessMessage();

      try {
        const response = await axios.post(
          `${API_BASE_URL}/auth/login`,
          { email, password },
          {
            headers: {
              "Content-Type": "application/json",
            },
          },
        );

        const { data } = response;
        console.log(data);

        if (data.success) {
          // Store tokens if provided
          if (data.data?.accessToken) {
            Cookies.set("accessToken", data.data.accessToken, { expires: 1 });
          }
          if (data.data?.refreshToken) {
            Cookies.set("refreshToken", data.data.refreshToken, { expires: 7 });
          }

          // Store user data
          if (data.data?.user) {
            const userData = data.data.user;
            setUser(userData);
            localStorage.setItem("user", JSON.stringify(userData));

            if (data.isAuthenticated && userData.status === "ACTIVE") {
              switch (userData.user_type) {
                case "SUPER_ADMIN":
                  setActive(true);
                  navigate("/admin");
                  break;
                default:
                  setActive(false);
                  navigate("/user");
                  break;
              }
            }
          }
        } else {
          if (data.status === "PENDING_VERIFICATION") {
            navigate("/verify-email", { state: { email } });
          } else if (data.status === "USER_INFO") {
            navigate("/user-info");
          } else {
            setError(data.message || "Login failed");
          }
        }
      } catch (err) {
        console.error("Login error:", err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Login failed",
        );
      } finally {
        setLoading(false);
      }
    },
    [navigate, clearError, clearSuccessMessage],
  );

  const register = useCallback(
    async (userData) => {
      setLoading(true);
      clearError();
      clearSuccessMessage();

      try {
        console.log("Sending registration data:", userData);

        const response = await api.post("/auth/register", userData);
        const { data } = response;
        console.log("Registration response:", data);

        if (data.success) {
          // Store tokens if provided
          if (data.data?.token) {
            Cookies.set("accessToken", data.data.token, { expires: 1 });
          }
          if (data.data?.refreshToken) {
            Cookies.set("refreshToken", data.data.refreshToken, { expires: 7 });
          }

          // Store user data
          if (data.data?.user) {
            setUser(data.data.user);
            localStorage.setItem("user", JSON.stringify(data.data.user));
          }
          if (data.data?.userId) {
            localStorage.setItem("userId", data.data.userId);
          }

          // Navigate based on response
          if (data.data?.redirect) {
            navigate(data.data.redirect);
          } else if (data.data?.requiresVerification) {
            navigate("/verify-email", {
              state: {
                email: data.data.user?.email || userData.email,
                message: data.message || "تم إنشاء الحساب بنجاح",
              },
            });
          } else if (data.redirect) {
            navigate(data.redirect);
          } else {
            navigate("/verify-email", {
              state: {
                email: userData.email,
                message: data.message || "تم إنشاء الحساب بنجاح",
              },
            });
          }

          return { success: true, data };
        } else {
          // Handle backend validation errors
          if (data.errors) {
            setError("يوجد أخطاء في البيانات المدخلة");
            return {
              success: false,
              errors: data.errors,
              message: data.message,
            };
          } else {
            setError(data.message || "Registration failed");
            return { success: false, message: data.message };
          }
        }
      } catch (err) {
        console.error("Registration error:", err);

        // Handle different error formats
        let errorMessage = "Registration failed";
        let validationErrors = {};

        if (err.response?.data?.errors) {
          // Handle validation errors from backend
          validationErrors = err.response.data.errors;
          errorMessage = "يوجد أخطاء في البيانات المدخلة";
        } else if (err.response?.data?.message) {
          errorMessage = err.response.data.message;
        } else if (err.message) {
          errorMessage = err.message;
        }

        setError(errorMessage);
        return {
          success: false,
          message: errorMessage,
          errors: validationErrors,
          error: err,
        };
      } finally {
        setLoading(false);
      }
    },
    [navigate, clearError, clearSuccessMessage],
  );

  const verifyEmail = useCallback(
    async (email, verificationCode) => {
      setLoading(true);
      clearError();
      clearSuccessMessage();

      try {
        const response = await api.post("/auth/verify-email", {
          email,
          verificationCode,
        });
        const { data } = response;
        console.log("Verification response:", data);

        if (data.success) {
          // Store tokens if provided
          if (data.data?.accessToken) {
            Cookies.set("accessToken", data.data.accessToken, { expires: 1 });
          }
          if (data.data?.refreshToken) {
            Cookies.set("refreshToken", data.data.refreshToken, { expires: 7 });
          }

          // Store user data if provided
          if (data.data?.user) {
            setUser(data.data.user);
            localStorage.setItem("user", JSON.stringify(data.data.user));
          }

          // Navigate
          if (data.data?.redirect) {
            navigate(data.data.redirect, { replace: true });
          } else if (data.redirect) {
            navigate(data.redirect, { replace: true });
          } else {
            navigate("/login", { replace: true });
          }
          return { success: true, data };
        } else {
          setError(data.message || "Email verification failed");
          return { success: false, message: data.message };
        }
      } catch (err) {
        console.error("Verification error:", err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Email verification failed",
        );
        return {
          success: false,
          message: err.response?.data?.message || err.message,
        };
      } finally {
        setLoading(false);
      }
    },
    [navigate, clearError, clearSuccessMessage],
  );

  const sendVerificationCode = async (email) => {
    setLoading(true);
    clearError();
    clearSuccessMessage();

    try {
      const response = await api.post("/msg/verify-code", { email });
      const { data } = response;

      if (data.success) {
        setSuccessMessage(
          data.message || "Verification code sent successfully",
        );
        return { success: true, data };
      } else {
        setError(data.message || "Failed to send verification code");
        return { success: false, message: data.message };
      }
    } catch (err) {
      console.error("Send verification code error:", err);
      setError(
        err.response?.data?.message ||
          err.response?.data?.error ||
          err.message ||
          "Failed to send verification code",
      );
      return {
        success: false,
        message: err.response?.data?.message || err.message,
      };
    } finally {
      setLoading(false);
    }
  };

  const forgotPassword = useCallback(
    async (email) => {
      setLoading(true);
      clearError();
      clearSuccessMessage();

      try {
        const response = await api.post("/auth/forgot-password", { email });
        const { data } = response;
        console.log("Forgot password response:", data);

        if (data.success) {
          setSuccessMessage(
            data.message ||
              "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، ستتلقى رابط إعادة تعيين كلمة المرور",
          );

          // Store email for reset password page
          if (data.data?.emailSent) {
            localStorage.setItem("resetEmail", email);
          }

          return { success: true, data };
        } else {
          // For security, still show success message even if user doesn't exist
          if (data.code === "USER_NOT_FOUND") {
            setSuccessMessage(
              "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، ستتلقى رابط إعادة تعيين كلمة المرور",
            );
            return { success: true, data };
          }
          setError(data.message || "Failed to process password reset request");
          return { success: false, message: data.message };
        }
      } catch (err) {
        console.error("Forgot password error:", err);

        // For security, show generic success message even on error
        setSuccessMessage(
          "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، ستتلقى رابط إعادة تعيين كلمة المرور",
        );

        console.error("Actual error:", err.response?.data || err.message);

        return {
          success: true,
          message:
            "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، ستتلقى رابط إعادة تعيين كلمة المرور",
        };
      } finally {
        setLoading(false);
      }
    },
    [clearError, clearSuccessMessage],
  );

  const resetPassword = useCallback(
    async (token, password, confirmPassword) => {
      setLoading(true);
      clearError();
      clearSuccessMessage();

      try {
        const response = await api.post("/auth/reset-password", {
          token,
          password,
          confirmPassword,
        });
        const { data } = response;
        console.log("Reset password response:", data);

        if (data.success) {
          setSuccessMessage(data.message || "تم إعادة تعيين كلمة المرور بنجاح");

          // Clear any stored reset email
          localStorage.removeItem("resetEmail");

          // Navigate to login after a delay
          setTimeout(() => {
            navigate("/login", {
              state: {
                message: data.message || "تم إعادة تعيين كلمة المرور بنجاح",
              },
            });
          }, 2000);

          return { success: true, data };
        } else {
          setError(data.message || "Failed to reset password");
          return { success: false, message: data.message };
        }
      } catch (err) {
        console.error("Reset password error:", err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Failed to reset password",
        );
        return {
          success: false,
          message: err.response?.data?.message || err.message,
        };
      } finally {
        setLoading(false);
      }
    },
    [navigate, clearError, clearSuccessMessage],
  );

  const validateResetToken = useCallback(
    async (token) => {
      setLoading(true);
      clearError();

      try {
        const response = await api.get("/auth/validate-reset-token", {
          params: { token },
        });
        const { data } = response;
        console.log("Validate token response:", data);

        if (data.success) {
          return { success: true, data: data.data };
        } else {
          setError(data.message || "Invalid or expired token");
          return { success: false, message: data.message };
        }
      } catch (err) {
        console.error("Validate token error:", err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Invalid or expired token",
        );
        return {
          success: false,
          message: err.response?.data?.message || err.message,
        };
      } finally {
        setLoading(false);
      }
    },
    [clearError],
  );

  const changePassword = useCallback(
    async (currentPassword, newPassword, confirmPassword) => {
      setLoading(true);
      clearError();
      clearSuccessMessage();

      try {
        const response = await api.post("/auth/change-password", {
          currentPassword,
          newPassword,
          confirmPassword,
        });
        const { data } = response;
        console.log("Change password response:", data);

        if (data.success) {
          setSuccessMessage(data.message || "تم تغيير كلمة المرور بنجاح");

          // Clear tokens and force re-login if configured
          if (data.data?.sessionsInvalidated) {
            setTimeout(() => {
              logoutRef.current();
            }, 3000);
          }

          return { success: true, data };
        } else {
          setError(data.message || "Failed to change password");
          return { success: false, message: data.message };
        }
      } catch (err) {
        console.error("Change password error:", err);
        setError(
          err.response?.data?.message ||
            err.response?.data?.error ||
            err.message ||
            "Failed to change password",
        );
        return {
          success: false,
          message: err.response?.data?.message || err.message,
        };
      } finally {
        setLoading(false);
      }
    },
    [clearError, clearSuccessMessage],
  );

  // Define the actual logout function
  const logout = useCallback(() => {
    logoutRef.current();
  }, []);

  const value = {
    error,
    loading,
    user,
    active,
    userInfo,
    successMessage,
    clearError,
    clearSuccessMessage,
    login,
    register,
    verifyEmail,
    logout,
    sendVerificationCode,
    forgotPassword,
    resetPassword,
    validateResetToken,
    changePassword,
    isAuthenticated: !!Cookies.get("accessToken") || !!user,
  };

  return <RootContext.Provider value={value}>{children}</RootContext.Provider>;
}

export const useRoot = () => {
  const context = useContext(RootContext);
  if (!context) {
    throw new Error("useRoot must be used within RootProvider");
  }
  return context;
};

// import React, { createContext, useContext, useState, useCallback } from "react";
// import Cookies from "js-cookie";
// import axios from "axios";
// import { useNavigate } from "react-router-dom";

// export const RootContext = createContext(null);

// // API Configuration
// const API_BASE_URL = "http://localhost:4000/api";

// // Configure axios instance
// export const api = axios.create({
//   baseURL: API_BASE_URL,
//   headers: {
//     "Content-Type": "application/json",
//   },
// });

// // Request interceptor for adding token
// api.interceptors.request.use(
//   (config) => {
//     const token = Cookies.get("accessToken");
//     if (token) {
//       config.headers.Authorization = `Bearer ${token}`;
//     }
//     return config;
//   },
//   (error) => Promise.reject(error),
// );

// // Response interceptor for handling token refresh
// api.interceptors.response.use(
//   (response) => response,
//   async (error) => {
//     const originalRequest = error.config;

//     if (error.response?.status === 401 && !originalRequest._retry) {
//       originalRequest._retry = true;

//       try {
//         const refreshToken = Cookies.get("refreshToken");
//         if (!refreshToken) throw new Error("No refresh token");

//         const response = await axios.post(
//           `${API_BASE_URL}/auth/refresh-token`,
//           { refreshToken },
//         );

//         const { accessToken, refreshToken: newRefreshToken } = response.data;

//         Cookies.set("accessToken", accessToken, { expires: 1 });
//         if (newRefreshToken) {
//           Cookies.set("refreshToken", newRefreshToken, { expires: 7 });
//         }

//         originalRequest.headers.Authorization = `Bearer ${accessToken}`;
//         return api(originalRequest);
//       } catch (refreshError) {
//         Cookies.remove("accessToken");
//         Cookies.remove("refreshToken");
//         window.location.href = "/login";
//         return Promise.reject(refreshError);
//       }
//     }

//     return Promise.reject(error);
//   },
// );

// export default function RootProvider({ children }) {
//   const [error, setError] = useState(null);
//   const [loading, setLoading] = useState(false);
//   const [user, setUser] = useState(null);
//   const [successMessage, setSuccessMessage] = useState(null);
//   const [active, setActive] = useState(null);
//   const [userInfo, setUserInfo] = useState(false);
//   const navigate = useNavigate();

//   const clearError = useCallback(() => {
//     setError(null);
//   }, []);

//   const clearSuccessMessage = useCallback(() => {
//     setSuccessMessage(null);
//   }, []);

//   // Load user from localStorage on mount
//   React.useEffect(() => {
//     const savedUser = localStorage.getItem("user");
//     if (savedUser) {
//       try {
//         setUser(JSON.parse(savedUser));
//       } catch (err) {
//         console.error("Error parsing user data:", err);
//         localStorage.removeItem("user");
//       }
//     }
//   }, []);

//   const login = useCallback(
//     async (email, password) => {
//       setLoading(true);
//       clearError();
//       clearSuccessMessage();

//       try {
//         const response = await api.post("/auth/login", { email, password });
//         const { data } = response;

//         if (data.success) {
//           // Store tokens if provided
//           if (data.data?.accessToken) {
//             Cookies.set("accessToken", data.data.accessToken, { expires: 1 });
//           }
//           if (data.data?.refreshToken) {
//             Cookies.set("refreshToken", data.data.refreshToken, { expires: 7 });
//           }

//           // Store user data
//           if (data.data?.user) {
//             setUser(data.data.user);
//             localStorage.setItem("user", JSON.stringify(data.data.user));
//           }

//           if (data.isAuthenticated && user.status === "ACTIVE") {
//             switch (data.user_type) {
//               case "SUPER_ADMIN":
//                 setActive(true);
//                 navigate("/admin");
//                 break;
//               default:
//                 setActive(false);
//                 navigate("/user");
//                 break;
//             }
//           }
//         } else {
//           if (data.status === "PENDING_VERIFICATION") {
//             navigate("/verify-email", { state: { email } });
//           } else if (data.status === "USER_INFO") {
//             navigate("/user-info");
//           } else {
//             setError(data.message || "Login failed");
//           }
//         }
//       } catch (err) {
//         console.error("Login error:", err);
//         setError(
//           err.response?.data?.message ||
//             err.response?.data?.error ||
//             err.message ||
//             "Login failed",
//         );
//       } finally {
//         setLoading(false);
//       }
//     },
//     [navigate, clearError, clearSuccessMessage],
//   );

//   const register = useCallback(
//     async (userData) => {
//       setLoading(true);
//       clearError();
//       clearSuccessMessage();

//       try {
//         console.log("Sending registration data:", userData);

//         const response = await api.post("/auth/register", userData);
//         const { data } = response;
//         console.log("Registration response:", data);

//         if (data.success) {
//           // Store tokens if provided
//           if (data.data?.token) {
//             Cookies.set("accessToken", data.data.token, { expires: 1 });
//           }
//           if (data.data?.refreshToken) {
//             Cookies.set("refreshToken", data.data.refreshToken, { expires: 7 });
//           }

//           // Store user data
//           if (data.data?.user) {
//             setUser(data.data.user);
//             localStorage.setItem("user", JSON.stringify(data.data.user));
//           }
//           if (data.data?.userId) {
//             localStorage.setItem("userId", data.data.userId);
//           }

//           // Navigate based on response
//           if (data.data?.redirect) {
//             navigate(data.data.redirect);
//           } else if (data.data?.requiresVerification) {
//             navigate("/verify-email", {
//               state: {
//                 email: data.data.user?.email || userData.email,
//                 message: data.message || "تم إنشاء الحساب بنجاح",
//               },
//             });
//           } else if (data.redirect) {
//             navigate(data.redirect);
//           } else {
//             navigate("/verify-email", {
//               state: {
//                 email: userData.email,
//                 message: data.message || "تم إنشاء الحساب بنجاح",
//               },
//             });
//           }

//           return { success: true, data };
//         } else {
//           // Handle backend validation errors
//           if (data.errors) {
//             setError("يوجد أخطاء في البيانات المدخلة");
//             return {
//               success: false,
//               errors: data.errors,
//               message: data.message,
//             };
//           } else {
//             setError(data.message || "Registration failed");
//             return { success: false, message: data.message };
//           }
//         }
//       } catch (err) {
//         console.error("Registration error:", err);

//         // Handle different error formats
//         let errorMessage = "Registration failed";
//         let validationErrors = {};

//         if (err.response?.data?.errors) {
//           // Handle validation errors from backend
//           validationErrors = err.response.data.errors;
//           errorMessage = "يوجد أخطاء في البيانات المدخلة";
//         } else if (err.response?.data?.message) {
//           errorMessage = err.response.data.message;
//         } else if (err.message) {
//           errorMessage = err.message;
//         }

//         setError(errorMessage);
//         return {
//           success: false,
//           message: errorMessage,
//           errors: validationErrors,
//           error: err,
//         };
//       } finally {
//         setLoading(false);
//       }
//     },
//     [navigate, clearError, clearSuccessMessage],
//   );

//   const verifyEmail = useCallback(
//     async (email, verificationCode) => {
//       setLoading(true);
//       clearError();
//       clearSuccessMessage();

//       try {
//         const response = await api.post("/auth/verify-email", {
//           email,
//           verificationCode,
//         });
//         const { data } = response;
//         console.log("Verification response:", data);

//         if (data.success) {
//           // Store tokens if provided
//           if (data.data?.accessToken) {
//             Cookies.set("accessToken", data.data.accessToken, { expires: 1 });
//           }
//           if (data.data?.refreshToken) {
//             Cookies.set("refreshToken", data.data.refreshToken, { expires: 7 });
//           }

//           // Store user data if provided
//           if (data.data?.user) {
//             setUser(data.data.user);
//             localStorage.setItem("user", JSON.stringify(data.data.user));
//           }

//           // Navigate
//           if (data.data?.redirect) {
//             navigate(data.data.redirect, { replace: true });
//           } else if (data.redirect) {
//             navigate(data.redirect, { replace: true });
//           } else {
//             navigate("/login", { replace: true });
//           }
//           return { success: true, data };
//         } else {
//           setError(data.message || "Email verification failed");
//           return { success: false, message: data.message };
//         }
//       } catch (err) {
//         console.error("Verification error:", err);
//         setError(
//           err.response?.data?.message ||
//             err.response?.data?.error ||
//             err.message ||
//             "Email verification failed",
//         );
//         return {
//           success: false,
//           message: err.response?.data?.message || err.message,
//         };
//       } finally {
//         setLoading(false);
//       }
//     },
//     [navigate, clearError, clearSuccessMessage],
//   );

//   const sendVerificationCode = async (email) => {
//     setLoading(true);
//     clearError();
//     clearSuccessMessage();

//     try {
//       const response = await api.post("/msg/verify-code", { email });
//       const { data } = response;

//       if (data.success) {
//         setSuccessMessage(
//           data.message || "Verification code sent successfully",
//         );
//         return { success: true, data };
//       } else {
//         setError(data.message || "Failed to send verification code");
//         return { success: false, message: data.message };
//       }
//     } catch (err) {
//       console.error("Send verification code error:", err);
//       setError(
//         err.response?.data?.message ||
//           err.response?.data?.error ||
//           err.message ||
//           "Failed to send verification code",
//       );
//       return {
//         success: false,
//         message: err.response?.data?.message || err.message,
//       };
//     } finally {
//       setLoading(false);
//     }
//   };

//   const forgotPassword = useCallback(
//     async (email) => {
//       setLoading(true);
//       clearError();
//       clearSuccessMessage();

//       try {
//         const response = await api.post("/auth/forgot-password", { email });
//         const { data } = response;
//         console.log("Forgot password response:", data);

//         if (data.success) {
//           setSuccessMessage(
//             data.message ||
//               "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، ستتلقى رابط إعادة تعيين كلمة المرور",
//           );

//           // Store email for reset password page
//           if (data.data?.emailSent) {
//             // You can store the email in localStorage or state if needed
//             localStorage.setItem("resetEmail", email);
//           }

//           return { success: true, data };
//         } else {
//           // For security, still show success message even if user doesn't exist
//           if (data.code === "USER_NOT_FOUND") {
//             setSuccessMessage(
//               "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، ستتلقى رابط إعادة تعيين كلمة المرور",
//             );
//             return { success: true, data };
//           }
//           setError(data.message || "Failed to process password reset request");
//           return { success: false, message: data.message };
//         }
//       } catch (err) {
//         console.error("Forgot password error:", err);

//         // For security, show generic success message even on error
//         setSuccessMessage(
//           "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، ستتلقى رابط إعادة تعيين كلمة المرور",
//         );

//         // Log the actual error for debugging
//         console.error("Actual error:", err.response?.data || err.message);

//         return {
//           success: true, // Return success for security reasons
//           message:
//             "إذا كان هناك حساب مرتبط بهذا البريد الإلكتروني، ستتلقى رابط إعادة تعيين كلمة المرور",
//         };
//       } finally {
//         setLoading(false);
//       }
//     },
//     [clearError, clearSuccessMessage],
//   );

//   const resetPassword = useCallback(
//     async (token, password, confirmPassword) => {
//       setLoading(true);
//       clearError();
//       clearSuccessMessage();

//       try {
//         const response = await api.post("/auth/reset-password", {
//           token,
//           password,
//           confirmPassword,
//         });
//         const { data } = response;
//         console.log("Reset password response:", data);

//         if (data.success) {
//           setSuccessMessage(data.message || "تم إعادة تعيين كلمة المرور بنجاح");

//           // Clear any stored reset email
//           localStorage.removeItem("resetEmail");

//           // Navigate to login after a delay
//           setTimeout(() => {
//             navigate("/login", {
//               state: {
//                 message: data.message || "تم إعادة تعيين كلمة المرور بنجاح",
//               },
//             });
//           }, 2000);

//           return { success: true, data };
//         } else {
//           setError(data.message || "Failed to reset password");
//           return { success: false, message: data.message };
//         }
//       } catch (err) {
//         console.error("Reset password error:", err);
//         setError(
//           err.response?.data?.message ||
//             err.response?.data?.error ||
//             err.message ||
//             "Failed to reset password",
//         );
//         return {
//           success: false,
//           message: err.response?.data?.message || err.message,
//         };
//       } finally {
//         setLoading(false);
//       }
//     },
//     [navigate, clearError, clearSuccessMessage],
//   );

//   const validateResetToken = useCallback(
//     async (token) => {
//       setLoading(true);
//       clearError();

//       try {
//         const response = await api.get("/auth/validate-reset-token", {
//           params: { token },
//         });
//         const { data } = response;
//         console.log("Validate token response:", data);

//         if (data.success) {
//           return { success: true, data: data.data };
//         } else {
//           setError(data.message || "Invalid or expired token");
//           return { success: false, message: data.message };
//         }
//       } catch (err) {
//         console.error("Validate token error:", err);
//         setError(
//           err.response?.data?.message ||
//             err.response?.data?.error ||
//             err.message ||
//             "Invalid or expired token",
//         );
//         return {
//           success: false,
//           message: err.response?.data?.message || err.message,
//         };
//       } finally {
//         setLoading(false);
//       }
//     },
//     [clearError],
//   );

//   const changePassword = useCallback(
//     async (currentPassword, newPassword, confirmPassword) => {
//       setLoading(true);
//       clearError();
//       clearSuccessMessage();

//       try {
//         const response = await api.post("/auth/change-password", {
//           currentPassword,
//           newPassword,
//           confirmPassword,
//         });
//         const { data } = response;
//         console.log("Change password response:", data);

//         if (data.success) {
//           setSuccessMessage(data.message || "تم تغيير كلمة المرور بنجاح");

//           // Clear tokens and force re-login if configured
//           if (data.data?.sessionsInvalidated) {
//             // Optional: Logout and force re-login
//             setTimeout(() => {
//               logout();
//             }, 3000);
//           }

//           return { success: true, data };
//         } else {
//           setError(data.message || "Failed to change password");
//           return { success: false, message: data.message };
//         }
//       } catch (err) {
//         console.error("Change password error:", err);
//         setError(
//           err.response?.data?.message ||
//             err.response?.data?.error ||
//             err.message ||
//             "Failed to change password",
//         );
//         return {
//           success: false,
//           message: err.response?.data?.message || err.message,
//         };
//       } finally {
//         setLoading(false);
//       }
//     },
//     [clearError, clearSuccessMessage, logout],
//   );

//   const logout = useCallback(() => {
//     // Clear all stored data
//     Cookies.remove("accessToken");
//     Cookies.remove("refreshToken");
//     localStorage.removeItem("user");
//     localStorage.removeItem("userId");
//     localStorage.removeItem("resetEmail");
//     setUser(null);
//     setError(null);
//     setSuccessMessage(null);

//     // Navigate to login
//     navigate("/login");
//   }, [navigate]);

//   const value = {
//     error,
//     loading,
//     user,
//     active,
//     userInfo,
//     successMessage,
//     clearError,
//     clearSuccessMessage,
//     login,
//     register,
//     verifyEmail,
//     logout,
//     sendVerificationCode,
//     forgotPassword,
//     resetPassword,
//     validateResetToken,
//     changePassword,
//     isAuthenticated: !!Cookies.get("accessToken") || !!user,
//   };

//   return <RootContext.Provider value={value}>{children}</RootContext.Provider>;
// }

// export const useRoot = () => {
//   const context = useContext(RootContext);
//   if (!context) {
//     throw new Error("useRoot must be used within RootProvider");
//   }
//   return context;
// };

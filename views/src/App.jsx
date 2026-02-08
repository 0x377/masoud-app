import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

// Layouts
import AuthLayout from "./pages/layouts/AuthLayout";
import UserLayout from "./pages/layouts/UserLayout.jsx";
import AdminLayout from "./pages/layouts/AdminLayout.jsx";

// Auth Pages
import Login from "./pages/auth/Login/Login.jsx";
import Register from "./pages/auth/Register/Register.jsx";
import VerifyEmail from "./pages/auth/VerifyEmail/VerifyEmail.jsx";
import ForgotPassword from "./pages/auth/ForgotPassword/ForgotPassword.jsx";
import ResetPassword from "./pages/auth/ResetPassword/ResetPassword.jsx";
import UserInfo from "./pages/user-info/userInfo.jsx";

// Admin Pages

// User Pages
import Donation from "./pages/sections/donation.jsx";
import Board from "./pages/sections/board/board";
import Waqf from "./pages/sections/waqf";
import Archive from "./pages/sections/archive/archive";
import Executive from "./pages/sections/executive";
import Financial from "./pages/sections/financial";
import Social from "./pages/sections/social";
import Cultural from "./pages/sections/cultural";
import Reconciliation from "./pages/sections/reconciliation";
import Sports from "./pages/sections/sports";
import { useRoot } from "./context/rootContesxt.jsx";

export default function App() {
  const { active, userInfo, isAuthenticated } = useRoot();

  const NotFound = () => {
    return (
      <div className="notFound">
        <h1 data-text="404">404</h1>
        <p>Oops! page not found...</p>
        <a href="/donation">Go Home</a>
      </div>
    );
  };

  return (
    <>
      <Toaster position="top-right" reverseOrder={false} />
      <Routes>
        {/* Public/Auth Routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />
        </Route>

        {/* User Info Route (Conditional) */}
        <Route element={<AuthLayout />}>
          <Route
            path="/user-info"
            element={userInfo ? <UserInfo /> : <Navigate to="/login" />}
          />
        </Route>

        {/* User Routes */}
        <Route element={<UserLayout />}>
          <Route path="/" element={<Donation />} />
          <Route path="/donation" element={<Donation />} />

          {/* Protected User Routes */}
          <Route
            path="/board"
            element={
              !active && isAuthenticated ? <Board /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/waqf"
            element={
              !active && isAuthenticated ? <Waqf /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/archive"
            element={
              !active && isAuthenticated ? (
                <Archive />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/executive"
            element={
              !active && isAuthenticated ? (
                <Executive />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/financial"
            element={
              !active && isAuthenticated ? (
                <Financial />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/social"
            element={
              !active && isAuthenticated ? <Social /> : <Navigate to="/login" />
            }
          />
          <Route
            path="/cultural"
            element={
              !active && isAuthenticated ? (
                <Cultural />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/reconciliation"
            element={
              !active && isAuthenticated ? (
                <Reconciliation />
              ) : (
                <Navigate to="/login" />
              )
            }
          />
          <Route
            path="/sports"
            element={
              !active && isAuthenticated ? <Sports /> : <Navigate to="/login" />
            }
          />
        </Route>

        {/* Admin Route */}
        <Route
          path="/admin"
          element={
            active && isAuthenticated ? (
              <AdminLayout />
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route index element={<Donation />} />
        </Route>

        {/* Default Route */}
        {/* <Route 
          path="/" 
          element={
            isAuthenticated ? (
              active ? <Navigate to="/admin" /> : <Navigate to="/donation" />
            ) : (
              <Navigate to="/login" />
            )
          } 
        /> */}

        {/* Catch-all 404 Route */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}

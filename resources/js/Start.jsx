import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";

import Login from "./Pages/Auth/Login/Login";
import Register from "./Pages/Auth/Register/Register";
import VerifyEmail from "./Pages/Auth/VerifyEmail/VerifyEmail";
import ResetPassword from "./Pages/Auth/ResetPassword/ResetPassword";
import ForgotPassword from "./Pages/Auth/ForgotPassword/ForgotPassword";
import Layout from "./Pages/Layout/Layout";
import Donation from "./Pages/Sections/donation";

export default function StartApp() {
  const [action] = useState(false);

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Donation />} />
        {action && <Route path="/sports" />}
      </Route>
    </Routes>
  );
}

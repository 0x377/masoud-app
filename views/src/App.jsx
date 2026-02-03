import React, { useState } from "react";
import { Routes, Route } from "react-router-dom";

import Login from "./Pages/Auth/Login/Login";
import Register from "./Pages/Auth/Register/Register";
import VerifyEmail from "./Pages/Auth/VerifyEmail/VerifyEmail";
import ResetPassword from "./Pages/Auth/ResetPassword/ResetPassword";
import ForgotPassword from "./Pages/Auth/ForgotPassword/ForgotPassword";
import Layout from "./Pages/Layout/Layout";

// Sections
import Donation from "./Pages/Sections/donation";
import Board from "./Pages/Sections/board/board";
import Waqf from "./Pages/Sections/waqf";
import Archive from "./Pages/Sections/archive/archive";
import Executive from "./Pages/Sections/executive";
import Financial from "./Pages/Sections/financial";
import Social from "./Pages/Sections/social";
import Cultural from "./Pages/Sections/cultural";
import Reconciliation from "./Pages/Sections/reconciliation";
import Sports from "./Pages/Sections/sports";

export default function App() {
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
        <Route path="/" element={<Board />} />
        {action && (
          <>
            <Route path="/board" element={<Board />} />
            <Route path="/waqf" element={<Waqf />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/executive" element={<Executive />} />
            <Route path="/financial" element={<Financial />} />
            <Route path="/social" element={<Social />} />
            <Route path="/cultural" element={<Cultural />} />
            <Route path="/reconciliation" element={<Reconciliation />} />
            <Route path="/sports" element={<Sports />} />
          </>
        )}
      </Route>
    </Routes>
  );
}

/*

admin

table منصة التبرعات
table member of مجلس الادارة



users table
 - id primary key
 - full name
 - email
 - password
 - gender
 - phone number
 - is active
 - tooken
 - auth
 - 


 create 10 tables
 







*/

import React from "react";
import { Routes, Route } from "react-router-dom";


// import Header from "./Components/Header/Header";
// import { Container } from "react-bootstrap";
// import Sidebar from "./Components/Sidebar/Sidebar";
import Login from "./Pages/Auth/Login/Login";
import Register from "./Pages/Auth/Register/Register";
import VerifyEmail from "./Pages/Auth/VerifyEmail/VerifyEmail";
import ResetPassword from "./Pages/Auth/ResetPassword/ResetPassword";
import ForgotPassword from "./Pages/Auth/ForgotPassword/ForgotPassword";
import Home from "./Pages/Home/Home";


export default function App() {
  return(
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={<Home />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/verify-email" element={<VerifyEmail />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password/:token" element={<ResetPassword />} />
    </Routes>
  );
}

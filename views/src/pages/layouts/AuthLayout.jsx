import React from "react";
import { Outlet } from "react-router-dom";

const authLayoutStyle = {
  width: "100vw",
  minHeight: "100vh",
  backgroundColor: "#fef2f2",
  padding: "40px",
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
};

const AuthLayout = () => {
  return (
    <div style={authLayoutStyle}>
      <Outlet />
    </div>
  );
};

export default AuthLayout;

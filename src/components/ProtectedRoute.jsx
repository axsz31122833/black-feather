import React from "react";
import { Navigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";

function ProtectedRoute({ children, role, allowedRoles }) {
  const { user } = useApp();
  const devBypass = String(import.meta.env.VITE_DEV_BYPASS_AUTH || "").toLowerCase();
  const devEnabled = devBypass === "true" || devBypass === "1" || devBypass === "yes";

  if (!user) {
    if (devEnabled) return children;
    return <Navigate to="/login" replace />;
  }

  const hasAccess = () => {
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (user.role === "super_admin") return true;
      return allowedRoles.includes(user.role);
    }
    if (user.role === "super_admin") return true;
    if (role) return user.role === role;
    return true;
  };

  if (!hasAccess()) {
    switch (user.role) {
      case "passenger":
      case "passenger":
        return <Navigate to="/passenger" replace />;
      case "driver":
        return <Navigate to="/driver" replace />;
      case "admin":
        return <Navigate to="/admin" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;

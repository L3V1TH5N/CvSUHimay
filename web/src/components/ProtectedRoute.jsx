// file path: web/src/components/ProtectedRoute.jsx

import { useContext } from "react";
import { Navigate } from "react-router-dom";
import { AppContext } from "../context/AppContext";

// allowAnyStatus: if true, lets pending/rejected users through (used for /pending-approval)
const ProtectedRoute = ({ children, allowedRoles, allowAnyStatus = false }) => {
  const { user, loading } = useContext(AppContext);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) return <Navigate to="/signin" replace />;

  // Block non-active accounts from all dashboards unless explicitly allowed
  if (!allowAnyStatus && user.account_status !== 'active') {
    return <Navigate to="/pending-approval" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
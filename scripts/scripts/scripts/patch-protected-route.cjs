// Patch ProtectedRoute.jsx with correct dev bypass and role-based redirects
// Usage: node scripts/scripts/patch-protected-route.cjs
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..', '..');
const targetPath = path.join(projectRoot, 'src', 'components', 'ProtectedRoute.jsx');

const code = `import React from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';

function ProtectedRoute({ children, role, allowedRoles }) {
  const { user } = useApp();
  const devBypass = String(import.meta.env.VITE_DEV_BYPASS_AUTH || '').toLowerCase();
  const devEnabled = devBypass === 'true' || devBypass === '1' || devBypass === 'yes';

  // If no user, allow dev bypass, otherwise redirect to login
  if (!user) {
    if (devEnabled) return children;
    return <Navigate to="/login" replace />;
  }

  // Evaluate access based on provided allowedRoles or specific role
  const hasAccess = () => {
    if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
      if (user.role === 'super_admin') return true;
      return allowedRoles.includes(user.role);
    }
    if (user.role === 'super_admin') return true;
    if (role) return user.role === role;
    return true;
  };

  // If no access, redirect based on role
  if (!hasAccess()) {
    switch (user.role) {
      case 'passenger':
        return <Navigate to="/passenger" replace />;
      case 'driver':
        return <Navigate to="/driver" replace />;
      case 'admin':
        return <Navigate to="/admin" replace />;
      default:
        return <Navigate to="/login" replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
`;

fs.mkdirSync(path.dirname(targetPath), { recursive: true });
fs.writeFileSync(targetPath, code, 'utf8');
console.log('Patched ProtectedRoute.jsx');
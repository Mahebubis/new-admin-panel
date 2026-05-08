// import { Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../hooks/useAuth';

// export default function ProtectedRoute({ children, permission }) {
//   const { isAuthenticated, hasPermission } = useAuth();
//   const location = useLocation();

//   if (!isAuthenticated) {
//     return <Navigate to="/login" state={{ from: location }} replace />;
//   }

//   if (permission && !hasPermission(permission)) {
//     return (
//       <div className="flex items-center justify-center min-h-[60vh]">
//         <div className="text-center">
//           <div className="text-6xl mb-4">🔒</div>
//           <h2 className="text-xl font-bold text-gray-800 mb-2">Access Denied</h2>
//           <p className="text-gray-500">You don't have permission to view this page.</p>
//         </div>
//       </div>
//     );
//   }

//   return children;
// }



import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

/**
 * Only enforces authentication.
 * Per-page permission checks are handled by <PermissionGate>.
 */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}
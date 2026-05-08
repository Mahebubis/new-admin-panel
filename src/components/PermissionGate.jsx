import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import RestrictedPopup from './RestrictedPopup';

/**
 * Wrap any route element with this to gate access by permission key.
 *
 *   <PermissionGate perm="all_students"><AllStudents /></PermissionGate>
 *
 * - Superadmin bypasses all checks.
 * - Dashboard ('/' / perm="dashboard") is always open (handled in useAuth).
 * - If user lacks permission: shows a branded "Access Restricted" popup
 *   and silently redirects to dashboard in the background so the user is
 *   never stranded on a blank page.
 *
 * Props:
 *   perm            : permission key required
 *   superadminOnly  : only superadmin allowed (e.g. /permissions page)
 *   children        : the actual page element
 */
export default function PermissionGate({ perm, superadminOnly = false, children }) {
  const { hasPermission, isSuperadmin } = useAuth();
  const navigate = useNavigate();
  const [showPopup, setShowPopup] = useState(false);

  const denied = superadminOnly
    ? !isSuperadmin
    : perm
      ? !hasPermission(perm)
      : false;

  useEffect(() => {
    if (denied) {
      setShowPopup(true);
    } else {
      setShowPopup(false);
    }
  }, [denied, perm, superadminOnly]);

  const handleClose = () => {
    setShowPopup(false);
    navigate('/', { replace: true });
  };

  const handleHome = () => {
    setShowPopup(false);
    navigate('/', { replace: true });
  };

  if (denied) {
    return (
      <>
        {/* subtle blurred placeholder behind the popup */}
        <div
          className="flex items-center justify-center"
          style={{ minHeight: '60vh', filter: 'blur(2px)', opacity: 0.4 }}
          aria-hidden="true"
        >
          <div className="text-center">
            <div style={{ fontSize: 48 }}>🔒</div>
            <p style={{ color: '#64748b', marginTop: 8 }}>Restricted area</p>
          </div>
        </div>

        <RestrictedPopup
          open={showPopup}
          onClose={handleClose}
          onHome={handleHome}
          permission={superadminOnly ? 'superadmin_only' : perm}
          title={superadminOnly ? 'Super Admin Only' : 'Access Restricted'}
          message={
            superadminOnly
              ? 'This section is reserved for Super Admins only. Please contact a Super Admin if you believe you need access.'
              : "You don't have permission to view this page. Please contact a Super Admin to request access."
          }
        />
      </>
    );
  }

  return children;
}
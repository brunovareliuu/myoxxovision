import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { auth } from '../firebase';

const ProtectedRoute = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    // Check localStorage first for session persistence
    const sessionToken = localStorage.getItem('oxxoSessionToken');
    
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (user) {
        // User is signed in, store token in localStorage
        localStorage.setItem('oxxoSessionToken', 'true');
        localStorage.setItem('oxxoUserId', user.uid);
        setAuthenticated(true);
      } else if (sessionToken) {
        // If we have a token but Firebase doesn't recognize user,
        // try to keep the session alive instead of immediate logout
        setAuthenticated(true);
        // Optionally attempt to refresh the Firebase auth silently here
      } else {
        // No user and no session token
        localStorage.removeItem('oxxoSessionToken');
        localStorage.removeItem('oxxoUserId');
        setAuthenticated(false);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="loading-container">
        <p>Cargando...</p>
      </div>
    );
  }

  if (!authenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;

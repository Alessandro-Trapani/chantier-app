import { Navigate } from "react-router-dom";
import { useEffect } from "react";

function ProtectedRoute({ element, isAuthenticated }) {
  // This effect is not strictly necessary for the redirect logic itself,
  // but can be useful for debugging or adding side effects when auth status changes.
  // useEffect(() => {
  //   console.log('ProtectedRoute - isAuthenticated:', isAuthenticated);
  // }, [isAuthenticated]);

  if (isAuthenticated) {
    // If authenticated, render the provided element (the target page component)
    return element;
  } else {
    // If not authenticated, redirect to the login page.
    // 'replace' ensures the login page replaces the current history entry,
    // so the user can't go back to the protected page using the browser back button.
    return <Navigate to="/login" replace />;
  }
}

export default ProtectedRoute;

import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { useState, useEffect } from "react";

import Chantiers from "./Chantiers";
import AddChantier from "./AddChantier";
import Chantier from "./Chantier";

import LoginPage from "./LoginPage";
import ProtectedRoute from "./ProtectedRoute";
import DailySummary from "./DailySummary";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem("isAuthenticated") === "true"
  );

  const setAuthStatus = (status) => {
    setIsAuthenticated(status);
    if (status) {
      localStorage.setItem("isAuthenticated", "true");
    } else {
      localStorage.removeItem("isAuthenticated");
    }
  };

  return (
    // Ensure basename is correct for your deployment path
    <Router basename="/chantier-app">
      <Routes>
        <Route
          path="/login"
          element={<LoginPage setIsAuthenticated={setAuthStatus} />}
        />

        <Route
          path="/chantiers"
          element={
            <ProtectedRoute
              element={<Chantiers />}
              isAuthenticated={isAuthenticated}
            />
          }
        />
        <Route
          path="/add-chantier"
          element={
            <ProtectedRoute
              element={<AddChantier />}
              isAuthenticated={isAuthenticated}
            />
          }
        />
        <Route
          path="/chantier/:id/daily"
          element={
            <ProtectedRoute
              element={<DailySummary />}
              isAuthenticated={isAuthenticated}
            />
          }
        />
        <Route
          path="/chantier/:id"
          element={
            <ProtectedRoute
              element={<Chantier />}
              isAuthenticated={isAuthenticated}
            />
          }
        />

        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Navigate to="/chantiers" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        <Route
          path="*"
          element={
            isAuthenticated ? (
              <Navigate to="/chantiers" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;

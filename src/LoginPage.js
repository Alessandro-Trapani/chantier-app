import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./supabaseClient"; // Assuming supabaseClient.js is in the same directory

// IMPORTANT SECURITY WARNING:
// Storing and querying plain text passwords from the client is HIGHLY INSECURE.
// For production, use Supabase's built-in auth (auth.signInWithPassword)
// or implement secure server-side password verification.
// This example is ONLY to fulfill the user's specific request while demonstrating how to query.

function LoginPage({ setIsAuthenticated }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault(); // Prevent default form submission
    setLoading(true);
    setError(null); // Clear previous errors

    // --- START OF INSECURE LOGIN LOGIC ---
    // This directly queries your custom table for username and password.
    // DO NOT USE THIS IN PRODUCTION WITHOUT PROPER SECURITY MEASURES.
    try {
      // Replace 'your_users_table' with the actual name of your table
      // This query is INSECURE as it exposes password checking logic client-side.
      const { data, error } = await supabase
        .from("users") // <<< REPLACE 'users' with your actual table name if it's different
        .select("user_id") // Assuming your user ID column is named 'user_id'
        .eq("username", username)
        .eq("password", password) // <<< Querying plain text password - INSECURE!
        .single(); // Expecting at most one match

      if (error && error.code !== "PGRST116") {
        // PGRST116 is 'No rows found'
        throw error;
      }

      if (data) {
        // User found - authentication successful
        // Store user ID (optional, but often useful)
        localStorage.setItem("user_id", data.user_id);
        // Set authentication status
        setIsAuthenticated(true); // Update state in App.js and localStorage via the passed function
        navigate("/chantiers"); // Redirect to the chantiers page
      } else {
        // No user found with those credentials
        setError("Invalid username or password");
      }
    } catch (err) {
      console.error("Login error:", err);
      setError(err.message || "An error occurred during login");
    } finally {
      setLoading(false);
    }
    // --- END OF INSECURE LOGIN LOGIC ---
  };

  return (
    // Apply the login-container class
    <div className="login-container">
      <h2>Login</h2>
      <form onSubmit={handleLogin}>
        {/* Apply form-group class to input containers */}
        <div className="form-group">
          <label htmlFor="username">Username:</label>
          <input
            type="text"
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            // Add a class for input styling if needed, e.g., 'form-input'
            // className="form-input"
          />
        </div>
        {/* Apply form-group class to input containers */}
        <div className="form-group">
          <label htmlFor="password">Password:</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            // Add a class for input styling if needed, e.g., 'form-input'
            // className="form-input"
          />
        </div>
        {/* Apply error-message class */}
        {error && <p className="error-message">{error}</p>}
        {/* Apply action-button class or specific login button class */}
        <button type="submit" disabled={loading} className="action-button">
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;

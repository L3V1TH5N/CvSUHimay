// file path: web/src/context/AppContext.jsx
//
// CHANGES:
// ─────────────────────────────────────────────────────────────────────────────
// - Removed the axios response interceptor that redirected to /pending-approval.
//   All accounts are now created as active, no pending_approval status exists.
// - Removed unused useRef import.
// googleSignIn and googleSignUp remain the same (accept credential or accessToken).
// ─────────────────────────────────────────────────────────────────────────────

import { createContext, useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-hot-toast";

export const AppContext = createContext();

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

export const AppContextProvider = (props) => {
  const [user,    setUser]    = useState(null);
  const [token,   setToken]   = useState(() => {
    const saved = localStorage.getItem("token");
    if (saved) axios.defaults.headers.common["Authorization"] = `Bearer ${saved}`;
    return saved || null;
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      localStorage.setItem("token", token);
      fetchUser();
    } else {
      delete axios.defaults.headers.common["Authorization"];
      localStorage.removeItem("token");
      setLoading(false);
    }
  }, [token]);

  // No interceptor needed – all accounts are active.

  const fetchUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`);
      setUser(response.data.user);
    } catch (error) {
      console.error("Failed to fetch user:", error);
      // Don't logout on password_change_required — user is authenticated,
      // just redirected to settings. Logging out would erase their session.
      if (error.response?.data?.error !== 'password_change_required') {
        logout();
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshUser = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/auth/me`);
      setUser(response.data.user);
      return response.data.user;
    } catch (error) {
      console.error("Failed to refresh user:", error);
    }
  };

  const login = async (email, password) => {
    const response = await axios.post(`${API_URL}/api/auth/login`, { email, password });
    const { token: newToken, user: newUser, must_change_password } = response.data;

    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);

    toast.success("Login successful!");
    return { user: newUser, must_change_password: !!must_change_password };
  };

  // ── googleSignIn ───────────────────────────────────────────────────────────
  // Accepts: { credential } — ID token (GoogleLogin component, legacy)
  //          { accessToken } — OAuth2 token (useGoogleLogin hook, new)
  const googleSignIn = async ({ credential, accessToken } = {}) => {
    const body = accessToken
      ? { access_token: accessToken }
      : { credential };

    const response = await axios.post(`${API_URL}/api/auth/google-signin`, body);
    const { token: newToken, user: newUser } = response.data;

    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);

    toast.success(response.data.message || "Sign in successful!");
    return newUser;
  };

  // ── googleSignUp ───────────────────────────────────────────────────────────
  // application shape: { role, accessToken?, credential?, employee_id?,
  //                      department?, campus?, justification? }
  const googleSignUp = async (application = {}) => {
    const {
      role = 'student',
      credential,
      accessToken,
      employee_id,
      department,
      campus,
      justification,
    } = application;

    const body = {
      requestedRole: role,
      ...(accessToken  ? { access_token: accessToken }  : { credential }),
      ...(role === 'instructor' && {
        employee_id,
        department,
        campus,
        justification,
      }),
    };

    const response = await axios.post(`${API_URL}/api/auth/google-signup`, body);
    const { token: newToken, user: newUser } = response.data;

    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);

    toast.success(
      response.data.isNewUser
        ? "Welcome! Your account has been created."
        : "Account created successfully!"
    );
    return newUser;
  };

  // payload: { email, password, full_name, role, employee_id?, ... }
  const register = async (payload) => {
    const response = await axios.post(`${API_URL}/api/auth/register`, payload);
    const { token: newToken, user: newUser } = response.data;

    axios.defaults.headers.common["Authorization"] = `Bearer ${newToken}`;
    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(newUser);

    toast.success("Account created successfully!");
    return newUser;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
    delete axios.defaults.headers.common["Authorization"];
    localStorage.removeItem("token");
    toast.success("Logged out successfully");
  };

  const value = {
    user, token, loading, setUser,
    refreshUser, login, googleSignIn, googleSignUp, register, logout,
  };

  return (
    <AppContext.Provider value={value}>
      {props.children}
    </AppContext.Provider>
  );
};
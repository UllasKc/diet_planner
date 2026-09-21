import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { isAuthenticated, isAdmin, displayName, logout } = useAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout();
    navigate("/login");
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <header className="navbar">
      <div className="navbar-brand">
        <span className="brand-icon">🥗</span> Sahana's Diet Planner
      </div>
      <nav className="navbar-links">
        <NavLink to="/generate" className={({ isActive }) => (isActive ? "active" : "")}>
          Generate Plan
        </NavLink>
        {isAdmin && (
          <NavLink to="/build" className={({ isActive }) => (isActive ? "active" : "")}>
            Build Diet Plans
          </NavLink>
        )}
        {isAdmin && (
          <NavLink to="/library" className={({ isActive }) => (isActive ? "active" : "")}>
            Meal Library
          </NavLink>
        )}
      </nav>
      <div className="navbar-user">
        <span>{displayName}</span>
        <button type="button" onClick={handleLogout} className="btn btn-ghost">
          Log out
        </button>
      </div>
    </header>
  );
}

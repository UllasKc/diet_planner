import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import ProtectedRoute from "./components/ProtectedRoute";
import Navbar from "./components/Navbar";
import LoginPage from "./pages/LoginPage";
import GeneratePlanPage from "./pages/GeneratePlanPage";
import BuildPlanPage from "./pages/BuildPlanPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar />
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/generate"
            element={
              <ProtectedRoute>
                <GeneratePlanPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/build"
            element={
              <ProtectedRoute adminOnly>
                <BuildPlanPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/generate" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

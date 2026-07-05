import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";

import Layout from "./components/Layout";
import ProtectedRoute from "./components/ProtectedRoute";
import { AuthProvider } from "./context/AuthContext";
import Admin from "./pages/Admin";
import Approvals from "./pages/Approvals";
import Archive from "./pages/Archive";
import Dashboard from "./pages/Dashboard";
import Documents from "./pages/Documents";
import GroupDetail from "./pages/GroupDetail";
import Groups from "./pages/Groups";
import Login from "./pages/Login";
import PasswordReset from "./pages/PasswordReset";
import Register from "./pages/Register";
import Schedules from "./pages/Schedules";
import Settings from "./pages/Settings";
import VerifyEmail from "./pages/VerifyEmail";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster position="top-right" richColors />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<PasswordReset />} />
          <Route path="/reset-password" element={<PasswordReset />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/groups" element={<Groups />} />
              <Route path="/groups/:id" element={<GroupDetail />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/schedules" element={<Schedules />} />
              <Route path="/archive" element={<Archive />} />
              <Route path="/settings" element={<Settings />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["FACULTY", "ADMIN"]} />}>
            <Route element={<Layout />}>
              <Route path="/approvals" element={<Approvals />} />
            </Route>
          </Route>

          <Route element={<ProtectedRoute roles={["ADMIN"]} />}>
            <Route element={<Layout />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

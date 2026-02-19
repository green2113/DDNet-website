import { Navigate, Route, Routes } from 'react-router-dom';
import { BackgroundOrbs } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { RequireGuest } from './components/RequireGuest';
import { RequireVerified } from './components/RequireVerified';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BlockedPage from './pages/BlockedPage';
import VerifyEmailPage from './pages/VerifyEmailPage';

export default function App() {
  return (
    <>
      <BackgroundOrbs />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/login"
          element={(
            <RequireGuest>
              <LoginPage />
            </RequireGuest>
          )}
        />
        <Route
          path="/register"
          element={(
            <RequireGuest>
              <RegisterPage />
            </RequireGuest>
          )}
        />
        <Route path="/blocked" element={<BlockedPage />} />
        <Route
          path="/verify-email"
          element={
            <RequireAuth>
              <VerifyEmailPage />
            </RequireAuth>
          }
        />
        <Route
          path="/dashboard"
          element={
            <RequireVerified>
              <DashboardPage />
            </RequireVerified>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

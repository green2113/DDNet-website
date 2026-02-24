import { Navigate, Route, Routes } from 'react-router-dom';
import { BackgroundOrbs } from './components/Layout';
import { RequireAuth } from './components/RequireAuth';
import { RequireGuest } from './components/RequireGuest';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import BlockedPage from './pages/BlockedPage';
import PlanStorePage from './pages/PlanStorePage';
import PlanSubscribePage from './pages/PlanSubscribePage';

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
          path="/dashboard"
          element={
            <RequireAuth>
              <DashboardPage />
            </RequireAuth>
          }
        />
        <Route
          path="/billing/plans"
          element={
            <RequireAuth>
              <PlanStorePage />
            </RequireAuth>
          }
        />
        <Route
          path="/billing/subscribe"
          element={
            <RequireAuth>
              <PlanSubscribePage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

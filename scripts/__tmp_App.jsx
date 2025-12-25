import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { ToastProvider } from './components/ui/toast';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PassengerDashboard from './pages/PassengerDashboard';
import DriverDashboard from './pages/DriverDashboard';
import PassengerRidePage from './pages/PassengerRidePage';
import DriverOrdersPage from './pages/DriverOrdersPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminUsersPage from './pages/AdminUsersPage';
import ProtectedRoute from './components/ProtectedRoute';
import HealthCheckBanner from './components/HealthCheckBanner';
import AirtableStatusBanner from "./components/AirtableStatusBanner";
import { Toaster } from './components/ui/toaster';

function App() {
  return (
    <ToastProvider>
      <AppProvider>
        <div className="min-h-screen bg-gradient-dark">
          <HealthCheckBanner />
          <AirtableStatusBanner />
          <Routes>
            <Route path="/" element={<LoginPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            {/* LINE callback è·¯ç”±å·²ç§»é™¤ */}
            
            <Route path="/passenger" element={
              <ProtectedRoute allowedRoles={["passenger", "driver", "admin"]}>
                <PassengerDashboard />
              </ProtectedRoute>
            } />
            
            <Route path="/driver" element={
              <ProtectedRoute role="driver">
                <DriverDashboard />
              </ProtectedRoute>
            } />

            <Route path="/passenger/ride" element={
              <ProtectedRoute allowedRoles={["passenger", "admin"]}>
                <PassengerRidePage />
              </ProtectedRoute>
            } />

            <Route path="/driver/orders" element={
              <ProtectedRoute role="driver">
                <DriverOrdersPage />
              </ProtectedRoute>
            } />
            
            <Route path="/admin" element={
              <ProtectedRoute role="admin">
                <AdminDashboard />
              </ProtectedRoute>
            } />
            <Route path="/admin/users" element={
              <ProtectedRoute role="admin">
                <AdminUsersPage />
              </ProtectedRoute>
            } />
          </Routes>
          <Toaster />
        </div>
      </AppProvider>
    </ToastProvider>
  );
}

export default App;


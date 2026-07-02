import { Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from '@/store/authStore';
import AdminLayout from '@/layouts/AdminLayout';
import Login from '@/pages/login';
import Signup from '@/pages/signup';
import AnalyticsSection from '@/pages/sections/AnalyticsSection';
import RevenueSection from '@/pages/sections/RevenueSection';
import OrdersSection from '@/pages/sections/OrdersSection';
import UsersSection from '@/pages/sections/UsersSection';
import DeliverySection from '@/pages/sections/DeliverySection';
import StoresSection from '@/pages/sections/StoresSection';
import StoreDetailSection from '@/pages/sections/StoreDetailSection';
import MerchantVerificationSection from '@/pages/sections/MerchantVerificationSection';
import DeliveryVerificationSection from '@/pages/sections/DeliveryVerificationSection';
import MerchantVerificationDetailSection from '@/pages/sections/MerchantVerificationDetailSection';
import DeliveryVerificationDetailSection from '@/pages/sections/DeliveryVerificationDetailSection';
import SettingsSection from '@/pages/sections/SettingsSection';

const AUTH_HOME = '/dashboard/analytics';

function App() {
  const { isAuthenticated, loadFromStorage } = useAuthStore();

  useEffect(() => {
    loadFromStorage();
  }, [loadFromStorage]);

  return (
    <Routes>
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={AUTH_HOME} replace /> : <Login />}
      />
      <Route
        path="/signup"
        element={isAuthenticated ? <Navigate to={AUTH_HOME} replace /> : <Signup />}
      />
      <Route
        path="/dashboard"
        element={isAuthenticated ? <AdminLayout /> : <Navigate to="/login" replace />}
      >
        <Route index element={<Navigate to="analytics" replace />} />
        <Route path="analytics" element={<AnalyticsSection />} />
        <Route path="revenue" element={<RevenueSection />} />
        <Route path="orders" element={<OrdersSection />} />
        <Route path="users" element={<UsersSection />} />
        <Route path="delivery" element={<DeliverySection />} />
        <Route path="stores" element={<StoresSection />} />
        <Route path="stores/:storeId" element={<StoreDetailSection />} />
        <Route path="verification/merchants" element={<MerchantVerificationSection />} />
        <Route path="verification/merchants/:userId" element={<MerchantVerificationDetailSection />} />
        <Route path="verification/delivery" element={<DeliveryVerificationSection />} />
        <Route path="verification/delivery/:userId" element={<DeliveryVerificationDetailSection />} />
        <Route path="settings" element={<SettingsSection />} />
      </Route>
      <Route
        path="/"
        element={<Navigate to={isAuthenticated ? AUTH_HOME : '/login'} replace />}
      />
    </Routes>
  );
}

export default App;

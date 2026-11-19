import { Suspense, lazy } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { ToastProvider } from './context/ToastContext';
import { LocationProvider } from './context/LocationContext';
import { AuthProvider } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { CartProvider } from './context/CartContext';
import ToastContainer from './components/common/ToastContainer';
import CustomerLayout from './layouts/CustomerLayout';

const HomePage = lazy(() => import('./pages/public/HomePage'));
const RestaurantDetailsPage = lazy(() => import('./pages/public/RestaurantDetailsPage'));
const LoginPage = lazy(() => import('./pages/public/LoginPage'));
const RegisterPage = lazy(() => import('./pages/public/RegisterPage'));
const OrdersPage = lazy(() => import('./pages/customer/OrdersPage'));
const ProfilePage = lazy(() => import('./pages/customer/ProfilePage'));
const RestaurantDashboardPage = lazy(() => import('./pages/restaurant/RestaurantDashboardPage'));
const DeliveryDashboardPage = lazy(() => import('./pages/delivery/DeliveryDashboardPage'));
const AdminDashboardPage = lazy(() => import('./pages/admin/AdminDashboardPage'));

function RouteLoader() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
        <Loader2 className="h-5 w-5 animate-spin text-orange-600" />
        Loading BiteStream portal...
      </div>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <LocationProvider>
          <AuthProvider>
            <SocketProvider>
              <CartProvider>
                <Suspense fallback={<RouteLoader />}>
                  <Routes>
                    <Route element={<CustomerLayout />}>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/restaurant/:id" element={<RestaurantDetailsPage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/register" element={<RegisterPage />} />
                      <Route path="/orders" element={<OrdersPage />} />
                      <Route path="/profile" element={<ProfilePage />} />
                    </Route>

                    <Route path="/restaurant/dashboard" element={<RestaurantDashboardPage />} />
                    <Route path="/delivery/dashboard" element={<DeliveryDashboardPage />} />
                    <Route path="/admin/dashboard" element={<AdminDashboardPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </Suspense>
                <ToastContainer />
              </CartProvider>
            </SocketProvider>
          </AuthProvider>
        </LocationProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;

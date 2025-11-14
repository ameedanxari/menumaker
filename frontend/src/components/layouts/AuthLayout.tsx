import { Outlet, Navigate } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';

export default function AuthLayout() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-primary-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-900">MenuMaker</h1>
          <p className="text-primary-700 mt-2">Create and share your menu online</p>
        </div>
        <div className="card">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import JobList from './pages/JobList.jsx';
import JobDetail from './pages/JobDetail.jsx';
import MyResume from './pages/MyResume.jsx';
import MyApplications from './pages/MyApplications.jsx';
import HrDashboard from './pages/hr/HrDashboard.jsx';
import JobForm from './pages/hr/JobForm.jsx';
import HrApplications from './pages/hr/HrApplications.jsx';
import HrJobApplications from './pages/hr/HrJobApplications.jsx';

// 已登录用户访问 /login 时直接回首页
function LoginRoute() {
  const { isLoggedIn, role } = useAuth();
  if (isLoggedIn) return <Navigate to={role === 'hr' ? '/hr' : '/'} replace />;
  return <Login />;
}

// 角色守卫：未登录去登录页（记住来路），角色不符给提示
function RequireRole({ need, children }) {
  const { isLoggedIn, role } = useAuth();
  const location = useLocation();

  if (!isLoggedIn) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }
  if (role !== need) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-700">
        当前账号是{role === 'hr' ? ' HR ' : '求职者'}，该页面仅限{need === 'hr' ? ' HR ' : '求职者'}访问。
      </div>
    );
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<JobList />} />
        <Route path="jobs/:id" element={<JobDetail />} />
        <Route path="login" element={<LoginRoute />} />

        <Route
          path="my/resume"
          element={
            <RequireRole need="seeker">
              <MyResume />
            </RequireRole>
          }
        />
        <Route
          path="my/applications"
          element={
            <RequireRole need="seeker">
              <MyApplications />
            </RequireRole>
          }
        />
        <Route
          path="hr"
          element={
            <RequireRole need="hr">
              <HrDashboard />
            </RequireRole>
          }
        />
        <Route
          path="hr/jobs/new"
          element={
            <RequireRole need="hr">
              <JobForm />
            </RequireRole>
          }
        />
        <Route
          path="hr/jobs/:id/edit"
          element={
            <RequireRole need="hr">
              <JobForm />
            </RequireRole>
          }
        />
        <Route
          path="hr/applications"
          element={
            <RequireRole need="hr">
              <HrApplications />
            </RequireRole>
          }
        />
        <Route
          path="hr/applications/:jobId"
          element={
            <RequireRole need="hr">
              <HrJobApplications />
            </RequireRole>
          }
        />

        <Route
          path="*"
          element={
            <div className="py-16 text-center text-sm text-slate-500">页面不存在</div>
          }
        />
      </Route>
    </Routes>
  );
}

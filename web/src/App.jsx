import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Layout from './components/Layout.jsx';
import { useAuth } from './auth.jsx';
import Login from './pages/Login.jsx';
import JobList from './pages/JobList.jsx';
import JobDetail from './pages/JobDetail.jsx';
import ComingSoon from './pages/ComingSoon.jsx';

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
              <ComingSoon title="我的简历" items={['简历表单（新增 / 修改共用）', '学历、经验、期望城市']} />
            </RequireRole>
          }
        />
        <Route
          path="my/applications"
          element={
            <RequireRole need="seeker">
              <ComingSoon title="我的投递" items={['投递记录列表', '状态标签与拒绝原因']} />
            </RequireRole>
          }
        />
        <Route
          path="hr"
          element={
            <RequireRole need="hr">
              <ComingSoon title="HR 工作台" items={['本企业职位列表', '新建职位', '编辑职位']} />
            </RequireRole>
          }
        />
        <Route
          path="hr/applications"
          element={
            <RequireRole need="hr">
              <ComingSoon title="投递管理" items={['按职位查看投递', '查看简历', '状态流转', '触发初筛']} />
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

import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';

const navClass = ({ isActive }) =>
  `rounded-lg px-3 py-1.5 text-sm transition ${
    isActive ? 'bg-brand-100 font-medium text-brand-800' : 'text-slate-600 hover:bg-brand-50 hover:text-brand-700'
  }`;

export default function Layout() {
  const { user, role, isLoggedIn, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center gap-2 px-6">
          <Link to="/" className="mr-4 text-base font-semibold tracking-tight text-brown-800">
            简历筛选平台
          </Link>

          <nav className="flex flex-1 items-center gap-1">
            <NavLink to="/" end className={navClass}>
              职位广场
            </NavLink>

            {role === 'seeker' && (
              <>
                <NavLink to="/my/resume" className={navClass}>
                  我的简历
                </NavLink>
                <NavLink to="/my/applications" className={navClass}>
                  我的投递
                </NavLink>
              </>
            )}

            {role === 'hr' && (
              <>
                <NavLink to="/hr" end className={navClass}>
                  工作台
                </NavLink>
                <NavLink to="/hr/applications" className={navClass}>
                  投递管理
                </NavLink>
              </>
            )}
          </nav>

          {isLoggedIn ? (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-500">
                {user.name}
                <span className="ml-1.5 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                  {role === 'hr' ? 'HR' : '求职者'}
                </span>
              </span>
              <button
                onClick={handleLogout}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50"
              >
                退出
              </button>
            </div>
          ) : (
            <Link
              to="/login"
              className="rounded-lg bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              登录 / 注册
            </Link>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}

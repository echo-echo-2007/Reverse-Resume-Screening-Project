import { useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { api } from '../api.js';
import { useAuth } from '../auth.jsx';
import Field, { inputClass } from '../components/Field.jsx';

export default function Login() {
  const [mode, setMode] = useState('login'); // login | register
  const [role, setRole] = useState('seeker');
  const [form, setForm] = useState({ phone: '', password: '', name: '', company_name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo = location.state?.from || null;

  const update = (key) => (e) => setForm((prev) => ({ ...prev, [key]: e.target.value }));

  const switchMode = (next) => {
    setMode(next);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const payload =
        mode === 'login'
          ? { phone: form.phone.trim(), password: form.password }
          : {
              role,
              phone: form.phone.trim(),
              password: form.password,
              name: form.name.trim(),
              ...(role === 'hr' ? { company_name: form.company_name.trim() } : {}),
            };

      const data = mode === 'login' ? await api.login(payload) : await api.register(payload);
      const user = signIn(data);
      navigate(redirectTo || (user.role === 'hr' ? '/hr' : '/'), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 flex rounded-xl border border-slate-200 bg-white p-1">
        {[
          { key: 'login', label: '登录' },
          { key: 'register', label: '注册' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => switchMode(tab.key)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition ${
              mode === tab.key ? 'bg-brand-600 text-white' : 'text-slate-600 hover:bg-brand-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      >
        <h1 className="text-lg font-semibold text-brown-800">
          {mode === 'login' ? '登录账号' : '创建账号'}
        </h1>

        {mode === 'register' && (
          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700">我是</span>
            <div className="grid grid-cols-2 gap-2">
              {[
                { key: 'seeker', label: '求职者', desc: '找工作、投简历' },
                { key: 'hr', label: 'HR', desc: '发职位、筛简历' },
              ].map((item) => (
                <button
                  type="button"
                  key={item.key}
                  onClick={() => setRole(item.key)}
                  className={`rounded-lg border px-3 py-2 text-left transition ${
                    role === item.key
                      ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-200'
                      : 'border-slate-200 hover:border-brand-300'
                  }`}
                >
                  <span className="block text-sm font-medium text-slate-800">{item.label}</span>
                  <span className="block text-xs text-slate-500">{item.desc}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <Field label="手机号" required>
          <input
            className={inputClass}
            value={form.phone}
            onChange={update('phone')}
            placeholder="11 位手机号"
            maxLength={11}
            autoComplete="username"
          />
        </Field>

        <Field label="密码" required hint={mode === 'register' ? '至少 6 位' : ''}>
          <input
            className={inputClass}
            type="password"
            value={form.password}
            onChange={update('password')}
            placeholder="请输入密码"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          />
        </Field>

        {mode === 'register' && (
          <>
            <Field label={role === 'hr' ? '你的姓名' : '姓名'} required>
              <input
                className={inputClass}
                value={form.name}
                onChange={update('name')}
                placeholder={role === 'hr' ? '如：张招聘' : '如：李求职'}
              />
            </Field>

            {role === 'hr' && (
              <Field label="企业名称" required hint="注册后自动创建并绑定企业">
                <input
                  className={inputClass}
                  value={form.company_name}
                  onChange={update('company_name')}
                  placeholder="如：星辰科技有限公司"
                />
              </Field>
            )}
          </>
        )}

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-600 py-2.5 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? '提交中…' : mode === 'login' ? '登录' : '注册并登录'}
        </button>

        <p className="text-center text-xs text-slate-400">
          {mode === 'login' ? (
            <>
              还没有账号？
              <button type="button" onClick={() => switchMode('register')} className="text-brand-700 underline">
                立即注册
              </button>
            </>
          ) : (
            <>
              已有账号？
              <button type="button" onClick={() => switchMode('login')} className="text-brand-700 underline">
                去登录
              </button>
            </>
          )}
        </p>
      </form>

      <p className="mt-4 text-center text-sm">
        <Link to="/" className="text-slate-500 hover:text-brand-700">
          ← 先去逛逛职位广场
        </Link>
      </p>
    </div>
  );
}

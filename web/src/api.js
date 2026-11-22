// 统一的接口调用层：注入 token、解析 JSON、把后端 error 文案抛出来
// 页面里只需要 try/catch 拿 err.message 显示

const BASE = '/api';
const TOKEN_KEY = 'token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const token = getToken();
  if (auth && token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('网络连接失败，请确认后端已启动（3000 端口）', 0);
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    // 非 JSON 响应，保持 data 为 null
  }

  if (!res.ok) {
    // 后端没起时，Vite 代理会直接回 500 且没有 JSON body，这里给一句人话
    const fallback =
      !data && res.status >= 500
        ? '服务暂时不可用，请确认后端已启动（3000 端口）'
        : `请求失败（${res.status}）`;
    throw new ApiError((data && data.error) || fallback, res.status);
  }
  return data;
}

const qs = (params) => {
  const usable = Object.entries(params).filter(([, v]) => v !== '' && v !== null && v !== undefined);
  return usable.length ? `?${new URLSearchParams(usable).toString()}` : '';
};

export const api = {
  // 鉴权
  register: (payload) => request('/register', { method: 'POST', body: payload, auth: false }),
  login: (payload) => request('/login', { method: 'POST', body: payload, auth: false }),

  // 职位
  listJobs: (params = {}) => request(`/jobs${qs(params)}`),
  getJob: (id) => request(`/jobs/${id}`),
  createJob: (payload) => request('/jobs', { method: 'POST', body: payload }),
  updateJob: (id, payload) => request(`/jobs/${id}`, { method: 'PATCH', body: payload }),

  // 简历
  getMyResume: () => request('/resume'),
  saveMyResume: (payload) => request('/resume', { method: 'PUT', body: payload }),

  // 投递
  apply: (jobId) => request(`/jobs/${jobId}/apply`, { method: 'POST', body: {} }),
  myApplications: () => request('/my/applications'),
  jobApplications: (jobId) => request(`/jobs/${jobId}/applications`),
  updateApplicationStatus: (id, payload) =>
    request(`/applications/${id}/status`, { method: 'PATCH', body: payload }),

  // HR 工作台
  hrOverview: () => request('/hr/overview'),
  hrApplications: (params = {}) => request(`/hr/applications${qs(params)}`),
  hrApplicationDetail: (id) => request(`/hr/applications/${id}`),
};

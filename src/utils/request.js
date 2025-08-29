import axios from 'axios';
import { ElMessage } from 'element-plus';

// 获取API基础URL
const getBaseURL = () => {
  // 在开发环境中使用代理路径，在生产环境中使用环境变量配置的URL
  if (import.meta.env.DEV) {
    return '/api'; // 开发环境使用代理
  } else {
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:8089';
  }
};

// 创建axios实例
const request = axios.create({
  baseURL: getBaseURL(),
  timeout: 120000, // 2分钟超时
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
request.interceptors.request.use(
  (config) => {
    // 在发送请求之前做些什么
    console.log('发送请求:', config.method?.toUpperCase(), config.url);
    console.log('请求配置:', {
      baseURL: config.baseURL,
      url: config.url,
      method: config.method,
      headers: config.headers,
      timeout: config.timeout
    });

    // 如果是文件上传，设置正确的Content-Type
    if (config.data instanceof FormData) {
      config.headers['Content-Type'] = 'multipart/form-data';
      console.log('文件上传请求，FormData keys:', Array.from(config.data.keys()));
    } else if (config.data) {
      console.log('请求数据:', config.data);
    }

    // 添加token等认证信息
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `${token}`;
    }

    return config;
  },
  (error) => {
    // 对请求错误做些什么
    console.error('请求错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
request.interceptors.response.use(
  (response) => {
    // 2xx 范围内的状态码都会触发该函数
    console.log('响应数据:', response.status, response.config.url, response.config.responseType);

    // 对于blob类型的响应（如文件下载），直接返回完整的response对象
    if (response.config.responseType === 'blob') {
      console.log('Blob响应，直接返回response对象');
      return response;
    }

    // 统一处理响应数据
    const { data } = response;

    // 如果后端返回的数据结构有统一格式，可以在这里处理
    if (data && typeof data === 'object') {
      // 假设后端返回格式为 { code: number, data: any, msg: string }
      if (data.code !== undefined) {
        console.log('检测到code字段:', data.code, '完整响应:', data);
        if (data.code === 200 || data.code === 0) {
          return data; // 成功时返回完整数据
        } else {
          // 业务错误
          // console.error('业务错误 - code:', data.code, 'msg:', data.msg);
          // ElMessage.error(data.msg || '请求失败');
          return Promise.reject(new Error(data.msg || '请求失败'));
        }
      }
    }

    // 如果没有统一格式，直接返回数据
    return data;
  },
  (error) => {
    // 超出 2xx 范围的状态码都会触发该函数
    console.error('响应错误详情:', {
      msg: error.msg,
      code: error.code,
      config: {
        url: error.config?.url,
        method: error.config?.method,
        baseURL: error.config?.baseURL,
        data: error.config?.data instanceof FormData ? 'FormData' : error.config?.data
      },
      response: error.response ? {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data,
        headers: error.response.headers
      } : null,
      request: error.request ? 'Request object exists' : 'No request object'
    });

    let msg = '网络错误';

    if (error.response) {
      // 服务器返回了错误状态码
      const { status, data } = error.response;

      switch (status) {
        case 400:
          msg = data?.msg || '请求参数错误';
          break;
        case 401:
          msg = '未授权，请重新登录';
          // 可以在这里处理登录过期逻辑
          // router.push('/login');
          break;
        case 403:
          msg = '拒绝访问';
          break;
        case 404:
          msg = '请求的资源不存在';
          break;
        case 500:
          msg = '服务器内部错误';
          break;
        case 502:
          msg = '网关错误';
          break;
        case 503:
          msg = '服务不可用';
          break;
        case 504:
          msg = '网关超时';
          break;
        default:
          msg = data?.msg || `请求失败 (${status})`;
      }
    } else if (error.request) {
      // 请求已发出但没有收到响应
      msg = '网络连接超时，请检查网络';
    } else {
      // 其他错误
      msg = error.msg || '请求失败';
    }

    // 显示错误消息
    // ElMessage.error(msg);

    return Promise.reject(error);
  }
);

export default request;

// 导出常用的请求方法
export const get = (url, params = {}) => {
  return request({
    method: 'GET',
    url,
    params
  });
};

export const post = (url, data = {}) => {
  return request({
    method: 'POST',
    url,
    data
  });
};

export const put = (url, data = {}) => {
  return request({
    method: 'PUT',
    url,
    data
  });
};

export const del = (url, params = {}) => {
  return request({
    method: 'DELETE',
    url,
    params
  });
};

// 文件上传专用方法
export const upload = (url, formData, onUploadProgress) => {
  return request({
    method: 'POST',
    url,
    data: formData,
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    timeout: 300000, // 5分钟超时，适用于大文件上传
    onUploadProgress
  });
};

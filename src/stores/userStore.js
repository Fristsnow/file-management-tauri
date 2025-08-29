import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * 用户信息存储，管理用户登录状态和个人信息
 */
export const useUserStore = defineStore('user', () => {
  // 用户基本信息
  const userInfo = ref({
    id: null,
    username: '',
    email: '',
    phone: '',
    department: '',
    avatar: '',
    role: '',
    permissions: []
  });
  
  // 登录状态
  const isLoggedIn = ref(false);
  
  // 登录token
  const token = ref('');
  
  // 设置用户信息
  const setUserInfo = (info) => {
    userInfo.value = { ...userInfo.value, ...info };
  };
  
  // 设置登录状态
  const setLoginStatus = (status) => {
    isLoggedIn.value = status;
  };
  
  // 设置token
  const setToken = (tokenValue) => {
    token.value = tokenValue;
  };
  
  // 清除用户信息
  const clearUserInfo = () => {
    userInfo.value = {
      id: null,
      username: '',
      email: '',
      phone: '',
      department: '',
      avatar: '',
      role: '',
      permissions: []
    };
    isLoggedIn.value = false;
    token.value = '';
  };
  
  // 更新用户头像
  const updateAvatar = (avatarUrl) => {
    userInfo.value.avatar = avatarUrl;
  };
  
  // 更新用户基本信息
  const updateUserInfo = (updates) => {
    userInfo.value = { ...userInfo.value, ...updates };
  };
  
  return {
    // 状态
    userInfo,
    isLoggedIn,
    token,
    
    // 方法
    setUserInfo,
    setLoginStatus,
    setToken,
    clearUserInfo,
    updateAvatar,
    updateUserInfo
  };
}, {
  // 配置持久化
  persist: {
    key: 'user-store',
    storage: localStorage,
    paths: ['userInfo', 'isLoggedIn', 'token']
  }
});
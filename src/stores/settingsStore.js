import { defineStore } from 'pinia';
import { ref } from 'vue';

/**
 * 设置存储，管理应用程序的各种配置
 */
export const useSettingsStore = defineStore('settings', () => {
  // 下载路径配置
  const downloadPath = ref('');
  
  // 是否使用系统默认下载路径
  const useDefaultDownloadPath = ref(true);
  
  // 下载路径设置（用于记住用户选择）
  const downloadPathSettings = ref({
    type: 'default',
    path: '',
    remember: false
  });
  
  // 获取系统默认下载路径
  const getDefaultDownloadPath = async () => {
    try {
      // 检查是否在Tauri环境中
      const isTauriEnvironment = () => {
        if (typeof window === 'undefined') return false;
        
        // 检查多个Tauri相关的全局对象
        const hasTauriCore = !!window.__TAURI__;
        const hasTauriInternals = !!window.__TAURI_INTERNALS__;
        const hasTauriInvoke = typeof window.__TAURI_INVOKE__ === 'function';
        const hasTauriPattern = !!window.__TAURI_PATTERN__;
        
        // 在开发环境中，__TAURI_INTERNALS__ 通常会先初始化
        return hasTauriCore || hasTauriInternals || hasTauriInvoke || hasTauriPattern;
      };
      
      if (isTauriEnvironment()) {
        const { downloadDir } = await import('@tauri-apps/api/path');
        const defaultPath = await downloadDir();
        
        // 确保路径存在，如果不存在则创建
        if (defaultPath) {
          const { exists, createDir } = await import('@tauri-apps/plugin-fs');
          const pathExists = await exists(defaultPath);
          
          if (!pathExists) {
            try {
              await createDir(defaultPath, { recursive: true });
            } catch (createError) {
              console.warn('创建默认下载目录失败:', createError);
            }
          }
        }
        
        return defaultPath;
      }
      
      // 浏览器环境返回空字符串，使用浏览器默认下载行为
      return '';
    } catch (error) {
      console.error('获取默认下载路径失败:', error);
      return '';
    }
  };
  
  // 设置下载路径
  const setDownloadPath = (path) => {
    downloadPath.value = path;
    useDefaultDownloadPath.value = !path;
  };
  
  // 获取当前有效的下载路径
  const getEffectiveDownloadPath = async () => {
    if (useDefaultDownloadPath.value || !downloadPath.value) {
      return await getDefaultDownloadPath();
    }
    return downloadPath.value;
  };
  
  // 重置为默认设置
  const resetToDefault = () => {
    downloadPath.value = '';
    useDefaultDownloadPath.value = true;
    downloadPathSettings.value = {
      type: 'default',
      path: '',
      remember: false
    };
  };
  
  // 更新下载路径设置
  const updateDownloadPathSettings = (settings) => {
    downloadPathSettings.value = { ...downloadPathSettings.value, ...settings };
  };
  
  return {
    downloadPath,
    useDefaultDownloadPath,
    downloadPathSettings,
    getDefaultDownloadPath,
    setDownloadPath,
    getEffectiveDownloadPath,
    resetToDefault,
    updateDownloadPathSettings
  };
}, {
  persist: {
    key: 'settings-store',
    storage: localStorage,
    paths: ['downloadPath', 'useDefaultDownloadPath', 'downloadPathSettings']
  }
});
<template>
  <el-dialog v-model="visible" :title="dialogTitle" width="700px" :close-on-click-modal="false"
    :close-on-press-escape="false" class="download-dialog">
    <div class="download-content">
      <!-- 路径选择阶段 -->
      <div v-if="currentStep === 'path-selection'" class="path-selection-step">
        <DownloadPathSelector v-model="downloadPathConfig" @path-changed="handlePathChanged" />
      </div>

      <!-- 下载进行阶段 -->
      <div v-else-if="currentStep === 'downloading'" class="downloading-step">
        <div class="download-message">
          <el-icon class="download-icon"><Loading /></el-icon>
          <div class="message-content">
            <div class="main-text">正在下载文件...</div>
            <div class="sub-text">下载进度请查看底部进度监控区域</div>
          </div>
        </div>
      </div>
    </div>

    <template #footer>
        <div class="dialog-footer">
          <!-- 路径选择阶段的按钮 -->
          <template v-if="currentStep === 'path-selection'">
            <el-button @click="closeDialog">
              取消
            </el-button>
            <el-button type="primary" @click="startDownloadWithPath" :disabled="!isPathConfigValid">
              开始下载
            </el-button>
          </template>

          <!-- 下载进行阶段的按钮 -->
          <template v-else-if="currentStep === 'downloading'">
            <el-button v-if="isAllCompleted" type="primary" @click="closeDialog">
              完成
            </el-button>
            <el-button v-else @click="closeDialog">
              关闭
            </el-button>
          </template>
        </div>
      </template>
  </el-dialog>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Document, Picture, Check, Close, Loading } from '@element-plus/icons-vue';
import { downloadFileToLocal } from '@/api/ftp.js';
import DownloadPathSelector from './DownloadPathSelector.vue';
import { useFileStore } from '@/stores/fileStore.js';
import { useSettingsStore } from '@/stores/settingsStore.js';

const props = defineProps({
  modelValue: {
    type: Boolean,
    default: false
  },
  files: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['update:modelValue', 'download-complete']);

// 使用stores
const fileStore = useFileStore();
const settingsStore = useSettingsStore();

const visible = computed({
  get: () => props.modelValue, 
  set: (value) => emit('update:modelValue', value)
});

// 下载步骤管理
const currentStep = ref('path-selection'); // 'path-selection' | 'downloading'
const downloadPathConfig = ref({
  type: 'default',
  path: '',
  remember: false
});

const downloadList = ref([]);

// 统计数据
const completedCount = computed(() => {
  return downloadList.value.filter(item => item.status === 'completed').length;
});

const failedCount = computed(() => {
  return downloadList.value.filter(item => item.status === 'error').length;
});

const processingCount = computed(() => {
  return downloadList.value.filter(item => item.status === 'downloading' || item.status === 'waiting').length;
});

// 总体进度
const overallProgress = computed(() => {
  if (downloadList.value.length === 0) return 0;
  const totalProgress = downloadList.value.reduce((sum, item) => {
    if (item.status === 'completed') return sum + 100;
    if (item.status === 'downloading') return sum + item.progress;
    return sum;
  }, 0);
  return Math.round(totalProgress / downloadList.value.length);
});

const overallStatus = computed(() => {
  if (failedCount.value > 0 && completedCount.value + failedCount.value === downloadList.value.length) {
    return 'exception';
  }
  if (completedCount.value === downloadList.value.length && downloadList.value.length > 0) {
    return 'success';
  }
  return undefined;
});

const isAllCompleted = computed(() => {
  return downloadList.value.length > 0 &&
    completedCount.value + failedCount.value === downloadList.value.length;
});

const canRetryAll = computed(() => {
  return failedCount.value > 0;
});

// 计算属性
const dialogTitle = computed(() => {
  switch (currentStep.value) {
    case 'path-selection':
      return '选择下载路径';
    case 'downloading':
      return '文件下载';
    default:
      return '文件下载';
  }
});

const isPathConfigValid = computed(() => {
  if (downloadPathConfig.value.type === 'default') {
    return true;
  }
  return downloadPathConfig.value.type === 'custom' && downloadPathConfig.value.path;
});

// 监听文件列表变化
watch(() => props.files, (newFiles) => {
  if (newFiles && newFiles.length > 0) {
    initializeDownloadList(newFiles);
    // 重置到路径选择步骤
    currentStep.value = 'path-selection';
  }
}, { immediate: true });

// 监听对话框显示状态
watch(visible, (newVisible) => {
  if (newVisible && props.files && props.files.length > 0) {
    // 对话框打开时重置到路径选择步骤
    currentStep.value = 'path-selection';
  }
});

// 初始化下载列表
const initializeDownloadList = (files) => {
  downloadList.value = files.map(file => {
    const downloadItem = {
      id: Date.now() + Math.random(),
      name: file.originalFileName,
      size: file.fileSize,
      progress: 0,
      status: 'waiting',
      speed: 0,
      file: file,
      type: 'download'
    };
    
    // 添加到fileStore的下载队列
    fileStore.addDownloadItem(downloadItem);
    
    return {
      id: downloadItem.id,
      file,
      status: 'waiting',
      progress: 0,
      error: null,
      startTime: null,
      downloadSpeed: 0,
      estimatedTime: 0,
      downloadedBytes: 0
    };
  });
};

// 开始下载
const startDownloads = async () => {
  for (const item of downloadList.value) {
    if (item.status === 'waiting') {
      await downloadSingleFile(item);
    }
  }
};

// 进度更新节流映射
const progressThrottleMap = new Map();
const PROGRESS_UPDATE_INTERVAL = 100; // 100ms更新一次，避免过于频繁

// 下载单个文件
const downloadSingleFile = async (item) => {
  try {
    console.log('开始下载文件:', item.file.originalFileName, '对象名:', item.file.minioObjectName);

    item.status = 'downloading';
    item.progress = 0;
    item.error = null;
    item.startTime = Date.now();
    item.downloadSpeed = 0;
    item.estimatedTime = 0;
    item.downloadedBytes = 0;

    // 确定下载路径并保存到settingsStore
    let customDownloadPath = null;
    if (downloadPathConfig.value.type === 'custom' && downloadPathConfig.value.path) {
      customDownloadPath = downloadPathConfig.value.path;
      // 保存用户选择的自定义路径到settingsStore
      settingsStore.setDownloadPath(customDownloadPath);
    } else {
      // 使用默认路径时，清除settingsStore中的自定义路径
      settingsStore.setDownloadPath('');
    }

    const result = await downloadFileToLocal(item.file, (progressData) => {
      // 节流进度更新，避免过于频繁的DOM更新导致应用崩溃
      const now = Date.now();
      const lastUpdate = progressThrottleMap.get(item.id) || 0;

      if (now - lastUpdate < PROGRESS_UPDATE_INTERVAL) {
        return; // 跳过此次更新
      }

      progressThrottleMap.set(item.id, now);

      try {
        item.progress = progressData.progress || 0;
        item.downloadedBytes = progressData.loaded || 0;

        // 计算下载速度和剩余时间
        const currentTime = Date.now();
        const elapsedTime = (currentTime - item.startTime) / 1000; // 秒

        if (elapsedTime > 0) {
          item.downloadSpeed = item.downloadedBytes / elapsedTime; // 字节/秒

          // 估算剩余时间
          if (item.downloadSpeed > 0 && progressData.total) {
            const remainingBytes = progressData.total - item.downloadedBytes;
            item.estimatedTime = remainingBytes / item.downloadSpeed; // 秒
          }
        }

        // 更新fileStore中的下载进度
        // 当进度达到100%时，状态设置为即将完成，否则为下载中
        const currentStatus = item.progress >= 100 ? 'completing' : 'downloading';
        fileStore.updateDownloadItem(item.id, {
          progress: item.progress,
          speed: item.downloadSpeed,
          status: currentStatus
        });
      } catch (error) {
        console.error('进度更新时发生错误:', error);
      }
    }, customDownloadPath);

    if (result.success) {
      console.log('文件下载成功:', item.file.originalFileName);
      item.status = 'completed';
      item.progress = 100;
      item.estimatedTime = 0;
      
      // 更新fileStore中的下载状态
      fileStore.updateDownloadItem(item.id, {
        progress: 100,
        status: 'completed',
        speed: 0
      });
    } else {
      console.error('文件下载失败:', item.file.originalFileName, result.error);
      item.status = 'error';
      item.error = result.error;
      
      // 更新fileStore中的下载状态
      fileStore.updateDownloadItem(item.id, {
        status: 'error',
        speed: 0
      });

      // 显示详细错误信息
      const errorMsg = getErrorMessage(result.error);
      ElMessage.error(`文件 ${item.file.originalFileName} 下载失败: ${errorMsg}`);
    }
  } catch (error) {
    console.error('下载过程中发生异常:', item.file.originalFileName, error);
    item.status = 'error';
    item.error = error;
    
    // 更新fileStore中的下载状态
    fileStore.updateDownloadItem(item.id, {
      status: 'error',
      speed: 0
    });

    // 显示详细错误信息
    const errorMsg = getErrorMessage(error);
    ElMessage.error(`文件 ${item.file.originalFileName} 下载异常: ${errorMsg}`);
  } finally {
    // 清理节流映射，避免内存泄漏
    progressThrottleMap.delete(item.id);
  }
};

// 获取错误信息
const getErrorMessage = (error) => {
  if (!error) return '未知错误';

  // 网络错误
  if (error.code === 'NETWORK_ERROR' || error.message?.includes('Network Error')) {
    return '网络连接失败，请检查网络连接';
  }

  // 超时错误
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return '请求超时，请重试';
  }

  // HTTP状态码错误
  if (error.response) {
    const status = error.response.status;
    const data = error.response.data;

    switch (status) {
      case 400:
        return data?.msg || '请求参数错误';
      case 401:
        return '未授权，请重新登录';
      case 403:
        return '没有权限访问该文件';
      case 404:
        return '文件不存在或已被删除';
      case 500:
        return '服务器内部错误';
      case 502:
        return '网关错误';
      case 503:
        return '服务不可用';
      case 504:
        return '网关超时';
      default:
        return data?.msg || `服务器错误 (${status})`;
    }
  }

  // 其他错误
  return error.message || error.msg || '下载失败';
};

// 重试下载
const retryDownload = async (item) => {
  await downloadSingleFile(item);
};

// 重试所有失败项
const retryAllFailed = async () => {
  const failedItems = downloadList.value.filter(item => item.status === 'error');
  for (const item of failedItems) {
    await downloadSingleFile(item);
  }
};

// 处理路径配置变化
const handlePathChanged = (pathConfig) => {
  downloadPathConfig.value = pathConfig;
};

// 开始下载（带路径配置）
const startDownloadWithPath = async () => {
  if (!isPathConfigValid.value) {
    ElMessage.warning('请选择有效的下载路径');
    return;
  }

  // 如果选择了自定义路径，验证路径
  if (downloadPathConfig.value.type === 'custom') {
    try {
      // 检查是否在Tauri环境中
      const isTauriEnvironment = () => {
        if (typeof window === 'undefined') return false;
        return !!window.__TAURI__ || !!window.__TAURI_INTERNALS__;
      };

      if (isTauriEnvironment()) {
        const { invoke } = await import('@tauri-apps/api/core');
        const pathInfo = await invoke('validate_download_path', {
          path: downloadPathConfig.value.path
        });

        if (!pathInfo.writable) {
          ElMessage.error('选择的路径不可写，请选择其他路径');
          return;
        }

        // 确保目录存在
        await invoke('ensure_download_directory', {
          path: downloadPathConfig.value.path
        });
      }
    } catch (error) {
      console.error('路径验证失败:', error);
      ElMessage.error('路径验证失败: ' + (error.message || '未知错误'));
      return;
    }
  }

  // 切换到下载步骤
  currentStep.value = 'downloading';

  // 下载开始后立即关闭弹窗
  closeDialog();
  
  // 异步开始下载（不等待完成）
  startDownloads().catch(error => {
    console.error('下载过程中发生错误:', error);
  });
};

// 关闭对话框
const closeDialog = () => {
  visible.value = false;

  // 重置状态
  currentStep.value = 'path-selection';

  emit('download-complete', {
    total: downloadList.value.length,
    completed: completedCount.value,
    failed: failedCount.value
  });
};

// 获取状态文本
const getStatusText = (item) => {
  switch (item.status) {
    case 'waiting':
      return '等待中';
    case 'downloading':
      return '下载中';
    case 'completed':
      return '已完成';
    case 'error':
      return '下载失败';
    default:
      return '';
  }
};

// 判断是否为图片文件
const isImageFile = (fileName) => {
  const ext = fileName.split('.').pop()?.toLowerCase();
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(ext);
};

// 格式化文件大小
const formatFileSize = (size) => {
  if (!size) return '0 B';
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
  return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

// 格式化下载速度
const formatDownloadSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond || bytesPerSecond < 1024) return Math.round(bytesPerSecond) + ' B/s';
  if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(1) + ' KB/s';
  if (bytesPerSecond < 1024 * 1024 * 1024) return (bytesPerSecond / (1024 * 1024)).toFixed(1) + ' MB/s';
  return (bytesPerSecond / (1024 * 1024 * 1024)).toFixed(1) + ' GB/s';
};

// 格式化剩余时间
const formatEstimatedTime = (seconds) => {
  if (!seconds || seconds <= 0) return '';
  if (seconds < 60) return Math.round(seconds) + '秒';
  if (seconds < 3600) return Math.round(seconds / 60) + '分钟';
  return Math.round(seconds / 3600) + '小时';
};
</script>

<style scoped>
.path-selection-step {
  padding: 20px 0;
}

.downloading-step {
  /* 保持原有的下载步骤样式 */
}

.download-message {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

.download-icon {
  font-size: 32px;
  color: #409eff;
  margin-right: 16px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.message-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.main-text {
  font-size: 16px;
  font-weight: 500;
  color: #303133;
}

.sub-text {
  font-size: 14px;
  color: #909399;
}

.download-dialog {
  .download-content {
    max-height: 500px;
    overflow-y: auto;
  }

  .download-stats {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    padding: 15px;
    background: var(--el-bg-color-page);
    border-radius: 8px;

    .stat-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;

      .label {
        font-size: 12px;
        color: var(--el-text-color-regular);
      }

      .value {
        font-size: 18px;
        font-weight: bold;

        &.success {
          color: var(--el-color-success);
        }

        &.error {
          color: var(--el-color-danger);
        }

        &.processing {
          color: var(--el-color-primary);
        }
      }
    }
  }

  .overall-progress {
    margin-bottom: 20px;

    .progress-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 14px;
      color: var(--el-text-color-primary);
    }
  }

  .download-list {
    .download-item {
      display: flex;
      align-items: center;
      padding: 12px;
      border: 1px solid var(--el-border-color-light);
      border-radius: 8px;
      margin-bottom: 8px;
      transition: all 0.3s;

      &.completed {
        background: var(--el-color-success-light-9);
        border-color: var(--el-color-success-light-5);
      }

      &.error {
        background: var(--el-color-danger-light-9);
        border-color: var(--el-color-danger-light-5);
      }

      &.downloading {
        background: var(--el-color-primary-light-9);
        border-color: var(--el-color-primary-light-5);
      }

      .file-info {
        display: flex;
        align-items: center;
        flex: 1;
        min-width: 0;

        .file-icon {
          font-size: 24px;
          margin-right: 12px;
          color: var(--el-color-primary);
        }

        .file-details {
          min-width: 0;
          flex: 1;

          .file-name {
            font-weight: 500;
            color: var(--el-text-color-primary);
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
          }

          .file-size {
            font-size: 12px;
            color: var(--el-text-color-regular);
            margin-top: 2px;
          }
        }
      }

      .download-progress {
        flex: 1;
        margin: 0 20px;

        .progress-info {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 12px;

          .status-text {
            color: var(--el-text-color-regular);
          }

          .progress-percent {
            color: var(--el-color-primary);
            font-weight: 500;
          }
        }

        .download-details {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
          font-size: 11px;
          color: var(--el-text-color-secondary);

          .download-speed {
            color: var(--el-color-success);
            font-weight: 500;
          }

          .estimated-time {
            color: var(--el-color-info);
          }
        }
      }

      .download-actions {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 60px;

        .success-icon {
          color: var(--el-color-success);
          font-size: 20px;
        }

        .error-icon {
          color: var(--el-color-danger);
          font-size: 20px;
        }

        .loading-icon {
          color: var(--el-color-primary);
          font-size: 20px;
          animation: rotate 1s linear infinite;
        }
      }
    }
  }

  .dialog-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
  }
}

@keyframes rotate {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}
</style>
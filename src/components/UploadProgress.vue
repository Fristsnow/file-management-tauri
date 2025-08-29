<template>
  <div class="upload-progress-container">
    <div class="upload-header">
      <div class="upload-title-section">
        <span class="upload-title">上传进度</span>
        <div class="upload-stats">
          <span class="stat-item completed">已完成: {{ completedCount }}/{{ totalCount }}</span>
          <span class="stat-item remaining">剩余: {{ remainingCount }}/{{ totalCount }}</span>
        </div>
      </div>
      <div class="upload-actions">
        <el-button size="small" @click="clearCompleted">清除已完成</el-button>
        <el-button size="small" @click="clearAll">清空所有</el-button>
      </div>
    </div>

    <div v-if="uploadProgress.length > 0" class="upload-content">
      <el-scrollbar class="upload-list">
        <div
          v-for="(item, index) in uploadProgress"
          :key="index"
          class="upload-item"
          :class="{
            'upload-success': item.status === 'completed',
            'upload-error': item.status === 'error',
            'upload-uploading': item.status === 'uploading'
          }"
        >
          <div class="upload-info">
            <div class="upload-name">{{ item.name }}</div>
            <div class="upload-details">
              <span class="upload-size">{{ formatSize(item.size) }}</span>
              <span v-if="item.status === 'uploading'" class="upload-speed">
                {{ formatSpeed(item.speed) }}
              </span>
              <span v-if="item.status === 'uploading' && item.speed > 0" class="upload-eta">
                剩余: {{ formatETA(item) }}
              </span>
              <span class="upload-status" :class="`status-${item.status}`">
                {{ getStatusText(item.status) }}
              </span>
            </div>
          </div>

          <div class="upload-progress">
            <el-progress
              :percentage="item.progress"
              :status="getProgressStatus(item.status)"
              :stroke-width="6"
            />
            <div v-if="item.status === 'uploading' && item.totalChunks" class="chunk-info">
              分片: {{ item.uploadedChunks || 0 }}/{{ item.totalChunks }}
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <div v-else class="empty-state">
      <el-empty description="暂无上传任务" />
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed } from 'vue';
import { useFileStore } from '@/stores/fileStore';

// 使用pinia store
const fileStore = useFileStore();

const props = defineProps({
  uploadProgress: {
    type: Array,
    default: () => []
  },
  isFullscreen: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['clear-completed', 'clear-all']);

// 计算统计数据
const totalCount = computed(() => props.uploadProgress.length); // 使用当前上传列表的长度
const completedCount = computed(() =>
  props.uploadProgress.filter(item => item.status === 'completed').length
);
const remainingCount = computed(() =>
  props.uploadProgress.filter(item => item.status !== 'completed').length
);
const currentDisplayCount = computed(() => props.uploadProgress.length); // 当前显示的记录数

// 格式化文件大小
const formatSize = (size) => {
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
  return (size / (1024 * 1024)).toFixed(2) + ' MB';
};

// 格式化上传速度
const formatSpeed = (speed) => {
  if (!speed) return '';
  if (speed < 1024) return speed.toFixed(0) + ' B/s';
  if (speed < 1024 * 1024) return (speed / 1024).toFixed(2) + ' KB/s';
  return (speed / (1024 * 1024)).toFixed(2) + ' MB/s';
};

// 格式化预估剩余时间
const formatETA = (item) => {
  if (!item.speed || item.speed <= 0 || !item.startTime) return '--';

  // 计算已上传的字节数
  const uploadedBytes = (item.progress / 100) * item.size;
  // 计算剩余字节数
  const remainingBytes = item.size - uploadedBytes;

  // 如果剩余字节数小于等于0，说明即将完成
  if (remainingBytes <= 0) return '即将完成';

  // 根据当前速度计算预估剩余时间（秒）
  const etaSeconds = remainingBytes / item.speed;

  // 格式化时间显示
  if (etaSeconds < 60) {
    return Math.ceil(etaSeconds) + '秒';
  } else if (etaSeconds < 3600) {
    const minutes = Math.floor(etaSeconds / 60);
    const seconds = Math.ceil(etaSeconds % 60);
    return minutes + '分' + (seconds > 0 ? seconds + '秒' : '');
  } else {
    const hours = Math.floor(etaSeconds / 3600);
    const minutes = Math.floor((etaSeconds % 3600) / 60);
    return hours + '小时' + (minutes > 0 ? minutes + '分' : '');
  }
};

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'waiting': '等待中',
    'uploading': '上传中',
    'completed': '已完成',
    'error': '上传失败'
  };
  return statusMap[status] || '上传中';
};

// 获取进度条状态
const getProgressStatus = (status) => {
  if (status === 'completed') return 'success';
  if (status === 'error') return 'exception';
  return undefined;
};

// 清除已完成的任务
const clearCompleted = () => {
  emit('clear-completed');
};

// 清空所有任务
const clearAll = () => {
  emit('clear-all');
};
</script>

<style scoped>
.upload-progress-container {
  height: 100%;
  background: var(--bg-primary);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
}

.upload-header {
  padding: var(--spacing-md) var(--spacing-lg);
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  border-bottom: 1px solid var(--border-color);
  height: auto;
  min-height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-sizing: border-box;
  flex-shrink: 0;
}

.upload-title-section {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.upload-stats {
  display: flex;
  gap: var(--spacing-md);
  font-size: 12px;
}

.stat-item {
  padding: 2px 8px;
  border-radius: var(--radius-sm);
  font-weight: 500;
  border: 1px solid;
}

.stat-item.completed {
  color: var(--success-color);
  background: rgba(16, 185, 129, 0.1);
  border-color: var(--success-color);
}

.stat-item.remaining {
  color: var(--primary-color);
  background: var(--primary-light);
  border-color: var(--primary-color);
}

.stat-item.display {
  color: var(--info-color);
  background: rgba(59, 130, 246, 0.1);
  border-color: var(--info-color);
}

.upload-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);

  &::before {
    content: '📤';
    font-size: 18px;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
  }
}

.upload-actions {
  display: flex;
  gap: var(--spacing-sm);

  .el-button {
    height: 32px;
    padding: 0 var(--spacing-md);
    font-size: 13px;
    border: 1px solid var(--border-color);
    border-radius: var(--radius-md);
    background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
    color: var(--text-primary);
    font-weight: 500;
    transition: var(--transition-fast);
    box-shadow: var(--shadow-sm);

    &:hover {
      background: linear-gradient(135deg, var(--bg-hover) 0%, var(--bg-secondary) 100%);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
      border-color: var(--primary-color);
      color: var(--primary-color);
    }

    &:active {
      transform: translateY(0);
      box-shadow: var(--shadow-sm);
    }
  }
}

.upload-content {
  flex: 1;
  overflow: hidden;
  background: var(--bg-primary);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.upload-list {
  height: 100%;
  overflow-y: auto;
  padding: var(--spacing-md);
  box-sizing: border-box;
  background: #fff;

  /* 现代化滚动条 */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: var(--bg-tertiary);
    border-radius: var(--radius-sm);
  }

  &::-webkit-scrollbar-thumb {
    background: linear-gradient(135deg, var(--border-color) 0%, var(--text-tertiary) 100%);
    border-radius: var(--radius-sm);

    &:hover {
      background: linear-gradient(135deg, var(--text-tertiary) 0%, var(--text-secondary) 100%);
    }
  }

  :deep(.el-scrollbar__view) {
    padding-right: var(--spacing-sm);
  }
}

.upload-item {
  background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
  border: 1px solid var(--border-color);
  padding: var(--spacing-md);
  margin-bottom: var(--spacing-sm);
  transition: var(--transition-normal);
  position: relative;
  overflow: hidden;
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-sm);

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.02) 100%);
    pointer-events: none;
  }

  &:hover {
    background: linear-gradient(135deg, var(--bg-hover) 0%, var(--bg-secondary) 100%);
    transform: translateY(-2px);
    box-shadow: var(--shadow-md);
    border-color: var(--primary-color);
  }
}

.upload-item:last-child {
  margin-bottom: 0;
}

.upload-item.upload-success {
  border-color: var(--success-color);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);

  &::before {
    background: linear-gradient(135deg, transparent 0%, rgba(16, 185, 129, 0.05) 100%);
  }
}

.upload-item.upload-error {
  border-color: var(--error-color);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);

  &::before {
    background: linear-gradient(135deg, transparent 0%, rgba(239, 68, 68, 0.05) 100%);
  }
}

.upload-item.upload-uploading {
  border-color: var(--primary-color);
  background: linear-gradient(135deg, var(--primary-light) 0%, rgba(59, 130, 246, 0.05) 100%);

  &::before {
    background: linear-gradient(135deg, transparent 0%, rgba(59, 130, 246, 0.05) 100%);
  }
}

.upload-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2px;
}

.upload-name {
  font-weight: normal;
  color: var(--text-primary);
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  margin-right: 8px;
}

.upload-details {
  display: flex;
  gap: 8px;
  font-size: 10px;
  color: var(--text-secondary);
  align-items: center;
}

.upload-size {
  color: var(--text-secondary);
  font-weight: normal;
}

.upload-speed {
  color: var(--primary-color);
  font-weight: normal;
}

.upload-eta {
  color: #10b981;
  font-weight: 500;
  font-size: 12px;
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
  padding: 2px 6px;
  border-radius: var(--radius-sm);
  border: 1px solid rgba(16, 185, 129, 0.2);
}

.upload-status {
  font-weight: 500;
  font-size: 10px;
  padding: 2px 6px;
  border: 1px solid;
  border-radius: var(--radius-sm);
  display: inline-flex;
  align-items: center;
  gap: 4px;
  position: relative;
  overflow: hidden;
  transition: var(--transition-fast);

  &::before {
    content: '';
    width: 8px;
    height: 8px;
    border-radius: 50%;
    flex-shrink: 0;
  }
}

.status-waiting {
  color: var(--text-tertiary);
  background: linear-gradient(135deg, var(--bg-tertiary) 0%, var(--bg-secondary) 100%);
  border-color: var(--border-color);

  &::before {
    background: var(--text-tertiary);
  }
}

.status-uploading {
  color: var(--primary-color);
  background: linear-gradient(135deg, var(--primary-light) 0%, rgba(59, 130, 246, 0.1) 100%);
  border-color: var(--primary-color);

  &::before {
    background: var(--primary-color);
    animation: pulse 2s infinite;
  }
}

.status-completed {
  color: var(--success-color);
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(16, 185, 129, 0.05) 100%);
  border-color: var(--success-color);

  &::before {
    background: var(--success-color);
  }
}

.status-error {
  color: var(--error-color);
  background: linear-gradient(135deg, rgba(239, 68, 68, 0.1) 0%, rgba(239, 68, 68, 0.05) 100%);
  border-color: var(--error-color);

  &::before {
    background: var(--error-color);
  }
}

@keyframes pulse {
  0% {
    opacity: 1;
    transform: scale(1);
  }
  50% {
    opacity: 0.7;
    transform: scale(1.1);
  }
  100% {
    opacity: 1;
    transform: scale(1);
  }
}

.upload-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 2px;

  :deep(.el-progress) {
    flex: 1;

    .el-progress-bar {
      .el-progress-bar__outer {
        background: var(--bg-tertiary);
        border: 1px solid var(--border-color);
        height: 12px;
      }

      .el-progress-bar__inner {
        background: linear-gradient(to bottom, var(--primary-color) 0%, var(--primary-dark) 100%);
        transition: none;
      }
    }

    .el-progress__text {
      color: var(--text-primary);
      font-weight: normal;
      font-size: 10px;
    }
  }
}

.chunk-info {
  font-size: 9px;
  color: var(--text-tertiary);
  white-space: nowrap;
  font-weight: normal;
  margin-top: 2px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
  box-sizing: border-box;

  :deep(.el-empty) {
    .el-empty__image {
      opacity: 0.6;
      filter: brightness(0.8);
    }

    .el-empty__description {
      color: var(--text-secondary);
      font-weight: normal;
      font-size: 14px;
    }
  }
}

/* 响应式设计 */
@media (max-width: 768px) {
  .upload-header {
    padding: var(--spacing-sm);
    min-height: 50px;
    flex-direction: column;
    gap: var(--spacing-xs);
    align-items: stretch;
  }

  .upload-title-section {
    align-items: center;
    text-align: center;
  }

  .upload-title {
    font-size: 14px;
  }

  .upload-stats {
    justify-content: center;
    font-size: 11px;
  }

  .upload-actions {
    justify-content: center;
    flex-wrap: wrap;
  }

  .upload-list {
    padding: var(--spacing-sm);
  }

  .upload-item {
    padding: var(--spacing-sm);
  }

  .upload-info {
    flex-direction: column;
    align-items: stretch;
    gap: var(--spacing-xs);
  }

  .upload-details {
    justify-content: space-between;
    gap: 4px;
  }
}
</style>

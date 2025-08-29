<template>
  <div class="file-upload-progress-container">
    <div class="file-upload-header">
      <div class="file-upload-title-section">
        <span class="file-upload-title">
          <el-icon class="title-icon"><Document /></el-icon>
          文件上传进度
        </span>
        <div class="file-upload-stats">
          <span class="stat-item completed">已完成: {{ completedCount }}/{{ totalCount }}</span>
          <span class="stat-item uploading">上传中: {{ uploadingCount }}</span>
          <span class="stat-item waiting">等待中: {{ waitingCount }}</span>
        </div>
      </div>
      <div class="file-upload-actions">
        <el-button size="small" @click="toggleDetail" type="primary" text>
          {{ showDetail ? '收起详情' : '展开详情' }}
        </el-button>
        <el-button size="small" @click="clearCompleted" :disabled="completedCount === 0">
          清除已完成
        </el-button>
        <el-button size="small" @click="clearAll" :disabled="totalCount === 0">
          清空所有
        </el-button>
      </div>
    </div>

    <div v-if="fileProgress.length > 0" class="file-upload-content">
      <el-scrollbar class="file-upload-list">
        <div v-show="showDetail">
          <div
            v-for="(item, index) in fileProgress"
            :key="item.id || index"
            class="file-upload-item"
            :class="`status-${item.status}`"
          >
            <div class="file-upload-info">
              <div class="file-header">
                <div class="file-name-section">
                  <el-icon class="file-icon" :class="`icon-${item.status}`">
                    <Document />
                  </el-icon>
                  <div class="file-details">
                    <span class="file-name" :title="item.name">{{ item.name }}</span>
                    <span class="file-stats">
                      {{ formatFileSize(item.size) }}
                      <span v-if="item.currentPath" class="file-path"> · {{ item.currentPath }}</span>
                    </span>
                  </div>
                </div>
                <div class="file-status-section">
                  <span class="file-status" :class="`status-${item.status}`">
                    {{ getStatusText(item.status) }}
                  </span>
                  <span class="file-percentage">{{ item.progress || 0 }}%</span>
                </div>
              </div>
            </div>

            <div class="file-upload-progress">
              <el-progress
                :percentage="item.progress || 0"
                :status="getProgressStatus(item.status)"
                :stroke-width="6"
                :show-text="false"
                class="smooth-progress"
              />
              <div v-if="item.status === 'uploading'" class="file-upload-details">
                <div class="upload-speed">
                  <el-icon class="speed-icon"><Upload /></el-icon>
                  <span v-if="item.speedText" class="speed-text">{{ item.speedText }}</span>
                  <span v-else-if="item.speed > 0" class="speed-text">{{ formatSpeed(item.speed) }}</span>
                  <span v-else class="speed-text">计算中...</span>
                </div>
                <div class="upload-eta">
                  <span v-if="item.etaText" class="eta-text">剩余: {{ item.etaText }}</span>
                  <span v-else-if="item.speed > 0" class="eta-text">剩余: {{ formatETA(item) }}</span>
                </div>
                <div v-if="item.uploadedChunks && item.totalChunks" class="chunk-info">
                  <span class="chunk-text">分片: {{ item.uploadedChunks }}/{{ item.totalChunks }}</span>
                </div>
                <div v-if="item.uploadedBytes && item.totalBytes" class="bytes-info">
                  <span class="bytes-text">{{ formatFileSize(item.uploadedBytes) }}/{{ formatFileSize(item.totalBytes) }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 简化视图 -->
        <div v-show="!showDetail" class="file-summary">
          <div class="summary-stats">
            <div class="summary-item">
              <span class="summary-label">总文件数:</span>
              <span class="summary-value">{{ totalCount }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">总大小:</span>
              <span class="summary-value">{{ formatFileSize(totalSize) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">整体进度:</span>
              <span class="summary-value">{{ overallProgress }}%</span>
            </div>
          </div>
          <div class="summary-progress">
            <el-progress
              :percentage="overallProgress"
              :status="overallProgress === 100 ? 'success' : undefined"
              :stroke-width="12"
              class="overall-progress"
            />
          </div>
        </div>
      </el-scrollbar>
    </div>

    <div v-else class="empty-state">
      <el-empty description="暂无文件上传任务">
        <template #image>
          <el-icon size="64" color="var(--el-color-info)"><Document /></el-icon>
        </template>
      </el-empty>
    </div>
  </div>
</template>

<script setup>
import { defineProps, defineEmits, computed, ref } from 'vue';
import { Document, Upload } from '@element-plus/icons-vue';

const props = defineProps({
  fileProgress: {
    type: Array,
    default: () => []
  },
  isVisible: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['clear-completed', 'clear-all']);

// 控制详情显示
const showDetail = ref(false);

// 计算统计数据
const totalCount = computed(() => props.fileProgress.length);
const completedCount = computed(() =>
  props.fileProgress.filter(file => file.status === 'completed').length
);
const uploadingCount = computed(() =>
  props.fileProgress.filter(file => file.status === 'uploading').length
);
const waitingCount = computed(() =>
  props.fileProgress.filter(file => file.status === 'waiting').length
);

// 计算总大小
const totalSize = computed(() =>
  props.fileProgress.reduce((total, file) => total + (file.size || 0), 0)
);

// 计算整体进度
const overallProgress = computed(() => {
  if (props.fileProgress.length === 0) return 0;

  const totalProgress = props.fileProgress.reduce((total, file) => {
    return total + (file.progress || 0);
  }, 0);

  return Math.round(totalProgress / props.fileProgress.length);
});

// 格式化文件大小
const formatFileSize = (size) => {
  if (!size || size < 1024) return (size || 0) + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
  if (size < 1024 * 1024 * 1024) return (size / (1024 * 1024)).toFixed(2) + ' MB';
  return (size / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
};

// 格式化上传速度
const formatSpeed = (speed) => {
  if (!speed || speed <= 0) return '0 B/s';
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
    'error': '上传失败',
    'paused': '已暂停'
  };
  return statusMap[status] || '上传中';
};

// 获取进度条状态
const getProgressStatus = (status) => {
  if (status === 'completed') return 'success';
  if (status === 'error') return 'exception';
  return undefined;
};

// 切换详情显示
const toggleDetail = () => {
  showDetail.value = !showDetail.value;
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
.file-upload-progress-container {
  height: 100%;
  background: var(--el-bg-color);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid var(--el-border-color-light);
}

.file-upload-header {
  padding: 16px 20px;
  background: linear-gradient(135deg, var(--el-color-success-light-9) 0%, var(--el-color-success-light-8) 100%);
  border-bottom: 1px solid var(--el-border-color-light);
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
}

.file-upload-title-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.file-upload-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.title-icon {
  color: var(--el-color-success);
}

.file-upload-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.stat-item {
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.stat-item.completed {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.stat-item.uploading {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.stat-item.waiting {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.file-upload-actions {
  display: flex;
  gap: 8px;
}

.file-upload-content {
  flex: 1;
  overflow: hidden;
}

.file-upload-list {
  height: 100%;
  padding: 12px;
}

.file-upload-item {
  background: var(--el-bg-color-page);
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 8px;
  transition: all 0.3s ease;
}

.file-upload-item:hover {
  border-color: var(--el-color-success-light-7);
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.file-upload-item.status-completed {
  border-color: var(--el-color-success-light-7);
  background: var(--el-color-success-light-9);
}

.file-upload-item.status-uploading {
  border-color: var(--el-color-primary-light-7);
  background: var(--el-color-primary-light-9);
}

.file-upload-item.status-error {
  border-color: var(--el-color-danger-light-7);
  background: var(--el-color-danger-light-9);
}

.file-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.file-name-section {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.file-icon.icon-completed {
  color: var(--el-color-success);
}

.file-icon.icon-uploading {
  color: var(--el-color-primary);
}

.file-icon.icon-waiting {
  color: var(--el-color-info);
}

.file-icon.icon-error {
  color: var(--el-color-danger);
}

.file-details {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.file-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--el-text-color-primary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-stats {
  font-size: 11px;
  color: var(--el-text-color-regular);
}

.file-path {
  color: var(--el-text-color-placeholder);
}

.file-status-section {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}

.file-status {
  font-size: 11px;
  font-weight: 500;
  padding: 1px 6px;
  border-radius: 3px;
}

.file-status.status-completed {
  background: var(--el-color-success-light-9);
  color: var(--el-color-success);
}

.file-status.status-uploading {
  background: var(--el-color-primary-light-9);
  color: var(--el-color-primary);
}

.file-status.status-waiting {
  background: var(--el-color-info-light-9);
  color: var(--el-color-info);
}

.file-status.status-error {
  background: var(--el-color-danger-light-9);
  color: var(--el-color-danger);
}

.file-percentage {
  font-size: 12px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.file-upload-progress {
  margin-top: 6px;
}

.smooth-progress {
  transition: all 0.3s ease;
}

.file-upload-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 6px;
  font-size: 11px;
  color: var(--el-text-color-regular);
  flex-wrap: wrap;
  gap: 8px;
}

.upload-speed {
  display: flex;
  align-items: center;
  gap: 4px;
}

.speed-icon {
  color: var(--el-color-primary);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

.speed-text {
  color: var(--el-color-primary);
  font-weight: 500;
}

.eta-text, .chunk-text, .bytes-text {
  color: var(--el-text-color-regular);
}

/* 简化视图样式 */
.file-summary {
  padding: 20px;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 16px;
  margin-bottom: 20px;
}

.summary-item {
  display: flex;
  flex-direction: column;
  gap: 4px;
  text-align: center;
  padding: 12px;
  background: var(--el-bg-color-page);
  border-radius: 6px;
  border: 1px solid var(--el-border-color-lighter);
}

.summary-label {
  font-size: 12px;
  color: var(--el-text-color-regular);
}

.summary-value {
  font-size: 16px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.summary-progress {
  margin-top: 16px;
}

.overall-progress {
  font-size: 14px;
}

.empty-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px;
}
</style>

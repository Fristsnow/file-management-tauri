<template>
  <div class="folder-upload-progress-container">
    <div class="folder-upload-header">
      <div class="folder-upload-title-section">
        <span class="folder-upload-title">
          <el-icon class="title-icon"><Folder /></el-icon>
          文件夹上传进度
        </span>
        <div class="folder-upload-stats">
          <span class="stat-item completed">已完成: {{ completedCount }}/{{ totalCount }}</span>
          <span class="stat-item uploading">上传中: {{ uploadingCount }}</span>
          <span class="stat-item waiting">等待中: {{ waitingCount }}</span>
<!--          <span class="stat-item ws-status" :class="{ 'connected': wsConnected, 'disconnected': !wsConnected }">-->
<!--            WebSocket: {{ wsConnected ? '已连接' : '未连接' }}-->
<!--          </span>-->
        </div>
      </div>
      <div class="folder-upload-actions">
        <el-button size="small" @click="clearCompleted" :disabled="completedCount === 0">
          清除已完成
        </el-button>
        <el-button size="small" @click="clearAll" :disabled="totalCount === 0">
          清空所有
        </el-button>
      </div>
    </div>

    <div v-if="folderProgress.size > 0" class="folder-upload-content">
      <el-scrollbar class="folder-upload-list">
        <div
          v-for="[folderName, folderInfo] in Array.from(mergedFolderProgress)"
          :key="folderName"
          class="folder-upload-item"
          :class="`status-${folderInfo.status}`"
        >
          <div class="folder-upload-info">
            <div class="folder-header">
              <div class="folder-name-section">
                <el-icon class="folder-icon" :class="`status-${folderInfo.status}`"><FolderOpened /></el-icon>
              </div>
              <div class="folder-status">
                <span class="status-text">{{ getStatusText(folderInfo.status) }}</span>
                <span class="folder-progress-text">{{ folderInfo.completedFiles }}/{{ folderInfo.totalFiles }} 文件</span>
              </div>
            </div>
<!--            <div class="folder-actions">-->
<!--              <el-button size="small" type="text" @click="toggleFolderDetail(folderName)">-->
<!--                {{ folderInfo.showDetail ? '收起' : '展开' }}-->
<!--              </el-button>-->
<!--            </div>-->
          </div>

          <div class="folder-progress">
            <el-progress
              :percentage="folderInfo.progress"
              :status="getProgressStatus(folderInfo.status)"
              :show-text="false"
            />
          </div>

          <div v-if="folderInfo.showDetail" class="file-list">
            <div
              v-for="file in folderInfo.files"
              :key="file.name"
              class="file-item"
              :class="`file-status-${file.status}`"
            >
              <div class="file-info">
                <span class="file-name">{{ file.name }}</span>
                <span class="file-size">{{ formatFileSize(file.size) }}</span>
              </div>
              <div class="file-progress">
                <el-progress
                  :percentage="file.progress"
                  :status="getProgressStatus(file.status)"
                  size="small"
                />
              </div>
            </div>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <div v-else class="folder-upload-empty">
      <el-icon class="empty-icon"><FolderOpened /></el-icon>
      <p>暂无文件夹上传任务</p>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue';
import { ElProgress, ElButton, ElIcon, ElScrollbar } from 'element-plus';
import { Folder, FolderOpened } from '@element-plus/icons-vue';

const props = defineProps({
  folderProgress: {
    type: Map,
    default: () => new Map()
  },
  isVisible: {
    type: Boolean,
    default: true
  },
  wsConnected: {
    type: Boolean,
    default: false
  }
});

const emit = defineEmits(['clear-completed', 'clear-all']);

const showDetail = ref(true);

// 只保留最后一项文件夹进度数据
const mergedFolderProgress = computed(() => {
  const resultMap = new Map();

  if (props.folderProgress.size === 0) {
    return resultMap;
  }

  // 找到最新的文件夹项（基于时间戳）
  let latestEntry = null;
  let latestTime = 0;

  for (const [folderName, folderInfo] of props.folderProgress) {
    const currentTime = folderInfo.lastUpdated || 0;
    if (currentTime >= latestTime) {
      latestTime = currentTime;
      latestEntry = [folderName, folderInfo];
    }
  }

  // 只保留最新的一项
  if (latestEntry) {
    resultMap.set(latestEntry[0], latestEntry[1]);
    console.log(`只保留最新的文件夹项: ${latestEntry[0]}`);
  }

  return resultMap;
});

// 计算统计数据
const totalCount = computed(() => {
  let total = 0;
  for (const [, folderInfo] of mergedFolderProgress.value) {
    total += folderInfo.totalFiles || 0;
  }
  return total;
});

const completedCount = computed(() => {
  let completed = 0;
  for (const [, folderInfo] of mergedFolderProgress.value) {
    completed += folderInfo.completedFiles || 0;
  }
  return completed;
});

const uploadingCount = computed(() => {
  let uploading = 0;
  for (const [, folderInfo] of mergedFolderProgress.value) {
    if (folderInfo.status === 'uploading') {
      uploading += (folderInfo.totalFiles || 0) - (folderInfo.completedFiles || 0);
    }
  }
  return uploading;
});

const waitingCount = computed(() => {
  let waiting = 0;
  for (const [, folderInfo] of mergedFolderProgress.value) {
    if (folderInfo.status === 'waiting') {
      waiting += folderInfo.totalFiles || 0;
    }
  }
  return waiting;
});

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    waiting: '等待中',
    uploading: '上传中',
    completed: '已完成',
    error: '上传失败',
    paused: '已暂停'
  };
  return statusMap[status] || '上传中';
};

// 获取进度条状态
const getProgressStatus = (status) => {
  const statusMap = {
    completed: 'success',
    error: 'exception',
    uploading: null,
    waiting: null,
    paused: 'warning'
  };
  return statusMap[status];
};

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 切换文件夹详情显示
const toggleFolderDetail = (folderName) => {
  const folderInfo = mergedFolderProgress.value.get(folderName);
  if (folderInfo) {
    folderInfo.showDetail = !folderInfo.showDetail;
  }
};

// 清除已完成任务
const clearCompleted = () => {
  emit('clear-completed');
};

// 清空所有任务
const clearAll = () => {
  emit('clear-all');
};


</script>

<style scoped>
.folder-upload-progress-container {
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.folder-upload-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
}

.folder-upload-title-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.folder-upload-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
}

.title-icon {
  color: #409eff;
}

.folder-upload-stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
}

.stat-item {
  padding: 2px 8px;
  border-radius: 4px;
  background: #f0f0f0;
}

.ws-status.connected {
  background: #f0f9f0;
  color: #67c23a;
  font-weight: 500;
}

.ws-status.disconnected {
  background: #fef0f0;
  color: #f56c6c;
  font-weight: 500;
}

.stat-item.completed {
  background: #f0f9ff;
  color: #67c23a;
}

.stat-item.uploading {
  background: #fff7e6;
  color: #e6a23c;
}

.stat-item.waiting {
  background: #f5f7fa;
  color: #909399;
}

.folder-upload-actions {
  display: flex;
  gap: 8px;
}

.folder-upload-content {
  max-height: 400px;
}

.folder-upload-list {
  padding: 0;
}

.folder-upload-item {
  padding: 16px 20px;
  border-bottom: 1px solid #f0f0f0;
  transition: background-color 0.2s;
}

.folder-upload-item:hover {
  background: #fafafa;
}

.folder-upload-item:last-child {
  border-bottom: none;
}

.folder-upload-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.folder-header {
  display: flex;
  align-items: center;
  gap: 12px;
}

.folder-name-section {
  display: flex;
  align-items: center;
  gap: 8px;
}

.folder-icon {
  font-size: 18px;
}

.folder-icon.status-waiting {
  color: #909399;
}

.folder-icon.status-uploading {
  color: #409eff;
}

.folder-icon.status-completed {
  color: #67c23a;
}

.folder-icon.status-error {
  color: #f56c6c;
}

.folder-status {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.status-text {
  font-size: 14px;
  font-weight: 500;
}

.folder-progress-text {
  font-size: 12px;
  color: #909399;
}

.folder-progress {
  margin-bottom: 12px;
}

.file-list {
  margin-left: 26px;
  padding-left: 16px;
  border-left: 2px solid #f0f0f0;
}

.file-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f8f9fa;
}

.file-item:last-child {
  border-bottom: none;
}

.file-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.file-name {
  font-size: 13px;
  color: #303133;
}

.file-size {
  font-size: 11px;
  color: #909399;
}

.file-progress {
  width: 120px;
  margin-left: 16px;
}

.folder-upload-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  color: #909399;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
  opacity: 0.5;
}

.folder-upload-empty p {
  margin: 0;
  font-size: 14px;
}

/* 状态样式 */
.status-waiting {
  opacity: 0.7;
}

.status-uploading {
  background: #f0f9ff;
}

.status-completed {
  background: #f0f9f0;
}

.status-error {
  background: #fef0f0;
}

.file-status-waiting .file-name {
  color: #909399;
}

.file-status-uploading .file-name {
  color: #409eff;
  font-weight: 500;
}

.file-status-completed .file-name {
  color: #67c23a;
}

.file-status-error .file-name {
  color: #f56c6c;
}
</style>

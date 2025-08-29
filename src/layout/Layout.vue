<script setup>
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowDown, Download, Upload, Document, Close } from '@element-plus/icons-vue'
import { useUserStore } from '@/stores/userStore'
import { useFileStore } from '@/stores/fileStore'

// 全屏状态
const isFullscreen = ref(false)



const route = useRoute()
const router = useRouter()
const userStore = useUserStore()
const fileStore = useFileStore()

const activeMenu = computed(() => {
  if (route.name === 'FileManager') return 'files'
  if (route.name === 'UploadManager' || route.name === 'UploadProgress') return 'uploads'
  if (route.name === 'UserProfile') return 'profile'
  return 'files'
})

const menuItems = [
  {
    key: 'files',
    label: '我的文件',
    icon: 'el-icon-folder',
    route: '/'
  },
  {
    key: 'profile',
    label: '上传记录',
    icon: 'el-icon-user',
    route: '/profile'
  },
  {
    key: 'profile',
    label: '回收站',
    icon: 'el-icon-user',
    route: '/profile'
  }
]

const handleMenuClick = (menuKey) => {
  const menuItem = menuItems.find(item => item.key === menuKey)
  if (menuItem && menuItem.route) {
    router.push(menuItem.route)
  }
}

const handleUserMenuCommand = async (command) => {
  switch (command) {
    // case 'profile':
    //   router.push('/profile')
    //   break
    case 'settings':
      await router.push('/settings')
      break
    case 'logout':
      await handleLogout()
      break
  }
}

const handleLogout = async () => {
  try {
    const confirmed = await ElMessageBox.confirm(
      '确定要退出登录吗？',
      '退出确认',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning',
      }
    )

    if (confirmed) {
      localStorage.removeItem('token')
      localStorage.removeItem('userInfo')

      userStore.clearUserInfo()

      ElMessage.success('已退出登录')

      router.push('/login')
    }
  } catch {

  }
}

// 格式化文件大小
const formatFileSize = (size) => {
  if (!size || size === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let index = 0
  let fileSize = size
  
  while (fileSize >= 1024 && index < units.length - 1) {
    fileSize /= 1024
    index++
  }
  
  return `${fileSize.toFixed(index === 0 ? 0 : 1)} ${units[index]}`
}

// 格式化速度
const formatSpeed = (bytesPerSecond) => {
  if (!bytesPerSecond) return '0 B/s'
  if (bytesPerSecond < 1024) return bytesPerSecond.toFixed(0) + ' B/s'
  if (bytesPerSecond < 1024 * 1024) return (bytesPerSecond / 1024).toFixed(2) + ' KB/s'
  if (bytesPerSecond < 1024 * 1024 * 1024) return (bytesPerSecond / (1024 * 1024)).toFixed(2) + ' MB/s'
  return (bytesPerSecond / (1024 * 1024 * 1024)).toFixed(2) + ' GB/s'
}

// 格式化时间
const formatTime = (seconds) => {
  if (!seconds || seconds <= 0) return ''
  if (seconds < 60) return Math.round(seconds) + '秒'
  if (seconds < 3600) return Math.round(seconds / 60) + '分钟'
  return Math.round(seconds / 3600) + '小时'
}

// 获取状态文本
const getStatusText = (status) => {
  const statusMap = {
    'pending': '等待中',
    'waiting': '等待中',
    'uploading': '上传中',
    'downloading': '下载中',
    'completing': '即将完成',
    'completed': '已完成',
    'success': '已完成',
    'error': '失败',
    'failed': '失败',
    'cancelled': '已取消'
  }
  return statusMap[status] || '未知'
}

// 获取进度条状态
const getProgressStatus = (status) => {
  if (status === 'completed' || status === 'success') return 'success'
  if (status === 'error' || status === 'failed') return 'exception'
  return undefined
}

// 获取项目样式类
const getItemClass = (item) => {
  return {
    'completed': item.status === 'completed' || item.status === 'success',
    'error': item.status === 'error' || item.status === 'failed',
    'processing': item.status === 'uploading' || item.status === 'downloading' || item.status === 'completing'
  }
}

// 计算属性：是否有已完成的记录
const hasFinishedRecords = computed(() => {
  const finishedStatuses = ['completed', 'success', 'error', 'failed']
  return fileStore.uploadProgress.some(item => finishedStatuses.includes(item.status)) ||
         fileStore.downloadQueue.some(item => finishedStatuses.includes(item.status))
})

// 计算属性：是否有任何记录
const hasAnyRecords = computed(() => {
  return fileStore.uploadProgress.length > 0 || fileStore.downloadQueue.length > 0
})

// 清除已完成的记录
const clearFinishedRecords = () => {
  fileStore.clearFinishedRecords()
  ElMessage.success('已清除完成的记录')
}

// 清除所有记录
const clearAllRecords = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要清除所有传输记录吗？此操作不可恢复。',
      '确认清除',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    fileStore.clearAllRecords()
    ElMessage.success('已清除所有记录')
  } catch {
    // 用户取消操作
  }
}

// 移除下载项
const removeDownloadItem = (id) => {
  fileStore.removeDownloadItem(id)
}

// 移除上传项
// 取消下载任务
const cancelDownloadItem = async (id) => {
  // 注释掉用户确认流程，直接执行取消操作
  // try {
  //   await ElMessageBox.confirm(
  //     '确定要取消这个下载任务吗？',
  //     '取消下载',
  //     {
  //       confirmButtonText: '确定',
  //       cancelButtonText: '取消',
  //       type: 'warning'
  //     }
  //   )
    const success = fileStore.cancelDownloadItem(id)
    if (success) {
      ElMessage.success('已取消下载任务')
    } else {
      ElMessage.warning('无法取消该任务')
    }
  // } catch {
  //   // 用户取消操作
  // }
}

// 切换进度区域全屏状态
const toggleFullscreen = () => {
  isFullscreen.value = !isFullscreen.value
  ElMessage.success(isFullscreen.value ? '进度区域已全屏显示' : '已退出全屏显示')
}
</script>

<template>
  <div class="layout-container">
    <!-- 顶部标题栏 -->
    <div class="header">
      <div class="header-left">
        <h1 class="app-title">文件管理系统</h1>
      </div>
      <div class="header-right">
        <el-dropdown @command="handleUserMenuCommand">
          <span class="user-menu">
            <span class="user-info">欢迎使用</span>
            <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
          </span>
          <template #dropdown>
            <el-dropdown-menu>
              <!-- <el-dropdown-item command="profile">个人信息</el-dropdown-item> -->
              <el-dropdown-item command="settings">应用设置</el-dropdown-item>
              <el-dropdown-item command="logout" divided>退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </div>

    <!-- 主体内容区域 -->
    <div class="main-container">
      <!-- 上半部分：文件管理区域 -->
      <div class="upper-section">
        <!-- 左侧菜单 -->
        <div class="sidebar">
          <div class="menu-list">
            <div
              v-for="item in menuItems"
              :key="item.key"
              class="menu-item"
              :class="{ active: activeMenu === item.key }"
              @click="handleMenuClick(item.key)"
            >
              <i :class="item.icon" class="menu-icon"></i>
              <span class="menu-label">{{ item.label }}</span>
            </div>
          </div>
        </div>

        <!-- 右侧内容区域 -->
        <div class="content-area">
          <RouterView />
        </div>
      </div>

      <!-- 下半部分：进度监控区域 -->
      <div class="lower-section" :class="{ fullscreen: isFullscreen }">
        <div class="progress-container">
          <div class="progress-header">
            <h3>传输进度监控</h3>
            <div class="header-actions">
              <el-button size="small" @click="toggleFullscreen">
                {{ isFullscreen ? '退出全屏' : '全屏' }}
              </el-button>
              <el-button size="small" @click="clearFinishedRecords" :disabled="!hasFinishedRecords">
                清除已完成
              </el-button>
              <el-button size="small" type="danger" @click="clearAllRecords" :disabled="!hasAnyRecords">
                清除全部
              </el-button>
            </div>
          </div>
          <div class="progress-content">
            <!-- 下载进度 -->
            <div class="download-progress">
              <div class="section-header">
                <h4>下载进度</h4>
                <span class="count-badge">{{ fileStore.downloadQueue.length }}/30</span>
              </div>
              <div v-if="fileStore.downloadQueue.length === 0" class="empty-state">
                <el-icon class="empty-icon"><Download /></el-icon>
                <span>暂无下载任务</span>
              </div>
              <div v-else class="progress-list">
                <div v-for="item in fileStore.downloadQueue" :key="item.id" class="progress-item" :class="getItemClass(item)">
                  <div class="item-header">
                    <div class="file-info">
                      <el-icon class="file-icon"><Document /></el-icon>
                      <div class="file-details">
                        <span class="file-name" :title="item.originalFileName || item.name">{{ item.originalFileName || item.name }}</span>
                        <span class="file-size">{{ formatFileSize(item.fileSize || item.size) }}</span>
                      </div>
                    </div>
                    <div class="item-actions">
                      <span class="status-text">{{ getStatusText(item.status) }}</span>
                      <!-- 根据状态显示不同的按钮 -->
                      <el-button 
                        v-if="item.status === 'downloading' || item.status === 'pending'"
                        size="small" 
                        type="text" 
                        @click="cancelDownloadItem(item.id)" 
                        class="cancel-btn"
                        title="取消下载"
                      >
                        取消
                      </el-button>
                      <el-button 
                        v-else
                        size="small" 
                        type="text" 
                        @click="removeDownloadItem(item.id)" 
                        class="remove-btn"
                        title="移除记录"
                      >
                        <el-icon><Close /></el-icon>
                      </el-button>
                    </div>
                  </div>
                  <div class="progress-bar">
                    <el-progress :percentage="item.progress || 0" :status="getProgressStatus(item.status)" :stroke-width="6" />
                  </div>
                  <div v-if="item.status === 'downloading' && item.downloadSpeed" class="progress-details">
                    <span class="speed">{{ formatSpeed(item.downloadSpeed) }}</span>
                    <span v-if="item.estimatedTime" class="time">剩余 {{ formatTime(item.estimatedTime) }}</span>
                  </div>
                </div>
              </div>
            </div>
            

          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.layout-container {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background-color: #f2f4f7;
  font-family: "Segoe UI", "PingFang SC", sans-serif;
}

/* ===== 顶部标题栏 ===== */
.header {
  height: 60px;
  background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
  backdrop-filter: blur(6px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 24px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  position: sticky;
  top: 0;
  z-index: 1000;
}

.app-title {
  color: white;
  font-size: 20px;
  font-weight: 600;
  margin: 0;
  letter-spacing: 0.5px;
}

.user-menu {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 6px 10px;
  border-radius: 6px;
  transition: background-color 0.3s;
}

.user-menu:hover {
  background-color: rgba(255, 255, 255, 0.15);
}

.user-info {
  color: #fff;
  font-size: 14px;
  margin-right: 6px;
  font-weight: 500;
}

.dropdown-icon {
  color: #fff;
  font-size: 12px;
}

/* ===== 主体布局 ===== */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* 上半部分：文件管理区域 */
.upper-section {
  flex: 1;
  display: flex;
  overflow: hidden;
  min-height: 0;
}

/* 下半部分：进度监控区域 */
.lower-section {
  height: 300px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -2px 6px rgba(0, 0, 0, 0.04);
  transition: all 0.3s ease;
}

/* 进度区域全屏状态 */
.lower-section.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  z-index: 9999;
  border-top: none;
  box-shadow: none;
}

.progress-container {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.progress-header {
  padding: 12px 16px;
  border-bottom: 1px solid #e5e7eb;
  background: #f9fafb;
}

.progress-header h3 {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.progress-content {
  flex: 1;
  display: flex;
  overflow: hidden;
}

.download-progress,
.upload-progress {
  flex: 1;
  padding: 12px;
  border-right: 1px solid #e5e7eb;
}

.upload-progress {
  border-right: none;
}

.download-progress h4,
.upload-progress h4 {
  margin: 0 0 8px 0;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}

.empty-state {
  color: #9ca3af;
  font-size: 12px;
  text-align: center;
  padding: 20px;
}

.progress-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e4e7ed;
}

.progress-header h3 {
  margin: 0;
  color: #303133;
  font-size: 16px;
  font-weight: 600;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-header h4 {
  margin: 0;
  color: #606266;
  font-size: 14px;
  font-weight: 500;
}

.count-badge {
  background: #f0f2f5;
  color: #606266;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: #909399;
  background: #fafafa;
  border-radius: 8px;
  border: 1px dashed #dcdfe6;
}

.empty-icon {
  font-size: 32px;
  margin-bottom: 8px;
  opacity: 0.6;
}

.progress-list {
  max-height: 300px;
  overflow-y: auto;
  padding-right: 4px;
}

.progress-list::-webkit-scrollbar {
  width: 6px;
}

.progress-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.progress-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.progress-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

.progress-item {
  margin-bottom: 12px;
  padding: 12px;
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.progress-item:hover {
  border-color: #c6e2ff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.progress-item.completed {
  border-color: #67c23a;
  background: #f0f9ff;
}

.progress-item.error {
  border-color: #f56c6c;
  background: #fef0f0;
}

.progress-item.processing {
  border-color: #409eff;
  background: #ecf5ff;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}

.file-info {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
}

.file-icon {
  color: #606266;
  margin-right: 8px;
  flex-shrink: 0;
}

.file-details {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.file-name {
  font-weight: 500;
  color: #303133;
  font-size: 13px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.file-size {
  color: #909399;
  font-size: 11px;
}

.item-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.status-text {
  color: #606266;
  font-size: 12px;
  font-weight: 500;
}

.progress-item.completed .status-text {
  color: #67c23a;
}

.progress-item.error .status-text {
  color: #f56c6c;
}

.progress-item.processing .status-text {
  color: #409eff;
}

.remove-btn {
  color: #c0c4cc;
  padding: 4px;
  min-height: auto;
}

.remove-btn:hover {
  color: #f56c6c;
  background: #fef0f0;
}

.cancel-btn {
  color: #e6a23c;
  padding: 4px 8px;
  min-height: auto;
  font-size: 12px;
  font-weight: 500;
}

.cancel-btn:hover {
  color: #cf9236;
  background: #fdf6ec;
}

.progress-bar {
  margin-bottom: 8px;
}

.progress-details {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 11px;
  color: #909399;
}

.speed {
  font-weight: 500;
  color: #606266;
}

.time {
  font-style: italic;
}

/* 左侧菜单 */
.sidebar {
  width: 220px;
  background: #fff;
  border-right: 1px solid #e5e7eb;
  box-shadow: 2px 0 6px rgba(0, 0, 0, 0.04);
  transition: width 0.3s ease;
}

.menu-list {
  padding: 16px 0;
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  cursor: pointer;
  border-radius: 6px;
  margin: 4px 12px;
  transition: all 0.25s ease;
}

.menu-item:hover {
  background-color: #f1f5ff;
  color: #2563eb;
}

.menu-item.active {
  background-color: #e0ecff;
  color: #2563eb;
  font-weight: 600;
}

.menu-icon {
  font-size: 18px;
  margin-right: 12px;
  width: 18px;
  text-align: center;
}

.menu-label {
  font-size: 14px;
}

/* 内容区 */
.content-area {
  flex: 1;
  background: #f9fafb;
  overflow: auto;
}

.content-panel {
  height: 100%;
  background: #fff;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.03);
}

/* ===== 响应式设计 ===== */
@media (max-width: 1024px) {
  .sidebar {
    width: 180px;
  }
  .lower-section {
    height: 180px;
  }
}

@media (max-width: 768px) {
  .sidebar {
    width: 60px;
    min-width: 60px;
  }
  .menu-label {
    display: none;
  }
  .menu-item {
    justify-content: center;
    padding: 12px 8px;
  }
  .menu-icon {
    margin-right: 0;
    font-size: 20px;
  }
}

@media (max-width: 480px) {
  .header {
    height: 50px;
    padding: 0 12px;
  }
  .app-title {
    font-size: 16px;
  }
  .user-info {
    font-size: 12px;
  }
  .sidebar {
    width: 50px;
  }
  .menu-item {
    padding: 10px 6px;
  }
}

</style>

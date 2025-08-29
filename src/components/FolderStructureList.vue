<template>
  <div class="folder-structure-list">
    <div class="list-header">
      <div class="header-title">
        <el-icon><Document /></el-icon>
        <span>待上传文件 ({{ fileList.length }} 个文件)</span>
      </div>
      <div class="header-actions">
        <el-button
          v-if="fileList.length > 0"
          type="danger"
          plain
          size="small"
          @click="$emit('clear-all')"
        >
          清空全部
        </el-button>
      </div>
    </div>

    <!-- 虚拟滚动列表 -->
    <div class="virtual-list-container" ref="containerRef">
      <div
        class="virtual-list-content"
        :style="{ height: totalHeight + 'px' }"
      >
        <div
          v-for="item in visibleItems"
          :key="item.index"
          class="file-item"
          :style="{
            position: 'absolute',
            top: item.top + 'px',
            left: 0,
            right: 0,
            height: itemHeight + 'px'
          }"
        >
          <div class="file-info">
            <div class="file-icon">
              <el-icon v-if="item.file.isEmptyFolderPlaceholder" color="#409eff">
                <Folder />
              </el-icon>
              <el-icon v-else-if="isImage(item.file)" color="#67c23a">
                <Picture />
              </el-icon>
              <el-icon v-else-if="isVideo(item.file)" color="#e6a23c">
                <VideoPlay />
              </el-icon>
              <el-icon v-else-if="isAudio(item.file)" color="#f56c6c">
                <VideoPlay />
              </el-icon>
              <el-icon v-else color="#909399">
                <Document />
              </el-icon>
            </div>
            <div class="file-details">
              <div class="file-name" :title="getDisplayFileName(item.file)">
                {{ getDisplayFileName(item.file) }}
              </div>
              <div class="file-meta">
                <span class="file-size">{{ formatFileSize(item.file.size) }}</span>
                <span class="file-path" :title="getDisplayPath(item.file)">
                  {{ getDisplayPath(item.file) }}
                </span>
              </div>
            </div>
          </div>
          <div class="file-actions">
            <el-button
              type="danger"
              plain
              size="small"
              circle
              @click="$emit('remove-file', item.index)"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>

    <!-- 统计信息 -->
    <div class="list-footer" v-if="fileList.length > 0">
      <div class="stats">
        <span>总计: {{ totalFiles }} 个文件</span>
        <span>大小: {{ formatFileSize(totalSize) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import {
  Document,
  Folder,
  Picture,
  VideoPlay,
  Close
} from '@element-plus/icons-vue'

const props = defineProps({
  fileList: {
    type: Array,
    default: () => []
  }
})

const emit = defineEmits(['remove-file', 'clear-all'])

// 虚拟滚动相关
const containerRef = ref(null)
const itemHeight = 60 // 每个文件项的高度
const containerHeight = ref(400) // 容器高度
const scrollTop = ref(0)
const visibleCount = computed(() => Math.ceil(containerHeight.value / itemHeight) + 2)

// 所有文件的扁平化列表
const allFiles = computed(() => {
  return props.fileList.map((file, index) => ({
    file,
    index
  }))
})

// 总高度
const totalHeight = computed(() => allFiles.value.length * itemHeight)

// 可见项目
const visibleItems = computed(() => {
  const startIndex = Math.floor(scrollTop.value / itemHeight)
  const endIndex = Math.min(startIndex + visibleCount.value, allFiles.value.length)
  
  return allFiles.value.slice(startIndex, endIndex).map((item, i) => ({
    ...item,
    top: (startIndex + i) * itemHeight
  }))
})

// 滚动处理
const handleScroll = (event) => {
  scrollTop.value = event.target.scrollTop
}

// 组件挂载时设置滚动监听
onMounted(async () => {
  await nextTick()
  if (containerRef.value) {
    containerRef.value.addEventListener('scroll', handleScroll)
    // 设置容器高度
    const rect = containerRef.value.getBoundingClientRect()
    containerHeight.value = Math.min(400, window.innerHeight - rect.top - 100)
  }
})

// 组件卸载时移除监听
onUnmounted(() => {
  if (containerRef.value) {
    containerRef.value.removeEventListener('scroll', handleScroll)
  }
})

// 获取显示的文件名
const getDisplayFileName = (file) => {
  if (!file) return '未知文件'
  if (file.isEmptyFolderPlaceholder) return '空文件夹'
  if (!file.name || typeof file.name !== 'string') return '未命名文件'
  return file.name
}

// 获取显示的路径
const getDisplayPath = (file) => {
  if (!file) return ''
  if (file.isEmptyFolderPlaceholder) {
    return file.folderPath || ''
  }
  if (file.webkitRelativePath) {
    return file.webkitRelativePath
  }
  return '根目录'
}



// 总文件数
const totalFiles = computed(() => props.fileList.length)

// 总大小
const totalSize = computed(() => {
  return props.fileList.reduce((total, file) => total + (file.size || 0), 0)
})

// 文件类型判断
const isImage = (file) => {
  const imageTypes = ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp']
  const ext = getFileExtension(file.name)
  return imageTypes.includes(ext.toLowerCase())
}

const isVideo = (file) => {
  const videoTypes = ['mp4', 'avi', 'mov', 'wmv', 'flv', 'mkv', 'webm']
  const ext = getFileExtension(file.name)
  return videoTypes.includes(ext.toLowerCase())
}

const isAudio = (file) => {
  const audioTypes = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma']
  const ext = getFileExtension(file.name)
  return audioTypes.includes(ext.toLowerCase())
}

// 获取文件扩展名
const getFileExtension = (filename) => {
  if (!filename || typeof filename !== 'string') {
    return ''
  }
  return filename.split('.').pop() || ''
}

// 获取文件名
const getFileName = (file) => {
  if (!file) {
    return '未知文件'
  }
  if (file.isEmptyFolderPlaceholder) {
    return `📁 空文件夹`
  }
  return file.name || '未命名文件'
}

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
</script>

<style scoped>
.folder-structure-list {
  border: 1px solid var(--border-color);
  border-radius: 8px;
  background: var(--bg-primary);
  overflow: hidden;
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 500;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.virtual-list-container {
  height: 400px;
  overflow-y: auto;
  position: relative;
}

.virtual-list-content {
  position: relative;
  width: 100%;
}

.file-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border-light);
  background: var(--bg-primary);
  transition: background-color 0.2s;
  box-sizing: border-box;
}

.file-item:hover {
  background: var(--bg-hover);
}

.file-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.file-icon {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-details {
  flex: 1;
  min-width: 0;
}

.file-name {
  font-size: 14px;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
  font-weight: 500;
}

.file-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-tertiary);
  align-items: center;
}

.file-size {
  flex-shrink: 0;
  white-space: nowrap;
}

.file-path {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
  max-width: 300px;
}

.file-actions {
  flex-shrink: 0;
  margin-left: 12px;
}

.list-footer {
  padding: 8px 16px;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-color);
}

.stats {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: var(--text-secondary);
}

/* 滚动条样式 */
.virtual-list-container::-webkit-scrollbar {
  width: 6px;
}

.virtual-list-container::-webkit-scrollbar-track {
  background: var(--bg-tertiary);
  border-radius: 3px;
}

.virtual-list-container::-webkit-scrollbar-thumb {
  background: var(--border-hover);
  border-radius: 3px;
}

.virtual-list-container::-webkit-scrollbar-thumb:hover {
  background: var(--border-dark);
}
</style>
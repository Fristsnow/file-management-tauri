<template>
  <div 
    class="file-list" 
    @dragover="handleDragOver" 
    @drop="handleDrop"
    @keydown="handleKeyDown"
    tabindex="0"
  >
    <!-- 批量操作工具栏 -->
    <div v-if="selectedFiles.length > 0" class="batch-toolbar">
      <div class="selected-info">
        <span>已选择 {{ selectedFiles.length }} 个文件</span>
      </div>
      <div class="batch-actions">
        <el-button
            style="color: #0f172a"
            type="primary"
            size="small"
            @click="handleBatchDownload"
            :disabled="selectedFiles.length === 0"
        >
          批量下载
        </el-button>
        <el-button
            type="danger"
            size="small"
            @click="handleBatchDelete"
            :disabled="selectedFiles.length === 0"
        >
          批量删除
        </el-button>
        <el-button size="small" @click="clearSelection">取消选择</el-button>
      </div>
    </div>

    <!-- 文件统计信息 -->
    <div class="file-stats">
      <div class="stats-info">
        <span class="total-count">共 {{ totalCount }} 项</span>
        <span class="file-count">文件 {{ fileCount }} 个</span>
        <span class="folder-count">文件夹 {{ folderCount }} 个</span>
      </div>
    </div>

    <!-- 表头 -->
    <div class="table-header">
      <div class="col checkbox">
        <input
            type="checkbox"
            :checked="isAllSelected"
            :indeterminate="isIndeterminate"
            @change="toggleSelectAll"
            title="全选/取消全选"
        />
      </div>
      <div class="col name">文件名</div>
      <div class="col size">大小</div>
      <div class="col time">修改时间</div>
      <div class="col action">操作</div>
    </div>

    <!-- 虚拟表格主体 -->
    <RecycleScroller
        class="virtual-table"
        :items="sortedFileList"
        :item-size="42"
        key-field="id"
        v-slot="{ item: row }"
    >
      <div class="row">
        <!-- 选择框 -->
        <div class="col checkbox">
          <input
              type="checkbox"
              :checked="selectedIds.has(row.id)"
              :disabled="isFolder(row)"
              @change="toggleSelection(row)"
          />
        </div>

        <!-- 文件名 -->
        <div class="col name">
          <FileIcon
              style="margin-right: 5px;"
              :file-type="row.fileType"
              :is-folder="isFolder(row)"
          />
          <span
              @click="handleItemClick(row)"
              :class="{ 'folder-name': isFolder(row), 'file-name': !isFolder(row) }"
          >
            {{ row.originalFileName }}
          </span>
        </div>

        <!-- 文件大小 -->
        <div class="col size">
          <span v-if="!isFolder(row)">{{ formatSize(row.fileSize) }}</span>
          <span v-else>-</span>
        </div>

        <!-- 修改时间 -->
        <div class="col time">{{ formatDate(row.updatedAt) }}</div>

        <!-- 操作 -->
        <div class="col action">
          <el-button
              v-if="!isFolder(row)"
              type="primary"
              size="small"
              @click="handleDownload(row)"
          >
            下载
          </el-button>
          <el-button
              type="danger"
              size="small"
              style="margin-left: 4px;"
              @click="handleDelete(row)"
          >
            删除
          </el-button>
        </div>
      </div>
    </RecycleScroller>
  </div>
</template>

<script setup>
import {ref, computed, watch} from 'vue'
import {RecycleScroller} from 'vue-virtual-scroller'
import {ElMessage} from 'element-plus'
import FileIcon from './FileIcon.vue'

const props = defineProps({
  fileList: {type: Array, default: () => []}
})

const emit = defineEmits([
  'enter-folder',
  'download-file',
  'delete-item',
  'drag-over',
  'drop',
  'batch-download',
  'batch-delete'
])

const selectedIds = ref(new Set());

// ✅ 已选择文件（用 Set 更高效）
const selectedFiles = computed(() => {
  return sortedFileList.value.filter(f => selectedIds.value.has(f.id))
})

// 可选择的文件（排除文件夹）
const selectableFiles = computed(() => {
  return sortedFileList.value.filter(f => !isFolder(f))
})

// 全选状态
const isAllSelected = computed(() => {
  return selectableFiles.value.length > 0 && 
         selectableFiles.value.every(f => selectedIds.value.has(f.id))
})

// 半选状态
const isIndeterminate = computed(() => {
  const selectedCount = selectableFiles.value.filter(f => selectedIds.value.has(f.id)).length
  return selectedCount > 0 && selectedCount < selectableFiles.value.length
})

// 文件统计
const totalCount = computed(() => props.fileList.length)
const fileCount = computed(() => props.fileList.filter(f => !isFolder(f)).length)
const folderCount = computed(() => props.fileList.filter(f => isFolder(f)).length)


// ✅ 排序：文件夹在前，名字升序
const sortedFileList = computed(() => {
  return [...props.fileList].sort((a, b) => {
    const aIsFolder = isFolder(a)
    const bIsFolder = isFolder(b)
    if (aIsFolder && !bIsFolder) return -1
    if (!aIsFolder && bIsFolder) return 1
    return a.originalFileName.localeCompare(b.originalFileName, 'zh-CN')
  })
})

const isFolder = (item) => item.fileType === 'folder' || item.isFolder || item.isDir === 1

const formatSize = (size) => {
  if (!size) return '-'
  if (size < 1024) return size + ' B'
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB'
  return (size / (1024 * 1024)).toFixed(2) + ' MB'
}

const formatDate = (dateString) => {
  if (!dateString) return '-'
  return new Date(dateString).toLocaleString('zh-CN')
}

// ✅ 勾选逻辑
const toggleSelection = (row) => {
  if (selectedIds.value.has(row.id)) {
    selectedIds.value.delete(row.id)
  } else {
    if (!isFolder(row)) selectedIds.value.add(row.id)
  }
}

const clearSelection = () => selectedIds.value.clear()

// 全选/取消全选
const toggleSelectAll = () => {
  if (isAllSelected.value) {
    // 取消全选
    selectedIds.value.clear()
  } else {
    // 全选
    selectableFiles.value.forEach(f => selectedIds.value.add(f.id))
  }
}

const handleItemClick = (row) => {
  if (isFolder(row)) emit('enter-folder', row)
}

const handleDownload = (row) => emit('download-file', row)
const handleDelete = (row) => emit('delete-item', row)

const handleBatchDownload = () => {
  if (selectedIds.value.size === 0) {
    ElMessage.warning('请先选择要下载的文件')
    return
  }
  emit(
      'batch-download',
      sortedFileList.value.filter((f) => selectedIds.value.has(f.id))
  )
}

const handleBatchDelete = () => {
  if (selectedIds.value.size === 0) {
    ElMessage.warning('请先选择要删除的文件')
    return
  }
  emit(
      'batch-delete',
      sortedFileList.value.filter((f) => selectedIds.value.has(f.id))
  )
}

const handleDragOver = (e) => emit('drag-over', e)
const handleDrop = (e) => emit('drop', e)

// 键盘快捷键处理
const handleKeyDown = (e) => {
  // Ctrl+A 全选
  if (e.ctrlKey && e.key === 'a') {
    e.preventDefault()
    if (selectableFiles.value.length > 0) {
      selectableFiles.value.forEach(f => selectedIds.value.add(f.id))
    }
    return
  }
  
  // Escape 取消选择
  if (e.key === 'Escape') {
    e.preventDefault()
    clearSelection()
    return
  }
  
  // Delete 删除选中文件
  if (e.key === 'Delete' && selectedFiles.value.length > 0) {
    e.preventDefault()
    handleBatchDelete()
    return
  }
 }

// 监听文件列表变化，清除无效选择
watch(
  () => props.fileList,
  (newList) => {
    if (selectedIds.value.size > 0) {
      const validIds = new Set(newList.map(f => f.id))
      const invalidIds = [...selectedIds.value].filter(id => !validIds.has(id))
      
      if (invalidIds.length > 0) {
        invalidIds.forEach(id => selectedIds.value.delete(id))
      }
    }
  },
  { deep: true }
)
</script>

<style scoped>
.file-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: #fff;
  border-radius: 8px;
  overflow: hidden;
  outline: none;
}

.file-list:focus {
  box-shadow: 0 0 0 2px #3b82f6;
}

/* 文件统计信息 */
.file-stats {
  padding: 8px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.stats-info {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #64748b;
}

.total-count {
  font-weight: 600;
  color: #334155;
}

.file-count,
.folder-count {
  color: #64748b;
}

/* 批量操作工具栏 */
.batch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.selected-info {
  font-size: 14px;
  color: #475569;
  font-weight: 500;
}

.batch-actions {
  display: flex;
  gap: 8px;
}

/* 表头样式 */
.table-header {
  display: flex;
  align-items: center;
  background: #f1f5f9;
  border-bottom: 2px solid #e2e8f0;
  height: 44px;
  padding: 0 12px;
  font-weight: 600;
  color: #334155;
  font-size: 13px;
  position: sticky;
  top: 0;
  z-index: 10;
}

/* 行样式 */
.row {
  display: flex;
  align-items: center;
  border-bottom: 1px solid #f1f5f9;
  height: 42px;
  padding: 0 12px;
  transition: background-color 0.2s ease;
}

.row:hover {
  background-color: #f8fafc;
}

.row:last-child {
  border-bottom: none;
}

/* 列样式 */
.col.checkbox {
  width: 55px;
  text-align: center;
}

.col.checkbox input[type="checkbox"] {
  width: 16px;
  height: 16px;
  cursor: pointer;
  accent-color: #3b82f6;
}

.col.checkbox input[type="checkbox"]:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.col.name {
  flex: 1;
  display: flex;
  align-items: center;
  min-width: 0;
}

.folder-name {
  cursor: pointer;
  color: #3b82f6;
  font-weight: 500;
  transition: color 0.2s ease;
  user-select: none;
}

.folder-name:hover {
  color: #1d4ed8;
  text-decoration: underline;
}

.file-name {
  color: #475569;
  word-break: break-all;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col.size {
  width: 120px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.col.time {
  width: 180px;
  text-align: center;
  color: #64748b;
  font-size: 13px;
}

.col.action {
  width: 200px;
  text-align: center;
}

/* 虚拟滚动容器 */
.virtual-table {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
}

/* 滚动条样式 */
.virtual-table::-webkit-scrollbar {
  width: 8px;
}

.virtual-table::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 4px;
}

.virtual-table::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
  transition: background-color 0.2s ease;
}

.virtual-table::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .col.time {
    display: none;
  }
  
  .col.action {
    width: 120px;
  }
  
  .batch-toolbar {
    flex-direction: column;
    gap: 8px;
    align-items: stretch;
  }
  
  .batch-actions {
    justify-content: center;
  }
  
  .stats-info {
    gap: 12px;
    font-size: 12px;
  }
}

@media (max-width: 480px) {
  .col.size {
    display: none;
  }
  
  .col.action {
    width: 80px;
  }
  
  .row {
    padding: 0 8px;
  }
  
  .table-header {
    padding: 0 8px;
  }
  
  .file-stats {
    padding: 6px 8px;
  }
  
  .stats-info {
    flex-direction: column;
    gap: 4px;
    font-size: 11px;
  }
}
</style>

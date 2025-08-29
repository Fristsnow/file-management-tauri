<template>
  <div class="file-list" @dragover="handleDragOver" @drop="handleDrop">
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
        <el-button
            size="small"
            @click="clearSelection"
        >
          取消选择
        </el-button>
      </div>
    </div>

    <div class="table-container">
      <el-table
          ref="tableRef"
          :data="sortedFileList"
          row-key="id"
          class="table"
          :header-cell-style="{ textAlign: 'center' }"
          @selection-change="handleSelectionChange"
      >
        <el-table-column
            type="selection"
            width="55"
            :selectable="isSelectable"
        />

        <el-table-column prop="originalFileName" label="文件名" class-name="name-column">
          <template #default="{ row }">
            <div style="display: flex;">
              <FileIcon style="margin-right: 5px;" :file-type="row.fileType" :is-folder="isFolder(row)"/>
              <span
                  @click="handleItemClick(row)"
                  :class="{ 'folder-name': isFolder(row), 'file-name': !isFolder(row) }"
              >
            {{ row.originalFileName }}
          </span>
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="fileSize" label="大小" width="120" class-name="size-column" align="center">
          <template #default="{ row }">
            <span v-if="!isFolder(row)">{{ formatSize(row.fileSize) }}</span>
            <span v-else>-</span>
          </template>
        </el-table-column>

        <el-table-column prop="updatedAt" label="修改时间" width="180" class-name="time-column" align="center">
          <template #default="{ row }">
            {{ formatDate(row.updatedAt) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" class-name="action-column" align="center">
          <template #default="{ row }">
            <el-button
                style="color: #000"
                v-if="!isFolder(row)"
                type="primary"
                size="small"
                @click="handleDownload(row)"
            >
              下载
            </el-button>
            <!-- <el-button
              v-if="!isFolder(row)"
              type="success"
              size="small"
              @click="handleAddToDownload(row)"
              style="margin-left: 4px;"
            >
              加入下载
            </el-button> -->
            <el-button
                type="danger"
                size="small"
                @click="handleDelete(row)"
                style="margin-left: 4px;"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup>
import {defineProps, defineEmits, ref, computed} from 'vue';
import {ElMessage} from 'element-plus';
import FileIcon from './FileIcon.vue';

const props = defineProps({
  fileList: {
    type: Array,
    default: () => []
  }
});

// 排序后的文件列表：文件夹在前，文件在后，再按名字升序
const sortedFileList = computed(() => {
  return [...props.fileList].sort((a, b) => {
    const aIsFolder = a.fileType === 'folder' || a.isFolder === true || a.isDir === 1;
    const bIsFolder = b.fileType === 'folder' || b.isFolder === true || b.isDir === 1;

    if (aIsFolder && !bIsFolder) return -1; // a是文件夹，排前
    if (!aIsFolder && bIsFolder) return 1;  // b是文件夹，排前

    // 如果都是文件夹 / 都是文件，就按文件名升序
    return a.originalFileName.localeCompare(b.originalFileName, 'zh-CN');
  });
});


const emit = defineEmits([
  'enter-folder',
  'download-file',
  'delete-item',
  'drag-over',
  'drop',
  'batch-download',
  'batch-delete',
  'add-to-download'
]);

const tableRef = ref(null);
const selectedFiles = ref([]);

// 判断是否为文件夹
const isFolder = (item) => {
  return item.fileType === 'folder' || item.isFolder === true || item.isDir === 1;
};

// 文件类型判断方法
const isImageFile = (fileType) => {
  return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'].includes(fileType?.toLowerCase());
};

const isAudioFile = (fileType) => {
  return ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma'].includes(fileType?.toLowerCase());
};

const isDocumentFile = (fileType) => {
  return ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt'].includes(fileType?.toLowerCase());
};

// 格式化文件大小
const formatSize = (size) => {
  if (size < 1024) return size + ' B';
  if (size < 1024 * 1024) return (size / 1024).toFixed(2) + ' KB';
  return (size / (1024 * 1024)).toFixed(2) + ' MB';
};

// 格式化日期
const formatDate = (dateString) => {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN');
};

// 处理项目点击
const handleItemClick = (row) => {
  if (isFolder(row)) {
    emit('enter-folder', row);
  }
};

// 处理下载
const handleDownload = (row) => {
  emit('download-file', row);
};

// 处理加入下载队列
const handleAddToDownload = (row) => {
  emit('add-to-download', row);
};

// 处理选择变化
const handleSelectionChange = (selection) => {
  selectedFiles.value = selection.filter(item => !isFolder(item));
};

// 判断行是否可选择（只有文件可以选择）
const isSelectable = (row) => {
  return !isFolder(row);
};

// 批量下载
const handleBatchDownload = () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请先选择要下载的文件');
    return;
  }
  emit('batch-download', selectedFiles.value);
};

// 批量删除
const handleBatchDelete = () => {
  if (selectedFiles.value.length === 0) {
    ElMessage.warning('请先选择要删除的文件');
    return;
  }
  emit('batch-delete', selectedFiles.value);
};

// 清除选择
const clearSelection = () => {
  if (tableRef.value) {
    tableRef.value.clearSelection();
  }
  selectedFiles.value = [];
};

// 处理删除
const handleDelete = (row) => {
  emit('delete-item', row);
};

// 拖拽处理
const handleDragOver = (e) => {
  emit('drag-over', e);
};

const handleDrop = (e) => {
  emit('drop', e);
};
</script>

<style scoped>
.file-list {
  height: 100%;
  background: var(--bg-primary);
  border-radius: var(--radius-md);
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border-light);
}

/* 批量操作栏 */
.batch-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: var(--el-color-primary-light-9);
  border-bottom: 1px solid var(--el-color-primary-light-7);
  border-radius: var(--radius-md) var(--radius-md) 0 0;
}

.selected-info {
  font-size: 13px;
  color: var(--el-color-primary);
  font-weight: 500;
}

.batch-actions {
  display: flex;
  gap: 8px;
}

/* 表格容器 */
.table-container {
  flex: 1;
  overflow-x: auto;
  background: var(--bg-primary);
  -webkit-overflow-scrolling: touch;
}

.table {
  width: 100%;
  min-width: 600px;

  /* 滚动条 */

  &::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }

  &::-webkit-scrollbar-thumb {
    background: var(--border-medium);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: var(--border-dark);
  }

  :deep(.el-table) {
    background: transparent;
    border: none;
    font-size: 14px;

    .el-table__header {
      background: var(--bg-secondary);
    }

    .el-table__header th {
      border-bottom: 1px solid var(--border-light);
      color: var(--text-secondary);
      font-weight: 500;
      font-size: 13px;
      padding: 8px;
    }

    .el-table__body tr {
      transition: var(--transition-fast);
    }

    .el-table__body tr:hover {
      background: var(--bg-hover);
    }

    .el-table__body td {
      border-bottom: 1px solid var(--border-light);
      padding: 8px;
      color: var(--text-primary);
      font-size: 13px;
    }

    .el-table__empty-text {
      color: var(--text-secondary);
      font-size: 13px;
    }
  }
}

/* 文件名样式 */
.folder-name {
  color: var(--primary-color);
  cursor: pointer;
  transition: var(--transition-fast);
}

.folder-name:hover {
  color: var(--primary-hover);
}

.file-name {
  color: var(--text-primary);
}

/* 操作按钮 */
:deep(.el-button) {
  height: 26px;
  font-size: 12px;
  border-radius: var(--radius-sm);
  padding: 0 8px;
}

:deep(.el-button--primary) {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: #fff;
}

:deep(.el-button--primary:hover) {
  background: var(--primary-hover);
}

/* 拖拽上传提示 */
.file-list.drag-over {
  background: rgba(24, 144, 255, 0.05);
  border: 2px dashed var(--primary-color);
}

.file-list.drag-over::after {
  content: '拖拽文件到此处上传';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  color: var(--primary-color);
  font-size: 14px;
  background: var(--bg-primary);
  padding: 8px 16px;
  border-radius: 6px;
}

/* 空状态 */
.empty-state {
  text-align: center;
  padding: 40px 20px;
  color: var(--text-secondary);
}

.empty-state .empty-icon {
  font-size: 48px;
  opacity: 0.5;
}

.empty-state .empty-text {
  font-size: 13px;
  margin-top: 8px;
}

/* 响应式 */
@media (max-width: 1024px) {
  .size-column {
    display: none !important;
  }

  .action-column {
    width: 160px !important;
  }
}

@media (max-width: 768px) {
  .size-column, .time-column {
    display: none !important;
  }

  .action-column {
    width: 140px !important;
  }

  .batch-toolbar {
    flex-direction: column;
    gap: 6px;
  }
}

@media (max-width: 480px) {
  .action-column .cell {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  :deep(.el-button) {
    width: 100%;
    padding: 2px 4px;
    font-size: 11px;
  }
}
</style>

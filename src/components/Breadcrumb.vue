<template>
  <div class="breadcrumb">

    <div class="breadcrumb-container">

      <div class="breadcrumb-item root-item" @click="navigateToProject">
        <el-icon class="home-icon"><House /></el-icon>
        <span class="item-text">{{ currentProject ? currentProject.originalFileName : '选择工作空间' }}</span>
      </div>

      <template v-for="(item, index) in breadcrumbItems" :key="index">
        <div class="breadcrumb-separator">
          <el-icon><ArrowRight /></el-icon>
        </div>
        <div
          class="breadcrumb-item path-item"
          :class="{ 'current-item': index === breadcrumbItems.length - 1 }"
          @click="navigateToPath(item.path)"
        >
          <el-icon class="folder-icon"><Folder /></el-icon>
          <span class="item-text">{{ item.name }}</span>
        </div>
      </template>
    </div>

    <div class="breadcrumb-actions">
      <el-tooltip content="刷新当前目录" placement="bottom">
        <el-button
          size="small"
          text
          @click="$emit('refresh')"
          class="action-btn"
        >
          <el-icon><Refresh /></el-icon>
        </el-button>
      </el-tooltip>

      <el-tooltip content="复制路径" placement="bottom">
        <el-button
          size="small"
          text
          @click="copyPath"
          class="action-btn"
        >
          <el-icon><CopyDocument /></el-icon>
        </el-button>
      </el-tooltip>
    </div>
  </div>
</template>

<script setup>
import { computed, defineProps, defineEmits } from 'vue'
import { ElMessage } from 'element-plus'
import { House, ArrowRight, Folder, Refresh, CopyDocument } from '@element-plus/icons-vue'

const props = defineProps({
  currentFolder: {
    type: String,
    default: '/'
  },
  currentProject: {
    type: Object,
    default: null
  }
})

const emit = defineEmits(['navigate', 'refresh'])

const breadcrumbItems = computed(() => {
  if (!props.currentProject) return [];
  
  const pathParts = props.currentFolder.split('/').filter(part => part);
  
  // 如果只是在项目根目录，不显示额外的面包屑
  if (pathParts.length <= 1) return [];
  
  const items = [];
  let currentPath = `/${pathParts[0]}`; // 从项目名称开始
  
  // 从第二个路径部分开始（跳过项目名称）
  pathParts.slice(1).forEach(part => {
    currentPath += '/' + part;
    items.push({
      name: part,
      path: currentPath
    });
  });

  return items;
});

const navigateToPath = (path) => {
  emit('navigate', path)
}

const navigateToProject = () => {
  if (props.currentProject) {
    const projectPath = `/${props.currentProject.originalFileName}`;
    emit('navigate', projectPath);
  }
}

const copyPath = async () => {
  try {
    await navigator.clipboard.writeText(props.currentFolder)
    ElMessage.success('路径已复制到剪贴板')
  } catch (err) {
    // 降级方案
    const textArea = document.createElement('textarea')
    textArea.value = props.currentFolder
    document.body.appendChild(textArea)
    textArea.select()
    document.execCommand('copy')
    document.body.removeChild(textArea)
    ElMessage.success('路径已复制到剪贴板')
  }
}
</script>

<style scoped>
.breadcrumb {
  background: var(--bg-primary);
  padding: 0 12px;
  border-bottom: 1px solid var(--border-light);
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.breadcrumb-container {
  display: flex;
  align-items: center;
  flex: 1;
  overflow: hidden;
}

.breadcrumb-item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-secondary);
  white-space: nowrap;
  max-width: 180px;
  transition: all 0.2s ease;
}

.breadcrumb-item:hover {
  background: var(--bg-hover);
  color: var(--primary-color);
}

.breadcrumb-separator {
  display: flex;
  align-items: center;
  margin: 0 4px;
  color: var(--text-tertiary);
  font-size: 12px;
}

.root-item {
  color: var(--primary-color);
  font-weight: 600;
}

.root-item .home-icon {
  font-size: 16px;
}

.path-item .folder-icon {
  color: var(--warning-color);
  font-size: 14px;
}

.path-item .item-text {
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-item {
  color: var(--text-primary);
  background: var(--bg-selected);
  font-weight: 600;
}

.current-item .folder-icon {
  color: var(--primary-color);
}

.breadcrumb-actions {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: 8px;
}

.action-btn {
  width: 30px;
  height: 30px;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
  transition: all 0.2s ease;
}

.action-btn:hover {
  background: var(--bg-hover);
  color: var(--primary-color);
}

.action-btn .el-icon {
  font-size: 14px;
}

/* 响应式优化 */
@media (max-width: 768px) {
  .breadcrumb {
    height: 40px;
    padding: 0 8px;
  }

  .breadcrumb-item {
    font-size: 12px;
    max-width: 120px;
    padding: 2px 6px;
  }

  .breadcrumb-separator {
    margin: 0 2px;
  }

  .action-btn {
    width: 26px;
    height: 26px;
  }
}

@media (max-width: 480px) {
  .breadcrumb-item {
    max-width: 70px;
  }

  .breadcrumb-item .item-text {
    display: none;
  }

  .root-item .item-text,
  .current-item .item-text {
    display: inline;
  }
}
</style>

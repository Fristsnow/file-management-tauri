<template>
  <div class="sidebar">
    <div class="tree-header">
      <span class="header-title">文件目录</span>
      <span class="header-path">{{ currentFolder === '/' ? '根目录' : currentFolder }}</span>
    </div>
    <el-tree
        ref="treeRef"
        :data="treeData"
        :props="treeProps"
        node-key="id"
        @node-click="handleTreeClick"
        highlight-current
        class="file-tree"
        lazy
        :load="loadNode"
        :expand-on-click-node="true"
        :default-expanded-keys="defaultExpandedKeys"
    >
      <template #default="{ node, data }">
        <span class="tree-node">
          <el-icon v-if="data.fileType === 'folder'" class="folder-icon">
            <Folder />
          </el-icon>
          <el-icon v-else class="file-icon">
            <Document />
          </el-icon>
          <span class="node-label">{{ data.originalFileName }}</span>
        </span>
      </template>
    </el-tree>
  </div>
</template>

<script setup>
import { ref, defineEmits, defineProps, onMounted, nextTick, watch } from 'vue';
import { Folder, Document } from '@element-plus/icons-vue';

const props = defineProps({
  currentFolder: {
    type: String,
    default: '/'
  },
  treeData: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['tree-click', 'load-children']);

// 树组件引用
const treeRef = ref(null);

// 默认展开的节点keys（根目录）
const defaultExpandedKeys = ref([0]);

const treeProps = { 
  label: 'originalFileName', 
  children: 'children',
  isLeaf: 'isLeaf'
};

// 左侧树点击
const handleTreeClick = async (data, node, nodeComponent) => {
  if (node.expanded || node.isLeaf || data.fileType !== 'folder') {
    emit('tree-click', data);
  }
};

// 懒加载节点
const loadNode = async (node, resolve) => {
  try {
    // 如果是根节点，加载根目录数据
    if (node.level === 0) {
      emit('load-children', { id: 0, isRoot: true, resolve });
      return;
    }
    
    // 如果是文件夹节点，加载子文件夹
    if (node.data && node.data.fileType === 'folder') {
      emit('load-children', { id: node.data.id, isRoot: false, resolve });
    } else {
      resolve([]);
    }
  } catch (error) {
    console.error('加载节点失败:', error);
    resolve([]);
  }
};

// 监听currentFolder变化，更新树的选中状态
watch(() => props.currentFolder, (newFolder) => {
  if (treeRef.value) {
    treeRef.value.setCurrentKey(newFolder);
  }
}, { immediate: true });

// 初始化时设置选中状态
onMounted(async () => {
  await nextTick();
  if (treeRef.value) {
    treeRef.value.setCurrentKey(props.currentFolder);
  }
});

// 刷新树组件，清除缓存
const refreshTree = () => {
  if (treeRef.value) {
    // 清除Element Plus树组件的内部缓存
    treeRef.value.store.nodesMap = {};
    treeRef.value.store.root.childNodes = [];
    // 重新加载根节点
    if (props.treeData && props.treeData.length > 0) {
      treeRef.value.store.setData(props.treeData);
    }
  }
};

// 监听treeData变化，自动刷新
watch(() => props.treeData, (newData) => {
  if (newData && newData.length > 0 && treeRef.value) {
    refreshTree();
  }
}, { deep: true });

// 暴露方法给父组件
defineExpose({
  setCurrentKey: (key) => {
    if (treeRef.value) {
      treeRef.value.setCurrentKey(key);
    }
  },
  expandNode: (nodeKey) => {
    if (treeRef.value) {
      const node = treeRef.value.getNode(nodeKey);
      if (node && !node.expanded) {
        node.expand();
      }
    }
  },
  expandToNode: async (nodeKey) => {
    if (treeRef.value) {
      // 获取节点路径并逐级展开
      const node = treeRef.value.getNode(nodeKey);
      if (node) {
        let currentNode = node.parent;
        const nodesToExpand = [];
        
        // 收集需要展开的父节点
        while (currentNode && currentNode.level > 0) {
          if (!currentNode.expanded) {
            nodesToExpand.unshift(currentNode);
          }
          currentNode = currentNode.parent;
        }
        
        // 逐级展开父节点
        for (const nodeToExpand of nodesToExpand) {
          if (!nodeToExpand.expanded) {
            nodeToExpand.expand();
            // 等待展开完成
            await nextTick();
          }
        }
        
        // 最后设置当前选中节点
        treeRef.value.setCurrentKey(nodeKey);
      }
    }
  },
  refreshTree
});
</script>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--bg-primary);
  border-right: 1px solid var(--border-light);
}

.tree-header {
  padding: var(--spacing-lg) var(--spacing-md);
  background: var(--bg-primary);
  border-bottom: 1px solid var(--border-light);
  min-height: 56px;
  display: flex;
  flex-direction: column;
  gap: var(--spacing-xs);
}

.header-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: var(--spacing-xs);
  line-height: 1.5;
}

.header-path {
  font-size: 12px;
  color: var(--text-secondary);
  background: var(--bg-secondary);
  padding: var(--spacing-xs) var(--spacing-sm);
  border: 1px solid var(--border-light);
  border-radius: var(--radius-sm);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', sans-serif;
  word-break: break-all;
  line-height: 1.4;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-tree {
  flex: 1;
  overflow: auto;
  background: var(--bg-primary);
  padding: var(--spacing-xs) 0;
  
  /* 百度网盘风格滚动条 */
  &::-webkit-scrollbar {
    width: 6px;
  }
  
  &::-webkit-scrollbar-track {
    background: transparent;
  }
  
  &::-webkit-scrollbar-thumb {
    background: var(--border-medium);
    border-radius: var(--radius-sm);
    transition: var(--transition-fast);
    
    &:hover {
      background: var(--border-dark);
    }
  }
  
  /* Firefox */
  scrollbar-width: thin;
  scrollbar-color: var(--border-medium) transparent;
}

:deep(.el-tree) {
  background: transparent;
  color: var(--text-primary);
  font-size: 14px;
  
  .el-tree-node {
    .el-tree-node__content {
      height: 32px;
      padding: 0 var(--spacing-md);
      margin: 1px 0;
      border-radius: 0;
      transition: var(--transition-fast);
      position: relative;
      
      &:hover {
        background: var(--bg-hover);
      }
    }
    
    &.is-current > .el-tree-node__content {
      background: var(--primary-light);
      color: var(--primary-color);
      font-weight: 500;
      
      &::before {
        content: '';
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        width: 3px;
        background: var(--primary-color);
      }
      
      .folder-icon {
        color: var(--primary-color);
      }
      
      .file-icon {
        color: var(--primary-color);
      }
      
      &:hover {
        background: var(--primary-light);
      }
    }
    
    .el-tree-node__expand-icon {
      color: var(--text-tertiary);
      transition: var(--transition-fast);
      
      &:hover {
        color: var(--text-secondary);
      }
    }
  }
}

.tree-node {
  display: flex;
  align-items: center;
  gap: var(--spacing-sm);
  width: 100%;
  padding: 0;
}

.folder-icon {
  color: #ffa940;
  font-size: 16px;
  transition: var(--transition-fast);
  flex-shrink: 0;
}

.file-icon {
  color: var(--text-tertiary);
  font-size: 16px;
  transition: var(--transition-fast);
  flex-shrink: 0;
}

.node-label {
  font-size: 14px;
  font-weight: 400;
  color: inherit;
  transition: var(--transition-fast);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  line-height: 1.5;
  user-select: none;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .tree-header {
    padding: var(--spacing-sm) var(--spacing-xs);
    min-height: 48px;
  }
  
  .header-title {
    font-size: 13px;
  }
  
  .header-path {
    font-size: 11px;
    padding: 2px var(--spacing-xs);
  }
  
  :deep(.el-tree) {
    .el-tree-node {
      .el-tree-node__content {
        height: 28px;
        padding: 0 var(--spacing-xs);
      }
    }
  }
  
  .node-label {
    font-size: 13px;
  }
  
  .folder-icon,
  .file-icon {
    font-size: 14px;
  }
}
</style>
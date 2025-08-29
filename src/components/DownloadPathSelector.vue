<template>
  <div class="download-path-selector">
    <div class="path-selector-header">
      <el-icon class="folder-icon">
        <Folder />
      </el-icon>
      <span class="title">下载路径设置</span>
    </div>
    
    <div class="path-options">
      <!-- 使用默认下载路径 -->
      <el-radio-group v-model="pathType" @change="handlePathTypeChange">
        <div class="path-option">
          <el-radio value="default">
            <span class="option-label">使用浏览器默认下载路径</span>
          </el-radio>
          <div v-if="pathType === 'default'" class="option-description">
            文件将下载到浏览器的默认下载文件夹
          </div>
        </div>
        
        <!-- 自定义下载路径 -->
        <div class="path-option">
          <el-radio value="custom">
            <span class="option-label">自定义下载路径</span>
          </el-radio>
          <div v-if="pathType === 'custom'" class="custom-path-section">
            <div class="path-input-group">
              <el-input
                v-model="customPath"
                placeholder="请选择下载路径"
                readonly
                class="path-input"
              >
                <template #append>
                  <el-button 
                    @click="selectDownloadPath"
                    :loading="isSelecting"
                    type="primary"
                  >
                    <el-icon><FolderOpened /></el-icon>
                    选择路径
                  </el-button>
                </template>
              </el-input>
            </div>
            <div v-if="customPath" class="selected-path-info">
              <el-icon class="info-icon"><InfoFilled /></el-icon>
              <span>已选择路径: {{ customPath }}</span>
            </div>
            <div v-if="pathError" class="path-error">
              <el-icon class="error-icon"><WarningFilled /></el-icon>
              <span>{{ pathError }}</span>
            </div>
          </div>
        </div>
      </el-radio-group>
    </div>
    
    <!-- 记住选择 -->
    <div class="remember-choice">
      <el-checkbox v-model="rememberChoice">
        记住我的选择
      </el-checkbox>
      <span class="remember-description">下次下载时自动使用此设置</span>
    </div>
    
    <!-- 快速路径选择 -->
    <div v-if="pathType === 'custom'" class="quick-paths">
      <div class="quick-paths-title">常用路径:</div>
      <div class="quick-path-buttons">
        <el-button 
          v-for="quickPath in quickPaths" 
          :key="quickPath.name"
          size="small"
          @click="selectQuickPath(quickPath.path)"
          class="quick-path-btn"
        >
          <el-icon><Folder /></el-icon>
          {{ quickPath.name }}
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { 
  Folder, 
  FolderOpened, 
  InfoFilled, 
  WarningFilled 
} from '@element-plus/icons-vue';
import { useSettingsStore } from '@/stores/settingsStore.js';

const props = defineProps({
  modelValue: {
    type: Object,
    default: () => ({
      type: 'default',
      path: ''
    })
  }
});

const emit = defineEmits(['update:modelValue', 'path-changed']);

const settingsStore = useSettingsStore();

const pathType = ref('default');
const customPath = ref('');
const rememberChoice = ref(false);
const isSelecting = ref(false);
const pathError = ref('');

// 快速路径选项
const quickPaths = ref([
  { name: '桌面', path: '' },
  { name: '下载', path: '' },
  { name: '文档', path: '' },
  { name: '图片', path: '' }
]);

// 计算属性
const currentSelection = computed(() => ({
  type: pathType.value,
  path: pathType.value === 'custom' ? customPath.value : '',
  remember: rememberChoice.value
}));

// 检查是否在Tauri环境中
const isTauriEnvironment = () => {
  if (typeof window === 'undefined') return false;
  return !!window.__TAURI__ || !!window.__TAURI_INTERNALS__;
};

// 初始化快速路径
const initializeQuickPaths = async () => {
  if (!isTauriEnvironment()) return;
  
  try {
    const { invoke } = await import('@tauri-apps/api/core');
    const systemPaths = await invoke('get_system_paths');
    
    quickPaths.value = [
      { 
        name: '桌面', 
        path: systemPaths.desktop || '' 
      },
      { 
        name: '下载', 
        path: systemPaths.downloads || '' 
      },
      { 
        name: '文档', 
        path: systemPaths.documents || '' 
      },
      { 
        name: '图片', 
        path: systemPaths.pictures || '' 
      }
    ].filter(item => item.path); // 过滤掉获取失败的路径
    
  } catch (error) {
    console.warn('获取系统路径失败:', error);
  }
};

// 选择下载路径
const selectDownloadPath = async () => {
  if (!isTauriEnvironment()) {
    ElMessage.warning('路径选择功能仅在桌面应用中可用');
    return;
  }
  
  try {
    isSelecting.value = true;
    pathError.value = '';
    
    const { open } = await import('@tauri-apps/plugin-dialog');
    
    const selected = await open({
      directory: true,
      multiple: false,
      title: '选择下载路径'
    });
    
    if (selected && typeof selected === 'string') {
      customPath.value = selected;
      pathError.value = '';
      ElMessage.success('路径选择成功');
    }
  } catch (error) {
    console.error('选择路径失败:', error);
    pathError.value = '选择路径失败: ' + (error.message || '未知错误');
    ElMessage.error('选择路径失败');
  } finally {
    isSelecting.value = false;
  }
};

// 选择快速路径
const selectQuickPath = (path) => {
  if (path) {
    customPath.value = path;
    pathError.value = '';
    ElMessage.success(`已选择${path}`);
  }
};

// 处理路径类型变化
const handlePathTypeChange = (value) => {
  pathError.value = '';
  if (value === 'default') {
    customPath.value = '';
  }
};

// 从设置store加载设置
const loadSettings = () => {
  try {
    const settings = settingsStore.downloadPathSettings;
    if (settings) {
      pathType.value = settings.type || 'default';
      customPath.value = settings.path || '';
      rememberChoice.value = settings.remember || false;
    }
  } catch (error) {
    console.warn('加载下载路径设置失败:', error);
  }
};

// 保存设置到设置store
const saveSettings = () => {
  try {
    const settings = {
      type: pathType.value,
      path: customPath.value,
      remember: rememberChoice.value
    };
    settingsStore.updateDownloadPathSettings(settings);
  } catch (error) {
    console.warn('保存下载路径设置失败:', error);
  }
};

// 监听变化并发出事件
watch(currentSelection, (newValue) => {
  emit('update:modelValue', newValue);
  emit('path-changed', newValue);
  saveSettings();
}, { deep: true });

// 监听props变化
watch(() => props.modelValue, (newValue) => {
  if (newValue) {
    pathType.value = newValue.type || 'default';
    customPath.value = newValue.path || '';
    rememberChoice.value = newValue.remember || false;
  }
}, { immediate: true });

// 组件挂载时初始化
onMounted(() => {
  loadSettings();
  initializeQuickPaths();
  
  // 如果settingsStore中有保存的自定义路径，优先使用
  if (settingsStore.downloadPath && !settingsStore.useDefaultDownloadPath) {
    pathType.value = 'custom';
    customPath.value = settingsStore.downloadPath;
    rememberChoice.value = true;
  }
});

// 暴露方法给父组件
defineExpose({
  getCurrentSelection: () => currentSelection.value,
  resetToDefault: () => {
    pathType.value = 'default';
    customPath.value = '';
    pathError.value = '';
  }
});
</script>

<style scoped>
.download-path-selector {
  padding: 16px;
  background: #fafafa;
  border-radius: 8px;
  border: 1px solid #e4e7ed;
}

.path-selector-header {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  font-weight: 600;
  color: #303133;
}

.folder-icon {
  margin-right: 8px;
  color: #409eff;
}

.title {
  font-size: 16px;
}

.path-options {
  margin-bottom: 16px;
}

.path-option {
  margin-bottom: 16px;
}

.option-label {
  font-weight: 500;
  color: #303133;
}

.option-description {
  margin-top: 8px;
  margin-left: 24px;
  font-size: 13px;
  color: #909399;
}

.custom-path-section {
  margin-top: 12px;
  margin-left: 24px;
}

.path-input-group {
  margin-bottom: 8px;
}

.path-input {
  width: 100%;
}

.selected-path-info {
  display: flex;
  align-items: center;
  margin-top: 8px;
  padding: 8px 12px;
  background: #f0f9ff;
  border: 1px solid #b3d8ff;
  border-radius: 4px;
  font-size: 13px;
  color: #409eff;
}

.info-icon {
  margin-right: 6px;
}

.path-error {
  display: flex;
  align-items: center;
  margin-top: 8px;
  padding: 8px 12px;
  background: #fef0f0;
  border: 1px solid #fbc4c4;
  border-radius: 4px;
  font-size: 13px;
  color: #f56c6c;
}

.error-icon {
  margin-right: 6px;
}

.remember-choice {
  display: flex;
  align-items: center;
  margin-bottom: 16px;
  padding: 12px;
  background: #f5f7fa;
  border-radius: 6px;
}

.remember-description {
  margin-left: 8px;
  font-size: 13px;
  color: #606266;
}

.quick-paths {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e4e7ed;
}

.quick-paths-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
  margin-bottom: 12px;
}

.quick-path-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.quick-path-btn {
  display: flex;
  align-items: center;
  gap: 4px;
}

.quick-path-btn .el-icon {
  font-size: 14px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .download-path-selector {
    padding: 12px;
  }
  
  .quick-path-buttons {
    flex-direction: column;
  }
  
  .quick-path-btn {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
<template>
  <div class="settings-container">
    <div class="settings-header">
      <h2>应用设置</h2>
      <p>配置应用程序的各种选项</p>
    </div>

    <div class="settings-content">
      <!-- 下载设置 -->
      <el-card class="setting-card">
        <template #header>
          <div class="card-header">
            <el-icon><Download /></el-icon>
            <span>下载设置</span>
          </div>
        </template>

        <div class="setting-item">
          <div class="setting-label">
            <label>下载路径</label>
            <p class="setting-description">设置文件下载的保存位置</p>
          </div>
          <div class="setting-control">
            <el-radio-group v-model="useDefaultPath" @change="handlePathModeChange">
              <el-radio :value="true">使用系统默认下载路径</el-radio>
              <el-radio :value="false">自定义下载路径</el-radio>
            </el-radio-group>
          </div>
        </div>

        <div v-if="!useDefaultPath" class="setting-item">
          <div class="setting-label">
            <label>自定义路径</label>
          </div>
          <div class="setting-control">
            <div class="path-input-group">
              <el-input
                v-model="customPath"
                placeholder="请选择下载文件夹"
                readonly
                class="path-input"
              />
              <el-button type="primary" @click="selectDownloadPath" :icon="FolderOpened">
                选择文件夹
              </el-button>
            </div>
          </div>
        </div>

        <div class="setting-item">
          <div class="setting-label">
            <label>当前下载路径</label>
          </div>
          <div class="setting-control">
            <el-input
              v-model="currentEffectivePath"
              readonly
              placeholder="获取中..."
              class="current-path-display"
            />
          </div>
        </div>

        <div class="setting-actions">
          <el-button @click="resetToDefault">重置为默认</el-button>
          <el-button type="primary" @click="saveSettings">保存设置</el-button>
        </div>
      </el-card>

      <!-- 其他设置可以在这里添加 -->
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Download, FolderOpened } from '@element-plus/icons-vue';
import { useSettingsStore } from '@/stores/settingsStore.js';

const settingsStore = useSettingsStore();

// 响应式数据
const useDefaultPath = ref(true);
const customPath = ref('');
const currentEffectivePath = ref('');

// 初始化设置
onMounted(async () => {
  useDefaultPath.value = settingsStore.useDefaultDownloadPath;
  customPath.value = settingsStore.downloadPath;
  await updateCurrentPath();
});

// 监听路径模式变化
const handlePathModeChange = async (value) => {
  useDefaultPath.value = value;
  await updateCurrentPath();
};

// 更新当前有效路径显示
const updateCurrentPath = async () => {
  try {
    if (useDefaultPath.value) {
      currentEffectivePath.value = await settingsStore.getDefaultDownloadPath() || '浏览器默认下载位置';
    } else {
      currentEffectivePath.value = customPath.value || '未设置';
    }
  } catch (error) {
    console.error('获取当前路径失败:', error);
    currentEffectivePath.value = '获取失败';
  }
};

// 检查是否在Tauri环境中
const isTauriEnvironment = () => {
  if (typeof window === 'undefined') return false;
  
  // 检查多个Tauri相关的全局对象
  const hasTauriCore = !!window.__TAURI__;
  const hasTauriInternals = !!window.__TAURI_INTERNALS__;
  const hasTauriInvoke = typeof window.__TAURI_INVOKE__ === 'function';
  const hasTauriPattern = !!window.__TAURI_PATTERN__;
  
  // 在开发环境中，__TAURI_INTERNALS__ 通常会先初始化
  const isInTauri = hasTauriCore || hasTauriInternals || hasTauriInvoke || hasTauriPattern;
  
  return isInTauri;
};

// 选择下载路径
const selectDownloadPath = async () => {
  try {
    // 检查是否在Tauri环境中
    if (isTauriEnvironment()) {
      const { open } = await import('@tauri-apps/plugin-dialog');
      
      const selected = await open({
        directory: true,
        multiple: false,
        title: '选择下载文件夹'
      });
      
      if (selected) {
        customPath.value = selected;
        await updateCurrentPath();
      }
    } else {
      ElMessage.warning('文件夹选择功能仅在桌面应用中可用');
    }
  } catch (error) {
    console.error('选择文件夹失败:', error);
    ElMessage.error('选择文件夹失败: ' + error.message);
  }
};

// 重置为默认设置
const resetToDefault = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要重置为默认设置吗？这将清除您的自定义下载路径。',
      '确认重置',
      {
        confirmButtonText: '确定',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );
    
    settingsStore.resetToDefault();
    useDefaultPath.value = true;
    customPath.value = '';
    await updateCurrentPath();
    
    ElMessage.success('已重置为默认设置');
  } catch {
    // 用户取消操作
  }
};

// 保存设置
const saveSettings = async () => {
  try {
    if (!useDefaultPath.value && !customPath.value) {
      ElMessage.warning('请选择自定义下载路径');
      return;
    }
    
    // 验证自定义路径是否存在（仅在Tauri环境中）
    if (!useDefaultPath.value && isTauriEnvironment()) {
      const { exists } = await import('@tauri-apps/plugin-fs');
      const pathExists = await exists(customPath.value);
      
      if (!pathExists) {
        ElMessage.error('选择的路径不存在，请重新选择');
        return;
      }
    }
    
    // 保存设置
    settingsStore.useDefaultDownloadPath = useDefaultPath.value;
    if (!useDefaultPath.value) {
      settingsStore.setDownloadPath(customPath.value);
    } else {
      settingsStore.setDownloadPath('');
    }
    
    await updateCurrentPath();
    ElMessage.success('设置已保存');
  } catch (error) {
    console.error('保存设置失败:', error);
    ElMessage.error('保存设置失败: ' + error.message);
  }
};

// 监听自定义路径变化
watch(customPath, updateCurrentPath);
</script>

<style scoped>
.settings-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.settings-header {
  margin-bottom: 24px;
}

.settings-header h2 {
  margin: 0 0 8px 0;
  color: var(--el-text-color-primary);
  font-size: 24px;
  font-weight: 600;
}

.settings-header p {
  margin: 0;
  color: var(--el-text-color-regular);
  font-size: 14px;
}

.settings-content {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.setting-card {
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: var(--el-text-color-primary);
}

.setting-item {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 16px 0;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.setting-item:last-child {
  border-bottom: none;
}

.setting-label {
  flex: 1;
  margin-right: 20px;
}

.setting-label label {
  display: block;
  font-weight: 500;
  color: var(--el-text-color-primary);
  margin-bottom: 4px;
}

.setting-description {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-regular);
  line-height: 1.4;
}

.setting-control {
  flex: 2;
  max-width: 400px;
}

.path-input-group {
  display: flex;
  gap: 8px;
}

.path-input {
  flex: 1;
}

.current-path-display {
  width: 100%;
}

.current-path-display :deep(.el-input__inner) {
  background-color: var(--el-fill-color-light);
  color: var(--el-text-color-regular);
}

.setting-actions {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  margin-top: 20px;
  padding-top: 20px;
  border-top: 1px solid var(--el-border-color-lighter);
}

@media (max-width: 768px) {
  .settings-container {
    padding: 16px;
  }
  
  .setting-item {
    flex-direction: column;
    align-items: stretch;
  }
  
  .setting-label {
    margin-right: 0;
    margin-bottom: 12px;
  }
  
  .setting-control {
    max-width: none;
  }
  
  .path-input-group {
    flex-direction: column;
  }
  
  .setting-actions {
    flex-direction: column;
  }
}
</style>
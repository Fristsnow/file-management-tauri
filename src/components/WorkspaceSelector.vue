<template>
  <div class="workspace-selector">
    <el-select
      v-model="selectedProjectId"
      placeholder="选择工作空间"
      @change="handleProjectChange"
      class="workspace-select"
    >
      <el-option
        v-for="project in fileStore.workspaceList"
        :key="project.projectId"
        :label="project.originalFileName"
        :value="project.projectId"
      >
        <div class="project-option">
          <el-icon class="project-icon"><Folder /></el-icon>
          <span class="project-name">{{ project.originalFileName }}</span>
        </div>
      </el-option>
    </el-select>
  </div>
</template>

<script setup>
import { ref, watch, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Folder } from '@element-plus/icons-vue';
import { useFileStore } from '@/stores/fileStore';

const fileStore = useFileStore();
const selectedProjectId = ref(null);

const emit = defineEmits(['project-changed']);

// 监听当前项目ID变化
watch(() => fileStore.currentProjectId, (newProjectId) => {
  selectedProjectId.value = newProjectId;
}, { immediate: true });

// 监听工作空间列表变化，自动选中第一项
watch(() => fileStore.workspaceList, (newWorkspaceList) => {
  // 如果当前没有选中项目且工作空间列表不为空，自动选中第一项
  if (!fileStore.currentProjectId && newWorkspaceList && newWorkspaceList.length > 0) {
    const firstProject = newWorkspaceList[0];
    selectedProjectId.value = firstProject.projectId;
    
    // 设置当前项目
    fileStore.setCurrentProjectId(firstProject.projectId);
    fileStore.setCurrentProject(firstProject);
    
    // 触发项目切换事件
    emit('project-changed', firstProject);
    
    ElMessage.success(`已自动选择工作空间：${firstProject.originalFileName}`);
  }
}, { immediate: true });

// 处理项目切换
const handleProjectChange = (projectId) => {
  const selectedProject = fileStore.workspaceList.find(p => p.projectId === projectId);
  if (selectedProject) {
    fileStore.setCurrentProjectId(projectId);
    fileStore.setCurrentProject(selectedProject);
    
    // 通知父组件项目已切换
    emit('project-changed', selectedProject);
    
    ElMessage.success(`已切换到工作空间：${selectedProject.originalFileName}`);
  }
};

onMounted(async () => {
  // 如果当前没有选中的项目，但有工作空间列表，则默认选中第一项
  if (!fileStore.currentProjectId && fileStore.workspaceList.length > 0) {
    const firstProject = fileStore.workspaceList[0];
    selectedProjectId.value = firstProject.projectId;
    
    // 设置当前项目
    fileStore.setCurrentProjectId(firstProject.projectId);
    fileStore.setCurrentProject(firstProject);
    
    // 触发项目切换事件
    emit('project-changed', firstProject);
    
    ElMessage.success(`已自动选择工作空间：${firstProject.originalFileName}`);
  } else {
    selectedProjectId.value = fileStore.currentProjectId;
  }
});
</script>

<style scoped>
.workspace-selector {
  display: flex;
  align-items: center;
}

.workspace-select {
  min-width: 200px;
}

.project-option {
  display: flex;
  align-items: center;
  gap: 8px;
}

.project-icon {
  color: #409eff;
}

.project-name {
  font-size: 14px;
}
</style>
<template>
  <div class="file-manager" @dragover="handleDragOver" @drop="handleDrop">
    <!-- 右侧主区域 -->
    <div class="main">
      <!-- 面包屑导航 -->
      <Breadcrumb
          :current-folder="fileStore.currentFolder"
          :current-project="fileStore.currentProject"
          @navigate="navigateToPath"
          @refresh="refreshCurrentFolder"
        />

      <!-- 功能区 -->
      <div class="toolbar">
        <!-- 工作空间选择器 -->
        <WorkspaceSelector @project-changed="handleProjectChange" />
        
        <div class="toolbar-divider"></div>
        
        <el-button
            type="info"
            size="small"
            @click="goBack"
            :disabled="fileStore.currentFolder === '/'"
            icon="ArrowLeft"
        >
          返回上级
        </el-button>
        <el-button type="success" size="small" @click="createNewFolder" icon="FolderAdd">
          新建文件夹
        </el-button>
        <el-button type="primary" size="small" @click="uploadFile">上传</el-button>
      </div>

      <!-- 文件列表 -->
      <FileList
          :file-list="fileStore.fileList"
          @enter-folder="enterFolder"
          @download-file="handleDownload"
          @delete-item="handleDelete"
          @batch-download="handleBatchDownload"
          @batch-delete="handleBatchDelete"
          @add-to-download="handleAddToDownload"
      />
    </div>

    <!-- 上传对话框 -->
    <FileUploadDialog
        v-model="showUploadDialog"
        :current-path="fileStore.currentFolder"
        :current-folder-id="getCurrentFolderId()"
        :default-files="dragFiles"
        @confirm="handleUploadConfirm"
        @upload-complete="handleUploadComplete"
    />

    <!-- 下载对话框 -->
    <FileDownloadDialog
        v-model="showDownloadDialog"
        :files="downloadFiles"
        @download-complete="handleDownloadComplete"
    />
  </div>
</template>

<script setup>
import {ref, onMounted, nextTick} from 'vue';
import {ElMessage, ElMessageBox} from 'element-plus';
import {useFileStore} from '@/stores/fileStore';
import {
  getFtpFileApi,
  fileDeleteApi,
  folderDeleteApi,
  createFolderApi,
  getUserWorderApi
} from '@/api/ftp.js';
import FileList from '@/components/FileList.vue';
import Breadcrumb from '@/components/Breadcrumb.vue';
import FileUploadDialog from '@/components/FileUploadDialog.vue';
import FileDownloadDialog from '@/components/FileDownloadDialog.vue';
import WorkspaceSelector from '@/components/WorkspaceSelector.vue';

const fileStore = useFileStore();
const fileTreeRef = ref(null);
const showUploadDialog = ref(false);
const showDownloadDialog = ref(false);
const dragFiles = ref([]);
const downloadFiles = ref([]);

const folderIdCache = ref(new Map());

const getCurrentFolderId = () => {
  if (fileStore.currentFolder === '/') {
    return 0;
  }

  const cachedId = folderIdCache.value.get(fileStore.currentFolder);
  if (cachedId !== undefined) {
    return cachedId;
  }

  const firstItem = fileStore.fileList.find(item => item.parentId !== undefined && item.parentId !== null);
  if (firstItem) {

    folderIdCache.value.set(fileStore.currentFolder, firstItem.parentId);
    return firstItem.parentId;
  }

  console.warn('无法获取当前文件夹ID，路径:', fileStore.currentFolder, '，使用根目录ID: 0');
  return 0;
};

const setCurrentFolderIdCache = (path, id) => {
  folderIdCache.value.set(path, id);
};

const loadFolderData = async (folderId) => {
  try {
    const targetId = folderId === 0 || folderId === '0' ? '0' : folderId.toString();
    console.log('发起API请求:', targetId);
    const res = await getFtpFileApi(targetId, fileStore.currentProjectId);
    console.log('API响应:', res);

    const data = res.data || [];

    const fileListData = data
        .filter(i => i.originalFileName !== ".folder_placeholder")
        .map(dataItem => {
          let fileType;
          if (dataItem.isDir === 1) {
            fileType = 'folder';
          } else {
            // 从文件名中提取扩展名作为文件类型
            const fileName = dataItem.originalFileName || '';
            const lastDotIndex = fileName.lastIndexOf('.');
            fileType = lastDotIndex > 0 ? fileName.substring(lastDotIndex + 1).toLowerCase() : 'unknown';
          }

          return {
            id: dataItem.id,
            originalFileName: dataItem.originalFileName,
            parentId: dataItem.parentId,
            minioObjectName: dataItem.minioObjectName,
            fileType: fileType,
            isFolder: dataItem.isDir === 1,
            fileSize: dataItem.fileSize,
            createdAt: dataItem.createdAt,
            updatedAt: dataItem.updatedAt
          };
        });

    return {
      fileListData,
      rawData: data
    };
  } catch (error) {
    console.error('数据加载失败:', error);
    return {
      fileListData: [],
      rawData: []
    };
  }
};

const handleBatchDownload = (files) => {
  if (files.length === 0) {
    ElMessage.warning('请选择要下载的文件');
    return;
  }

  downloadFiles.value = files;
  showDownloadDialog.value = true;
};

const handleBatchDelete = async (files) => {
  if (files.length === 0) {
    ElMessage.warning('请选择要删除的文件');
    return;
  }

  try {
    const fileNames = files.map(f => f.originalFileName).join('、');
    await ElMessageBox.confirm(
        `确定要删除以下文件吗？\n\n${fileNames}`,
        '批量删除确认',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          type: 'warning'
        }
    );

    const fileIds = files.map(f => f.id);
    await fileDeleteApi(fileIds);

    ElMessage.success(`成功删除 ${files.length} 个文件`);

    // 刷新文件列表
    await refreshCurrentFolder();
  } catch (error) {
    if (error !== 'cancel') {
      console.error('批量删除失败:', error);
      ElMessage.error('批量删除失败');
    }
  }
};

// 加入下载队列
const handleAddToDownload = (file) => {
  const added = fileStore.addDownloadItem(file);
  if (added) {
    ElMessage.success(`${file.originalFileName} 已加入下载队列`);
  } else {
    ElMessage.info(`${file.originalFileName} 已在下载队列中`);
  }
};


// 下载完成回调
const handleDownloadComplete = (result) => {
  ElMessage.success(`下载完成：成功 ${result.completed} 个，失败 ${result.failed} 个`);
  downloadFiles.value = [];
};

// 加载文件夹
const loadFolder = async (folderPath, folderId = null) => {
  try {
    let targetFolderId = folderId;

    if (folderPath === '/') {
      targetFolderId = 0;
      fileStore.setCurrentFolder('/');
      setCurrentFolderIdCache('/', 0);
    } else if (targetFolderId !== null) {
      setCurrentFolderIdCache(folderPath, targetFolderId);
    }

    const {fileListData} = await loadFolderData(targetFolderId);

    if (folderPath === '/') {
      const initialTreeData = [{
        originalFileName: '根目录',
        id: 0,
        parentId: null,
        minioObjectName: '/',
        fileType: 'folder',
        isFolder: true,
        isLeaf: false
      }];
      fileStore.setTreeData(initialTreeData);
    }

    fileStore.setFileList(fileListData);
    fileStore.setCurrentFolder(folderPath);

  } catch (error) {
    console.error('加载文件夹失败:', error);
  }
};

// 路径导航
const navigateToPath = async (targetPath) => {
  try {
    const pathParts = targetPath.split('/').filter(part => part);
    
    // 如果没有路径部分或者是当前项目的根目录
    if (pathParts.length === 0 || (pathParts.length === 1 && fileStore.currentProject && pathParts[0] === fileStore.currentProject.originalFileName)) {
      // 导航到当前项目的根目录
      if (fileStore.currentProject) {
        const projectPath = `/${fileStore.currentProject.originalFileName}`;
        const {fileListData} = await loadFolderData('0');
        fileStore.setFileList(fileListData);
        fileStore.setCurrentFolder(projectPath);
        setCurrentFolderIdCache(projectPath, 0);
      }
      return;
    }

    // 确保路径是当前项目的子路径
    if (!fileStore.currentProject || pathParts[0] !== fileStore.currentProject.originalFileName) {
      console.error('路径不属于当前项目:', targetPath);
      return;
    }
    
    // 首先检查目标路径是否已经缓存
    const cachedId = folderIdCache.value.get(targetPath);
    if (cachedId !== undefined) {
      console.log('使用缓存的文件夹ID:', targetPath, '->', cachedId);
      const {fileListData} = await loadFolderData(cachedId.toString());
      fileStore.setFileList(fileListData);
      fileStore.setCurrentFolder(targetPath);
      return;
    }
    
    // 导航到项目内的子文件夹
    let currentId = 0;
    let currentPath = `/${pathParts[0]}`; // 从项目根开始
    
    for (let i = 1; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      // 检查当前层级路径是否已缓存
      const partialPath = currentPath + '/' + part;
      const partialCachedId = folderIdCache.value.get(partialPath);
      
      if (partialCachedId !== undefined) {
        console.log('使用缓存的部分路径ID:', partialPath, '->', partialCachedId);
        currentId = partialCachedId;
        currentPath = partialPath;
        continue;
      }
      
      // 如果没有缓存，则加载数据查找
      const {rawData} = await loadFolderData(currentId.toString());
      const folders = rawData.filter(item => item.isDir === 1);

      const targetFolder = folders.find(folder => folder.originalFileName === part);
      if (!targetFolder) {
        console.error('找不到文件夹:', part, '在路径:', currentPath);
        // 回退到项目根目录
        const projectPath = `/${fileStore.currentProject.originalFileName}`;
        const {fileListData} = await loadFolderData('0');
        fileStore.setFileList(fileListData);
        fileStore.setCurrentFolder(projectPath);
        setCurrentFolderIdCache(projectPath, 0);
        return;
      }

      currentId = targetFolder.id;
      currentPath = partialPath;
      
      // 缓存这个部分路径
      setCurrentFolderIdCache(currentPath, currentId);
    }
    
    const {fileListData} = await loadFolderData(currentId.toString());
    fileStore.setFileList(fileListData);
    fileStore.setCurrentFolder(targetPath);
    setCurrentFolderIdCache(targetPath, currentId);

  } catch (error) {
    console.error('路径导航失败:', error);
    // 回退到项目根目录
    if (fileStore.currentProject) {
      const projectPath = `/${fileStore.currentProject.originalFileName}`;
      const {fileListData} = await loadFolderData('0');
      fileStore.setFileList(fileListData);
      fileStore.setCurrentFolder(projectPath);
      setCurrentFolderIdCache(projectPath, 0);
    }
  }
};

// 返回上级目录
const goBack = async () => {
  if (!fileStore.currentProject) return;
  
  const pathParts = fileStore.currentFolder.split('/').filter(part => part);
  
  // 如果已经在项目根目录，无法再返回
  if (pathParts.length <= 1) return;
  
  pathParts.pop();
  const parentPath = '/' + pathParts.join('/');

  // 检查父路径是否是项目根目录
  if (pathParts.length === 1 && pathParts[0] === fileStore.currentProject.originalFileName) {
    // 返回到项目根目录
    const {fileListData} = await loadFolderData('0');
    fileStore.setFileList(fileListData);
    fileStore.setCurrentFolder(parentPath);
    setCurrentFolderIdCache(parentPath, 0);
    return;
  }

  // 获取父级目录的ID
  let parentId = 0;
  // 跳过项目名称部分，从第二个路径开始查找
  const searchParts = pathParts.slice(1);

  for (const part of searchParts) {
    const {rawData} = await loadFolderData(parentId.toString());
    const folders = rawData.filter(item => item.isDir === 1);

    const targetFolder = folders.find(folder => folder.originalFileName === part);
    if (!targetFolder) {
      console.error('找不到父级文件夹:', part);
      // 回退到项目根目录
      const projectPath = `/${fileStore.currentProject.originalFileName}`;
      const {fileListData} = await loadFolderData('0');
      fileStore.setFileList(fileListData);
      fileStore.setCurrentFolder(projectPath);
      setCurrentFolderIdCache(projectPath, 0);
      return;
    }

    parentId = targetFolder.id;
  }

  // 加载父级目录内容
  const {fileListData} = await loadFolderData(parentId.toString());
  fileStore.setFileList(fileListData);
  fileStore.setCurrentFolder(parentPath);
  setCurrentFolderIdCache(parentPath, parentId);

  // 选中左侧树的对应节点
  if (fileTreeRef.value && fileTreeRef.value.setCurrentKey) {
    fileTreeRef.value.setCurrentKey(parentId);
  }
};

// 进入文件夹
const enterFolder = async (folder) => {
  try {
    const {fileListData} = await loadFolderData(folder.id.toString());
    
    // 构建新的路径 - 确保路径格式正确
    let newPath;
    const currentPath = fileStore.currentFolder || '/';
    
    // 如果当前路径是根目录或项目根目录
    if (currentPath === '/' || currentPath === `/${fileStore.currentProject?.originalFileName}`) {
      // 确保包含项目名称
      if (fileStore.currentProject) {
        newPath = `/${fileStore.currentProject.originalFileName}/${folder.originalFileName}`;
      } else {
        newPath = `/${folder.originalFileName}`;
      }
    } else {
      // 在现有路径基础上添加新文件夹
      newPath = `${currentPath}/${folder.originalFileName}`;
    }
    
    console.log('进入文件夹:', folder.originalFileName, '新路径:', newPath);
    
    fileStore.setFileList(fileListData);
    fileStore.setCurrentFolder(newPath);
    setCurrentFolderIdCache(newPath, folder.id);

    // 然后确保左侧树节点路径已加载并展开到目标节点
    if (folder && folder.id) {
      await ensureTreeNodeLoaded(folder);
    }
    
  } catch (error) {
    console.error('进入文件夹失败:', error);
    ElMessage.error('进入文件夹失败，请重试');
  }
};

// 上传文件
const uploadFile = () => {
  showUploadDialog.value = true;
};

// 新建文件夹
const createNewFolder = async () => {
  try {
    const {value: folderName} = await ElMessageBox.prompt(
        '请输入文件夹名称',
        '新建文件夹',
        {
          confirmButtonText: '确定',
          cancelButtonText: '取消',
          // inputPattern: /^[^\\/:*?"<>|]+$/,
          // inputErrorMessage: '文件夹名称不能包含特殊字符 \\ / : * ? " < > |'
        }
    );

    if (!folderName || !folderName.trim()) {
      ElMessage.warning('文件夹名称不能为空');
      return;
    }

    // 检查是否已存在同名文件夹
    const existingFolder = fileStore.fileList.find(
        item => item.originalFileName === folderName.trim() && item.isFolder
    );

    if (existingFolder) {
      ElMessage.warning('文件夹已存在');
      return;
    }

    // 获取当前文件夹ID
    const currentFolderId = getCurrentFolderId();

    ElMessage.info(`正在创建文件夹: ${folderName.trim()}`);

    // 调用API创建文件夹
    await createFolderApi(
        folderName.trim(),
        currentFolderId,
        fileStore.currentFolder
    );

    ElMessage.success(`文件夹 "${folderName.trim()}" 创建成功`);

    // 刷新文件列表
    await refreshCurrentFolder();

  } catch (error) {
    if (error !== 'cancel') {
      console.error('创建文件夹失败:', error);
      ElMessage.error('创建文件夹失败');
    }
  }
};

const handleUploadConfirm = async () => {
  dragFiles.value = [];

  await refreshCurrentFolder();
};

// 处理上传完成事件
const handleUploadComplete = async () => {
  await refreshCurrentFolder();
  showUploadDialog.value = false;
};

// 处理项目切换
const handleProjectChange = async (project) => {
  try {
    // 清空当前文件夹缓存
    folderIdCache.value.clear();
    
    // 设置当前项目路径
    const projectPath = `/${project.originalFileName}`;
    fileStore.setCurrentFolder(projectPath);
    
    // 加载项目根目录数据
    const {fileListData} = await loadFolderData('0');
    fileStore.setFileList(fileListData);
    
    // 缓存项目根目录ID
    setCurrentFolderIdCache(projectPath, 0);
    
    console.log('已切换到项目:', project.originalFileName);
    ElMessage.success(`已切换到工作空间：${project.originalFileName}`);
  } catch (error) {
    console.error('切换项目失败:', error);
    ElMessage.error('切换工作空间失败');
  }
};

const handleDownload = (file) => {
  downloadFiles.value = [file];
  showDownloadDialog.value = true;
};

const handleDelete = async (item) => {
  try {
    const isFolder = item.fileType === 'folder' || item.isFolder === true || item.isDir === 1;
    const itemType = isFolder ? '文件夹' : '文件';

    // 确认删除
    const confirmed = await ElMessageBox.confirm(
        `确定要删除${itemType} "${item.originalFileName}" 吗？此操作不可恢复！`,
        `删除${itemType}`,
        {
          confirmButtonText: '确定删除',
          cancelButtonText: '取消',
          type: 'warning',
        }
    ).catch(() => false);

    if (!confirmed) {
      return;
    }

    ElMessage.info(`正在删除${itemType}: ${item.originalFileName}`);

    if (isFolder) {
      // 删除文件夹
      await folderDeleteApi(item.id, item.originalFileName);
    } else {
      // 删除文件
      await fileDeleteApi([item.id]);
    }

    ElMessage.success(`${itemType} "${item.originalFileName}" 删除成功`);

    // 刷新文件列表
    const currentFolderId = fileStore.currentFolder === '/' ? '0' : getCurrentFolderId();
    const targetId = currentFolderId || '0';
    const {fileListData} = await loadFolderData(targetId);
    fileStore.setFileList(fileListData);

    // 刷新文件树
    if (fileTreeRef.value && fileTreeRef.value.refreshTree) {
      fileTreeRef.value.refreshTree();
    }

  } catch (error) {
    console.error('删除失败:', error);
    const isFolder = item.fileType === 'folder' || item.isFolder === true || item.isDir === 1;
    const itemType = isFolder ? '文件夹' : '文件';
    ElMessage.error(`${itemType} "${item.originalFileName}" 删除失败`);
  }
};

// 构建从根目录到目标文件夹的路径
const buildPathToFolder = async (targetFolder) => {
  const path = [];
  let currentFolder = targetFolder;

  while (currentFolder && currentFolder.id !== 0) {
    path.unshift(currentFolder);

    // 查找父文件夹
    if (currentFolder.parentId !== null && currentFolder.parentId !== 0) {
      try {
        const {rawData} = await loadFolderData(currentFolder.parentId.toString());
        currentFolder = rawData.find(item => item.id === currentFolder.parentId && item.isDir === 1);
      } catch (error) {
        console.error('查找父文件夹失败:', error);
        break;
      }
    } else {
      break;
    }
  }

  // 添加根目录
  path.unshift({
    originalFileName: '根目录',
    id: 0,
    parentId: null,
    isDir: 1
  });

  return path;
};

// 确保树节点路径已加载并展开到目标节点
const ensureTreeNodeLoaded = async (targetFolder) => {
  if (!fileTreeRef.value) {
    return;
  }

  try {
    // 构建从根目录到目标文件夹的路径
    const pathToTarget = await buildPathToFolder(targetFolder);

    // 逐级确保父节点已加载并展开
    for (let i = 0; i < pathToTarget.length - 1; i++) {
      const parentFolder = pathToTarget[i];

      // 检查节点是否存在于树中
      const treeRef = fileTreeRef.value;
      if (treeRef && treeRef.getNode) {
        let node = treeRef.getNode(parentFolder.id);

        // 如果节点不存在，需要先加载父节点的子节点
        if (!node && i > 0) {
          const grandParent = pathToTarget[i - 1];
          const grandParentNode = treeRef.getNode(grandParent.id);
          if (grandParentNode && !grandParentNode.loaded) {
            await new Promise((resolve) => {
              grandParentNode.loadData(() => {
                resolve();
              });
            });
          }
          node = treeRef.getNode(parentFolder.id);
        }

        // 展开节点
        if (node && !node.expanded) {
          node.expand();
          await nextTick();
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    }

    // 最后设置目标节点为选中状态
    await nextTick();
    if (fileTreeRef.value.setCurrentKey) {
      fileTreeRef.value.setCurrentKey(targetFolder.id);
    }
  } catch (error) {
    console.error('确保树节点加载失败:', error);
    // 备用方案：直接设置选中状态
    if (fileTreeRef.value && fileTreeRef.value.setCurrentKey) {
      fileTreeRef.value.setCurrentKey(targetFolder.id);
    }
  }
};

// 拖拽事件处理
const handleDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

const handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  const files = Array.from(e.dataTransfer.files);
  if (files.length > 0) {
    dragFiles.value = files;
    showUploadDialog.value = true;
  }
};

// 刷新当前文件夹
const refreshCurrentFolder = async () => {
  try {
    const currentPath = fileStore.currentFolder;

    if (currentPath === '/') {
      // 刷新根目录
      await loadFolder('/', 0);
    } else {
      // 获取当前文件夹ID并刷新
      const currentFolderId = getCurrentFolderId();
      if (currentFolderId) {
        const {fileListData} = await loadFolderData(currentFolderId.toString(), {forceRefresh: true});
        fileStore.setFileList(fileListData);
      } else {
        // 如果无法获取当前文件夹ID，使用路径导航重新加载
        await navigateToPath(currentPath);
      }
    }

    // 刷新文件树
    if (fileTreeRef.value && fileTreeRef.value.refreshTree) {
      fileTreeRef.value.refreshTree();
    }

    ElMessage.success('刷新成功');
  } catch (error) {
    console.error('刷新文件夹失败:', error);
    ElMessage.error('刷新失败');
  }
};

// 组件挂载时初始化
onMounted(async () => {
  try {
    // 获取用户工作空间
    const workspaceRes = await getUserWorderApi();
    if (workspaceRes.code === 200 && workspaceRes.data && workspaceRes.data.length > 0) {
      fileStore.setWorkspaceList(workspaceRes.data);
    } else {
      // 如果没有工作空间数据，显示空列表
      fileStore.setFileList([]);
      fileStore.setCurrentFolder('/');
      ElMessage.warning('未找到可用的工作空间');
    }
  } catch (error) {
    console.error('初始化失败:', error);
    // 错误时显示空列表
    fileStore.setFileList([]);
    fileStore.setCurrentFolder('/');
    ElMessage.error('初始化工作空间失败');
  }
});
</script>

<style scoped>
.file-manager {
  display: flex;
  height: 100%;
  background: var(--bg-primary, #f5f7fa);
  gap: 12px;
  box-sizing: border-box;
}

/* 左侧文件树 */
.left-tree {
  width: 280px;
  background: #fff;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-light, #e8eaec);
  overflow: auto;
  box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.05));
  transition: all 0.3s ease;
}

.left-tree::-webkit-scrollbar {
  width: 6px;
}

.left-tree::-webkit-scrollbar-thumb {
  background: #dcdfe6;
  border-radius: 4px;
}

.left-tree::-webkit-scrollbar-thumb:hover {
  background: #c0c4cc;
}

/* 主区域 */
.main {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: var(--radius-md, 8px);
  border: 1px solid var(--border-light, #e8eaec);
  overflow: hidden;
  box-shadow: var(--shadow-sm, 0 2px 6px rgba(0, 0, 0, 0.05));
}

/* 工具栏 */
.toolbar {
  padding: 12px 16px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.toolbar-divider {
  width: 1px;
  height: 24px;
  background: #e8eaec;
  margin: 0 4px;
}

.toolbar .el-button {
  display: flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  border-radius: var(--radius-sm, 6px);
  transition: all 0.2s ease;
}

/* ====== 响应式 ====== */
@media screen and (max-width: 1200px) {
  .file-manager {
    gap: 8px;
    padding: 8px;
  }

  .left-tree {
    width: 220px;
  }
}

@media screen and (max-width: 1024px) {
  .file-manager {
    flex-direction: row;
    gap: 6px;
  }

  .left-tree {
    width: 200px;
  }

  .toolbar {
    padding: 10px;
  }

  .toolbar .el-button {
    padding: 6px 12px;
    font-size: 13px;
  }
}

@media screen and (max-width: 768px) {
  .file-manager {
    flex-direction: column;
    padding: 6px;
  }

  .left-tree {
    display: none; /* 小屏幕隐藏文件树 */
  }

  .toolbar {
    justify-content: space-between;
    padding: 8px;
  }

  .toolbar .el-button {
    flex: 1;
    min-width: 80px;
    font-size: 12px;
  }
}

@media screen and (max-width: 480px) {
  .toolbar {
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
    padding: 6px;
  }

  .toolbar .el-button {
    flex: 1 1 48%;
    min-width: 0;
    font-size: 12px;
    padding: 6px;
    justify-content: center;
  }

  .toolbar .el-button .el-icon {
    margin-right: 0;
  }
}

@media screen and (max-width: 360px) {
  .toolbar {
    gap: 4px;
  }

  .toolbar .el-button {
    font-size: 11px;
    padding: 4px 6px;
  }
}

</style>

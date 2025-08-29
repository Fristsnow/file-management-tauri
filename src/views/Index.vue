<!--<template>-->
<!--  <div class="app">-->
<!--    &lt;!&ndash; 左侧文件树 &ndash;&gt;-->
<!--    <FileTree-->
<!--        ref="fileTreeRef"-->
<!--        :current-folder="fileStore.currentFolder"-->
<!--        :tree-data="fileStore.treeData"-->
<!--        class="left-tree"-->
<!--        @tree-click="handleTreeClick"-->
<!--        @load-children="handleLoadChildren"-->
<!--    />-->

<!--    &lt;!&ndash; 右侧主区域 &ndash;&gt;-->
<!--    <div class="main">-->
<!--      &lt;!&ndash; 面包屑导航 &ndash;&gt;-->
<!--      <Breadcrumb-->
<!--          :current-folder="fileStore.currentFolder"-->
<!--          @navigate="navigateToPath"-->
<!--      />-->

<!--      &lt;!&ndash; 功能区 &ndash;&gt;-->
<!--      <div class="toolbar">-->
<!--        <el-button-->
<!--            type="info"-->
<!--            size="small"-->
<!--            @click="goBack"-->
<!--            :disabled="fileStore.currentFolder === '/'"-->
<!--            icon="ArrowLeft"-->
<!--        >-->
<!--          返回上级-->
<!--        </el-button>-->
<!--        <el-button type="primary" size="small" @click="uploadFile">上传</el-button>-->
<!--        <el-button-->
<!--            v-if="fileStore.uploadProgress.length > 0"-->
<!--            type="success"-->
<!--            size="small"-->
<!--            @click="showUploadProgress = true"-->
<!--            icon="Upload"-->
<!--        >-->
<!--          上传进度 ({{ fileStore.uploadProgress.length }})-->
<!--        </el-button>-->
<!--      </div>-->

<!--      &lt;!&ndash; 文件列表 &ndash;&gt;-->
<!--      <FileList-->
<!--          :file-list="fileStore.fileList"-->
<!--          @enter-folder="enterFolder"-->
<!--          @download-file="handleDownload"-->
<!--          @drag-over="handleDragOver"-->
<!--          @drop="handleDrop"-->
<!--      />-->
<!--    </div>-->
<!--  </div>-->

<!--  &lt;!&ndash; 上传对话框 &ndash;&gt;-->
<!--  <FileUploadDialog-->
<!--      v-model="showUploadDialog"-->
<!--      :current-path="fileStore.currentFolder"-->
<!--      :default-files="dragFiles"-->
<!--      @confirm="handleUploadConfirm"-->
<!--  />-->


<!--</template>-->

<!--<script setup>-->
<!--import { ref, onMounted, nextTick } from 'vue';-->
<!--import { ElMessage, ElMessageBox } from 'element-plus';-->
<!--import { getFtpFileApi, uploadSmallFileApi, uploadSingleFileApi, initMultipartUploadApi, uploadPartApi, completeMultipartUploadApi, getDynamicChunkSize } from '@/api/ftp';-->
<!--import FileUploadDialog from '@/components/FileUploadDialog.vue';-->
<!--import FileTree from '@/components/FileTree.vue';-->
<!--import FileList from '@/components/FileList.vue';-->
<!--import Breadcrumb from '@/components/Breadcrumb.vue';-->

<!--import { useFileStore } from '@/stores/fileStore';-->

<!--// 使用pinia store-->
<!--const fileStore = useFileStore();-->

<!--// 组件引用-->
<!--const fileTreeRef = ref(null);-->

<!--// 上传对话框相关-->
<!--const showUploadDialog = ref(false);-->
<!--const dragFiles = ref([]);-->



<!--// 当前文件夹ID缓存-->
<!--const currentFolderIdCache = ref(new Map());-->

<!--// 获取当前文件夹ID-->
<!--const getCurrentFolderId = () => {-->
<!--  // 如果是根目录，返回0-->
<!--  if (fileStore.currentFolder === '/') {-->
<!--    return 0;-->
<!--  }-->

<!--  // 首先尝试从缓存中获取-->
<!--  if (currentFolderIdCache.value.has(fileStore.currentFolder)) {-->
<!--    return currentFolderIdCache.value.get(fileStore.currentFolder);-->
<!--  }-->

<!--  // 如果缓存中没有，尝试从文件列表中的第一个文件夹项获取parentId-->
<!--  // 因为当前目录下的所有项目的parentId就是当前目录的ID-->
<!--  const firstItem = fileStore.fileList.find(item => item.parentId !== undefined);-->
<!--  if (firstItem && firstItem.parentId !== null) {-->
<!--    // 缓存结果-->
<!--    currentFolderIdCache.value.set(fileStore.currentFolder, firstItem.parentId);-->
<!--    return firstItem.parentId;-->
<!--  }-->

<!--  // 如果都没有找到，返回null（这会触发回退到根目录的逻辑）-->
<!--  console.warn('无法获取当前文件夹ID，路径:', fileStore.currentFolder);-->
<!--  return null;-->
<!--};-->

<!--// 设置当前文件夹ID到缓存-->
<!--const setCurrentFolderIdCache = (folderPath, folderId) => {-->
<!--  currentFolderIdCache.value.set(folderPath, folderId);-->
<!--};-->

<!--// 面包屑导航方法-->
<!--const navigateToPath = async (path) => {-->
<!--  if (path === '/') {-->
<!--    await loadFolder(path, null); // 根目录不需要传递id-->
<!--    return;-->
<!--  }-->

<!--  // 对于其他路径，我们需要通过路径查找对应的文件夹ID-->
<!--  // 这是一个复杂的过程，需要遍历路径层级-->
<!--  await navigateToPathByTraversal(path);-->
<!--};-->

<!--// 通过路径遍历导航-->
<!--const navigateToPathByTraversal = async (targetPath) => {-->
<!--  try {-->
<!--    console.log('通过路径导航:', targetPath);-->

<!--    // 分解路径-->
<!--    const pathParts = targetPath.split('/').filter(part => part);-->
<!--    let currentId = 0; // 从根目录开始-->

<!--    // 逐级查找文件夹ID-->
<!--    for (const part of pathParts) {-->
<!--      const { rawData } = await loadFolderData(currentId.toString());-->
<!--      const folders = rawData.filter(item => item.isDir === 1);-->

<!--      // 查找匹配的文件夹-->
<!--      const targetFolder = folders.find(folder => folder.originalFileName === part);-->
<!--      if (!targetFolder) {-->
<!--        console.error('找不到文件夹:', part);-->
<!--        // 如果找不到，返回根目录-->
<!--        await loadFolder('/', null);-->
<!--        return;-->
<!--      }-->

<!--      currentId = targetFolder.id;-->
<!--    }-->

<!--    // 找到目标文件夹，加载其内容-->
<!--    const { fileListData } = await loadFolderData(currentId.toString());-->

<!--    // 更新文件列表-->
<!--    fileStore.setFileList(fileListData);-->
<!--    fileStore.setCurrentFolder(targetPath);-->

<!--    // 缓存文件夹ID-->
<!--    setCurrentFolderIdCache(targetPath, currentId);-->

<!--    // 重新初始化树数据以反映最新的文件结构-->
<!--    const initialTreeData = [{-->
<!--      originalFileName: '根目录',-->
<!--      id: 0,-->
<!--      parentId: null,-->
<!--      minioObjectName: '/',-->
<!--      fileType: 'folder',-->
<!--      isFolder: true,-->
<!--      isLeaf: false // 根节点不是叶子节点，可以展开-->
<!--    }];-->
<!--    fileStore.setTreeData(initialTreeData);-->

<!--    console.log('路径导航完成:', targetPath);-->
<!--  } catch (error) {-->
<!--    console.error('路径导航失败:', error);-->
<!--    // 出错时返回根目录-->
<!--    await loadFolder('/', null);-->
<!--  }-->
<!--};-->

<!--// 返回上级目录-->
<!--const goBack = async () => {-->
<!--  if (fileStore.currentFolder === '/') return;-->

<!--  // 计算上级目录路径-->
<!--  const pathParts = fileStore.currentFolder.split('/').filter(part => part);-->
<!--  if (pathParts.length <= 1) {-->
<!--    // 如果只有一级，返回根目录-->
<!--    await loadFolder('/', null);-->
<!--    return;-->
<!--  }-->

<!--  // 移除最后一级，构建上级路径-->
<!--  pathParts.pop();-->
<!--  const parentPath = '/' + pathParts.join('/');-->

<!--  // 需要找到对应的文件夹ID来加载上级目录-->
<!--  // 由于我们现在使用懒加载，需要通过路径查找对应的文件夹-->
<!--  await navigateToParentFolder(parentPath);-->
<!--};-->

<!--// 导航到父级文件夹-->
<!--const navigateToParentFolder = async (parentPath) => {-->
<!--  // 使用统一的路径导航方法-->
<!--  await navigateToPath(parentPath);-->
<!--};-->

<!--// 原始数据存储-->
<!--const rawData = ref([]);-->

<!--// 文件夹数据缓存，避免重复API调用-->
<!--const folderDataCache = ref(new Map());-->

<!--// 清除缓存的方法-->
<!--const clearFolderCache = (folderId = null) => {-->
<!--  if (folderId) {-->
<!--    folderDataCache.value.delete(folderId.toString());-->
<!--  } else {-->
<!--    folderDataCache.value.clear();-->
<!--  }-->
<!--};-->

<!--// 初始化数据加载（使用统一数据加载）-->
<!--const initializeData = async () => {-->
<!--  try {-->
<!--    console.log('开始初始化数据加载...');-->

<!--    // 使用统一数据加载函数加载根目录-->
<!--    const { fileListData, rawData: loadedRawData } = await loadFolderData('0');-->

<!--    rawData.value = loadedRawData;-->
<!--    console.log('原始数据:', rawData.value);-->

<!--    // 初始化树数据为根节点（懒加载模式）-->
<!--    const initialTreeData = [{-->
<!--      originalFileName: '根目录',-->
<!--      id: 0,-->
<!--      parentId: null,-->
<!--      minioObjectName: '/',-->
<!--      fileType: 'folder',-->
<!--      isFolder: true,-->
<!--      isLeaf: false // 根节点不是叶子节点，可以展开-->
<!--    }];-->
<!--    fileStore.setTreeData(initialTreeData);-->
<!--    console.log('树数据（懒加载模式）:', initialTreeData);-->

<!--    // 设置右侧文件列表-->
<!--    fileStore.setFileList(fileListData);-->
<!--    console.log('文件列表:', fileListData);-->

<!--    // 设置当前文件夹为根目录-->
<!--    fileStore.setCurrentFolder('/');-->

<!--    console.log('数据初始化完成');-->
<!--  } catch (error) {-->
<!--    console.error('初始化数据失败:', error);-->
<!--  }-->
<!--};-->

<!--// 加载指定文件夹的内容（使用统一数据加载）-->
<!--const loadFolder = async (folderPath, folderId = null) => {-->
<!--  try {-->
<!--    let targetFolderId = folderId;-->

<!--    // 如果是根目录，使用特殊处理-->
<!--    if (folderPath === '/') {-->
<!--      targetFolderId = 0;-->
<!--      fileStore.setCurrentFolder('/');-->
<!--      // 缓存根目录的ID-->
<!--      setCurrentFolderIdCache('/', 0);-->
<!--    } else if (targetFolderId !== null) {-->
<!--      // 缓存当前文件夹的ID-->
<!--      setCurrentFolderIdCache(folderPath, targetFolderId);-->
<!--    }-->

<!--    // 使用统一数据加载函数-->
<!--    const { fileListData, rawData: loadedRawData } = await loadFolderData(targetFolderId);-->

<!--    // 更新原始数据（仅在根目录时）-->
<!--    if (folderPath === '/') {-->
<!--      rawData.value = loadedRawData;-->

<!--      // 初始化树数据为根节点（懒加载模式）-->
<!--      const initialTreeData = [{-->
<!--        originalFileName: '根目录',-->
<!--        id: 0,-->
<!--        parentId: null,-->
<!--        minioObjectName: '/',-->
<!--        fileType: 'folder',-->
<!--        isFolder: true,-->
<!--        isLeaf: false-->
<!--      }];-->
<!--      fileStore.setTreeData(initialTreeData);-->
<!--    }-->

<!--    // 更新文件列表-->
<!--    fileStore.setFileList(fileListData);-->
<!--    fileStore.setCurrentFolder(folderPath);-->

<!--  } catch (error) {-->
<!--    console.error('加载文件夹失败:', error);-->
<!--  }-->
<!--};-->

<!--// 加载根目录-->
<!--const loadRoot = async () => {-->
<!--  await loadFolder('/', 0);-->
<!--};-->

<!--// 统一的数据加载函数，避免重复API调用-->
<!--const loadFolderData = async (folderId, options = {}) => {-->
<!--  try {-->
<!--    const targetId = folderId === 0 || folderId === '0' ? '0' : folderId.toString();-->

<!--    // 检查缓存-->
<!--    const cacheKey = targetId;-->
<!--    const forceRefresh = options.forceRefresh || false;-->

<!--    if (!forceRefresh && folderDataCache.value.has(cacheKey)) {-->
<!--      console.log('使用缓存数据:', cacheKey);-->
<!--      return folderDataCache.value.get(cacheKey);-->
<!--    }-->

<!--    console.log('发起API请求:', targetId);-->
<!--    const res = await getFtpFileApi(targetId);-->
<!--    console.log('统一数据加载API响应:', res);-->

<!--    const data = res.data || [];-->

<!--    // 处理树结构数据（只包含文件夹）-->
<!--    const folders = data.filter(item => item.isDir === 1);-->
<!--    const treeChildren = folders.map(folder => ({-->
<!--      originalFileName: folder.originalFileName,-->
<!--      id: folder.id,-->
<!--      parentId: folder.parentId,-->
<!--      minioObjectName: folder.minioObjectName,-->
<!--      fileType: 'folder',-->
<!--      isFolder: true,-->
<!--      isLeaf: false-->
<!--    }));-->

<!--    // 处理文件列表数据（包含文件和文件夹）-->
<!--    const fileListData = data.map(dataItem => ({-->
<!--      id: dataItem.id,-->
<!--      originalFileName: dataItem.originalFileName,-->
<!--      parentId: dataItem.parentId,-->
<!--      minioObjectName: dataItem.minioObjectName,-->
<!--      fileType: dataItem.isDir === 1 ? 'folder' : 'file',-->
<!--      isFolder: dataItem.isDir === 1,-->
<!--      fileSize: dataItem.fileSize,-->
<!--      createdAt: dataItem.createdAt,-->
<!--      updatedAt: dataItem.updatedAt-->
<!--    }));-->

<!--    const result = {-->
<!--      treeChildren,-->
<!--      fileListData,-->
<!--      rawData: data-->
<!--    };-->

<!--    // 缓存结果-->
<!--    folderDataCache.value.set(cacheKey, result);-->

<!--    return result;-->
<!--  } catch (error) {-->
<!--    console.error('数据加载失败:', error);-->
<!--    return {-->
<!--      treeChildren: [],-->
<!--      fileListData: [],-->
<!--      rawData: []-->
<!--    };-->
<!--  }-->
<!--};-->

<!--// 懒加载子节点处理（使用统一数据加载）-->
<!--const handleLoadChildren = async (nodeInfo) => {-->
<!--  try {-->
<!--    console.log('懒加载子节点:', nodeInfo);-->

<!--    const folderId = nodeInfo.isRoot ? '0' : nodeInfo.id;-->
<!--    const { treeChildren } = await loadFolderData(folderId);-->

<!--    // 调用resolve回调返回子节点数据-->
<!--    if (nodeInfo.resolve) {-->
<!--      nodeInfo.resolve(treeChildren);-->
<!--    }-->

<!--    return treeChildren;-->
<!--  } catch (error) {-->
<!--    console.error('懒加载失败:', error);-->
<!--    if (nodeInfo.resolve) {-->
<!--      nodeInfo.resolve([]);-->
<!--    }-->
<!--    return [];-->
<!--  }-->
<!--};-->

<!--// 左侧树点击事件处理（使用统一数据加载）-->
<!--const handleTreeClick = async (node) => {-->
<!--  console.log('点击左侧树节点:', node);-->

<!--  // 统一使用loadFolderData处理所有节点点击，包括根目录-->
<!--  try {-->
<!--    const folderId = node.id === 0 ? '0' : node.id;-->
<!--    const { fileListData } = await loadFolderData(folderId);-->
<!--    console.log('左侧树数据加载完成:', fileListData);-->

<!--    // 更新右侧文件列表-->
<!--    fileStore.setFileList(fileListData);-->

<!--    // 更新当前文件夹-->
<!--    const folderPath = node.id === 0 ? '/' : node.minioObjectName;-->
<!--    fileStore.setCurrentFolder(folderPath);-->

<!--    // 缓存文件夹ID-->
<!--    setCurrentFolderIdCache(folderPath, node.id === 0 ? 0 : node.id);-->

<!--    console.log('左侧树切换完成');-->
<!--  } catch (error) {-->
<!--    console.error('左侧树加载失败:', error);-->
<!--  }-->
<!--};-->

<!--// 判断是否为文件夹-->
<!--const isFolder = (item) => {-->
<!--  return item.fileType === 'folder' || item.isFolder === true;-->
<!--};-->

<!--// 右侧列表点击文件夹事件处理（使用统一数据加载）-->
<!--const enterFolder = async (row) => {-->
<!--  if (isFolder(row)) {-->
<!--    console.log('点击文件夹:', row);-->

<!--    // 使用统一数据加载函数-->
<!--    try {-->
<!--      const { fileListData } = await loadFolderData(row.id);-->
<!--      console.log('文件夹数据加载完成:', fileListData);-->

<!--      // 更新文件列表-->
<!--      fileStore.setFileList(fileListData);-->

<!--      // 更新当前文件夹-->
<!--      fileStore.setCurrentFolder(row.minioObjectName);-->

<!--      // 缓存文件夹ID-->
<!--      setCurrentFolderIdCache(row.minioObjectName, row.id);-->

<!--      // 同步更新左侧树的选中状态-->
<!--      await nextTick();-->

<!--      // 确保左侧树节点路径已加载并展开-->
<!--      await ensureTreeNodeLoaded(row);-->

<!--      console.log('文件夹切换完成，左右侧已同步');-->
<!--    } catch (error) {-->
<!--      console.error('加载文件夹失败:', error);-->
<!--    }-->
<!--  }-->
<!--};-->

<!--// 确保树节点路径已加载并展开到目标节点-->
<!--const ensureTreeNodeLoaded = async (targetFolder) => {-->
<!--  if (!fileTreeRef.value) return;-->

<!--  try {-->
<!--    // 构建从根目录到目标文件夹的路径-->
<!--    const pathToTarget = await buildPathToFolder(targetFolder);-->
<!--    console.log('目标文件夹路径:', pathToTarget);-->

<!--    // 逐级确保父节点已加载-->
<!--    for (let i = 0; i < pathToTarget.length - 1; i++) {-->
<!--      const parentFolder = pathToTarget[i];-->
<!--      const childFolder = pathToTarget[i + 1];-->

<!--      // 检查父节点是否已展开，如果没有则展开-->
<!--      if (fileTreeRef.value.expandNode) {-->
<!--        console.log('展开父节点:', parentFolder.originalFileName);-->
<!--        fileTreeRef.value.expandNode(parentFolder.id);-->
<!--        await nextTick();-->
<!--        // 等待懒加载完成-->
<!--        await new Promise(resolve => setTimeout(resolve, 200));-->
<!--      }-->
<!--    }-->

<!--    // 最后设置目标节点为选中状态-->
<!--    await nextTick();-->
<!--    if (fileTreeRef.value.setCurrentKey) {-->
<!--      fileTreeRef.value.setCurrentKey(targetFolder.id);-->
<!--      console.log('设置选中节点:', targetFolder.originalFileName);-->
<!--    }-->
<!--  } catch (error) {-->
<!--    console.error('确保树节点加载失败:', error);-->
<!--    // 备用方案：直接设置选中状态-->
<!--    if (fileTreeRef.value && fileTreeRef.value.setCurrentKey) {-->
<!--      fileTreeRef.value.setCurrentKey(targetFolder.id);-->
<!--    }-->
<!--  }-->
<!--};-->

<!--// 构建从根目录到目标文件夹的路径-->
<!--const buildPathToFolder = async (targetFolder) => {-->
<!--  const path = [];-->

<!--  // 利用minioObjectName路径信息来构建路径-->
<!--  const folderPath = targetFolder.minioObjectName || '';-->

<!--  // 解析路径，获取所有层级的文件夹名称-->
<!--  const pathParts = folderPath.split('/').filter(part => part.length > 0);-->

<!--  // 添加根目录-->
<!--  path.push({ id: 0, originalFileName: '根目录', parentId: null, minioObjectName: '/' });-->

<!--  // 逐级构建路径，需要查找每个层级的文件夹ID-->
<!--  let currentPath = '';-->
<!--  let currentParentId = 0;-->

<!--  for (let i = 0; i < pathParts.length; i++) {-->
<!--    const folderName = pathParts[i];-->
<!--    currentPath += folderName + '/';-->

<!--    // 查找当前层级的文件夹信息-->
<!--    const folderInfo = await findFolderByPath(currentPath, currentParentId, folderName);-->
<!--    if (folderInfo) {-->
<!--      path.push(folderInfo);-->
<!--      currentParentId = folderInfo.id;-->
<!--    }-->
<!--  }-->

<!--  return path;-->
<!--};-->

<!--// 通过路径和父ID查找文件夹信息-->
<!--const findFolderByPath = async (targetPath, parentId, folderName) => {-->
<!--  // 首先尝试从缓存中查找-->
<!--  for (const [cacheKey, cacheData] of folderDataCache.value.entries()) {-->
<!--    const folder = cacheData.rawData.find(item =>-->
<!--        item.isDir === 1 &&-->
<!--        item.originalFileName === folderName &&-->
<!--        item.parentId === parentId-->
<!--    );-->
<!--    if (folder) {-->
<!--      return {-->
<!--        id: folder.id,-->
<!--        originalFileName: folder.originalFileName,-->
<!--        parentId: folder.parentId,-->
<!--        minioObjectName: folder.minioObjectName-->
<!--      };-->
<!--    }-->
<!--  }-->

<!--  // 如果缓存中没有找到，加载父目录数据-->
<!--  try {-->
<!--    const { rawData } = await loadFolderData(parentId);-->
<!--    const folder = rawData.find(item =>-->
<!--        item.isDir === 1 &&-->
<!--        item.originalFileName === folderName-->
<!--    );-->

<!--    if (folder) {-->
<!--      return {-->
<!--        id: folder.id,-->
<!--        originalFileName: folder.originalFileName,-->
<!--        parentId: folder.parentId,-->
<!--        minioObjectName: folder.minioObjectName-->
<!--      };-->
<!--    }-->
<!--  } catch (error) {-->
<!--    console.error('查找文件夹失败:', error);-->
<!--  }-->

<!--  return null;-->
<!--};-->

<!--// 文件下载处理-->
<!--const handleDownload = (file) => {-->
<!--  // 下载逻辑-->
<!--  console.log('下载文件:', file);-->
<!--};-->

<!--// 上传文件 - 显示上传对话框-->
<!--const uploadFile = () => {-->
<!--  dragFiles.value = []; // 清空拖拽文件-->
<!--  showUploadDialog.value = true; // 显示上传对话框-->
<!--};-->

<!--// 新建文件夹-->
<!--const newFolder = () => {-->
<!--  const folderName = '新建文件夹_' + Math.floor(Math.random() * 100);-->
<!--  const fullPath = fileStore.currentFolder.endsWith('/')-->
<!--      ? fileStore.currentFolder + folderName + '/'-->
<!--      : fileStore.currentFolder + '/' + folderName + '/';-->

<!--  const newItem = {-->
<!--    id: Date.now(),-->
<!--    originalFileName: folderName,-->
<!--    parentId: 0,-->
<!--    minioObjectName: fullPath,-->
<!--    fileType: 'folder',-->
<!--    isFolder: true,-->
<!--    fileSize: 0,-->
<!--    createdAt: new Date().toISOString(),-->
<!--    updatedAt: new Date().toISOString(),-->
<!--    bucketName: 'public',-->
<!--    isDeleted: 0,-->
<!--    isDir: 1-->
<!--  };-->
<!--  const currentList = [...fileStore.fileList];-->
<!--  currentList.unshift(newItem);-->
<!--  fileStore.setFileList(currentList);-->
<!--};-->

<!--// 拖拽事件处理-->
<!--const handleDragOver = (e) => {-->
<!--  e.preventDefault();-->
<!--  e.stopPropagation();-->
<!--};-->

<!--const handleDrop = (e) => {-->
<!--  e.preventDefault();-->
<!--  e.stopPropagation();-->
<!--  const files = Array.from(e.dataTransfer.files);-->
<!--  if (files.length > 0) {-->
<!--    dragFiles.value = files;-->
<!--    showUploadDialog.value = true;-->
<!--  }-->
<!--};-->

<!--// 处理上传确认-->
<!--const handleUploadConfirm = async (files) => {-->
<!--  // 清空拖拽文件-->
<!--  dragFiles.value = [];-->

<!--  // 检查文件覆盖-->
<!--  const conflictFiles = await checkFileConflicts(files);-->

<!--  if (conflictFiles.length > 0) {-->
<!--    const conflictNames = conflictFiles.map(f => f.webkitRelativePath || f.name).join('\n');-->
<!--    const confirmed = await ElMessageBox.confirm(-->
<!--        `以下文件在当前目录已存在，是否覆盖？\n\n${conflictNames}`,-->
<!--        '文件覆盖确认',-->
<!--        {-->
<!--          confirmButtonText: '覆盖',-->
<!--          cancelButtonText: '取消',-->
<!--          type: 'warning',-->
<!--          customClass: 'file-overwrite-dialog'-->
<!--        }-->
<!--    ).catch(() => false);-->

<!--    if (!confirmed) {-->
<!--      ElMessage.info('已取消上传');-->
<!--      return;-->
<!--    }-->
<!--  }-->

<!--  // 为每个文件创建上传状态-->
<!--  const shouldOverwrite = conflictFiles.length > 0; // 如果有冲突文件且用户确认，则需要覆盖-->
<!--  files.forEach(file => {-->
<!--    const uploadItem = {-->
<!--      id: Date.now() + Math.random(),-->
<!--      name: file.webkitRelativePath || file.name, // 使用原始文件名，路径处理交给API-->
<!--      size: file.size,-->
<!--      progress: 0,-->
<!--      status: 'waiting', // waiting, uploading, completed, error-->
<!--      speed: 0,-->
<!--      uploadedChunks: 0,-->
<!--      totalChunks: 0,-->
<!--      startTime: null,-->
<!--      file: file, // 保存文件对象用于上传-->
<!--      overwrite: shouldOverwrite // 添加覆盖标识-->
<!--    };-->
<!--    fileStore.addUploadItem(uploadItem); // 使用addUploadItem方法，自动处理历史记录限制-->
<!--  });-->

<!--  // 显示上传进度弹窗-->
<!--  showUploadProgress.value = true;-->

<!--  // 开始上传所有文件-->
<!--  await uploadAllFiles();-->
<!--};-->

<!--// 检查文件冲突-->
<!--const checkFileConflicts = async (files) => {-->
<!--  const conflictFiles = [];-->
<!--  const currentFiles = fileStore.fileList.map(item => item.fileName || item.name);-->

<!--  files.forEach(file => {-->
<!--    const fileName = file.webkitRelativePath || file.name;-->
<!--    // 只检查文件名，不包含路径-->
<!--    const baseName = fileName.split('/').pop();-->
<!--    if (currentFiles.includes(baseName)) {-->
<!--      conflictFiles.push(file);-->
<!--    }-->
<!--  });-->

<!--  return conflictFiles;-->
<!--};-->

<!--// 上传所有文件-->
<!--const uploadAllFiles = async () => {-->
<!--  const uploadConfig = {-->
<!--    server: "http://192.168.0.12:8080",-->
<!--    bucketName: "public",-->
<!--    minChunkSize: 5 * 1024 * 1024, // MinIO 最小分片 5MB-->
<!--    maxFileConcurrency: 1, // 文件并发数-->
<!--  };-->

<!--  // 逐个上传文件-->
<!--  for (const uploadItem of fileStore.uploadProgress) {-->
<!--    if (uploadItem.status === 'waiting') {-->
<!--      await uploadSingleFile(uploadItem, uploadConfig);-->
<!--    }-->
<!--  }-->

<!--  // 上传完成后清除缓存并刷新当前文件夹内容-->
<!--  const currentFolderId = fileStore.currentFolder === '/' ? '0' : getCurrentFolderId();-->

<!--  // 清除当前文件夹的缓存-->
<!--  clearFolderCache(currentFolderId);-->

<!--  // 强制刷新数据-->
<!--  if (fileStore.currentFolder === '/') {-->
<!--    const { fileListData } = await loadFolderData('0', { forceRefresh: true });-->
<!--    fileStore.setFileList(fileListData);-->
<!--  } else {-->
<!--    // 通过当前文件夹的ID重新加载数据-->
<!--    if (currentFolderId) {-->
<!--      const { fileListData } = await loadFolderData(currentFolderId.toString(), { forceRefresh: true });-->
<!--      fileStore.setFileList(fileListData);-->
<!--    } else {-->
<!--      // 如果无法获取当前文件夹ID，回退到根目录-->
<!--      const { fileListData } = await loadFolderData('0', { forceRefresh: true });-->
<!--      fileStore.setFileList(fileListData);-->
<!--      fileStore.setCurrentFolder('/');-->
<!--    }-->
<!--  }-->

<!--  // 强制刷新文件树组件，清除缓存的节点数据-->
<!--  if (fileTreeRef.value && fileTreeRef.value.refreshTree) {-->
<!--    fileTreeRef.value.refreshTree();-->
<!--  }-->
<!--};-->

<!--// 上传单个文件 - 使用智能并发控制-->
<!--const uploadSingleFile = async (uploadItem, config) => {-->
<!--  const file = uploadItem.file;-->
<!--  const objectName = file.webkitRelativePath || file.name; // 使用原始文件名-->

<!--  uploadItem.status = 'uploading';-->
<!--  uploadItem.startTime = Date.now();-->

<!--  try {-->
<!--    // 处理文件夹上传的路径：如果文件有相对路径，需要构建完整路径-->
<!--    let fullPath = fileStore.currentFolder;-->
<!--    if (file.webkitRelativePath) {-->
<!--      // 文件夹上传：获取文件的目录部分-->
<!--      const relativeDirPath = file.webkitRelativePath.substring(0, file.webkitRelativePath.lastIndexOf('/'));-->
<!--      if (relativeDirPath) {-->
<!--        fullPath = fileStore.currentFolder.endsWith('/') ? fileStore.currentFolder + relativeDirPath : fileStore.currentFolder + '/' + relativeDirPath;-->
<!--      }-->
<!--    }-->
<!--    -->
<!--    // 使用新的单文件上传接口，自动处理路径和并发控制-->
<!--    const response = await uploadSingleFileApi(file, {-->
<!--      bucketName: config.bucketName,-->
<!--      objectName: objectName,-->
<!--      currentPath: fullPath, // 使用处理后的完整路径-->
<!--      overwrite: uploadItem.overwrite || false, // 传递覆盖标识-->
<!--      onProgress: (progress, uploadedChunks, totalChunks) => {-->
<!--        uploadItem.progress = progress;-->
<!--        uploadItem.uploadedChunks = uploadedChunks;-->
<!--        uploadItem.totalChunks = totalChunks;-->

<!--        // 计算上传速度-->
<!--        const elapsed = (Date.now() - uploadItem.startTime) / 1000;-->
<!--        uploadItem.speed = (file.size * (progress / 100)) / Math.max(elapsed, 0.1);-->
<!--      }-->
<!--    });-->

<!--    uploadItem.progress = 100;-->
<!--    uploadItem.status = 'completed';-->

<!--  } catch (error) {-->
<!--    console.error(`文件 ${objectName} 上传失败:`, error);-->
<!--    uploadItem.status = 'error';-->
<!--  }-->
<!--};-->


<!--// 移除toggleFullscreen函数，因为现在使用弹窗模式-->

<!--onMounted(() => {-->
<!--  // 直接使用统一的数据加载函数，避免重复调用-->
<!--  initializeData();-->
<!--});-->
<!--</script>-->

<!--<style scoped lang="scss">-->
<!--:root {-->
<!--  &#45;&#45;primary-color: #1890ff;-->
<!--  &#45;&#45;primary-hover: #40a9ff;-->
<!--  &#45;&#45;success-color: #52c41a;-->
<!--  &#45;&#45;success-hover: #73d13d;-->
<!--  &#45;&#45;info-color: #1890ff;-->
<!--  &#45;&#45;info-hover: #40a9ff;-->
<!--  &#45;&#45;danger-color: #ff4d4f;-->
<!--  &#45;&#45;danger-hover: #ff7875;-->
<!--  &#45;&#45;warning-color: #faad14;-->
<!--  &#45;&#45;warning-hover: #ffc53d;-->

<!--  &#45;&#45;bg-primary: #ffffff;-->
<!--  &#45;&#45;bg-secondary: #fafafa;-->
<!--  &#45;&#45;bg-tertiary: #f5f5f5;-->
<!--  &#45;&#45;bg-hover: #f0f0f0;-->

<!--  &#45;&#45;text-primary: #262626;-->
<!--  &#45;&#45;text-secondary: #595959;-->
<!--  &#45;&#45;text-tertiary: #8c8c8c;-->
<!--  &#45;&#45;text-inverse: #ffffff;-->

<!--  &#45;&#45;border-color: #d9d9d9;-->
<!--  &#45;&#45;border-light: #f0f0f0;-->
<!--  &#45;&#45;border-medium: #d9d9d9;-->
<!--  &#45;&#45;border-hover: #40a9ff;-->

<!--  &#45;&#45;shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.06);-->
<!--  &#45;&#45;shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);-->
<!--  &#45;&#45;shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);-->

<!--  &#45;&#45;radius-sm: 4px;-->
<!--  &#45;&#45;radius-md: 6px;-->
<!--  &#45;&#45;radius-lg: 8px;-->

<!--  &#45;&#45;spacing-xs: 4px;-->
<!--  &#45;&#45;spacing-sm: 8px;-->
<!--  &#45;&#45;spacing-md: 12px;-->
<!--  &#45;&#45;spacing-lg: 16px;-->
<!--  &#45;&#45;spacing-xl: 24px;-->

<!--  &#45;&#45;transition-fast: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1);-->
<!--  &#45;&#45;transition-normal: all 0.3s cubic-bezier(0.645, 0.045, 0.355, 1);-->
<!--  &#45;&#45;transition-slow: all 0.4s cubic-bezier(0.645, 0.045, 0.355, 1);-->
<!--}-->

<!--.app {-->
<!--  height: 100vh;-->
<!--  display: flex;-->
<!--  background-color: var(&#45;&#45;bg-tertiary);-->
<!--  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;-->
<!--  color: var(&#45;&#45;text-primary);-->
<!--  overflow: hidden;-->

<!--  .left-tree {-->
<!--    width: 260px;-->
<!--    min-width: 200px;-->
<!--    max-width: 400px;-->
<!--    height: 100vh;-->
<!--    border-right: 1px solid var(&#45;&#45;border-light);-->
<!--    background: var(&#45;&#45;bg-primary);-->
<!--    overflow: auto;-->
<!--    resize: horizontal;-->
<!--  }-->

<!--  .main {-->
<!--    flex: 1;-->
<!--    height: 100vh;-->
<!--    display: flex;-->
<!--    flex-direction: column;-->
<!--    background: var(&#45;&#45;bg-primary);-->
<!--    overflow: hidden;-->

<!--    .toolbar {-->
<!--      padding: 12px 20px;-->
<!--      background: #ffffff;-->
<!--      border-bottom: 1px solid #e8eaed;-->
<!--      display: flex;-->
<!--      align-items: center;-->
<!--      gap: 12px;-->
<!--      min-height: 60px;-->
<!--      flex-wrap: wrap;-->
<!--      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);-->

<!--      .el-button {-->
<!--        height: 36px;-->
<!--        padding: 0 16px;-->
<!--        font-size: 14px;-->
<!--        font-weight: 400;-->
<!--        border: 1px solid #d9d9d9;-->
<!--        border-radius: 6px;-->
<!--        background: #ffffff;-->
<!--        color: #333333;-->
<!--        transition: all 0.2s ease;-->
<!--        cursor: pointer;-->
<!--        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);-->

<!--        &:hover {-->
<!--          border-color: #1890ff;-->
<!--          color: #1890ff;-->
<!--          box-shadow: 0 2px 4px rgba(24, 144, 255, 0.15);-->
<!--        }-->

<!--        &.el-button&#45;&#45;primary {-->
<!--          background: #1890ff;-->
<!--          border-color: #1890ff;-->
<!--          color: #ffffff;-->
<!--          font-weight: 500;-->

<!--          &:hover {-->
<!--            background: #40a9ff;-->
<!--            border-color: #40a9ff;-->
<!--            box-shadow: 0 2px 6px rgba(24, 144, 255, 0.25);-->
<!--          }-->
<!--        }-->

<!--        &.el-button&#45;&#45;success {-->
<!--          background: #52c41a;-->
<!--          border-color: #52c41a;-->
<!--          color: #ffffff;-->
<!--          font-weight: 500;-->

<!--          &:hover {-->
<!--            background: #73d13d;-->
<!--            border-color: #73d13d;-->
<!--            box-shadow: 0 2px 6px rgba(82, 196, 26, 0.25);-->
<!--          }-->
<!--        }-->

<!--        &.el-button&#45;&#45;info {-->
<!--          background: #1890ff;-->
<!--          border-color: #1890ff;-->
<!--          color: #ffffff;-->
<!--          font-weight: 500;-->

<!--          &:hover {-->
<!--            background: #40a9ff;-->
<!--            border-color: #40a9ff;-->
<!--            box-shadow: 0 2px 6px rgba(24, 144, 255, 0.25);-->
<!--          }-->
<!--        }-->

<!--        &:disabled {-->
<!--          background: #f5f5f5;-->
<!--          border-color: #d9d9d9;-->
<!--          color: #bfbfbf;-->
<!--          cursor: not-allowed;-->
<!--          box-shadow: none;-->

<!--          &:hover {-->
<!--            background: #f5f5f5;-->
<!--            border-color: #d9d9d9;-->
<!--            color: #bfbfbf;-->
<!--            box-shadow: none;-->
<!--          }-->
<!--        }-->
<!--      }-->
<!--    }-->

<!--    .file-content {-->
<!--      flex: 1;-->
<!--      overflow: auto;-->
<!--      background: var(&#45;&#45;bg-primary);-->
<!--      padding: 0;-->

<!--      /* 现代化滚动条 */-->
<!--      &::-webkit-scrollbar {-->
<!--        width: 8px;-->
<!--      }-->

<!--      &::-webkit-scrollbar-track {-->
<!--        background: var(&#45;&#45;bg-secondary);-->
<!--        border-radius: var(&#45;&#45;radius-sm);-->
<!--      }-->

<!--      &::-webkit-scrollbar-thumb {-->
<!--        background: var(&#45;&#45;border-hover);-->
<!--        border-radius: var(&#45;&#45;radius-sm);-->
<!--        transition: var(&#45;&#45;transition-fast);-->

<!--        &:hover {-->
<!--          background: var(&#45;&#45;text-tertiary);-->
<!--        }-->
<!--      }-->

<!--      /* Firefox */-->
<!--      scrollbar-width: thin;-->
<!--      scrollbar-color: var(&#45;&#45;border-hover) var(&#45;&#45;bg-secondary);-->
<!--    }-->
<!--  }-->
<!--}-->

<!--/* 响应式设计 */-->
<!--@media (max-width: 1200px) {-->
<!--  .left-tree {-->
<!--    width: 240px;-->
<!--  }-->
<!--}-->

<!--@media (max-width: 1024px) {-->
<!--  .left-tree {-->
<!--    width: 220px;-->
<!--  }-->

<!--  .main {-->
<!--    .toolbar {-->
<!--      padding: 10px 16px;-->

<!--      .el-button {-->
<!--        height: 34px;-->
<!--        padding: 0 12px;-->
<!--        font-size: 13px;-->
<!--      }-->
<!--    }-->
<!--  }-->
<!--}-->

<!--@media (max-width: 768px) {-->
<!--  .app {-->
<!--    flex-direction: column;-->
<!--  }-->

<!--  .left-tree {-->
<!--    width: 100%;-->
<!--    height: 180px;-->
<!--    min-height: 180px;-->
<!--    max-height: 180px;-->
<!--    border-right: none;-->
<!--    border-bottom: 1px solid var(&#45;&#45;border-light);-->
<!--    overflow: auto;-->
<!--    resize: none;-->
<!--  }-->

<!--  .main {-->
<!--    height: calc(100vh - 180px);-->
<!--    .toolbar {-->
<!--      padding: var(&#45;&#45;spacing-sm);-->
<!--      min-height: 48px;-->
<!--      flex-wrap: wrap;-->
<!--      gap: var(&#45;&#45;spacing-xs);-->

<!--      .el-button {-->
<!--        height: 32px;-->
<!--        padding: 0 var(&#45;&#45;spacing-sm);-->
<!--        font-size: 12px;-->
<!--        flex: 1;-->
<!--        min-width: 80px;-->
<!--      }-->
<!--    }-->
<!--  }-->
<!--}-->

<!--@media (max-width: 480px) {-->
<!--  .app {-->
<!--    font-size: 14px;-->
<!--  }-->

<!--  .left-tree {-->
<!--    height: 140px;-->
<!--    min-height: 140px;-->
<!--    max-height: 140px;-->
<!--  }-->

<!--  .main {-->
<!--    height: calc(100vh - 140px);-->

<!--    .toolbar {-->
<!--      padding: var(&#45;&#45;spacing-xs);-->
<!--      min-height: 44px;-->

<!--      .el-button {-->
<!--        height: 28px;-->
<!--        padding: 0 var(&#45;&#45;spacing-xs);-->
<!--        font-size: 11px;-->
<!--        min-width: 60px;-->
<!--      }-->
<!--    }-->
<!--  }-->
<!--}-->

<!--/* 动画效果 */-->
<!--@keyframes fadeIn {-->
<!--  from {-->
<!--    opacity: 0;-->
<!--    transform: translateY(10px);-->
<!--  }-->
<!--  to {-->
<!--    opacity: 1;-->
<!--    transform: translateY(0);-->
<!--  }-->
<!--}-->

<!--@keyframes slideIn {-->
<!--  from {-->
<!--    transform: translateX(-20px);-->
<!--    opacity: 0;-->
<!--  }-->
<!--  to {-->
<!--    transform: translateX(0);-->
<!--    opacity: 1;-->
<!--  }-->
<!--}-->

<!--.fade-enter-active,-->
<!--.fade-leave-active {-->
<!--  transition: var(&#45;&#45;transition-normal);-->
<!--}-->

<!--.fade-enter-from,-->
<!--.fade-leave-to {-->
<!--  opacity: 0;-->
<!--  transform: translateY(10px);-->
<!--}-->

<!--/* 加载状态 */-->
<!--.loading {-->
<!--  display: flex;-->
<!--  align-items: center;-->
<!--  justify-content: center;-->
<!--  padding: var(&#45;&#45;spacing-xl);-->
<!--  color: var(&#45;&#45;text-secondary);-->

<!--  &::after {-->
<!--    content: '';-->
<!--    width: 20px;-->
<!--    height: 20px;-->
<!--    border: 2px solid var(&#45;&#45;border-light);-->
<!--    border-top: 2px solid var(&#45;&#45;primary-color);-->
<!--    border-radius: 50%;-->
<!--    animation: spin 1s linear infinite;-->
<!--    margin-left: var(&#45;&#45;spacing-sm);-->
<!--  }-->
<!--}-->

<!--@keyframes spin {-->
<!--  0% { transform: rotate(0deg); }-->
<!--  100% { transform: rotate(360deg); }-->
<!--}-->



<!--/* 文件覆盖确认对话框样式 */-->
<!--.file-overwrite-dialog {-->
<!--  .el-message-box__message {-->
<!--    white-space: pre-line;-->
<!--    max-height: 300px;-->
<!--    overflow-y: auto;-->
<!--    font-family: monospace;-->
<!--    font-size: 14px;-->
<!--    line-height: 1.5;-->
<!--  }-->
<!--}-->

<!--</style>-->

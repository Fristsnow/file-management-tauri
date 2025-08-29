<script setup>
import { ref, watch, onMounted, onUnmounted, computed, nextTick } from "vue";
import { ElMessage, ElProgress, ElMessageBox } from "element-plus";
import { Folder, Document, Upload, VideoPause, VideoPlay, InfoFilled } from "@element-plus/icons-vue";
import { uploadSingleFileApi, uploadSmallFileApi, formatFileSize, uploadFolderApi, abortMultipartUploadApi } from '@/api/ftp.js';
import { getUserInfoApi } from '@/api/login.js';
import { useFileStore } from '@/stores/fileStore.js';
import { useUserStore } from '@/stores/userStore.js';
// 恢复进度组件到上传对话框中
import FolderStructureList from './FolderStructureList.vue';
import UploadProgress from './UploadProgress.vue';

// 导入统一拖拽处理器
import { dragHandler } from '@/utils/dragHandler.js';

// 拖拽处理器相关状态
const dragHandlerInitialized = ref(false);
const dragEventHandlers = ref(null);
const environmentInfo = ref(null);

// 兼容性：保留isTauri引用
const isTauri = computed(() => environmentInfo.value?.isTauri || false);

// 初始化拖拽处理器
const initDragHandler = async () => {
  try {
    
    const result = await dragHandler.initialize({
      onFileDrop: handleFileDrop
    });
    
    if (result.success) {
      dragHandlerInitialized.value = true;
      dragEventHandlers.value = result.handlers;
      environmentInfo.value = dragHandler.getEnvironmentInfo();
      
      return result;
    } else {
      throw new Error(result.error || '拖拽处理器初始化失败');
    }
  } catch (error) {
    // 初始化失败时，设置基本的环境信息
    dragHandlerInitialized.value = false;
    dragEventHandlers.value = null;
    environmentInfo.value = {
      isTauri: false,
      userAgent: navigator.userAgent,
      fallbackMode: true
    };
    
    // 显示用户友好的提示
    ElMessage.warning('拖拽处理器初始化失败，已启用基础拖拽功能');
    
    return { success: false, error: error.message, fallbackMode: true };
  }
};

// 专门用于拖拽的文件夹上传处理方法
const handleDragFolderUpload = async (folderPath, files) => {
  const envInfo = environmentInfo.value;
  if (!envInfo?.isTauri) {
    throw new Error('拖拽文件夹上传仅支持Tauri环境');
  }

  try {
    // 获取用户信息和上传配置
    const userInfo = await getUserInfoApi();
    // 上传配置
    const uploadConfig = {
      baseUrl: 'http://localhost:8089',
      bucketName: 'public',
      token: localStorage.getItem('token'),
      targetPath: props.currentPath || '/'
    };

    ElMessage.info('正在处理拖拽的文件夹...');

    // 动态导入Tauri invoke函数
    const { invoke } = await import('@tauri-apps/api/core');
    
    // 调用专门的拖拽文件夹上传命令
    const uploadResult = await invoke('upload_drag_folder_with_structure', {
      folderPath: folderPath,
      config: uploadConfig
    });

    if (uploadResult.success) {
      ElMessage.success(`拖拽文件夹上传完成！${uploadResult.message}`);
      // 触发上传完成事件，通知父组件刷新文件列表
      emit('upload-complete');
      return {
        success: true,
        uploadedFiles: uploadResult.uploaded_files,
        failedFiles: uploadResult.failed_files
      };
    } else {
      throw new Error(uploadResult.message);
    }

  } catch (error) {
    throw error;
  }
};

// 文件拖拽处理回调函数
const handleFileDrop = async (files, metadata) => {
  // 为拖拽的文件添加拖拽标记
  const draggedFiles = files.map(file => {
    // 为每个文件添加拖拽标记
    file.isDragFile = true;
    return file;
  });
  
  // 根据拖拽内容类型设置标志
  if (metadata.hasDirectories && !metadata.hasFiles) {
    // 只有文件夹
    isFolder.value = true;
    isFile.value = false;
  } else if (metadata.hasFiles && !metadata.hasDirectories) {
    // 只有文件
    isFile.value = true;
    isFolder.value = false;
  } else if (metadata.hasDirectories && metadata.hasFiles) {
    // 混合内容，优先显示文件夹进度
    isFolder.value = true;
    isFile.value = false;
  } else {
    // 默认情况
    isFile.value = true;
    isFolder.value = false;
  }
  
  // 添加标记后的文件到待上传列表
  addFiles(draggedFiles);
  
  // 根据内容类型显示不同的提示信息
  if (metadata.hasDirectories && metadata.hasFiles) {
    ElMessage.success(`成功添加 ${files.length} 个项目到上传列表（包含文件和文件夹）`);
  } else if (metadata.hasDirectories) {
    ElMessage.success(`成功添加文件夹内容到上传列表，共 ${files.length} 个项目`);
  } else {
    ElMessage.success(`成功添加 ${files.length} 个文件到上传列表`);
  }
};


const props = defineProps({
  modelValue: { type: Boolean, required: true },
  currentPath: { type: String, default: "/" },
  currentFolderId: { type: Number, default: 0 },
  defaultFiles: { type: Array, default: () => [] },
});

const emit = defineEmits(["update:modelValue", "confirm", "upload-complete"]);

// 创建计算属性来处理对话框的显示状态
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value) => emit('update:modelValue', value)
});

// 拖拽状态（从拖拽处理器获取）
const isDragging = computed(() => dragEventHandlers.value?.isDragging?.value || false);

// 初始化 fileStore 和 userStore
const fileStore = useFileStore();
const userStore = useUserStore();

const fileList = ref([]);
const isUploading = ref(false);

// 上传配置
const uploadConfig = {
  bucketName: "public",
  minChunkSize: 5 * 1024 * 1024, // MinIO 最小分片 5MB
  maxFileConcurrency: 1, // 文件并发数
};

// 性能优化：进度更新节流
const progressUpdateThrottle = new Map();
const PROGRESS_UPDATE_INTERVAL = 200; // 200ms更新一次进度

// 性能监控
const performanceMonitor = {
  startTime: 0,
  fileCount: 0,
  showPerformanceTip: ref(false),

  start(count) {
    this.startTime = performance.now();
    this.fileCount = count;
    this.showPerformanceTip.value = count > 1000; // 超过1000个文件显示性能提示
  },

  end() {
    const duration = performance.now() - this.startTime;
    this.showPerformanceTip.value = false;
  }
};

// 目录分组进度管理
const directoryProgress = ref(new Map());
const showDirectoryProgress = ref(false);
const showDetailProgress = ref(false);
const directoryUpdateThrottle = new Map(); // 目录进度更新节流

// WebSocket连接管理
const ws = ref(null);
const wsConnected = ref(false);

// 等待WebSocket连接建立的Promise函数
const waitForWebSocketConnection = () => {
  return new Promise(async (resolve, reject) => {
    if (ws.value && ws.value.readyState === WebSocket.OPEN) {
      resolve();
      return;
    }

    await connectWebSocket();

    // 设置连接超时
    const timeout = setTimeout(() => {
      reject(new Error('WebSocket连接超时'));
    }, 10000); // 10秒超时

    // 监听连接成功
    const originalOnOpen = ws.value.onopen;
    ws.value.onopen = (event) => {
      clearTimeout(timeout);
      if (originalOnOpen) originalOnOpen(event);
      resolve();
    };

    // 监听连接失败
    const originalOnError = ws.value.onerror;
    ws.value.onerror = (error) => {
      clearTimeout(timeout);
      if (originalOnError) originalOnError(error);
      console.error('WebSocket连接失败');
      reject(error);
    };
  });
};

// 获取WebSocket URL的函数
const getWebSocketUrl = () => {
  console.log('=== WebSocket URL 获取调试信息 ===');
  console.log('当前环境模式:', import.meta.env.MODE);
  console.log('是否为开发环境:', import.meta.env.DEV);
  console.log('是否为生产环境:', import.meta.env.PROD);
  console.log('环境变量 VITE_WEBSOCKET_URL:', import.meta.env.VITE_WEBSOCKET_URL);
  console.log('编译时变量 __WEBSOCKET_URL__:', typeof __WEBSOCKET_URL__ !== 'undefined' ? __WEBSOCKET_URL__ : '未定义');

  let finalUrl;

  // 优先使用环境变量
  if (import.meta.env.VITE_WEBSOCKET_URL) {
    finalUrl = import.meta.env.VITE_WEBSOCKET_URL;
    // console.log('使用环境变量 VITE_WEBSOCKET_URL:', finalUrl);
    return finalUrl;
  }

  // 如果环境变量不存在，使用编译时定义的变量
  if (typeof __WEBSOCKET_URL__ !== 'undefined') {
    finalUrl = __WEBSOCKET_URL__;
    // console.log('使用编译时变量 __WEBSOCKET_URL__:', finalUrl);
    return finalUrl;
  }

  // 最后的默认值
  finalUrl = 'ws://127.0.0.1:8089/ws/upload-progress';
  // console.log('使用默认值:', finalUrl);
  // console.log('=== WebSocket URL 获取调试信息结束 ===');
  return finalUrl;
};

// WebSocket连接函数
const connectWebSocket = async () => {
  if (ws.value) {
    ws.value.close();
  }

  // 从userStore中获取用户信息
  const userId = userStore.userInfo?.id;

  if (!userId) {
    console.warn('无法从store获取用户ID，尝试调用API获取');
    try {
      // 如果store中没有用户信息，尝试调用API获取
      const userInfoResponse = await getUserInfoApi();
      const apiUserId = userInfoResponse?.data?.id || userInfoResponse?.id;
      if (apiUserId) {
        // 更新store中的用户信息
        userStore.setUserInfo({ ...userStore.userInfo, id: apiUserId });
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    }
  }

  // 构建WebSocket URL并添加认证参数
  let wsUrl = getWebSocketUrl();
  const finalUserId = userStore.userInfo?.id;
  const token = localStorage.getItem('token');

  console.log('=== WebSocket 连接调试信息 ===');
  console.log('基础WebSocket URL:', wsUrl);
  console.log('用户ID:', finalUserId);
  console.log('Token存在:', !!token);

  // 添加token进行身份验证（Sa-Token握手拦截器需要）
  if (token) {
    const separator = wsUrl.includes('?') ? '&' : '?';
    wsUrl = `${wsUrl}${separator}token=${encodeURIComponent(token)}`;
    console.log('已添加token到WebSocket URL');

    // 同时添加userId参数供业务逻辑使用
    if (finalUserId) {
      wsUrl += `&userId=${encodeURIComponent(finalUserId)}`;
      console.log('已添加userId到WebSocket URL');
    }
  } else {
    console.warn('未找到token，WebSocket连接可能会失败');
    console.warn('请确保用户已登录，并且Sa-Token会话有效');

    // 即使没有token也尝试添加userId
    if (finalUserId) {
      const separator = wsUrl.includes('?') ? '&' : '?';
      wsUrl += `${separator}userId=${encodeURIComponent(finalUserId)}`;
    }
  }

  console.log('WebSocket连接URL:', wsUrl.replace(/token=[^&]+/, 'token=***'));
  console.log('环境变量VITE_WEBSOCKET_URL:', import.meta.env.VITE_WEBSOCKET_URL);
  console.log('编译时__WEBSOCKET_URL__:', typeof __WEBSOCKET_URL__ !== 'undefined' ? __WEBSOCKET_URL__ : '未定义');
  console.log('当前环境模式:', import.meta.env.MODE);

  console.log('尝试连接WebSocket，用户ID:', finalUserId);
  ws.value = new WebSocket(wsUrl);

  ws.value.onopen = () => {
    console.log('WebSocket连接已建立，URL:', wsUrl);
    wsConnected.value = true;
  };

  ws.value.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      console.log('收到WebSocket消息:', data);

      if (data.type === 'folder_progress') {
        // 处理文件夹级别的进度数据
        updateFolderProgressFromWebSocket(data);
      } else if (data.type === 'file_progress') {
        // 处理单个文件的进度数据
        updateFileProgressFromWebSocket(data);
      } else {
        console.log('未知的WebSocket消息类型:', data.type);
      }
    } catch (error) {
      console.error('解析WebSocket消息失败:', error);
    }
  };

  ws.value.onerror = (error) => {
    console.error('WebSocket错误:', error);
    console.error('WebSocket URL:', wsUrl);
    console.error('WebSocket readyState:', ws.value?.readyState);
    wsConnected.value = false;
  };

  ws.value.onclose = (event) => {
    console.log('WebSocket连接已关闭');
    console.log('关闭代码:', event.code, '关闭原因:', event.reason);
    console.log('是否正常关闭:', event.wasClean);
    wsConnected.value = false;
    // 尝试重连
    setTimeout(async () => {
      if (showDirectoryProgress.value) {
        console.log('尝试重新连接WebSocket...');
        await connectWebSocket();
      }
    }, 3000);
  };
};

// 从WebSocket更新文件夹进度
const updateFolderProgressFromWebSocket = (data) => {
  // 适配后端新的消息格式：fileName -> folderName, uploaded -> uploadedSize, total -> totalSize
  const { fileName, progress, uploaded: uploadedSize, total: totalSize, status, completedFiles, totalFiles } = data;

  // 从文件名中提取顶级文件夹名称
  const folderName = getTopLevelDirectory(fileName);

  if (directoryProgress.value.has(folderName)) {
    const folderInfo = directoryProgress.value.get(folderName);

    // 检查并清理可能存在的重复文件夹项（不同键名但指向同一文件夹）
    const existingKeys = Array.from(directoryProgress.value.keys());
    const duplicateKeys = existingKeys.filter(key =>
      key !== folderName && (
        key.toLowerCase() === folderName.toLowerCase() ||
        key.replace(/\\/g, '/') === folderName.replace(/\\/g, '/') ||
        key.replace(/\//g, '\\') === folderName.replace(/\//g, '\\')
      )
    );

    // 删除重复的文件夹项
    if (duplicateKeys.length > 0) {
      console.log(`发现并删除重复的文件夹项:`, duplicateKeys);
      duplicateKeys.forEach(duplicateKey => {
        directoryProgress.value.delete(duplicateKey);
      });
    }

    // 创建新的对象来触发响应式更新
    const updatedFolderInfo = {
      ...folderInfo,
      progress: progress || 0,
      uploadedSize: uploadedSize || 0,
      totalSize: totalSize || folderInfo.totalSize,
      completedCount: completedFiles || 0,
      fileCount: totalFiles || folderInfo.fileCount,
      completedFiles: completedFiles || 0,
      totalFiles: totalFiles || folderInfo.fileCount
    };

    // 根据完成情况更新状态
    if (completedFiles && totalFiles && completedFiles >= totalFiles) {
      updatedFolderInfo.status = 'completed';
    } else if (status) {
      updatedFolderInfo.status = status;
    } else {
      updatedFolderInfo.status = folderInfo.status;
    }

    // 添加时间戳并重新设置Map中的值以触发响应式更新
    updatedFolderInfo.lastUpdated = Date.now();
    directoryProgress.value.set(folderName, updatedFolderInfo);

    console.log(`WebSocket更新文件夹进度 - ${folderName}:`, {
      progress,
      uploadedSize,
      totalSize,
      status,
      completedFiles,
      totalFiles,
      updatedFolderInfo
    });
  } else {
    // 如果文件夹不存在，先清理可能存在的旧进度条，然后创建新的文件夹进度项
    console.warn(`文件夹 ${folderName} 不存在于 directoryProgress 中，可能存在键名不匹配问题`);

    // 检查是否有相似的文件夹名称（可能是路径分隔符或编码问题）
    const existingKeys = Array.from(directoryProgress.value.keys());
    const similarKey = existingKeys.find(key =>
      key.toLowerCase() === folderName.toLowerCase() ||
      key.replace(/\\/g, '/') === folderName.replace(/\\/g, '/') ||
      key.replace(/\//g, '\\') === folderName.replace(/\//g, '\\')
    );

    if (similarKey) {
      console.log(`找到相似的文件夹键名: ${similarKey}，将更新该项而不是创建新项`);
      // 使用相似的键名更新现有项
      const folderInfo = directoryProgress.value.get(similarKey);
      const updatedFolderInfo = {
        ...folderInfo,
        progress: progress || 0,
        uploadedSize: uploadedSize || 0,
        totalSize: totalSize || folderInfo.totalSize,
        completedCount: completedFiles || 0,
        fileCount: totalFiles || folderInfo.fileCount,
        completedFiles: completedFiles || 0,
        totalFiles: totalFiles || folderInfo.fileCount
      };

      // 根据完成情况更新状态
      if (completedFiles && totalFiles && completedFiles >= totalFiles) {
        updatedFolderInfo.status = 'completed';
      } else if (status) {
        updatedFolderInfo.status = status;
      } else {
        updatedFolderInfo.status = folderInfo.status;
      }

      updatedFolderInfo.lastUpdated = Date.now();
      directoryProgress.value.set(similarKey, updatedFolderInfo);
      return;
    }

    // 如果确实没有匹配的文件夹，创建新的文件夹进度项
    const newFolderInfo = {
      name: folderName,
      files: [],
      totalSize: totalSize || 0,
      uploadedSize: uploadedSize || 0,
      progress: progress || 0,
      fileCount: totalFiles || 0,
      completedCount: completedFiles || 0,
      completedFiles: completedFiles || 0,
      totalFiles: totalFiles || 0
    };

    // 根据完成情况设置状态
    if (completedFiles && totalFiles && completedFiles >= totalFiles) {
      newFolderInfo.status = 'completed';
    } else if (status) {
      newFolderInfo.status = status;
    } else {
      newFolderInfo.status = 'uploading';
    }

    newFolderInfo.lastUpdated = Date.now();
    directoryProgress.value.set(folderName, newFolderInfo);

    console.log(`创建新的文件夹进度项 - ${folderName}:`, {
      progress,
      uploadedSize,
      totalSize,
      status,
      completedFiles,
      totalFiles,
      newFolderInfo
    });
  }
};

// 从WebSocket更新单个文件进度
const updateFileProgressFromWebSocket = (data) => {
  const { fileName, progress, uploadedSize, totalSize, status, speed } = data;

  // 查找对应的文件上传项
  const uploadItem = fileStore.uploadProgress.find(item =>
    item.name === fileName || (item.file && item.file.name === fileName)
  );

  if (uploadItem) {
    fileStore.updateUploadItem(uploadItem.id, {
      progress: progress || 0,
      uploadedSize: uploadedSize || 0,
      status: status || uploadItem.status,
      speed: speed || 0
    });

    console.log(`WebSocket更新文件进度 - ${fileName}:`, {
      progress,
      uploadedSize,
      totalSize,
      status,
      speed
    });

  } else {
    console.warn(`文件 ${fileName} 不存在于uploadProgress中`);
  }
};

// 获取文件的顶级目录
const getTopLevelDirectory = (filePath) => {
  if (!filePath) return '根目录';

  // 处理webkitRelativePath或普通文件名
  const path = filePath.replace(/\\/g, '/');
  const parts = path.split('/');

  // 如果是单个文件（没有路径分隔符），归类到根目录
  if (parts.length <= 1) {
    return '根目录';
  }

  // 返回顶级目录名
  return parts[0];
};

// 按顶级目录分组文件
const groupFilesByDirectory = (files) => {
  const groups = new Map();

  files.forEach(file => {
    const topDir = getTopLevelDirectory(file.webkitRelativePath || file.name);

    if (!groups.has(topDir)) {
      groups.set(topDir, {
        name: topDir,
        files: [],
        totalSize: 0,
        uploadedSize: 0,
        progress: 0,
        status: 'waiting', // waiting, uploading, completed, error
        fileCount: 0,
        completedCount: 0,
        lastUpdated: Date.now()
      });
    }

    const group = groups.get(topDir);
    group.files.push(file);
    group.totalSize += file.size;
    group.fileCount += 1;
  });

  return groups;
};

// 更新目录进度
const updateDirectoryProgress = (directoryName, uploadedSize, isCompleted = false) => {
  const group = directoryProgress.value.get(directoryName);
  if (!group) return;

  if (isCompleted) {
    group.completedCount += 1;
  }

  group.uploadedSize = uploadedSize;
  group.progress = group.totalSize > 0 ? Math.round((group.uploadedSize / group.totalSize) * 100) : 0;

  // 更新状态
  if (group.completedCount === group.fileCount) {
    group.status = 'completed';
  } else if (group.uploadedSize > 0) {
    group.status = 'uploading';
  }
};

// 节流更新进度
const throttledUpdateProgress = (uploadId, updates) => {
  const now = Date.now();
  const lastUpdate = progressUpdateThrottle.get(uploadId) || 0;

  if (now - lastUpdate >= PROGRESS_UPDATE_INTERVAL) {
    fileStore.updateUploadItem(uploadId, updates);
    progressUpdateThrottle.set(uploadId, now);

    // 同时更新目录进度
    const uploadItem = fileStore.uploadProgress.find(item => item.id === uploadId);
    if (uploadItem && uploadItem.topDirectory) {
      updateDirectoryProgressFromFiles(uploadItem.topDirectory);
    }
  }
};

// 根据文件进度更新目录进度（带节流优化）
const updateDirectoryProgressFromFiles = (directoryName) => {
  const now = Date.now();
  const lastUpdate = directoryUpdateThrottle.get(directoryName) || 0;

  // 目录进度更新节流，减少频繁更新
  if (now - lastUpdate < PROGRESS_UPDATE_INTERVAL) {
    return;
  }

  const group = directoryProgress.value.get(directoryName);
  if (!group) return;

  // 计算该目录下所有文件的总上传进度
  let totalUploadedSize = 0;
  let completedCount = 0;

  group.files.forEach(file => {
    const fileUploadItem = fileStore.uploadProgress.find(item =>
      item.name === (file.webkitRelativePath || file.name)
    );
    if (fileUploadItem) {
      // 对于已完成的文件，直接使用文件完整大小，避免进度计算误差
      if (fileUploadItem.status === 'completed') {
        totalUploadedSize += file.size;
        completedCount += 1;
      } else {
        // 对于未完成的文件，使用进度百分比计算
        totalUploadedSize += (fileUploadItem.progress || 0) * file.size / 100;
      }
    }
  });

  group.uploadedSize = totalUploadedSize;
  group.progress = group.totalSize > 0 ? Math.round((totalUploadedSize / group.totalSize) * 100) : 0;
  group.completedCount = completedCount;

  // 更新状态
  if (completedCount === group.fileCount) {
    group.status = 'completed';
  } else if (totalUploadedSize > 0) {
    group.status = 'uploading';
  } else {
    // 如果没有上传进度但也没有完成，保持等待状态
    group.status = 'waiting';
  }

  // 调试信息
  console.log('文件夹进度更新:', {
    directoryName,
    progress: group.progress,
    completedCount,
    fileCount: group.fileCount,
    status: group.status,
    totalUploadedSize,
    totalSize: group.totalSize
  });

  directoryUpdateThrottle.set(directoryName, now);
};

// 监听弹窗打开状态，每次打开时清空之前的记录并建立WebSocket连接
watch(
  () => props.modelValue,
  async (newValue) => {
    if (newValue) {
      // 弹窗打开时清空之前的上传记录
      fileStore.clearAllUploads();
      directoryProgress.value.clear();
      showDirectoryProgress.value = false;
      
      // 重置进度条显示标志
      isFile.value = true;
      isFolder.value = false;

      // 弹窗打开时立即建立WebSocket连接
      try {
        await connectWebSocket();
      } catch (error) {
        console.warn('弹窗打开时WebSocket连接失败:', error.message);
      }
    } else {
      // 弹窗关闭时断开WebSocket连接
      if (ws.value) {
        ws.value.close();
        ws.value = null;
        wsConnected.value = false;
      }
    }
  }
);

// 监听外部拖拽文件传入
watch(
  () => props.defaultFiles,
  (newFiles) => {
    if (newFiles.length) {
      addFiles(newFiles);
    }
  }
);

// 添加文件（去重：文件名+相对路径相同才算重复）
const addFiles = (files) => {
  const validFiles = [];
  let addedCount = 0;
  let skippedCount = 0;

  files.forEach(file => {
    const path = file.webkitRelativePath || file.name;

    // 空文件夹占位符直接添加，不当作空文件处理
    if (file.isEmptyFolderPlaceholder) {
      if (!fileList.value.some(f => (f.webkitRelativePath || f.name) === path)) {
        validFiles.push(file);
        fileList.value.push(file);
        addedCount++;
      } else {
        skippedCount++;
      }
      return;
    }

    // 允许空文件上传，不再过滤0字节文件

    // 检查是否重复
    if (!fileList.value.some(f => (f.webkitRelativePath || f.name) === path)) {
      validFiles.push(file);
      fileList.value.push(file);
      addedCount++;
    } else {
      skippedCount++;
      console.log(`跳过重复文件: ${path}`);
    }
  });

  // 如果没有添加任何文件，给出提示
  if (addedCount === 0 && files.length > 0) {
    if (skippedCount > 0) {
      ElMessage.info('所选文件均已存在于上传列表中');
    } else {
      ElMessage.warning('未能添加任何文件到上传列表');
    }
  }
};

// 控制进度条显示的标志
const isFile = ref(true)  // 默认显示文件进度条
const isFolder = ref(false)

// 处理文件夹选择时的空文件夹检测
const processFilesWithEmptyFolders = async (files) => {
  const processedFiles = [...files];
  
  // 构建文件夹结构映射
  const folderStructure = new Map();
  
  files.forEach(file => {
    if (file.webkitRelativePath) {
      const pathParts = file.webkitRelativePath.split('/');
      // 移除文件名，只保留文件夹路径
      const folderParts = pathParts.slice(0, -1);
      
      // 记录所有层级的文件夹路径
      for (let i = 1; i <= folderParts.length; i++) {
        const folderPath = folderParts.slice(0, i).join('/');
        if (!folderStructure.has(folderPath)) {
          folderStructure.set(folderPath, new Set());
        }
        
        // 如果是最后一级文件夹，记录包含的文件
        if (i === folderParts.length) {
          folderStructure.get(folderPath).add(file.name);
        }
      }
    }
  });
  
  // 检测空文件夹
  const allFolderPaths = new Set();
  const occupiedFolderPaths = new Set();
  
  files.forEach(file => {
    if (file.webkitRelativePath) {
      const pathParts = file.webkitRelativePath.split('/');
      const folderParts = pathParts.slice(0, -1);
      
      // 记录所有文件夹路径
      for (let i = 1; i <= folderParts.length; i++) {
        const folderPath = folderParts.slice(0, i).join('/');
        allFolderPaths.add(folderPath);
      }
      
      // 记录直接包含文件的文件夹路径
      if (folderParts.length > 0) {
        const directParentPath = folderParts.join('/');
        occupiedFolderPaths.add(directParentPath);
      }
    }
  });
  
  // 找出空文件夹（存在于allFolderPaths但不在occupiedFolderPaths中的路径）
  const emptyFolderPaths = [...allFolderPaths].filter(path => {
    // 检查这个路径是否有直接的子文件
    const hasDirectFiles = [...occupiedFolderPaths].some(occupiedPath => occupiedPath === path);
    
    // 检查这个路径是否有子文件夹包含文件
    const hasSubFoldersWithFiles = [...occupiedFolderPaths].some(occupiedPath => 
      occupiedPath.startsWith(path + '/') && occupiedPath !== path
    );
    
    return !hasDirectFiles && !hasSubFoldersWithFiles;
  });
  
  // 为空文件夹创建占位符
  emptyFolderPaths.forEach(emptyPath => {
    const emptyFolderPlaceholder = {
      name: '.folder_placeholder',
      size: 0,
      type: 'application/x-empty-folder',
      webkitRelativePath: emptyPath + '/.folder_placeholder',
      isEmptyFolderPlaceholder: true,
      folderPath: emptyPath
    };
    processedFiles.push(emptyFolderPlaceholder);
  });
  
  return processedFiles;
};

// 处理 input 选择文件
const handleAddFiles = async (e) => {
  isFile.value = true;
  isFolder.value = false;
  const files = Array.from(e.target.files);

  // 检查是否为文件夹选择
  const isDirectoryInput = e.target.hasAttribute('webkitdirectory');

  if (!isDirectoryInput && files.length === 0) {
    ElMessage.warning('请选择文件');
    return;
  }

  // 对于文件夹选择，即使没有文件也要继续处理（可能包含空文件夹）
  if (isDirectoryInput && files.length === 0) {
    ElMessage.info('选择的文件夹为空，将创建空文件夹占位符');
    // 创建一个空的占位符来表示空的根文件夹
    const emptyRootPlaceholder = {
      name: '.folder_placeholder',
      size: 0,
      type: 'application/x-empty-folder',
      webkitRelativePath: 'empty_folder/.folder_placeholder',
      isEmptyFolderPlaceholder: true,
      folderPath: 'empty_folder'
    };
    addFiles([emptyRootPlaceholder]);
    isFile.value = false;
    isFolder.value = true;
    e.target.value = "";
    return;
  }

  // 对于文件夹选择，需要检测并创建空文件夹占位符
  if (isDirectoryInput) {
    const processedFiles = await processFilesWithEmptyFolders(files);
    addFiles(processedFiles);
    
    const folderName = files[0].webkitRelativePath ? files[0].webkitRelativePath.split('/')[0] : '未知文件夹';
    const totalFiles = processedFiles.length;
    const emptyFolders = processedFiles.filter(f => f.isEmptyFolderPlaceholder).length;
    
    if (emptyFolders > 0) {
      ElMessage.success(`成功选择文件夹 "${folderName}"，包含 ${files.length} 个文件和 ${emptyFolders} 个空文件夹`);
    } else {
      ElMessage.success(`成功选择文件夹 "${folderName}"，包含 ${totalFiles} 个文件`);
    }
    
    isFile.value = false;
    isFolder.value = true;
  } else {
    addFiles(files);
  }

  // 重置input值，确保可以重复选择相同文件/文件夹
  e.target.value = "";
};

// Tauri文件夹选择方法
const handleTauriFolderSelect = async () => {
  const envInfo = environmentInfo.value;
  if (!envInfo?.isTauri) {
    ElMessage.error('Tauri环境未初始化');
    return;
  }

  try {
    // 动态导入Tauri API
    const { open } = await import('@tauri-apps/plugin-dialog');
    const { invoke } = await import('@tauri-apps/api/core');
    
    // 使用Tauri对话框选择文件夹
    const folderPath = await open({
      directory: true,
      multiple: false,
      title: '选择文件夹'
    });

    if (!folderPath) {
      return; // 用户取消选择
    }

    ElMessage.info('正在扫描文件夹结构...');

    // 调用Rust命令扫描文件夹结构
    const scanResult = await invoke('scan_folder_structure', {
      folderPath: folderPath
    });

    if (!scanResult.success) {
      ElMessage.error(`扫描文件夹失败: ${scanResult.message}`);
      return;
    }

    // 将扫描结果转换为前端文件对象
    const processedFiles = scanResult.files.map(fileInfo => {
      if (fileInfo.is_empty_folder_placeholder) {
        // 空文件夹占位符
        return {
          name: fileInfo.name,
          size: 0,
          type: 'application/x-empty-folder',
          webkitRelativePath: fileInfo.relative_path,
          isEmptyFolderPlaceholder: true,
          folderPath: fileInfo.relative_path.split('/')[0] || 'empty_folder',
          tauriFilePath: fileInfo.path
        };
      } else {
        // 普通文件
        return {
          name: fileInfo.name,
          size: fileInfo.size,
          type: 'application/octet-stream',
          webkitRelativePath: fileInfo.relative_path,
          isEmptyFolderPlaceholder: false,
          tauriFilePath: fileInfo.path
        };
      }
    });

    addFiles(processedFiles);

    const folderName = folderPath.split(/[\\/]/).pop() || '未知文件夹';
    const emptyFolders = scanResult.empty_folders;
    
    if (emptyFolders > 0) {
      ElMessage.success(`成功选择文件夹 "${folderName}"，包含 ${scanResult.total_files} 个文件和 ${emptyFolders} 个空文件夹`);
    } else {
      ElMessage.success(`成功选择文件夹 "${folderName}"，包含 ${scanResult.total_files} 个文件`);
    }

    isFile.value = false;
    isFolder.value = true;

  } catch (error) {
    console.error('Tauri文件夹选择失败:', error);
    ElMessage.error(`文件夹选择失败: ${error.message || error}`);
  }
};

// 测试拖拽功能
const testTauriDragFunction = () => {
  console.log('🧪 开始测试拖拽功能');
  
  // 使用新的拖拽处理器进行测试
  if (dragHandler && dragHandler.testDragFunction) {
    dragHandler.testDragFunction();
  } else {
    console.warn('⚠️ 拖拽处理器未初始化或测试功能不可用');
    ElMessage.warning('拖拽处理器未初始化，请先初始化拖拽功能');
  }
};

// Tauri文件夹上传方法 - 用于按钮选择的文件夹上传
const handleTauriFolderUpload = async (folderPath, files) => {
  const envInfo = environmentInfo.value;
  if (!envInfo?.isTauri) {
    throw new Error('Tauri环境未初始化');
  }

  try {
    // 获取用户信息和上传配置
    const userInfo = await getUserInfoApi();
    console.log('用户信息:', userInfo);
    
    // 临时硬编码配置用于测试
    const uploadConfig = {
      baseUrl: 'http://localhost:8089',
      bucketName: 'public',
      token: localStorage.getItem('token'),
      targetPath: props.currentPath || '/'
    };
    console.log('上传配置:', uploadConfig);
    console.log('当前路径:', props.currentPath);

    ElMessage.info('正在使用Rust后端上传文件夹...');

    // 动态导入Tauri invoke函数
    const { invoke } = await import('@tauri-apps/api/core');
    
    // 调用Rust命令上传文件夹
    const uploadResult = await invoke('upload_folder_with_structure', {
      folderPath: folderPath,
      config: uploadConfig
    });

    if (uploadResult.success) {
      ElMessage.success(uploadResult.message);
      // 触发上传完成事件，通知父组件刷新文件列表
      emit('upload-complete');
      return {
        success: true,
        uploadedFiles: uploadResult.uploaded_files,
        failedFiles: uploadResult.failed_files
      };
    } else {
      throw new Error(uploadResult.message);
    }

  } catch (error) {
    console.error('Tauri文件夹上传失败:', error);
    throw error;
  }
};

// Tauri拖拽文件夹上传方法 - 专门用于拖拽场景
const handleTauriDragFolderUpload = async (folderPath, files) => {
  const envInfo = environmentInfo.value;
  if (!envInfo?.isTauri) {
    throw new Error('Tauri环境未初始化');
  }

  try {
    // 获取用户信息和上传配置
    const userInfo = await getUserInfoApi();
    
    // 上传配置
    const uploadConfig = {
      baseUrl: 'http://localhost:8089',
      bucketName: 'public',
      token: localStorage.getItem('token'),
      targetPath: props.currentPath || '/'
    };

    ElMessage.info('正在使用Rust后端处理拖拽文件夹上传...');

    // 动态导入Tauri invoke函数
    const { invoke } = await import('@tauri-apps/api/core');
    
    // 调用专门的拖拽文件夹上传命令
    const uploadResult = await invoke('upload_drag_folder_with_structure', {
      folderPath: folderPath,
      config: uploadConfig
    });

    if (uploadResult.success) {
      ElMessage.success(`拖拽文件夹上传完成！${uploadResult.message}`);
      return {
        success: true,
        uploadedFiles: uploadResult.uploaded_files,
        failedFiles: uploadResult.failed_files
      };
    } else {
      throw new Error(uploadResult.message);
    }

  } catch (error) {
    console.error('拖拽文件夹上传失败:', error);
    throw error;
  }
};

// 统一拖拽事件处理器（使用新的拖拽处理器）
const handleDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const handler = dragEventHandlers.value?.drop;
  if (handler) {
    handler(e);
  } else {
    console.warn('⚠️ 拖拽处理器未初始化或drop处理器不可用，使用回退处理');
    // 回退处理：直接处理拖拽的文件
    handleFallbackDrop(e);
  }
};

// 回退拖拽处理方法
const handleFallbackDrop = async (e) => {
  try {
    // 首先尝试使用 webkitGetAsEntry API 处理文件夹
    const items = Array.from(e.dataTransfer.items);
    const files = [];
    let hasDirectories = false;
    let hasFiles = false;
    
    // 处理拖拽项目
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isDirectory) {
            hasDirectories = true;
            await processFallbackBrowserEntry(entry, files);
          } else if (entry.isFile) {
            hasFiles = true;
            await processFallbackBrowserEntry(entry, files);
          }
        }
      }
    }
    
    // 如果没有通过 webkitGetAsEntry 获取到文件，回退到传统方式
    if (files.length === 0) {
      console.log('⚠️ webkitGetAsEntry 未获取到文件，使用传统方式');
      const fallbackFiles = Array.from(e.dataTransfer.files);
      files.push(...fallbackFiles);
      if (fallbackFiles.length > 0) {
        hasFiles = true;
        console.log(`传统方式获取到 ${fallbackFiles.length} 个文件`);
      }
    }
    
    if (files.length > 0) {
      console.log(`📊 拖拽处理结果: ${files.length} 个文件, 包含文件夹: ${hasDirectories}, 包含文件: ${hasFiles}`);
      
      // 为文件添加拖拽标记
      const draggedFiles = files.map(file => {
        file.isDragFile = true;
        return file;
      });
      
      // 设置文件类型标志
      if (hasDirectories && !hasFiles) {
        isFolder.value = true;
        isFile.value = false;
        console.log('📁 检测到纯文件夹拖拽');
      } else if (hasFiles && !hasDirectories) {
        isFile.value = true;
        isFolder.value = false;
        console.log('📄 检测到纯文件拖拽');
      } else if (hasDirectories && hasFiles) {
        isFolder.value = true;
        isFile.value = false;
        console.log('📁📄 检测到混合内容拖拽');
      } else {
        isFile.value = true;
        isFolder.value = false;
      }
      
      // 添加文件到列表
      addFiles(draggedFiles);
      
      // 显示成功提示
      if (hasDirectories && hasFiles) {
        ElMessage.success(`成功添加 ${files.length} 个项目到上传列表（包含文件和文件夹）`);
      } else if (hasDirectories) {
        ElMessage.success(`成功添加文件夹内容到上传列表，共 ${files.length} 个项目`);
      } else {
        ElMessage.success(`成功添加 ${files.length} 个文件到上传列表`);
      }
    } else {
      console.warn('⚠️ 没有获取到任何文件');
      ElMessage.warning('没有检测到可上传的文件');
    }
  } catch (error) {
    console.error('回退拖拽处理失败:', error);
    ElMessage.error('文件拖拽处理失败，请重试');
  }
};

// 处理浏览器环境下的文件/文件夹条目（回退方式）
const processFallbackBrowserEntry = async (entry, files, path = '') => {
  try {
    if (entry.isFile) {
      // 处理文件
      return new Promise((resolve, reject) => {
        entry.file((file) => {
          try {
            // 设置文件的相对路径
            const relativePath = path ? `${path}/${file.name}` : file.name;
            Object.defineProperty(file, 'webkitRelativePath', {
              value: relativePath,
              writable: false
            });
            
            files.push(file);
            console.log(`📄 添加文件: ${relativePath}`);
            resolve();
          } catch (error) {
            console.error('处理文件时出错:', error);
            reject(error);
          }
        }, (error) => {
          console.error('读取文件失败:', error);
          reject(error);
        });
      });
    } else if (entry.isDirectory) {
      // 处理文件夹
      const dirPath = path ? `${path}/${entry.name}` : entry.name;
      console.log(`📁 处理文件夹: ${dirPath}`);
      
      return new Promise((resolve, reject) => {
        const dirReader = entry.createReader();
        const readEntries = async () => {
          try {
            dirReader.readEntries(async (entries) => {
              try {
                if (entries.length === 0) {
                  // 空文件夹，创建占位符
                  console.log(`📁 创建空文件夹占位符: ${dirPath}`);
                  const emptyFolderFile = new File([], '.gitkeep', {
                    type: 'text/plain',
                    lastModified: Date.now()
                  });
                  Object.defineProperty(emptyFolderFile, 'webkitRelativePath', {
                    value: `${dirPath}/.gitkeep`,
                    writable: false
                  });
                  Object.defineProperty(emptyFolderFile, 'isEmptyFolderPlaceholder', {
                    value: true,
                    writable: false
                  });
                  files.push(emptyFolderFile);
                  resolve();
                } else {
                  // 递归处理文件夹内容
                  const promises = entries.map(childEntry => 
                    processFallbackBrowserEntry(childEntry, files, dirPath)
                  );
                  await Promise.all(promises);
                  resolve();
                }
              } catch (error) {
                console.error('处理文件夹内容时出错:', error);
                reject(error);
              }
            }, (error) => {
              console.error('读取文件夹失败:', error);
              reject(error);
            });
          } catch (error) {
            console.error('创建文件夹读取器失败:', error);
            reject(error);
          }
        };
        readEntries();
      });
    }
  } catch (error) {
    console.error('处理条目时出错:', error);
    throw error;
  }
};

const handleDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const handler = dragEventHandlers.value?.dragover;
  if (handler) {
    handler(e);
  }
  // 回退处理：基本的拖拽悬停效果
};

const handleDragEnter = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const handler = dragEventHandlers.value?.dragenter;
  if (handler) {
    handler(e);
  }
  // 回退处理：基本的拖拽进入效果
};

const handleDragLeave = (e) => {
  e.preventDefault();
  e.stopPropagation();
  
  const handler = dragEventHandlers.value?.dragleave;
  if (handler) {
    handler(e);
  }
  // 回退处理：基本的拖拽离开效果
};

// 删除文件
const handleRemove = (index) => {
  fileList.value.splice(index, 1);
};

// 清空文件
const handleClear = () => {
  fileList.value = [];
};

// 文件夹上传处理函数 - 统一使用文件夹上传接口
const handleSmartFolderUpload = async (files) => {
  // 按顶级目录分组文件
  const folderGroups = new Map();
  const remainingFiles = [];

  files.forEach(file => {
    const topDir = getTopLevelDirectory(file.webkitRelativePath || file.name);

    // 所有来自文件夹的文件和空文件夹占位符都使用文件夹上传接口
    if ((file.webkitRelativePath && topDir !== '根目录') || file.isEmptyFolderPlaceholder) {
      const folderKey = file.isEmptyFolderPlaceholder ? file.folderPath : topDir;
      if (!folderGroups.has(folderKey)) {
        folderGroups.set(folderKey, []);
      }
      folderGroups.get(folderKey).push(file);
    } else {
      // 非文件夹文件直接加入剩余文件列表
      remainingFiles.push(file);
    }
  });

  // 处理文件夹批量上传
  for (const [folderName, folderFiles] of folderGroups) {
    // 所有文件夹都使用批量上传接口，不再有文件数量限制
    if (folderFiles.length > 0) {

      try {
        // 准备批量上传数据
        const objectNames = [];
        const originalFileNames = [];
        const processedFiles = [];

        folderFiles.forEach(file => {
          if (file.isEmptyFolderPlaceholder) {
            // 将空文件夹占位符转换为实际的File对象
            const placeholderFile = new File([''], file.name, {
              type: file.type,
              lastModified: Date.now()
            });
            
            // 设置webkitRelativePath以保持文件夹结构
            Object.defineProperty(placeholderFile, 'webkitRelativePath', {
              value: file.webkitRelativePath,
              writable: false
            });
            
            processedFiles.push(placeholderFile);
          } else {
            processedFiles.push(file);
          }
        });

        processedFiles.forEach(file => {
          const targetPath = props.currentPath || '/';
          
          if (file.isEmptyFolderPlaceholder) {
            // 处理空文件夹占位符
            const fullUploadPath = targetPath === '/' ? file.webkitRelativePath : targetPath + '/' + file.webkitRelativePath;
            objectNames.push(fullUploadPath);
            originalFileNames.push(file.name);
          } else {
            // 处理普通文件
            // webkitRelativePath已经包含了完整的相对路径，直接使用
            // 只有在根目录时才直接使用webkitRelativePath，否则需要加上当前路径
            const fullUploadPath = targetPath === '/' ? file.webkitRelativePath : targetPath + '/' + file.webkitRelativePath;
            objectNames.push(fullUploadPath);
            originalFileNames.push(file.name);
          }
        });

        // 更新所有文件状态为上传中
        folderFiles.forEach(file => {
          const uploadItem = fileStore.uploadProgress.find(item =>
            item.name === (file.webkitRelativePath || file.name)
          );
          if (uploadItem) {
            fileStore.updateUploadItem(uploadItem.id, {
              status: 'uploading',
              startTime: Date.now()
            });
          }
        });

        // 执行批量上传
        const response = await uploadFolderApi(
          processedFiles,
          objectNames,
          originalFileNames,
          uploadConfig.bucketName
        );

        // 更新所有文件状态为完成
        folderFiles.forEach(file => {
          const uploadItem = fileStore.uploadProgress.find(item =>
            item.name === (file.webkitRelativePath || file.name)
          );
          if (uploadItem) {
            fileStore.updateUploadItem(uploadItem.id, {
              status: 'completed',
              progress: 100,
              speed: 0
            });
          }
        });

        ElMessage.success(`文件夹 "${folderName}" 批量上传完成 (${folderFiles.length}个文件)`);
        // 触发上传完成事件，通知父组件刷新文件列表
        emit('upload-complete');

      } catch (error) {
        // 批量上传失败，将文件加入剩余文件列表，使用传统方式上传
        remainingFiles.push(...folderFiles);

        // 重置文件状态
        folderFiles.forEach(file => {
          const uploadItem = fileStore.uploadProgress.find(item =>
            item.name === (file.webkitRelativePath || file.name)
          );
          if (uploadItem) {
            fileStore.updateUploadItem(uploadItem.id, {
              status: 'waiting',
              progress: 0,
              speed: 0
            });
          }
        });

        ElMessage.warning(`文件夹 "${folderName}" 批量上传失败，将使用单文件上传方式`);
      }
    }
  }

  return { remainingFiles };
};

// 批量上传文件 - 严格分离文件夹上传和单文件上传
const runFileUploads = async () => {
  return runFileUploadsWithFiles(fileList.value);
};

// 使用指定文件列表进行上传的方法
const runFileUploadsWithFiles = async (files) => {
  isUploading.value = true;
  performanceMonitor.start(files.length);

  try {
    const MB = 1024 * 1024;
    const GB = 1024 * MB;

    // 分离空文件夹占位符和普通文件
    const emptyFolders = files.filter(file => file.isEmptyFolderPlaceholder);
    const regularFiles = files.filter(file => !file.isEmptyFolderPlaceholder);

    // 第一步：按文件来源分离（文件夹 vs 单文件）
    const folderFiles = regularFiles.filter(file => file.webkitRelativePath && file.webkitRelativePath.includes('/'));
    const singleFiles = regularFiles.filter(file => !file.webkitRelativePath || !file.webkitRelativePath.includes('/'));

    console.log(`文件来源分组: 空文件夹${emptyFolders.length}个, 文件夹文件${folderFiles.length}个, 单文件${singleFiles.length}个`);

    // 统一处理所有文件：拖拽和按钮选择都走相同的上传逻辑
    const allFolderFiles = [...folderFiles, ...emptyFolders];
    
    console.log('统一文件上传处理:', {
      folderFiles: folderFiles.length,
      emptyFolders: emptyFolders.length,
      singleFiles: singleFiles.length,
      totalFiles: files.length
    });

    // 创建上传任务队列
    const uploadTasks = [];

    // 处理文件夹上传 - 统一使用文件夹上传接口（包括空文件夹占位符）
    if (allFolderFiles.length > 0) {
      const folderUploadResult = await handleSmartFolderUpload(allFolderFiles);
      if (folderUploadResult.remainingFiles.length > 0) {
        // 文件夹上传失败的文件，按大小分组使用单文件接口
        const remainingSmall = folderUploadResult.remainingFiles.filter(file => file.size < 50 * MB);
        const remainingMedium = folderUploadResult.remainingFiles.filter(file => file.size >= 50 * MB && file.size < 1 * GB);
        const remainingLarge = folderUploadResult.remainingFiles.filter(file => file.size >= 1 * GB && file.size < 3 * GB);
        const remainingExtraLarge = folderUploadResult.remainingFiles.filter(file => file.size >= 3 * GB);

        if (remainingSmall.length > 0) uploadTasks.push(uploadFileGroup(remainingSmall, 3, 'small'));
        if (remainingMedium.length > 0) uploadTasks.push(uploadFileGroup(remainingMedium, 3, 'medium'));
        if (remainingLarge.length > 0) uploadTasks.push(uploadFileGroup(remainingLarge, 2, 'large'));
        if (remainingExtraLarge.length > 0) uploadTasks.push(uploadFileGroup(remainingExtraLarge, 1, 'extraLarge'));
      }
    }

    // 处理单文件上传 - 按文件大小分组使用不同接口
    if (singleFiles.length > 0) {
      const smallFiles = singleFiles.filter(file => file.size < 50 * MB); // 50MB以下 - 单文件上传接口
      const mediumFiles = singleFiles.filter(file => file.size >= 50 * MB && file.size < 1 * GB); // 50MB-1GB - 大文件上传接口
      const largeFiles = singleFiles.filter(file => file.size >= 1 * GB && file.size < 3 * GB); // 1GB-3GB - 大文件上传接口
      const extraLargeFiles = singleFiles.filter(file => file.size >= 3 * GB); // 3GB以上 - 大文件上传接口

      console.log(`单文件分组统计: 小文件${smallFiles.length}个, 中等文件${mediumFiles.length}个, 大文件${largeFiles.length}个, 超大文件${extraLargeFiles.length}个`);

      // 小文件并发上传（3个并发） - 使用单文件上传接口
      if (smallFiles.length > 0) {
        uploadTasks.push(uploadFileGroup(smallFiles, 3, 'small'));
      }

      // 中等文件并发上传（3个并发） - 使用大文件上传接口
      if (mediumFiles.length > 0) {
        uploadTasks.push(uploadFileGroup(mediumFiles, 3, 'medium'));
      }

      // 大文件并发上传（2个并发） - 使用大文件上传接口
      if (largeFiles.length > 0) {
        uploadTasks.push(uploadFileGroup(largeFiles, 2, 'large'));
      }

      // 超大文件串行上传（1个并发） - 使用大文件上传接口
      if (extraLargeFiles.length > 0) {
        uploadTasks.push(uploadFileGroup(extraLargeFiles, 1, 'extraLarge'));
      }
    }

    // 等待所有分组上传完成
    await Promise.all(uploadTasks);
    ElMessage.success('所有文件上传完成!');
    
    // 触发上传完成事件，通知父组件刷新文件列表
    emit('upload-complete');

  } catch (error) {
    ElMessage.error('批量上传过程中出现错误');
    console.error('批量上传错误:', error);
  } finally {
    performanceMonitor.end();
    isUploading.value = false;
  }
};

// 改进的并发控制队列
class ConcurrencyQueue {
  constructor(concurrency) {
    this.concurrency = concurrency;
    this.running = 0;
    this.queue = [];
  }

  async add(task) {
    return new Promise((resolve, reject) => {
      this.queue.push({ task, resolve, reject });
      this.process();
    });
  }

  async process() {
    if (this.running >= this.concurrency || this.queue.length === 0) {
      return;
    }

    this.running++;
    const { task, resolve, reject } = this.queue.shift();

    try {
      const result = await task();
      resolve(result);
    } catch (error) {
      reject(error);
    } finally {
      this.running--;
      this.process();
    }
  }
}

// 处理单文件上传
const handleSingleFilesUpload = async (singleFiles) => {
  const MB = 1024 * 1024;
  const GB = 1024 * MB;
  
  // 按文件大小分组
  const smallFiles = singleFiles.filter(file => file.size < 50 * MB);
  const mediumFiles = singleFiles.filter(file => file.size >= 50 * MB && file.size < 1 * GB);
  const largeFiles = singleFiles.filter(file => file.size >= 1 * GB && file.size < 3 * GB);
  const extraLargeFiles = singleFiles.filter(file => file.size >= 3 * GB);
  
  const uploadTasks = [];
  
  if (smallFiles.length > 0) uploadTasks.push(uploadFileGroup(smallFiles, 3, 'small'));
  if (mediumFiles.length > 0) uploadTasks.push(uploadFileGroup(mediumFiles, 3, 'medium'));
  if (largeFiles.length > 0) uploadTasks.push(uploadFileGroup(largeFiles, 2, 'large'));
  if (extraLargeFiles.length > 0) uploadTasks.push(uploadFileGroup(extraLargeFiles, 1, 'extraLarge'));
  
  await Promise.all(uploadTasks);
};

// 文件分组上传处理函数
const uploadFileGroup = async (files, concurrency, groupType) => {
  const queue = new ConcurrencyQueue(concurrency);

  const uploadSingleFile = async (file) => {
    const uploadItem = fileStore.uploadProgress.find(item =>
      item.name === (file.webkitRelativePath || file.name)
    );

    if (!uploadItem) {
      console.warn(`未找到文件 ${file.name} 的上传项`);
      return;
    }

    // 更新上传状态为上传中
    fileStore.updateUploadItem(uploadItem.id, {
      status: 'uploading',
      startTime: Date.now()
    });

    try {
      let response;
      const objectName = file.webkitRelativePath || file.name;

      // 处理文件夹上传的路径 - 构建完整的上传路径
      let targetPath = props.currentPath || '/';
      let finalObjectName = objectName;
      let fullUploadPath;

      if (file.webkitRelativePath) {
        // 对于文件夹上传，使用webkitRelativePath作为相对路径
        finalObjectName = file.webkitRelativePath;
        // 构建完整路径：根目录 + 当前路径 + 相对路径
        // objectName = 根目录 + 上传文件的路径 + 文件名
        if (targetPath === '/') {
          fullUploadPath = finalObjectName; // 根目录情况下直接使用相对路径
        } else {
          // 移除targetPath开头的'/'，避免重复
          const cleanTargetPath = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;
          fullUploadPath = cleanTargetPath + '/' + finalObjectName;
        }
      } else {
        // 对于单文件上传，构建：根目录 + 当前路径 + 文件名
        if (targetPath === '/') {
          fullUploadPath = finalObjectName; // 根目录情况下直接使用文件名
        } else {
          // 移除targetPath开头的'/'，避免重复
          const cleanTargetPath = targetPath.startsWith('/') ? targetPath.substring(1) : targetPath;
          fullUploadPath = cleanTargetPath + '/' + finalObjectName;
        }
      }

      console.log('当前路径:', targetPath, '文件名:', finalObjectName, '完整上传路径:', fullUploadPath);

      if (groupType === 'small') {
        // 小文件使用单文件上传接口
        const progressInterval = setInterval(() => {
          const elapsed = (Date.now() - uploadItem.startTime) / 1000;
          const estimatedProgress = Math.min(90, elapsed * 20);
          const speed = (file.size * (estimatedProgress / 100)) / Math.max(elapsed, 0.1);

          throttledUpdateProgress(uploadItem.id, {
            progress: estimatedProgress,
            speed: speed
          });
        }, PROGRESS_UPDATE_INTERVAL);

        // 直接使用小文件上传API，避免重复调用
        response = await uploadSmallFileApi(file, uploadConfig.bucketName, fullUploadPath, props.currentFolderId, false);
        clearInterval(progressInterval);
      } else {
        // 中等、大文件、超大文件使用大文件上传接口
        response = await uploadSingleFileApi(file, {
          bucketName: uploadConfig.bucketName,
          objectName: fullUploadPath,
          currentPath: finalObjectName,
          overwrite: false,
          onUploadIdReady: (uploadId) => {
            // 尽早存储uploadId以便中止操作
            fileStore.updateUploadItem(uploadItem.id, {
              uploadId: uploadId
            });
          },
          onProgress: (progress, uploadedChunks, totalChunks, detailedInfo) => {
            const elapsed = (Date.now() - uploadItem.startTime) / 1000;

            // 使用详细信息中的速度，如果没有则回退到计算值
            let speed = (file.size * (progress / 100)) / Math.max(elapsed, 0.1);
            let speedText = `${(speed / (1024 * 1024)).toFixed(2)} MB/s`;
            let etaText = '--:--';

            if (detailedInfo) {
              speed = detailedInfo.speed || speed;
              speedText = detailedInfo.speedText || speedText;
              etaText = detailedInfo.etaText || etaText;
            }

            throttledUpdateProgress(uploadItem.id, {
              progress: progress,
              uploadedChunks: uploadedChunks,
              totalChunks: totalChunks,
              speed: speed,
              speedText: speedText,
              etaText: etaText,
              uploadedBytes: detailedInfo?.uploadedBytes,
              totalBytes: detailedInfo?.totalBytes
            });
          }
        });

        // 如果是大文件上传，存储uploadId以便后续中止操作
        if (response && response.uploadId && file.size > 5 * 1024 * 1024) {
          fileStore.updateUploadItem(uploadItem.id, {
            uploadId: response.uploadId
          });
        }
      }

      // 上传完成
      fileStore.updateUploadItem(uploadItem.id, {
        progress: 100,
        status: 'completed'
      });

      if (uploadItem.topDirectory) {
        updateDirectoryProgressFromFiles(uploadItem.topDirectory);
      }

    } catch (error) {
      fileStore.updateUploadItem(uploadItem.id, {
        status: 'error',
        error: error?.message || '上传失败'
      });

      ElMessage.error(`文件 ${objectName} 上传失败`);
    }
  };

  const promises = files.map(file =>
    queue.add(() => uploadSingleFile(file))
  );

  await Promise.all(promises);
};

const toggleUpload = (fileName) => {
  const uploadItem = fileStore.uploadProgress.find(item => item.name === fileName);
  if (uploadItem) {
    const newStatus = uploadItem.status === 'uploading' ? 'paused' : 'uploading';
    fileStore.updateUploadItem(uploadItem.id, { status: newStatus });
  }
};

const cancelUpload = (fileName) => {
  const uploadItem = fileStore.uploadProgress.find(item => item.name === fileName);
  if (uploadItem) {
    // 从 fileStore 中移除该上传项
    const newProgress = fileStore.uploadProgress.filter(item => item.id !== uploadItem.id);
    fileStore.setUploadProgress(newProgress);
  }
};

const clearCompletedUploads = () => {
  fileStore.clearCompletedUploads();
};

const clearCompletedFolders = () => {
  const completedFolders = Array.from(directoryProgress.value.entries())
    .filter(([_, group]) => group.status === 'completed')
    .map(([name, _]) => name);

  completedFolders.forEach(folderName => {
    directoryProgress.value.delete(folderName);
  });
};

const clearAllFolders = () => {
  directoryProgress.value.clear();
  showDirectoryProgress.value = false;
};

// 清除方法已移至Layout.vue的进度监控区域

const handleConfirm = async () => {
  if (!fileList.value.length) {
    ElMessage.warning("请先选择文件！");
    return;
  }

  // 保存文件列表的副本，避免在上传过程中被清空
  const filesToUpload = [...fileList.value];
  
  const directoryGroups = groupFilesByDirectory(filesToUpload);
  directoryProgress.value = directoryGroups;
  showDirectoryProgress.value = true;

  if (!wsConnected.value) {
    ElMessage.warning('进度服务器未连接，上传将继续但进度可能不会实时更新');
  } else {
    console.log('WebSocket已连接，开始上传');
  }

  // 为每个文件创建上传项
  filesToUpload.forEach(file => {
    const uploadItem = {
      id: Date.now() + Math.random(),
      name: file.webkitRelativePath || file.name,
      size: file.size,
      currentPath: props.currentPath || '/', // 添加当前路径
      progress: 0,
      status: 'waiting',
      speed: 0,
      uploadedChunks: 0,
      totalChunks: 0,
      startTime: null,
      file: file,
      isEmptyFolder: file.isEmptyFolderPlaceholder || false, // 标记是否为空文件夹
      topDirectory: getTopLevelDirectory(file.webkitRelativePath || file.name) // 添加顶级目录信息
    };
    fileStore.addUploadItem(uploadItem);
  });

  // 清空文件列表并关闭弹窗
  fileList.value = [];
  emit("confirm");

  // 使用保存的文件列表开始上传
  console.log('开始上传文件，文件数量:', filesToUpload.length);
  runFileUploadsWithFiles(filesToUpload).catch(error => {
    console.error('上传过程中发生错误:', error);
    ElMessage.error('上传过程中发生错误: ' + (error.message || '未知错误'));
  });

};

// 关闭弹窗
const handleCancel = async (done) => {
  if (isUploading.value) {
    try {
      await ElMessageBox.confirm(
        '当前有文件正在上传中，退出将会终止所有上传任务，确定要退出吗？',
        '确认退出',
        {
          confirmButtonText: '确定退出',
          cancelButtonText: '取消',
          type: 'warning',
          dangerouslyUseHTMLString: false
        }
      );

      // 用户确认退出，停止所有上传任务
      isUploading.value = false;

      // 中止所有大文件分片上传任务
      const uploadItems = fileStore.uploadItems;
      const abortPromises = [];

      uploadItems.forEach(item => {
        // 仅对大文件分片上传且有uploadId的任务调用中止接口
        if (item.uploadId && item.size > 5 * 1024 * 1024 && item.status === 'uploading') {
          const abortPromise = abortMultipartUploadApi({
            bucketName: 'file-management',
            objectName: item.name,
            uploadId: item.uploadId
          }).catch(error => {
            console.warn(`中止分片上传失败: ${item.name}`, error);
          });
          abortPromises.push(abortPromise);
        }
      });

      // 等待所有中止请求完成
      if (abortPromises.length > 0) {
        try {
          await Promise.all(abortPromises);
          console.log(`已中止 ${abortPromises.length} 个分片上传任务`);
        } catch (error) {
          console.warn('部分分片上传任务中止失败', error);
        }
      }

      // 清除所有上传进度
      fileStore.clearAllUploads();

      // 重置目录进度显示
      directoryProgress.value.clear();
      showDirectoryProgress.value = false;

      // 关闭WebSocket连接
      if (ws.value) {
        ws.value.close();
        ws.value = null;
        wsConnected.value = false;
      }

      // 清空文件列表
      fileList.value = [];

      ElMessage.info('已终止所有上传任务');

      // 确认关闭弹窗
      emit('update:modelValue', false);
      if (done && typeof done === 'function') done();
      isFolder.value = false;
      isFile.value = false;
    } catch (error) {
      // 用户取消退出，阻止弹窗关闭
      console.log('用户取消退出上传弹窗');
      // 不调用done()，保持弹窗打开状态
    }
  } else {
    // 没有上传任务，直接关闭
    fileList.value = [];

    // 重置目录进度显示
    directoryProgress.value.clear();
    showDirectoryProgress.value = false;

    // 清空文件上传进度记录
    fileStore.clearAllUploads();

    // 关闭WebSocket连接
    if (ws.value) {
      ws.value.close();
      ws.value = null;
      wsConnected.value = false;
    }

    // 确认关闭弹窗
    emit('update:modelValue', false);
    if (done && typeof done === 'function') done();
  }
};

// 全局阻止拖拽文件到浏览器空白处默认打开
const preventDefault = (e) => {
  e.preventDefault();
  e.stopPropagation();
};

onMounted(async () => {
  console.log('🚀 FileUploadDialog组件开始初始化');
  
  // 初始化新的拖拽处理器
  await initDragHandler();
  
  // 设置全局拖拽阻止事件
  window.addEventListener("dragover", preventDefault);
  window.addEventListener("drop", preventDefault);
  
  console.log('✅ FileUploadDialog组件初始化完成');
});

onUnmounted(() => {
  // 销毁拖拽处理器
  if (dragHandler) {
    dragHandler.destroy();
  }

  window.removeEventListener("dragover", preventDefault);
  window.removeEventListener("drop", preventDefault);

  // 关闭WebSocket连接
  if (ws.value) {
    ws.value.close();
    ws.value = null;
    wsConnected.value = false;
  }
});
</script>

<template>
  <el-dialog
    v-model="dialogVisible"
    width="800px"
    class="bt-upload-dialog"
    :show-close="true"
    :close-on-click-modal="false"
    :before-close="handleCancel"
    title="文件上传"
  >
    <!-- 路径显示 -->
    <div class="upload-path">
      <el-icon class="path-icon"><Folder /></el-icon>
      <span class="path-text">上传到：{{ props.currentPath || '/' }}</span>
    </div>

    <!-- 操作按钮区 -->
    <div class="upload-actions">
      <div class="action-buttons">
        <el-button type="primary" :icon="Upload" :disabled="isUploading">
          <label class="file-input-label">
            <input
              type="file"
              multiple
              class="hidden"
              @change="handleAddFiles"
            />
            选择文件
          </label>
        </el-button>

        <el-button type="primary" plain :icon="Folder" :disabled="isUploading">
          <label class="file-input-label">
            <input
              type="file"
              webkitdirectory
              class="hidden"
              @change="handleAddFiles"
            />
            选择文件夹
          </label>
        </el-button>

        <!-- Tauri文件夹选择按钮 -->
        <el-button 
          v-if="isTauri" 
          type="success" 
          plain 
          :icon="Folder" 
          :disabled="isUploading"
          @click="handleTauriFolderSelect"
        >
          Rust文件夹选择
        </el-button>
        
        <!-- Tauri调试测试按钮 -->
        <el-button 
          v-if="isTauri" 
          type="warning" 
          plain 
          :icon="InfoFilled" 
          size="small"
          @click="testTauriDragFunction"
        >
          测试拖拽功能
        </el-button>

        <el-button
          v-if="fileList.length > 0"
          type="danger"
          plain
          @click="handleClear"
          :disabled="isUploading"
        >
          清空列表
        </el-button>
      </div>

      <!-- 上传统计 -->
      <div class="upload-stats" v-if="fileList.length > 0 || fileStore.uploadProgress.length > 0">
        <span v-if="fileList.length > 0" class="stat-item">
          待上传：<strong>{{ fileList.length }}</strong> 个文件
        </span>
        <span v-if="showDirectoryProgress && directoryProgress.size > 0" class="stat-item">
          目录：<strong>{{ directoryProgress.size }}</strong> 个
        </span>
        <span v-if="fileStore.uploadProgress.length > 0" class="stat-item">
          上传中：<strong>{{ fileStore.uploadProgress.filter(item => item.status === 'uploading').length }}</strong> 个文件
        </span>
        <span v-if="showDirectoryProgress && directoryProgress.size > 0" class="stat-item">
          已完成目录：<strong>{{ Array.from(directoryProgress.values()).filter(dir => dir.status === 'completed').length }}</strong>/{{ directoryProgress.size }}
        </span>
      </div>

      <!-- 性能优化提示 -->
      <div v-if="performanceMonitor.showPerformanceTip.value" class="performance-tip">
        <el-icon class="tip-icon"><Upload /></el-icon>
        <span>检测到大量文件上传，已启用性能优化模式以提升体验</span>
      </div>
    </div>

    <!-- 拖拽上传区域 -->
    <div
      class="bt-drag-area"
      :class="{ 'is-dragging': isDragging }"
      @drop="handleDrop"
      @dragover="handleDragOver"
      @dragenter="handleDragEnter"
      @dragleave="handleDragLeave"
    >
      <div v-if="!fileList.length && fileStore.uploadProgress.length === 0" class="drag-hint">
        <div class="drag-icon">
          <el-icon size="48"><Upload /></el-icon>
        </div>
        <div class="drag-text">
          <div class="main-text">将文件拖拽到此处，或点击上方按钮选择文件</div>
          <div class="sub-text">支持多文件上传，单个文件最大 10GB</div>
        </div>
      </div>

      <!-- 文件列表区域 -->
      <div v-else class="file-list-area">

        <!-- 待上传文件列表 -->
        <div v-if="fileList.length > 0 && !isUploading" class="pending-section">
          <FolderStructureList
            :file-list="fileList"
            @remove-file="handleRemove"
            @clear-all="handleClear"
          />
        </div>

        <!-- 上传进度显示 -->
        <div v-if="fileStore.uploadProgress.length > 0" class="progress-section">
          <UploadProgress
            :upload-progress="fileStore.uploadProgress"
            @clear-completed="fileStore.clearCompletedUploads"
            @clear-all="fileStore.clearAllUploads"
          />
        </div>
      </div>
    </div>

    <!-- 底部操作区 -->
    <template #footer>
      <div class="footer-actions">
        <div class="footer-info">
          <span v-if="isUploading" class="uploading-tip">
            <el-icon class="loading-icon"><Upload /></el-icon>
            正在上传中，请勿关闭窗口
          </span>
        </div>
        <div class="footer-buttons">
          <el-button
            v-if="isUploading"
            type="danger"
            @click="handleCancel"
            size="large"
          >
            取消上传
          </el-button>
          <el-button
            type="primary"
            @click="handleConfirm"
            :disabled="!fileList.length || isUploading"
            size="large"
            :icon="Upload"
          >
            {{ isUploading ? '上传中...' : '开始上传' }}
          </el-button>
        </div>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
/* 宝塔面板风格的对话框样式 */
.bt-upload-dialog :deep(.el-dialog) {
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.12);
  background: #ffffff;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.bt-upload-dialog :deep(.el-dialog__header) {
  background: #f8fafc;
  border-bottom: 1px solid #e5e7eb;
  padding: 20px 24px;
}

.bt-upload-dialog :deep(.el-dialog__title) {
  font-weight: 600;
  color: #1f2937;
  font-size: 18px;
}

.bt-upload-dialog :deep(.el-dialog__body) {
  padding: 24px;
  background: #ffffff;
  max-height: 600px;
  overflow-y: auto;
}

.bt-upload-dialog :deep(.el-dialog__footer) {
  background: #f8fafc;
  border-top: 1px solid #e5e7eb;
  padding: 16px 24px;
}

/* 路径显示样式 */
.upload-path {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  margin-bottom: 20px;
}

.path-icon {
  color: #3b82f6;
  font-size: 16px;
}

.path-text {
  color: #475569;
  font-size: 14px;
  font-weight: 500;
}

/* 操作按钮区样式 */
.upload-actions {
  margin-bottom: 20px;
}

.action-buttons {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}

.file-input-label {
  cursor: pointer;
  display: block;
  width: 100%;
  height: 100%;
}

.upload-stats {
  display: flex;
  gap: 16px;
  padding: 12px 16px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  color: #64748b;
}

.stat-item strong {
  color: #1e293b;
  font-weight: 600;
}

/* 性能优化提示样式 */
.performance-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
  border: 1px solid #93c5fd;
  border-radius: 6px;
  color: #1e40af;
  font-size: 13px;
  margin-top: 8px;
}

.tip-icon {
  color: #3b82f6;
  font-size: 14px;
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* 头部样式 */
.upload-dialog :deep(.el-dialog__header .flex) {
  align-items: center;
  gap: var(--spacing-md);
}

.text-blue-500 {
  color: var(--primary-color);
  font-weight: 600;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.text-gray-400 {
  color: var(--text-tertiary);
  font-size: 14px;
}

.text-gray-600 {
  color: var(--text-secondary);
}

/* 操作区按钮样式 */
.upload-dialog :deep(.el-button) {
  border-radius: var(--radius-md);
  font-weight: 500;
  transition: var(--transition-fast);
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.upload-dialog :deep(.el-button:hover) {
  transform: translateY(-2px);
  box-shadow: var(--shadow-md);
}

.upload-dialog :deep(.el-dropdown) {
  .el-button {
    background: linear-gradient(135deg, var(--bg-primary) 0%, var(--bg-secondary) 100%);
    border: 1px solid var(--border-color);
    color: var(--text-primary);

    &:hover {
      background: linear-gradient(135deg, var(--bg-hover) 0%, var(--bg-secondary) 100%);
      border-color: var(--primary-color);
      color: var(--primary-color);
    }
  }
}

/* 拖拽区域样式 */
.bt-drag-area {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 40px 20px;
  text-align: center;
  background: #fafbfc;
  transition: all 0.3s ease;
  margin-bottom: 20px;
  cursor: pointer;
  min-height: 200px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bt-drag-area:hover {
  border-color: #3b82f6;
  background: #f0f9ff;
}

.bt-drag-area.is-dragging {
  border-color: #3b82f6;
  background: #eff6ff;
  transform: scale(1.02);
  box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
}

.drag-hint {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
}

.drag-icon {
  color: #9ca3af;
  transition: color 0.3s ease;
}

.bt-drag-area:hover .drag-icon {
  color: #3b82f6;
}

.drag-text {
  text-align: center;
}

.main-text {
  font-size: 16px;
  color: #374151;
  margin-bottom: 8px;
  font-weight: 500;
}

.sub-text {
  font-size: 14px;
  color: #6b7280;
}

/* 文件列表区域样式 */
.file-list-area {
  width: 100%;
  max-height: 400px;
  overflow-y: auto;
}

/* 待上传文件列表区域样式 */
.pending-section {
  margin-bottom: 20px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  overflow: hidden;
}

.pending-section:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #d1d5db;
}

/* 进度条区域样式 */
.progress-section {
  margin-bottom: 16px;
}

.file-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e5e7eb;
}

.section-header h4 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1f2937;
}

.file-count {
  font-size: 14px;
  color: #6b7280;
  background: #f3f4f6;
  padding: 4px 8px;
  border-radius: 4px;
}

.file-table {
  border-radius: 6px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-icon {
  color: #6b7280;
  font-size: 16px;
}

.file-name {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #374151;
}

.file-size {
  color: #6b7280;
  font-size: 13px;
}

/* 上传进度列表样式 */
.progress-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.progress-item {
  padding: 16px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #ffffff;
  transition: all 0.3s ease;
}

.progress-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.progress-item.status-uploading {
  border-color: #3b82f6;
  background: #f8faff;
}

.progress-item.status-completed {
  border-color: #10b981;
  background: #f0fdf4;
}

.progress-item.status-error {
  border-color: #ef4444;
  background: #fef2f2;
}

.progress-item.status-paused {
  border-color: #f59e0b;
  background: #fffbeb;
}

.progress-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.progress-actions {
  display: flex;
  gap: 8px;
}

.progress-bar {
  margin-bottom: 8px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  font-size: 12px;
  gap: 8px;
}

.status-text {
  color: #374151;
  font-weight: 500;
  white-space: nowrap;
}

.upload-details {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
  font-size: 11px;
}

.speed-text {
  color: #3b82f6;
  font-weight: 600;
}

.eta-text {
  color: #f59e0b;
  font-weight: 500;
}

.bytes-text {
  color: #6b7280;
  font-size: 10px;
}

.chunks-text {
  color: #8b5cf6;
  font-size: 10px;
}

/* 拖拽区域提示样式 */
.drag-area-hint {
  text-align: center;
  color: var(--text-secondary);
  z-index: 1;
  position: relative;
}

.drag-area-hint .highlight {
  color: var(--primary-color);
  font-weight: 600;
  background: linear-gradient(135deg, var(--primary-color), var(--primary-hover));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.drag-area-hint .text-xl {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.5rem;
}

.drag-area-hint .text-sm {
  font-size: 0.875rem;
  opacity: 0.8;
}

.drag-area-hint .mt-2 {
  margin-top: 0.5rem;
}

/* 文件列表样式 */
.upload-dialog :deep(.el-table) {
  border-radius: var(--radius-md);
  overflow: hidden;
  box-shadow: var(--shadow-sm);
  border: 1px solid var(--border-color);
}

.upload-dialog :deep(.el-table th) {
  background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);
  color: var(--text-primary);
  font-weight: 600;
  border-bottom: 2px solid var(--border-color);
}

.upload-dialog :deep(.el-table td) {
  border-bottom: 1px solid var(--border-light);
}

.upload-dialog :deep(.el-table tr:hover) {
  background: var(--bg-hover);
}

/* 底部操作区样式 */
.footer-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
}

.footer-info {
  flex: 1;
}

.uploading-tip {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #3b82f6;
  font-size: 14px;
  font-weight: 500;
}

.loading-icon {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.footer-buttons {
  display: flex;
  gap: 12px;
}

/* Element Plus 表格样式覆盖 */
.file-table :deep(.el-table) {
  border-radius: 6px;
  overflow: hidden;
}

.file-table :deep(.el-table__header) {
  background: #f8fafc;
}

.file-table :deep(.el-table th) {
  background: #f8fafc;
  color: #374151;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}

.file-table :deep(.el-table td) {
  border-bottom: 1px solid #f3f4f6;
}

.file-table :deep(.el-table__row:hover) {
  background: #f8fafc;
}

/* Element Plus 进度条样式覆盖 */
.progress-bar :deep(.el-progress-bar__outer) {
  background: #f3f4f6;
  border-radius: 4px;
  height: 6px;
}

.progress-bar :deep(.el-progress-bar__inner) {
  border-radius: 4px;
  transition: width 0.3s ease;
}

.status-uploading .progress-bar :deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
}

.status-completed .progress-bar :deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #10b981, #34d399);
}

.status-error .progress-bar :deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #ef4444, #f87171);
}

.status-paused .progress-bar :deep(.el-progress-bar__inner) {
  background: linear-gradient(90deg, #f59e0b, #fbbf24);
}

/* 工具类样式 */
.hidden {
  display: none;
}

.cursor-pointer {
  cursor: pointer;
}

.flex {
  display: flex;
}

.items-center {
  align-items: center;
}

.justify-between {
  justify-content: space-between;
}

.w-full {
  width: 100%;
}

.space-x-2 > * + * {
  margin-left: var(--spacing-sm);
}

.space-y-3 > * + * {
  margin-top: var(--spacing-md);
}

.mb-2 {
  margin-bottom: var(--spacing-sm);
}

.mb-3 {
  margin-bottom: var(--spacing-md);
}

.mb-4 {
  margin-bottom: var(--spacing-lg);
}

.text-sm {
  font-size: 0.875rem;
}

.font-medium {
  font-weight: 500;
}

.text-gray-700 {
  color: var(--text-primary);
}

.text-gray-800 {
  color: var(--text-primary);
  font-weight: 500;
}

.text-gray-600 {
  color: var(--text-secondary);
}

.text-gray-500 {
  color: var(--text-tertiary);
}

/* 文件名截断 */
.truncate {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 200px;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .bt-upload-dialog :deep(.el-dialog) {
    width: 95% !important;
    margin: 10px !important;
  }

  .bt-upload-dialog :deep(.el-dialog__body) {
    padding: 16px;
  }

  .action-buttons {
    flex-direction: column;
    gap: 8px;
  }

  .upload-stats {
    flex-direction: column;
    gap: 8px;
  }

  .footer-actions {
    flex-direction: column;
    gap: 12px;
  }

  .footer-buttons {
    width: 100%;
    justify-content: stretch;
  }

  .footer-buttons .el-button {
    flex: 1;
  }

  .progress-item {
    padding: 12px;
  }

  .progress-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }

  .progress-actions {
    width: 100%;
    justify-content: flex-end;
  }
}

@media (max-width: 480px) {
  .bt-upload-dialog :deep(.el-dialog) {
    width: 100% !important;
    margin: 0 !important;
    border-radius: 0;
    height: 100vh;
  }

  .bt-drag-area {
    padding: 20px 10px;
    min-height: 120px;
  }

  .drag-icon {
    font-size: 32px;
  }

  .main-text {
    font-size: 14px;
  }

  .sub-text {
    font-size: 12px;
  }
}

/* 滚动条样式 */
.file-list-area::-webkit-scrollbar {
  width: 6px;
}

.file-list-area::-webkit-scrollbar-track {
  background: #f1f5f9;
  border-radius: 3px;
}

/* 目录进度条样式 */
.directory-summary {
  display: flex;
  gap: 12px;
  margin-left: auto;
}

/* 进度显示区域样式 */
.progress-section {
  margin-top: 16px;
  border-top: 1px solid #e5e7eb;
  padding-top: 16px;
}

.pending-section {
  margin-bottom: 16px;
}

.summary-item {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
}

.summary-item.success {
  color: #67c23a;
  background: #f0f9ff;
}

.summary-item.uploading {
  color: #409eff;
  background: #ecf5ff;
}

.summary-item.waiting {
  color: #909399;
  background: #f5f7fa;
}

.directory-progress-list {
  max-height: 350px;
  overflow-y: auto;
  padding-right: 4px;
}

.directory-progress-item {
  padding: 16px;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  margin-bottom: 12px;
  background: #fafafa;
  transition: all 0.3s ease;
  position: relative;
}

.directory-progress-item:hover {
  background: #f5f7fa;
  border-color: #c0c4cc;
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.directory-progress-item.status-uploading {
  border-color: #409eff;
  background: linear-gradient(135deg, #ecf5ff 0%, #f0f9ff 100%);
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.2);
}

.directory-progress-item.status-completed {
  border-color: #67c23a;
  background: linear-gradient(135deg, #f0f9ff 0%, #e8f5e8 100%);
  box-shadow: 0 2px 8px rgba(103, 194, 58, 0.2);
}

.directory-progress-item.status-error {
  border-color: #f56c6c;
  background: linear-gradient(135deg, #fef0f0 0%, #fde2e2 100%);
  box-shadow: 0 2px 8px rgba(245, 108, 108, 0.2);
}

.directory-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.directory-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.directory-icon {
  font-size: 20px;
  margin-top: 2px;
  transition: all 0.3s ease;
}

.directory-icon.icon-uploading {
  color: #409eff;
  animation: pulse 2s infinite;
}

.directory-icon.icon-completed {
  color: #67c23a;
}

.directory-icon.icon-waiting {
  color: #909399;
}

.directory-icon.icon-error {
  color: #f56c6c;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.6; }
}

.directory-details {
  flex: 1;
  min-width: 0;
}

.directory-name {
  font-weight: 600;
  color: #303133;
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  display: block;
  margin-bottom: 4px;
}

.directory-stats {
  color: #909399;
  font-size: 12px;
  white-space: nowrap;
  display: block;
}

.directory-progress-info {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  text-align: right;
}

.directory-status {
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  padding: 2px 8px;
  border-radius: 8px;
}

.directory-status.status-uploading {
  color: #409eff;
  background: rgba(64, 158, 255, 0.1);
}

.directory-status.status-completed {
  color: #67c23a;
  background: rgba(103, 194, 58, 0.1);
}

.directory-status.status-waiting {
  color: #909399;
  background: rgba(144, 147, 153, 0.1);
}

.directory-status.status-error {
  color: #f56c6c;
  background: rgba(245, 108, 108, 0.1);
}

.directory-percentage {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.directory-progress-bar {
  margin-top: 8px;
}

.smooth-progress {
  transition: all 0.3s ease;
}

.directory-speed {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  padding: 6px 12px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 8px;
  border-left: 3px solid #409eff;
}

.speed-icon {
  color: #409eff;
  font-size: 14px;
  animation: bounce 1.5s infinite;
}

@keyframes bounce {
  0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
  40% { transform: translateY(-3px); }
  60% { transform: translateY(-2px); }
}

.speed-text {
  color: #409eff;
  font-size: 12px;
  font-weight: 500;
}

.toggle-detail-btn {
  margin-left: auto;
  font-size: 12px;
}

.file-list-area::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 3px;
  transition: background 0.3s ease;
}

.file-list-area::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

/* 动画效果 */
.progress-item {
  animation: slideIn 0.3s ease-out;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* 状态颜色定义 */
.status-uploading {
  --status-color: #3b82f6;
  --status-bg: #eff6ff;
  --status-border: #bfdbfe;
}

.status-completed {
  --status-color: #10b981;
  --status-bg: #f0fdf4;
  --status-border: #bbf7d0;
}

.status-error {
  --status-color: #ef4444;
  --status-bg: #fef2f2;
  --status-border: #fecaca;
}

.status-paused {
  --status-color: #f59e0b;
  --status-bg: #fffbeb;
  --status-border: #fed7aa;
}
</style>

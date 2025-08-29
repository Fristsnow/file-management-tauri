/**
 * 统一拖拽处理器
 * 支持 Tauri 和浏览器环境的文件拖拽功能
 */

import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';

/**
 * 环境检测器
 */
class EnvironmentDetector {
  constructor() {
    this.isTauri = ref(false);
    this.tauriAPIs = reactive({
      event: null,
      app: null,
      invoke: null,
      dialog: null
    });
    this.initialized = false;
  }

  /**
   * 检测并初始化环境
   */
  async detect() {
    try {
      // 多重检测确保在 Tauri 环境
      const hasWindow = typeof window !== "undefined";
      const hasTauriInternals = hasWindow && "__TAURI_INTERNALS__" in window;
      const hasTauriMetadata = hasWindow && window.__TAURI_METADATA__;
      const isRunningInTauri = hasTauriInternals || hasTauriMetadata;

      console.log("🔍 环境检测:", {
        hasWindow,
        hasTauriInternals,
        hasTauriMetadata,
        isRunningInTauri,
        userAgent: hasWindow ? navigator.userAgent : 'N/A'
      });

      if (!isRunningInTauri) {
        console.log("🌐 当前运行在浏览器环境");
        this.isTauri.value = false;
        this.initialized = true;
        return { success: true, environment: 'browser' };
      }

      console.log("🚀 检测到 Tauri 环境，正在初始化...");
      await this.initTauriAPIs();
      
      this.isTauri.value = true;
      this.initialized = true;
      
      console.log("✅ Tauri 环境初始化完成");
      return { success: true, environment: 'tauri' };
      
    } catch (error) {
      console.error("❌ 环境检测失败:", error);
      this.isTauri.value = false;
      this.initialized = true;
      return { success: false, environment: 'browser', error };
    }
  }

  /**
   * 初始化 Tauri APIs
   */
  async initTauriAPIs() {
    try {
      // 动态导入 Tauri API 并验证可用性
      const eventModule = await import("@tauri-apps/api/event");
      const windowModule = await import("@tauri-apps/api/window");
      const coreModule = await import("@tauri-apps/api/core");
      const dialogModule = await import("@tauri-apps/plugin-dialog");

      // 验证关键API是否可用
      if (!eventModule.listen) {
        throw new Error("Tauri event.listen API不可用");
      }
      if (!windowModule.getCurrentWindow) {
        throw new Error("Tauri getCurrentWindow API不可用");
      }

      this.tauriAPIs.event = { listen: eventModule.listen };
      this.tauriAPIs.app = windowModule.getCurrentWindow();
      this.tauriAPIs.invoke = coreModule.invoke;
      this.tauriAPIs.dialog = { open: dialogModule.open };

      console.log("✅ Tauri API 初始化完成", {
        hasEvent: !!this.tauriAPIs.event,
        hasApp: !!this.tauriAPIs.app,
        hasInvoke: !!this.tauriAPIs.invoke,
        hasDialog: !!this.tauriAPIs.dialog
      });
    } catch (error) {
      console.error("❌ Tauri API 初始化失败:", error);
      throw error;
    }
  }

  /**
   * 获取当前环境信息
   */
  getEnvironmentInfo() {
    return {
      isTauri: this.isTauri.value,
      initialized: this.initialized,
      apis: this.tauriAPIs
    };
  }
}

/**
 * 文件处理器
 */
class FileProcessor {
  constructor() {
    this.supportedTypes = new Set([
      'txt', 'pdf', 'jpg', 'jpeg', 'png', 'gif', 'mp4', 'mp3',
      'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'zip', 'rar'
    ]);
  }

  /**
   * 获取文件MIME类型
   */
  getMimeType(fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes = {
      'txt': 'text/plain',
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'mp4': 'video/mp4',
      'mp3': 'audio/mpeg',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'xls': 'application/vnd.ms-excel',
      'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'zip': 'application/zip',
      'rar': 'application/x-rar-compressed'
    };
    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * 创建空文件夹占位符
   */
  createEmptyFolderPlaceholder(folderPath) {
    return {
      name: '.folder_placeholder',
      size: 0,
      type: 'application/x-empty-folder',
      webkitRelativePath: folderPath + '/.folder_placeholder',
      isEmptyFolderPlaceholder: true,
      folderPath: folderPath
    };
  }

  /**
   * 为文件设置相对路径
   */
  setFileRelativePath(file, relativePath) {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: relativePath,
      writable: false
    });
  }

  /**
   * 处理浏览器环境的文件夹结构
   */
  async processBrowserEntry(entry, files, path = '') {
    return new Promise((resolve) => {
      if (entry.isFile) {
        // 处理文件
        entry.file((file) => {
          const relativePath = path ? `${path}/${file.name}` : file.name;
          this.setFileRelativePath(file, relativePath);
          files.push(file);
          resolve();
        });
      } else if (entry.isDirectory) {
        // 处理文件夹
        const dirReader = entry.createReader();
        const currentPath = path ? `${path}/${entry.name}` : entry.name;

        dirReader.readEntries(async (entries) => {
          if (entries.length === 0) {
            // 创建空文件夹占位符
            const placeholder = this.createEmptyFolderPlaceholder(currentPath);
            files.push(placeholder);
          } else {
            // 处理文件夹中的内容
            const promises = entries.map(childEntry =>
              this.processBrowserEntry(childEntry, files, currentPath)
            );
            await Promise.all(promises);
          }
          resolve();
        });
      }
    });
  }

  /**
   * 处理Tauri环境的文件夹结构
   */
  async processTauriDirectory(dirPath, files, baseName = '') {
    try {
      const { readDir, readFile, stat } = await import('@tauri-apps/plugin-fs');
      const { join } = await import('@tauri-apps/api/path');
      
      console.log(`📁 开始处理Tauri文件夹: ${dirPath}`);
      
      const entries = await readDir(dirPath);
      console.log(`📋 文件夹 ${dirPath} 包含 ${entries.length} 个项目`);
      
      if (entries.length === 0) {
        // 空文件夹，创建占位符
        console.log(`📁 检测到空文件夹: ${baseName}`);
        const placeholder = this.createEmptyFolderPlaceholder(baseName);
        files.push(placeholder);
        console.log(`✅ 空文件夹占位符已添加: ${baseName}`);
        return;
      }
      
      let processedFiles = 0;
      let processedDirs = 0;
      let errorCount = 0;
      
      for (const entry of entries) {
        try {
          const entryPath = await join(dirPath, entry.name);
          const entryMetadata = await stat(entryPath);
          
          console.log(`🔍 处理项目: ${entry.name} (类型: ${entryMetadata.isFile ? '文件' : '文件夹'})`);
          
          if (entryMetadata.isFile) {
            try {
              const fileContent = await readFile(entryPath);
              const file = new File([fileContent], entry.name, {
                type: this.getMimeType(entry.name),
                lastModified: entryMetadata.modifiedAt?.getTime() || Date.now()
              });
              
              // 设置相对路径
              const relativePath = baseName ? `${baseName}/${entry.name}` : entry.name;
              this.setFileRelativePath(file, relativePath);
              
              files.push(file);
              processedFiles++;
              console.log(`✅ 文件添加成功: ${relativePath}`);
              
            } catch (fileError) {
              console.error(`❌ 文件读取失败 ${entryPath}:`, fileError);
              errorCount++;
              ElMessage.warning(`文件读取失败: ${entry.name}`);
            }
          } else if (entryMetadata.isDirectory) {
            try {
              // 递归处理子文件夹
              const subDirName = baseName ? `${baseName}/${entry.name}` : entry.name;
              console.log(`📁 递归处理子文件夹: ${entry.name}`);
              
              const beforeCount = files.length;
              await this.processTauriDirectory(entryPath, files, subDirName);
              const addedCount = files.length - beforeCount;
              
              processedDirs++;
              console.log(`✅ 子文件夹处理完成: ${entry.name} (添加了 ${addedCount} 个文件)`);
              
            } catch (dirError) {
              console.error(`❌ 子文件夹处理失败 ${entryPath}:`, dirError);
              errorCount++;
              ElMessage.warning(`文件夹处理失败: ${entry.name}`);
            }
          }
        } catch (entryError) {
          console.error(`❌ 处理项目失败 ${entry.name}:`, entryError);
          errorCount++;
        }
      }
      
      console.log(`📊 文件夹 ${baseName || dirPath} 处理完成:`, {
        处理的文件: processedFiles,
        处理的文件夹: processedDirs,
        错误数量: errorCount,
        总项目数: entries.length
      });
      
    } catch (error) {
      console.error(`❌ 文件夹处理失败 ${dirPath}:`, error);
      throw error;
    }
  }
}

/**
 * 事件管理器
 */
class EventManager {
  constructor(environmentDetector, fileProcessor) {
    this.environmentDetector = environmentDetector;
    this.fileProcessor = fileProcessor;
    this.listeners = new Map();
    this.tauriUnlisteners = new Map();
    this.isDragging = ref(false);
  }

  /**
   * 初始化事件监听器
   */
  async initializeListeners(callbacks) {
    const envInfo = this.environmentDetector.getEnvironmentInfo();
    
    if (envInfo.isTauri) {
      await this.setupTauriListeners(callbacks);
    } else {
      this.setupBrowserListeners(callbacks);
    }
  }

  /**
   * 设置Tauri事件监听器
   */
  async setupTauriListeners(callbacks) {
    try {
      const { event } = this.environmentDetector.tauriAPIs;
      
      if (!event || typeof event.listen !== 'function') {
        throw new Error('Tauri event API不可用');
      }
      
      console.log('🎯 开始注册Tauri文件拖拽事件监听器...');
      
      // 监听文件拖拽事件
      const unlisten = await event.listen('tauri://file-drop', (event) => {
        this.handleTauriFileDrop(event, callbacks.onFileDrop);
      });
      
      this.tauriUnlisteners.set('file-drop', unlisten);
      
      console.log('✅ Tauri文件拖拽事件监听器注册成功');
      
      // 设置全局拖拽阻止事件
      this.setupGlobalDragPrevention();
      
    } catch (error) {
      console.error('❌ Tauri事件监听器设置失败:', error);
      throw error;
    }
  }

  /**
   * 设置浏览器事件监听器
   */
  setupBrowserListeners(callbacks) {
    console.log('🌐 设置浏览器拖拽事件监听器');
    
    // 这里不直接绑定DOM事件，而是提供事件处理函数
    // 实际的DOM绑定由组件负责
    this.listeners.set('dragover', (e) => this.handleBrowserDragOver(e));
    this.listeners.set('dragenter', (e) => this.handleBrowserDragEnter(e));
    this.listeners.set('dragleave', (e) => this.handleBrowserDragLeave(e));
    this.listeners.set('drop', (e) => this.handleBrowserDrop(e, callbacks.onFileDrop));
    
    // 设置全局拖拽阻止事件
    this.setupGlobalDragPrevention();
  }

  /**
   * 设置全局拖拽阻止事件
   */
  setupGlobalDragPrevention() {
    const preventDefault = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };
    
    window.addEventListener("dragover", preventDefault);
    window.addEventListener("drop", preventDefault);
    
    // 保存引用以便清理
    this.listeners.set('global-dragover', preventDefault);
    this.listeners.set('global-drop', preventDefault);
  }

  /**
   * 处理Tauri文件拖拽
   */
  async handleTauriFileDrop(event, callback) {
    console.log('🎯 Tauri文件拖拽事件触发', {
      eventType: event.event,
      pathCount: event.payload?.paths?.length || 0,
      paths: event.payload?.paths
    });
    
    try {
      // 验证事件数据
      if (!event.payload || !event.payload.paths || !Array.isArray(event.payload.paths)) {
        throw new Error('无效的拖拽事件数据');
      }
      
      if (event.payload.paths.length === 0) {
        console.warn('⚠️ 拖拽路径列表为空');
        return;
      }
      
      const files = [];
      let hasDirectories = false;
      let hasFiles = false;
      
      console.log(`📁 开始处理 ${event.payload.paths.length} 个拖拽项目`);
      
      for (const filePath of event.payload.paths) {
        try {
          console.log(`🔍 处理路径: ${filePath}`);
          
          const { stat } = await import('@tauri-apps/plugin-fs');
          const { basename } = await import('@tauri-apps/api/path');
          
          const metadata = await stat(filePath);
          const fileName = await basename(filePath);
          
          if (metadata.isFile) {
            hasFiles = true;
            console.log(`📄 检测到文件: ${fileName}`);
            
            try {
              const { readFile } = await import('@tauri-apps/plugin-fs');
              const fileContent = await readFile(filePath);
              const file = new File([fileContent], fileName, {
                type: this.fileProcessor.getMimeType(fileName),
                lastModified: metadata.modifiedAt?.getTime() || Date.now()
              });
              
              this.fileProcessor.setFileRelativePath(file, fileName);
              files.push(file);
              console.log(`✅ 文件添加成功: ${fileName}`);
              
            } catch (fileError) {
              console.error(`❌ 文件读取失败 ${filePath}:`, fileError);
              ElMessage.warning(`文件读取失败: ${fileName}`);
            }
          } else if (metadata.isDirectory) {
            hasDirectories = true;
            console.log(`📂 检测到文件夹: ${fileName}`);
            
            try {
              await this.fileProcessor.processTauriDirectory(filePath, files, fileName);
              console.log(`✅ 文件夹处理完成: ${fileName}`);
            } catch (dirError) {
              console.error(`❌ 文件夹处理失败 ${filePath}:`, dirError);
              ElMessage.warning(`文件夹处理失败: ${fileName}`);
            }
          }
        } catch (error) {
          console.error(`❌ 处理路径失败 ${filePath}:`, error);
          ElMessage.warning(`处理失败: ${filePath}`);
        }
      }
      
      console.log(`📊 拖拽处理完成统计:`, {
        总项目数: event.payload.paths.length,
        文件总数: files.length,
        包含文件夹: hasDirectories,
        包含文件: hasFiles
      });
      
      if (files.length > 0) {
        callback && callback(files, { hasDirectories, hasFiles });
        ElMessage.success(`成功添加 ${files.length} 个文件到上传列表`);
      } else {
        console.warn('⚠️ 没有有效文件可添加');
        ElMessage.warning('没有找到可上传的文件');
      }
      
    } catch (error) {
      console.error('❌ Tauri文件拖拽处理失败:', error);
      ElMessage.error(`文件拖拽处理失败: ${error.message}`);
    }
  }

  /**
   * 处理浏览器拖拽事件
   */
  handleBrowserDragOver(e) {
    e.preventDefault();
    e.stopPropagation();
    console.log('🎯 浏览器环境处理dragover事件');
  }

  handleBrowserDragEnter(e) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.value = true;
    console.log('🎯 浏览器环境处理dragenter事件');
  }

  handleBrowserDragLeave(e) {
    e.preventDefault();
    e.stopPropagation();
    // 只有当离开整个拖拽区域时才设置为false
    if (!e.currentTarget.contains(e.relatedTarget)) {
      this.isDragging.value = false;
    }
    console.log('🎯 浏览器环境处理dragleave事件');
  }

  async handleBrowserDrop(e, callback) {
    e.preventDefault();
    e.stopPropagation();
    this.isDragging.value = false;
    
    console.log('🎯 浏览器环境处理drop事件');
    
    const items = Array.from(e.dataTransfer.items);
    const files = [];
    let hasDirectories = false;
    let hasFiles = false;
    
    // 处理拖拽的项目（支持文件夹）
    for (const item of items) {
      if (item.kind === 'file') {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          if (entry.isDirectory) {
            hasDirectories = true;
          } else if (entry.isFile) {
            hasFiles = true;
          }
          await this.fileProcessor.processBrowserEntry(entry, files);
        }
      }
    }
    
    // 如果没有通过 webkitGetAsEntry 获取到文件，回退到传统方式
    if (files.length === 0) {
      const fallbackFiles = Array.from(e.dataTransfer.files);
      files.push(...fallbackFiles);
      if (fallbackFiles.length > 0) {
        hasFiles = true;
      }
    }
    
    if (files.length > 0) {
      callback && callback(files, { hasDirectories, hasFiles });
    }
  }

  /**
   * 获取事件处理器
   */
  getEventHandlers() {
    return {
      dragover: this.listeners.get('dragover'),
      dragenter: this.listeners.get('dragenter'),
      dragleave: this.listeners.get('dragleave'),
      drop: this.listeners.get('drop'),
      isDragging: this.isDragging
    };
  }

  /**
   * 清理事件监听器
   */
  cleanup() {
    // 清理Tauri事件监听器
    for (const [key, unlisten] of this.tauriUnlisteners) {
      if (typeof unlisten === 'function') {
        unlisten();
      }
    }
    this.tauriUnlisteners.clear();
    
    // 清理全局事件监听器
    const globalDragover = this.listeners.get('global-dragover');
    const globalDrop = this.listeners.get('global-drop');
    
    if (globalDragover) {
      window.removeEventListener("dragover", globalDragover);
    }
    if (globalDrop) {
      window.removeEventListener("drop", globalDrop);
    }
    
    this.listeners.clear();
  }
}

/**
 * 统一拖拽处理器主类
 */
export class UnifiedDragHandler {
  constructor() {
    this.environmentDetector = new EnvironmentDetector();
    this.fileProcessor = new FileProcessor();
    this.eventManager = new EventManager(this.environmentDetector, this.fileProcessor);
    this.initialized = false;
  }

  /**
   * 初始化拖拽处理器
   */
  async initialize(options = {}) {
    try {
      console.log('🚀 开始初始化统一拖拽处理器...');
      
      // 设置文件处理回调
      const callbacks = {
        onFileDrop: options.onFileDrop || (() => {})
      };
      
      // 检测环境
      const envResult = await this.environmentDetector.detect();
      console.log('🔍 环境检测结果:', envResult);
      
      // 初始化事件监听器
      await this.eventManager.initializeListeners(callbacks);
      
      this.initialized = true;
      console.log('✅ 统一拖拽处理器初始化完成');
      
      return {
        success: true,
        environment: envResult.environment,
        handlers: this.eventManager.getEventHandlers()
      };
      
    } catch (error) {
      console.error('❌ 拖拽处理器初始化失败:', error);
      return {
        success: false,
        error: error.message,
        handlers: null
      };
    }
  }

  /**
   * 获取环境信息
   */
  getEnvironmentInfo() {
    return this.environmentDetector.getEnvironmentInfo();
  }

  /**
   * 获取事件处理器
   */
  getEventHandlers() {
    return this.eventManager.getEventHandlers();
  }

  /**
   * 测试拖拽功能
   */
  testDragFunction() {
    const envInfo = this.getEnvironmentInfo();
    
    console.log('🧪 开始测试拖拽功能');
    console.log('📊 环境信息:', envInfo);
    
    if (envInfo.isTauri && this.eventManager.tauriUnlisteners.has('file-drop')) {
      ElMessage.success('✅ Tauri拖拽功能正常！请尝试拖拽文件到窗口进行测试。');
      console.log('✅ 所有Tauri API都已正确初始化，拖拽功能应该可以正常工作');
    } else if (!envInfo.isTauri) {
      ElMessage.success('✅ 浏览器拖拽功能正常！请尝试拖拽文件到拖拽区域进行测试。');
      console.log('✅ 浏览器拖拽功能已初始化，可以正常工作');
    } else {
      const issues = [];
      if (!envInfo.isTauri) issues.push('isTauri为false');
      if (!envInfo.apis.event) issues.push('tauriEvent未初始化');
      if (!this.eventManager.tauriUnlisteners.has('file-drop')) issues.push('文件拖拽监听器未注册');
      
      ElMessage.warning(`⚠️ 拖拽功能存在问题: ${issues.join(', ')}`);
      console.warn('⚠️ 拖拽功能检测到问题:', issues);
    }
  }

  /**
   * 销毁拖拽处理器
   */
  destroy() {
    this.eventManager.cleanup();
    this.initialized = false;
    console.log('🗑️ 拖拽处理器已销毁');
  }
}

// 导出单例实例
export const dragHandler = new UnifiedDragHandler();

// 导出默认实例
export default dragHandler;
import request, { upload } from '@/utils/request.js';
import {ElMessage} from "element-plus";

export const getFtpFileApi = (prefix) => {
    return request({
        method: 'GET',
        url: '/minios/listFilesAndFolders',
        params: {
            bucketName: "public",
            prefix: prefix
        }
    });
}

/**
 * 单文件下载
 * filePath 为 列表数据的 minioObjectName
 */
export const fileDownload = async (filePath, originalFileName, fileId = null, id = null) => {
    const requestData = {
        bucketName: 'public',
        objectName: filePath
    };

    // 添加可选的fileId和id字段
    if (fileId) {
        requestData.fileId = fileId;
    }
    if (id) {
        requestData.id = id;
    }

    const response = await request({
        method: 'POST',
        url: '/file/download',
        data: requestData,
        responseType: 'blob'
    });

    // 确保返回的数据有正确的 MIME 类型
    if (originalFileName) {
        const contentType = response.headers?.['content-type'] || getMimeTypeFromFileName(originalFileName);
        const blob = new Blob([response.data], { type: contentType });
        response.data = blob;
    }

    return response;
}

/**
 * 批量文件下载
 * files: 文件对象数组，每个对象包含 minioObjectName 和 originalFileName
 */
export const batchFileDownload = async (files, onProgress) => {
    const results = [];
    const total = files.length;

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        try {
            const requestData = {
                bucketName: 'public',
                objectName: file.minioObjectName
            };

            // 添加可选的fileId和id字段
            if (file.fileId) {
                requestData.fileId = file.fileId;
            }
            if (file.id) {
                requestData.id = file.id;
            }

            const response = await request({
                method: 'POST',
                url: '/file/download',
                data: requestData,
                responseType: 'blob'
            });

            // 确保下载的数据有正确的 MIME 类型
            const contentType = response.headers?.['content-type'] || getMimeTypeFromFileName(file.originalFileName);
            const blob = new Blob([response.data], { type: contentType });

            results.push({
                file,
                success: true,
                data: blob
            });

            // 调用进度回调
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total,
                    file,
                    progress: Math.round(((i + 1) / total) * 100)
                });
            }
        } catch (error) {
            results.push({
                file,
                success: false,
                error
            });

            // 调用进度回调（包含错误信息）
            if (onProgress) {
                onProgress({
                    current: i + 1,
                    total,
                    file,
                    progress: Math.round(((i + 1) / total) * 100),
                    error
                });
            }
        }
    }

    return results;
}

/**
 * 根据文件名获取 MIME 类型
 */
const getMimeTypeFromFileName = (fileName) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const mimeTypes = {
        // 图片类型
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'bmp': 'image/bmp',
        'svg': 'image/svg+xml',
        'webp': 'image/webp',
        'ico': 'image/x-icon',

        // 文档类型
        'pdf': 'application/pdf',
        'doc': 'application/msword',
        'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'xls': 'application/vnd.ms-excel',
        'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'ppt': 'application/vnd.ms-powerpoint',
        'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'txt': 'text/plain',
        'rtf': 'application/rtf',

        // 音频类型
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'ogg': 'audio/ogg',
        'aac': 'audio/aac',
        'flac': 'audio/flac',

        // 视频类型
        'mp4': 'video/mp4',
        'avi': 'video/x-msvideo',
        'mov': 'video/quicktime',
        'wmv': 'video/x-ms-wmv',
        'flv': 'video/x-flv',
        'webm': 'video/webm',
        'mkv': 'video/x-matroska',

        // 压缩文件
        'zip': 'application/zip',
        'rar': 'application/vnd.rar',
        '7z': 'application/x-7z-compressed',
        'tar': 'application/x-tar',
        'gz': 'application/gzip',

        // 代码文件
        'js': 'application/javascript',
        'css': 'text/css',
        'html': 'text/html',
        'htm': 'text/html',
        'xml': 'application/xml',
        'json': 'application/json',
        'csv': 'text/csv',

        // 其他常见类型
        'exe': 'application/vnd.microsoft.portable-executable',
        'msi': 'application/x-msi',
        'dmg': 'application/x-apple-diskimage'
    };

    return mimeTypes[ext] || 'application/octet-stream';
};

/**
 * 下载单个文件并自动触发浏览器下载
 * 在Tauri环境下支持自定义下载路径
 */
export const downloadFileToLocal = async (file, onProgress, customDownloadPath = null) => {
    try {
        console.log('开始下载请求:', {
            fileName: file.originalFileName,
            objectName: file.minioObjectName,
            fileSize: file.fileSize
        });

        // 验证必要参数
        if (!file.minioObjectName) {
            throw new Error('文件对象名称不能为空');
        }

        // 根据文件大小动态设置超时时间
        const fileSize = file.fileSize || 0;
        let timeout = 120000; // 默认2分钟

        if (fileSize > 100 * 1024 * 1024) { // 大于100MB
            timeout = 6000000; // 10分钟
        } else if (fileSize > 50 * 1024 * 1024) { // 大于50MB
            timeout = 300000; // 5分钟
        } else if (fileSize > 10 * 1024 * 1024) { // 大于10MB
            timeout = 180000; // 3分钟
        }

        console.log(`文件大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB, 设置超时时间: ${timeout / 1000}秒`);

        const response = await request({
            method: 'POST',
            url: '/file/download',
            data: {
                bucketName: 'public',
                objectName: file.minioObjectName,
                fileId: file.fileId,
                id: file.id
            },
            responseType: 'blob',
            timeout: timeout,
            onDownloadProgress: (progressEvent) => {
                console.log('下载进度事件:', {
                    fileName: file.originalFileName,
                    loaded: progressEvent.loaded,
                    total: progressEvent.total,
                    fileSize: file.fileSize,
                    lengthComputable: progressEvent.lengthComputable
                });

                if (onProgress) {
                    let progress = 0;
                    let totalSize = progressEvent.total;

                    // 如果服务器没有发送Content-Length，使用文件列表中的fileSize
                    if (!totalSize && file.fileSize) {
                        totalSize = file.fileSize;
                    }

                    if (totalSize && totalSize > 0) {
                        // 有总大小信息，计算精确进度
                        progress = Math.round((progressEvent.loaded / totalSize) * 100);
                        // 确保进度不超过100%
                        progress = Math.min(progress, 100);
                    } else if (progressEvent.loaded > 0) {
                        // 没有总大小信息，显示不确定进度
                        progress = Math.min(99, Math.round(progressEvent.loaded / 1024)); // 简单估算
                    }

                    console.log(`下载进度: ${file.originalFileName} - ${progress}% (${progressEvent.loaded}/${totalSize || '未知'})`);

                    onProgress({
                        file,
                        progress,
                        loaded: progressEvent.loaded,
                        total: totalSize || 0
                    });
                }
            }
        });

        console.log('下载响应:', {
            status: response.status,
            contentType: response.headers?.['content-type'],
            contentLength: response.headers?.['content-length'],
            dataSize: response.data?.size
        });

        // 验证响应数据
        if (!response.data) {
            throw new Error('服务器返回的文件数据为空');
        }

        if (response.data.size === 0) {
            throw new Error('下载的文件大小为0，可能文件已损坏或不存在');
        }

        // 检查是否在Tauri环境中
        const isTauriEnvironment = () => {
            if (typeof window === 'undefined') return false;

            // 检查多个Tauri相关的全局对象
            const hasTauriCore = !!window.__TAURI__;
            const hasTauriInternals = !!window.__TAURI_INTERNALS__;
            const hasTauriInvoke = typeof window.__TAURI_INVOKE__ === 'function';
            const hasTauriPattern = !!window.__TAURI_PATTERN__;

            // 在开发环境中，__TAURI_INTERNALS__ 通常会先初始化
            return hasTauriCore || hasTauriInternals || hasTauriInvoke || hasTauriPattern;
        };

        console.log('下载环境检查:', {
            isTauriEnvironment: isTauriEnvironment(),
            customDownloadPath,
            fileName: file.originalFileName
        });

        if (isTauriEnvironment() && customDownloadPath) {
            // Tauri环境下使用Rust后端异步下载，避免阻塞UI线程
            try {
                console.log('开始Tauri异步下载:', {
                    customDownloadPath,
                    fileName: file.originalFileName,
                    objectName: file.minioObjectName,
                    fileId: file.fileId,
                    id: file.id
                });

                const { invoke } = await import('@tauri-apps/api/core');

                // 获取基础URL - 确保在Tauri环境中有正确的baseURL
                let baseURL = response.config.baseURL;
                
                // 如果baseURL为空或是相对路径，使用环境变量或默认值
                if (!baseURL || baseURL.startsWith('/')) {
                    baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8089';
                }
                
                console.log('下载使用的baseURL:', baseURL);

                // 如果没有指定自定义路径，使用默认下载路径
                let downloadPath = customDownloadPath;
                if (!downloadPath) {
                    // 获取系统默认下载路径
                    try {
                        const systemPaths = await invoke('get_system_paths');
                        downloadPath = systemPaths.downloads || systemPaths.desktop || systemPaths.home;
                    } catch (error) {
                        console.warn('获取系统路径失败，使用当前目录:', error);
                        downloadPath = '.';
                    }
                }

                console.log('下载路径详情:', {
                    原始路径: downloadPath,
                    路径类型: typeof downloadPath,
                    路径长度: downloadPath?.length,
                    是否为空: !downloadPath,
                    文件名: file.originalFileName
                });

                // 调用Rust后端的异步下载命令
                const downloadParams = {
                    baseUrl: baseURL,
                    bucketName: 'public',
                    objectName: file.minioObjectName,
                    fileId: file.fileId ? String(file.fileId) : null,
                    id: file.id ? String(file.id) : null,
                    filePath: downloadPath || null, // 确保路径格式正确，空字符串转为null
                    fileName: file.originalFileName
                };

                console.log('传递给Rust后端的参数:', downloadParams);

                const downloadResult = await invoke('download_file_async', downloadParams);

                if (downloadResult.success) {
                    console.log('Tauri异步下载成功:', downloadResult.file_path);
                } else {
                    console.error('Tauri异步下载失败:', downloadResult.message);
                    // 回退到浏览器下载
                    await saveToBrowser(response.data, file.originalFileName);
                }
            } catch (tauriError) {
                console.error('Tauri异步下载调用失败，回退到浏览器下载:', {
                    error: tauriError,
                    message: tauriError.message,
                    stack: tauriError.stack
                });
                // 回退到浏览器下载
                await saveToBrowser(response.data, file.originalFileName);
            }
        } else {
            // 浏览器环境或未指定自定义路径，使用浏览器默认下载
            console.log('使用浏览器默认下载:', {
                reason: !isTauriEnvironment() ? '非Tauri环境' : '未指定自定义路径'
            });
            await saveToBrowser(response.data, file.originalFileName);
        }

        // 浏览器下载的辅助函数
        async function saveToBrowser(data, fileName) {
            const contentType = response.headers?.['content-type'] || getMimeTypeFromFileName(fileName);
            const blob = new Blob([data], { type: contentType });

            console.log('创建Blob:', {
                blobSize: blob.size,
                blobType: blob.type,
                originalSize: data.size
            });

            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            // 清理URL对象
            window.URL.revokeObjectURL(downloadUrl);
        }

        console.log('文件下载完成:', file.originalFileName);
        return { success: true, file };
    } catch (error) {
        console.error('下载文件失败:', {
            fileName: file.originalFileName,
            objectName: file.minioObjectName,
            error: error.message,
            stack: error.stack,
            response: error.response ? {
                status: error.response.status,
                statusText: error.response.statusText,
                data: error.response.data
            } : null
        });
        return { success: false, file, error };
    }
}

/**
 * 删除多个文件
 * @param {Array|string} ids - 文件ID数组或逗号分隔的ID字符串
 */
export const fileDeleteApi = (ids) => {
    // 如果是数组，转换为逗号分隔的字符串
    let idString;
    if (Array.isArray(ids)) {
        idString = ids.join(',');
    } else if (typeof ids === 'string') {
        idString = ids;
    } else {
        idString = String(ids);
    }

    return request({
        method: 'DELETE',
        url: '/minios/deletesFile',
        params: {
            bucketName: "public",
            ids: idString
        }
    })
}

/**
 * 创建文件夹
 * path: 全路径
 * id: 父文件夹ID
 * currentPath: 当前路径
 */
export const createFolderApi = (folderName, parentId = 0, currentPath = '/') => {
    // 确保路径格式正确，避免重复的斜杠
    const normalizedPath = currentPath.endsWith('/') ? currentPath : currentPath + '/';
    const fullPath = normalizedPath + folderName;

    return request({
        method: 'GET',
        url: '/minios/cretePath',
        params: {
            path: fullPath,
            id: parentId,
            bucketName: 'public'
        }
    })
}

/**
 * 需要提示，文件夹有东西是否删除
 * id: 删除文件夹id
 * folderName: 删除文件夹名称original_final_name
 */
export const folderDeleteApi = (id, folderName) => {
    return request({
        method: 'DELETE',
        url: '/minios/deleteFolder',
        params: {
            id: id,
            bucketName: "public",
            folderName: folderName
        }
    })
}

// 小文件直接上传 - 使用与HTML文件相同的接口
export const uploadSmallFileApi = (file, bucketName = 'public', objectName = file.name, id,  overwrite = false) => {
    const formData = new FormData();
    formData.append('bucketName', bucketName);
    formData.append('file', file);
    formData.append('objectName', objectName); // 使用完整的对象路径（包含文件名）
    formData.append('id', id);
    formData.append('overwrite', overwrite.toString());

    return upload('/file/upload', formData);
};

/**
 * 文件夹批量上传API
 * @param {Array} files - 文件列表
 * @param {Array} objectNames - 文件的完整路径名列表
 * @param {Array} originalFileNames - 文件的原始文件名列表
 * @param {string} bucketName - MinIO存储桶名称
 * @returns {Promise} 上传结果
 */
export const uploadFolderApi = (files, objectNames, originalFileNames, bucketName = 'public') => {
    const formData = new FormData();

    // 添加存储桶名称
    formData.append('bucketName', bucketName);

    // 添加所有文件
    files.forEach(file => {
        formData.append('files', file);
    });

    // 添加对象名称列表
    objectNames.forEach(objectName => {
        formData.append('objectNames', objectName);
    });

    // 添加原始文件名列表
    originalFileNames.forEach(originalFileName => {
        formData.append('originalFileNames', originalFileName);
    });

    return upload('/file/upload/folder', formData);
};

// 单文件上传接口 - 支持智能并发控制
export const uploadSingleFileApi = (file, options = {}) => {
    const {
        bucketName = 'public',
        objectName = file.name,
        onProgress = () => {},
        onUploadIdReady = () => {},
        currentPath = '/',
        overwrite = false
    } = options;

    // 直接使用传入的objectName，不再重复构建路径
    // 路径构建应该在调用方完成，避免重复处理
    return uploadFtpFileApi(file, {
        bucketName,
        objectName,
        onProgress,
        onUploadIdReady,
        currentPath,
        overwrite
    });
};

// 初始化分片上传
export const initMultipartUploadApi = (data) => {
    return request({
        method: 'POST',
        url: '/file/init',
        data: {
            bucketName: data.bucketName,
            objectName: data.objectName,
            fileSize: data.fileSize,
            originalFileName: data.originalFileName,
            currentPath: data.currentPath,
            overwrite: data.overwrite || false
        }
    });
};

// 上传分片
export const uploadPartApi = (formData) => {
    return upload('/file/uploadPart', formData);
};

// 完成分片上传
export const completeMultipartUploadApi = (data) => {
    return request({
        method: 'POST',
        url: '/file/complete',
        headers: {
            'Content-Type': 'application/json'
        },
        data: {
            bucketName: data.bucketName,
            objectName: data.objectName,
            uploadId: data.uploadId
        }
    });
};

// 中止分片上传
export const abortMultipartUploadApi = (data) => {
    return request({
        method: 'POST',
        url: '/file/abort',
        headers: {
            'Content-Type': 'application/json'
        },
        data: {
            bucketName: data.bucketName,
            objectName: data.objectName,
            uploadId: data.uploadId
        }
    });
};

export const uploadFtpFileApi = (file, options = {}) => {
    const {
        bucketName = 'public',
        objectName = file.name,
        onProgress = () => {},
        onUploadIdReady = () => {},
        minChunkSize = 5 * 1024 * 1024, // 5MB
        currentPath = '/',
        overwrite = false
    } = options;

    // 直接使用大文件分片上传，不再判断文件大小
    // 小文件应该通过uploadSmallFileApi直接上传，避免重复调用
    return uploadLargeFile(file, {
        bucketName,
        objectName,
        onProgress,
        onUploadIdReady,
        minChunkSize,
        currentPath,
        overwrite
    });
};

// 大文件分片上传实现
const uploadLargeFile = async (file, options) => {
    const { bucketName, objectName, onProgress, onUploadIdReady, minChunkSize, currentPath = '/', overwrite = false } = options;
    const chunkSize = await getDynamicChunkSize(file.size);
    const totalChunks = Math.ceil(file.size / chunkSize);
    const fileId = generateFileId(file, objectName);

    // 声明变量在try块外部，确保在catch块中也能访问
    let uploadId;
    let completedParts = new Set();

    try {
        // 1. 检查是否有断点续传数据
        const savedProgress = getUploadProgress(fileId);

        if (savedProgress) {
            console.log(`检测到断点续传数据，继续上传文件: ${objectName}`);
            uploadId = savedProgress.uploadId;
            completedParts = new Set(savedProgress.completedParts);
        } else {
            // 初始化分片上传
            const initResult = await initMultipartUploadApi({
                bucketName,
                objectName,
                fileSize: file.size,
                originalFileName: file.name,
                currentPath: currentPath,
                overwrite: overwrite
            });

            uploadId = initResult.uploadId || initResult.data?.uploadId;
            if (!uploadId) {
                ElMessage.info("文件已存在")
                return Promise.resolve();
            }
        }

        // 通知调用方uploadId已准备好
        if (onUploadIdReady && uploadId) {
            onUploadIdReady(uploadId);
        }

        // 2. 并发上传所有分片
        let uploadedChunks = completedParts.size;
        const concurrency = getDynamicConcurrency(file.size);

        // 创建分片上传任务（跳过已完成的分片）
        const uploadTasks = [];
        for (let i = 0; i < totalChunks; i++) {
            const partNumber = i + 1;

            // 跳过已完成的分片
            if (completedParts.has(partNumber)) {
                continue;
            }

            const start = i * chunkSize;
            const end = Math.min(file.size, start + chunkSize);
            const chunk = file.slice(start, end);

            // 跳过小于最小分片大小的分片（除了最后一个分片）
            if (chunk.size < minChunkSize && i !== totalChunks - 1) {
                continue;
            }

            uploadTasks.push({
                chunk,
                partNumber,
                index: i
            });
        }

        // 进度跟踪变量
        let uploadStartTime = Date.now();
        let lastProgressUpdate = Date.now();
        let uploadedBytes = completedParts.size * chunkSize; // 已上传的字节数
        let speedSamples = []; // 速度采样数组
        const maxSpeedSamples = 10; // 最多保留10个速度采样

        // 计算实时上传速度和ETA
        const calculateSpeedAndETA = (currentUploadedBytes) => {
            const now = Date.now();
            const timeDiff = (now - lastProgressUpdate) / 1000; // 秒

            if (timeDiff > 0) {
                const bytesDiff = currentUploadedBytes - uploadedBytes;
                const currentSpeed = bytesDiff / timeDiff; // bytes/s

                // 添加到速度采样数组
                speedSamples.push(currentSpeed);
                if (speedSamples.length > maxSpeedSamples) {
                    speedSamples.shift();
                }

                // 计算平均速度（使用最近的采样）
                const avgSpeed = speedSamples.reduce((sum, speed) => sum + speed, 0) / speedSamples.length;

                // 计算ETA
                const remainingBytes = file.size - currentUploadedBytes;
                const eta = avgSpeed > 0 ? Math.ceil(remainingBytes / avgSpeed) : 0;

                uploadedBytes = currentUploadedBytes;
                lastProgressUpdate = now;

                return { avgSpeed, eta };
            }

            return { avgSpeed: 0, eta: 0 };
        };

        // 错误分析函数
        const analyzeError = (error) => {
            const message = error.message?.toLowerCase() || '';
            const status = error.status || error.response?.status;

            // 网络相关错误
            if (message.includes('network') || message.includes('timeout') ||
                message.includes('connection') || status === 0) {
                return 'network';
            }

            // 服务器临时错误
            if (status >= 500 && status < 600) {
                return 'server_temporary';
            }

            // 限流错误
            if (status === 429 || message.includes('rate limit') || message.includes('too many')) {
                return 'rate_limit';
            }

            // 认证错误
            if (status === 401 || status === 403) {
                return 'auth';
            }

            // 客户端错误
            if (status >= 400 && status < 500) {
                return 'client';
            }

            return 'unknown';
        };

        // 判断是否应该重试
        const shouldRetryError = (errorType, attempt) => {
            switch (errorType) {
                case 'network':
                case 'server_temporary':
                case 'rate_limit':
                    return attempt <= 5; // 这些错误可以重试
                case 'auth':
                case 'client':
                    return false; // 认证和客户端错误不重试
                case 'unknown':
                    return attempt <= 3; // 未知错误限制重试次数
                default:
                    return false;
            }
        };

        // 计算重试延迟
        const calculateRetryDelay = (errorType, networkQuality, attempt) => {
            let baseDelay;

            // 根据错误类型设置基础延迟
            switch (errorType) {
                case 'network':
                    baseDelay = 2000 * Math.pow(1.5, attempt - 1); // 网络错误较长延迟
                    break;
                case 'server_temporary':
                    baseDelay = 1000 * Math.pow(2, attempt - 1); // 服务器错误指数退避
                    break;
                case 'rate_limit':
                    baseDelay = 5000 * Math.pow(2, attempt - 1); // 限流错误更长延迟
                    break;
                default:
                    baseDelay = 1000 * Math.pow(2, attempt - 1);
            }

            // 根据网络质量调整延迟
            switch (networkQuality) {
                case 'poor':
                    baseDelay *= 1.5; // 网络差时延长重试间隔
                    break;
                case 'good':
                    baseDelay *= 0.7; // 网络好时缩短重试间隔
                    break;
            }

            // 添加随机抖动，避免雷群效应
            const jitter = Math.random() * 0.3 + 0.85; // 0.85-1.15倍随机因子
            baseDelay *= jitter;

            // 限制最大延迟
            return Math.min(Math.floor(baseDelay), 30000); // 最大30秒
        };

        // 并发上传分片 - 优化版本：增强重试机制、错误处理和进度跟踪
        const uploadChunk = async (task, retries = 5) => {
            const maxRetries = 5;
            const currentAttempt = maxRetries - retries + 1;
            const chunkStartTime = Date.now();

            try {
                const formData = new FormData();
                formData.append('bucketName', bucketName);
                formData.append('objectName', objectName);
                formData.append('uploadId', uploadId);
                formData.append('partNumber', task.partNumber);
                formData.append('file', task.chunk);

                await uploadPartApi(formData);
                uploadedChunks++;

                // 标记分片为已完成并保存进度
                completedParts.add(task.partNumber);
                saveUploadProgress(fileId, uploadId, Array.from(completedParts));

                // 计算当前已上传的字节数
                const currentUploadedBytes = completedParts.size * chunkSize;

                // 计算速度和ETA
                const { avgSpeed, eta } = calculateSpeedAndETA(currentUploadedBytes);

                // 更新进度（基于字节数计算，更精确）
                const progress = Math.min(100, Math.floor((currentUploadedBytes / file.size) * 100));

                // 格式化速度显示
                const speedMBps = (avgSpeed / (1024 * 1024)).toFixed(2);
                const etaMinutes = Math.floor(eta / 60);
                const etaSeconds = eta % 60;

                // 调用进度回调，传递更多信息
                onProgress(progress, uploadedChunks, totalChunks, {
                    uploadedBytes: currentUploadedBytes,
                    totalBytes: file.size,
                    speed: avgSpeed,
                    speedText: `${speedMBps} MB/s`,
                    eta: eta,
                    etaText: eta > 0 ? `${etaMinutes}:${etaSeconds.toString().padStart(2, '0')}` : '--:--',
                    chunkUploadTime: Date.now() - chunkStartTime
                });

            } catch (error) {
                if (retries > 0) {
                    // 智能错误分析和重试策略
                    const errorType = analyzeError(error);
                    const shouldRetry = shouldRetryError(errorType, currentAttempt);

                    if (!shouldRetry) {
                        console.error(`分片 ${task.partNumber} 遇到不可重试错误: ${error.message}`);
                        throw error;
                    }

                    // 自适应重试策略：根据错误类型、网络质量和重试次数调整
                    let baseDelay = calculateRetryDelay(errorType, networkQuality, currentAttempt);

                    console.warn(`分片 ${task.partNumber} 上传失败 (${errorType})，${baseDelay}ms后重试... 剩余重试次数: ${retries} (网络质量: ${networkQuality})`);
                    await new Promise(resolve => setTimeout(resolve, baseDelay));
                    return uploadChunk(task, retries - 1);
                } else {
                    console.error(`分片 ${task.partNumber} 上传失败，已达到最大重试次数`);
                    throw error;
                }
            }
        };

        // 使用智能并发控制上传分片 - 参考 hhhh.html 的并发实现
        let taskIndex = 0;

        const worker = async () => {
            while (taskIndex < uploadTasks.length) {
                const task = uploadTasks[taskIndex++];
                await uploadChunk(task);
            }
        };

        // 创建指定数量的并发工作器
        const workers = [];
        for (let i = 0; i < concurrency; i++) {
            workers.push(worker());
        }

        await Promise.all(workers);

        // 3. 完成分片上传
        const completeResult = await completeMultipartUploadApi({
            bucketName,
            objectName,
            uploadId,
            originalFileName: file.name,
            fileSize: file.size
        });

        // 4. 清除断点续传数据
        clearUploadProgress(fileId);

        return { ...completeResult, uploadId };

    } catch (error) {
        console.error('大文件上传失败:', error);
        // 保存当前进度以便断点续传
        if (uploadId && completedParts.size > 0) {
            saveUploadProgress(fileId, uploadId, Array.from(completedParts));
        }
        throw error;
    }
};

// 网络状况检测和缓存
let networkQuality = 'good'; // good, medium, poor
let lastNetworkCheck = 0;
let avgUploadSpeed = 0; // KB/s
let bandwidthCache = null;
const NETWORK_CHECK_INTERVAL = 30000; // 30秒检测一次

// 检测网络质量
const detectNetworkQuality = async () => {
    const now = Date.now();
    // 每30秒检测一次网络质量
    if (now - lastNetworkCheck < NETWORK_CHECK_INTERVAL && networkQuality !== 'unknown') {
        return networkQuality;
    }

    try {
        // 综合延迟和带宽检测
        const [latency, bandwidth] = await Promise.all([
            measureLatency(),
            measureBandwidth()
        ]);

        // 综合延迟和带宽判断网络质量
        if (latency < 100 && bandwidth > 10) { // 延迟<100ms，带宽>10Mbps
            networkQuality = 'good';
        } else if (latency < 300 && bandwidth > 5) { // 延迟<300ms，带宽>5Mbps
            networkQuality = 'medium';
        } else {
            networkQuality = 'poor';
        }

        bandwidthCache = bandwidth;
        avgUploadSpeed = bandwidth * 1024; // 转换为KB/s
        lastNetworkCheck = now;

        console.log(`网络检测结果: 延迟=${latency}ms, 带宽=${bandwidth.toFixed(2)}Mbps, 质量=${networkQuality}`);

    } catch (error) {
        console.warn('网络质量检测失败，使用默认设置:', error);
        networkQuality = 'medium';
    }

    return networkQuality;
};

// 测量网络延迟
const measureLatency = async () => {
    const startTime = Date.now();
    try {
        await fetch('/api/ping', {
            method: 'HEAD',
            cache: 'no-cache',
            signal: AbortSignal.timeout(5000) // 5秒超时
        });
        return Date.now() - startTime;
    } catch (error) {
        return 1000; // 超时或失败时返回较高延迟
    }
};

// 测量带宽（下载速度）
const measureBandwidth = async () => {
    try {
        // 创建一个小的测试数据（约100KB）
        const testSize = 100 * 1024; // 100KB
        const testData = new Uint8Array(testSize);

        const startTime = Date.now();

        // 模拟上传测试来估算带宽
        const formData = new FormData();
        formData.append('test', new Blob([testData]));

        await fetch('/api/bandwidth-test', {
            method: 'POST',
            body: formData,
            signal: AbortSignal.timeout(10000) // 10秒超时
        });

        const duration = (Date.now() - startTime) / 1000; // 秒
        const bandwidth = (testSize * 8) / (1024 * 1024 * duration); // Mbps

        return Math.max(bandwidth, 0.1); // 最小0.1Mbps
    } catch (error) {
        console.warn('带宽检测失败，使用估算值:', error);
        // 根据延迟估算带宽
        const latency = await measureLatency();
        if (latency < 100) return 10; // 假设10Mbps
        if (latency < 300) return 5;  // 假设5Mbps
        return 2; // 假设2Mbps
    }
};

// 获取当前带宽
const getCurrentBandwidth = () => {
    return bandwidthCache || 5; // 默认5Mbps
};

// 优化的动态分片大小计算 - 基于文件大小、网络状况和带宽
const getDynamicChunkSize = async (fileSize, forceNetworkCheck = false) => {
    const MB = 1024 * 1024;
    const GB = 1024 * MB;

    // 检测网络质量
    if (forceNetworkCheck || networkQuality === 'unknown') {
        await detectNetworkQuality();
    }

    // 获取当前带宽
    const bandwidth = getCurrentBandwidth(); // Mbps

    // 基础分片大小策略
    let baseChunkSize;
    if (fileSize < 100 * MB) {
        baseChunkSize = 5 * MB;   // 小文件用5MB分片
    } else if (fileSize < 500 * MB) {
        baseChunkSize = 10 * MB;  // 中小文件用10MB分片
    } else if (fileSize < 1 * GB) {
        baseChunkSize = 20 * MB;  // 中等文件用20MB分片
    } else if (fileSize < 3 * GB) {
        baseChunkSize = 50 * MB;  // 大文件用50MB分片
    } else if (fileSize < 10 * GB) {
        baseChunkSize = 100 * MB; // 超大文件用100MB分片
    } else {
        baseChunkSize = 150 * MB; // 巨大文件用150MB分片
    }

    // 根据带宽调整分片大小
    let bandwidthMultiplier = 1;
    if (bandwidth > 50) { // 高带宽 >50Mbps
        bandwidthMultiplier = 1.8;
    } else if (bandwidth > 20) { // 中高带宽 >20Mbps
        bandwidthMultiplier = 1.4;
    } else if (bandwidth > 10) { // 中等带宽 >10Mbps
        bandwidthMultiplier = 1.2;
    } else if (bandwidth < 2) { // 低带宽 <2Mbps
        bandwidthMultiplier = 0.4;
    } else if (bandwidth < 5) { // 较低带宽 <5Mbps
        bandwidthMultiplier = 0.7;
    }

    // 根据网络质量进一步调整
    let qualityMultiplier;
    switch (networkQuality) {
        case 'good':
            qualityMultiplier = 1.2; // 网络好时适度增大分片
            break;
        case 'medium':
            qualityMultiplier = 1.0; // 网络一般时保持基础大小
            break;
        case 'poor':
            qualityMultiplier = 0.6; // 网络差时减小分片
            break;
        default:
            qualityMultiplier = 1.0;
    }

    // 计算最终分片大小
    let finalChunkSize = Math.round(baseChunkSize * bandwidthMultiplier * qualityMultiplier);

    // 确保分片大小在合理范围内
    const minChunkSize = 2 * MB;   // 最小2MB
    const maxChunkSize = 200 * MB; // 最大200MB

    finalChunkSize = Math.max(minChunkSize, Math.min(maxChunkSize, finalChunkSize));

    console.log(`文件大小: ${Math.round(fileSize / MB)}MB, 网络质量: ${networkQuality}, 带宽: ${bandwidth.toFixed(1)}Mbps, 分片大小: ${Math.round(finalChunkSize / MB)}MB`);

    return finalChunkSize;
};

// 系统性能检测
let systemPerformance = 'good'; // good, medium, poor
let lastPerformanceCheck = 0;

// 检测系统性能
const detectSystemPerformance = () => {
    const now = Date.now();
    // 每2分钟检测一次系统性能
    if (now - lastPerformanceCheck < 2 * 60 * 1000 && systemPerformance !== 'unknown') {
        return systemPerformance;
    }

    try {
        // 检测可用内存（如果支持）
        const memoryInfo = navigator.deviceMemory || 4; // 默认4GB

        // 检测CPU核心数
        const cpuCores = navigator.hardwareConcurrency || 4; // 默认4核

        // 基于内存和CPU评估系统性能
        if (memoryInfo >= 8 && cpuCores >= 8) {
            systemPerformance = 'good';
        } else if (memoryInfo >= 4 && cpuCores >= 4) {
            systemPerformance = 'medium';
        } else {
            systemPerformance = 'poor';
        }

        lastPerformanceCheck = now;
        console.log(`系统性能检测: ${systemPerformance}, 内存: ${memoryInfo}GB, CPU核心: ${cpuCores}`);

    } catch (error) {
        console.warn('系统性能检测失败，使用默认设置:', error);
        systemPerformance = 'medium';
    }

    return systemPerformance;
};

// 智能并发控制 - 基于文件大小、网络质量和系统性能
const getDynamicConcurrency = (fileSize) => {
    const MB = 1024 * 1024;
    const GB = 1024 * MB;

    // 检测系统性能
    detectSystemPerformance();

    // 基础并发数策略
    let baseConcurrency;
    if (fileSize < 50 * MB) {
        baseConcurrency = 4; // 小文件可以更多并发
    } else if (fileSize < 500 * MB) {
        baseConcurrency = 3; // 中等文件适中并发
    } else if (fileSize < 2 * GB) {
        baseConcurrency = 2; // 大文件较少并发
    } else {
        baseConcurrency = 1; // 超大文件最少并发
    }

    // 根据网络质量调整
    let networkAdjustment = 1;
    switch (networkQuality) {
        case 'good':
            networkAdjustment = 1.5;
            break;
        case 'medium':
            networkAdjustment = 1.0;
            break;
        case 'poor':
            networkAdjustment = 0.5;
            break;
    }

    // 根据系统性能调整
    let performanceAdjustment = 1;
    switch (systemPerformance) {
        case 'good':
            performanceAdjustment = 1.5;
            break;
        case 'medium':
            performanceAdjustment = 1.0;
            break;
        case 'poor':
            performanceAdjustment = 0.7;
            break;
    }

    // 计算最终并发数
    let finalConcurrency = Math.round(baseConcurrency * networkAdjustment * performanceAdjustment);

    // 确保并发数在合理范围内
    finalConcurrency = Math.max(1, Math.min(8, finalConcurrency));

    console.log(`文件大小: ${Math.round(fileSize / MB)}MB, 网络: ${networkQuality}, 系统: ${systemPerformance}, 并发数: ${finalConcurrency}`);

    return finalConcurrency;
};

// 断点续传：保存上传进度到本地存储（已禁用历史记录保存）
const saveUploadProgress = (fileId, uploadId, completedParts) => {
    // 不再保存上传进度到本地存储
    // const progressKey = `upload_progress_${fileId}`;
    // const progressData = {
    //     uploadId,
    //     completedParts,
    //     timestamp: Date.now()
    // };
    // localStorage.setItem(progressKey, JSON.stringify(progressData));
};

// 断点续传：获取已保存的上传进度（已禁用历史记录保存）
const getUploadProgress = (fileId) => {
    // 不再从本地存储获取上传进度
    // const progressKey = `upload_progress_${fileId}`;
    // const progressData = localStorage.getItem(progressKey);
    // if (progressData) {
    //     const parsed = JSON.parse(progressData);
    //     // 检查进度是否过期（24小时）
    //     if (Date.now() - parsed.timestamp < 24 * 60 * 60 * 1000) {
    //         return parsed;
    //     } else {
    //         localStorage.removeItem(progressKey);
    //     }
    // }
    return null;
};

// 断点续传：清除上传进度（已禁用历史记录保存）
const clearUploadProgress = (fileId) => {
    // 不再清除本地存储的上传进度
    // const progressKey = `upload_progress_${fileId}`;
    // localStorage.removeItem(progressKey);
};

// 生成文件唯一标识
const generateFileId = (file, objectName) => {
    return `${objectName}_${file.size}_${file.lastModified || Date.now()}`;
};

// 多文件智能并发上传管理 - 参考 hhhh.html 的实现
export const uploadMultipleFiles = async (files, options = {}) => {
    const {
        bucketName = 'public',
        currentPath = '/',
        onProgress = () => {},
        onFileComplete = () => {},
        onAllComplete = () => {},
        overwrite = false
    } = options;

    const MB = 1024 * 1024;
    const GB = 1024 * MB;

    // 按文件大小分组
    const smallFiles = files.filter(file => file.size < 50 * MB); // 50MB以下
    const mediumFiles = files.filter(file => file.size >= 50 * MB && file.size < 1 * GB); // 50MB-1GB
    const largeFiles = files.filter(file => file.size >= 1 * GB && file.size < 3 * GB); // 1GB-3GB
    const extraLargeFiles = files.filter(file => file.size >= 3 * GB); // 3GB以上

    console.log(`文件分组统计: 小文件${smallFiles.length}个, 中等文件${mediumFiles.length}个, 大文件${largeFiles.length}个, 超大文件${extraLargeFiles.length}个`);

    // 创建上传任务队列
    const uploadTasks = [];

    // 小文件并发上传（3个并发）
    if (smallFiles.length > 0) {
        uploadTasks.push(uploadFileGroup(smallFiles, 3, 'small', { bucketName, currentPath, onProgress, onFileComplete, overwrite }));
    }

    // 中等文件并发上传（3个并发）
    if (mediumFiles.length > 0) {
        uploadTasks.push(uploadFileGroup(mediumFiles, 3, 'medium', { bucketName, currentPath, onProgress, onFileComplete, overwrite }));
    }

    // 大文件并发上传（2个并发）
    if (largeFiles.length > 0) {
        uploadTasks.push(uploadFileGroup(largeFiles, 2, 'large', { bucketName, currentPath, onProgress, onFileComplete, overwrite }));
    }

    // 超大文件串行上传（1个并发）
    if (extraLargeFiles.length > 0) {
        uploadTasks.push(uploadFileGroup(extraLargeFiles, 1, 'extraLarge', { bucketName, currentPath, onProgress, onFileComplete, overwrite }));
    }

    try {
        // 等待所有分组上传完成
        await Promise.all(uploadTasks);
        onAllComplete();
        console.log('所有文件上传完成');
    } catch (error) {
        console.error('多文件上传过程中出现错误:', error);
        throw error;
    }
};

// 分组上传文件 - 参考 hhhh.html 的并发实现
const uploadFileGroup = async (files, concurrency, groupType, options) => {
    const { bucketName, currentPath, onProgress, onFileComplete, overwrite = false } = options;

    console.log(`开始上传${groupType}文件组: ${files.length}个文件，并发数: ${concurrency}`);

    let fileIndex = 0;

    const worker = async () => {
        while (fileIndex < files.length) {
            const file = files[fileIndex++];
            try {
                // 直接使用文件的路径信息，不再重复构建
                // 路径构建已在调用方（FileUploadDialog.vue）完成
                const objectName = file.webkitRelativePath || file.name;

                console.log(`开始上传文件: ${objectName} (${formatFileSize(file.size)})`);

                // 使用现有的上传API
                await uploadFtpFileApi(file, {
                    bucketName,
                    objectName,
                    onProgress: (progress, uploadedChunks, totalChunks) => {
                        onProgress(file, progress, uploadedChunks, totalChunks);
                    },
                    overwrite
                });

                console.log(`文件上传完成: ${objectName}`);
                onFileComplete(file, 'success');

            } catch (error) {
                console.error(`文件上传失败: ${file.name}`, error);
                onFileComplete(file, 'error', error);
                throw error;
            }
        }
    };

    // 创建指定数量的并发工作器
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
        workers.push(worker());
    }

    await Promise.all(workers);
    console.log(`${groupType}文件组上传完成`);
};

// 格式化文件大小
const formatFileSize = (bytes) => {
    if (bytes === undefined || bytes === null || isNaN(bytes)) return 'N/A';
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 导出工具函数
export { getDynamicChunkSize, getDynamicConcurrency, saveUploadProgress, getUploadProgress, clearUploadProgress, generateFileId, formatFileSize };

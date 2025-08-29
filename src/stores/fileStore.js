/*
 * @Author: FirstsnowLucky firstsnow1119@163.com
 * @Date: 2025-08-22 23:16:52
 * @LastEditors: FirstsnowLucky firstsnow1119@163.com
 * @LastEditTime: 2025-08-28 17:16:06
 * @FilePath: \vue-file\src\stores\fileStore.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useFileStore = defineStore('fileStore', () => {
  // 当前文件夹路径
  const currentFolder = ref('/')

  // 文件列表
  const fileList = ref([])

  // 树形数据
  const treeData = ref([])

  // 工作空间列表
  const workspaceList = ref([])

  // 当前选中的项目ID
  const currentProjectId = ref(null)

  // 当前选中的项目信息
  const currentProject = ref(null)

  // 上传进度
  const uploadProgress = ref([])

  // 下载队列
  const downloadQueue = ref([])

  // 最大记录数量
  const MAX_RECORDS = 30

  // 注意：不再保存上传历史记录

  // 设置当前文件夹
  const setCurrentFolder = (folder) => {
    currentFolder.value = folder
  }

  // 设置文件列表
  const setFileList = (files) => {
    fileList.value = files
  }

  // 设置树形数据
  const setTreeData = (data) => {
    treeData.value = data
  }

  // 设置工作空间列表
  const setWorkspaceList = (workspaces) => {
    workspaceList.value = workspaces
  }

  // 设置当前项目ID
  const setCurrentProjectId = (projectId) => {
    currentProjectId.value = projectId
    // 同时更新当前项目信息
    if (projectId && workspaceList.value.length > 0) {
      const project = workspaceList.value.find(item => item.id === projectId)
      currentProject.value = project || null
    } else {
      currentProject.value = null
    }
  }

  // 设置当前项目信息
  const setCurrentProject = (project) => {
    currentProject.value = project
    currentProjectId.value = project ? project.id : null
  }

  // 添加上传项
  const addUploadItem = (item) => {
    // 添加时间戳
    const itemWithTimestamp = {
      ...item,
      timestamp: Date.now(),
      id: item.id || Date.now() + Math.random()
    }
    
    uploadProgress.value.unshift(itemWithTimestamp)
    
    // 限制记录数量
    if (uploadProgress.value.length > MAX_RECORDS) {
      uploadProgress.value = uploadProgress.value.slice(0, MAX_RECORDS)
    }
  }

  // 更新上传项
  const updateUploadItem = (id, updates) => {
    const index = uploadProgress.value.findIndex(item => item.id === id)
    if (index !== -1) {
      Object.assign(uploadProgress.value[index], updates)
    }
  }

  // 清除已完成的上传
  const clearCompletedUploads = () => {
    uploadProgress.value = uploadProgress.value.filter(item => item.status !== 'completed')
  }

  // 设置上传进度
  const setUploadProgress = (progress) => {
    uploadProgress.value = progress
  }

  // 清除所有上传
  const clearAllUploads = () => {
    uploadProgress.value = []
  }

  // 添加下载项到队列
  const addDownloadItem = (item) => {
    const existingIndex = downloadQueue.value.findIndex(f => f.id === item.id)
    if (existingIndex === -1) {
      const itemWithTimestamp = {
        ...item,
        progress: 0,
        status: 'pending',
        timestamp: Date.now(),
        id: item.id || Date.now() + Math.random()
      }
      
      downloadQueue.value.unshift(itemWithTimestamp)
      
      // 限制记录数量
      if (downloadQueue.value.length > MAX_RECORDS) {
        downloadQueue.value = downloadQueue.value.slice(0, MAX_RECORDS)
      }
      
      return true
    }
    return false
  }

  // 更新下载项
  const updateDownloadItem = (id, updates) => {
    const index = downloadQueue.value.findIndex(item => item.id === id)
    if (index !== -1) {
      Object.assign(downloadQueue.value[index], updates)
    }
  }

  // 移除下载项
  const removeDownloadItem = (id) => {
    const index = downloadQueue.value.findIndex(item => item.id === id)
    if (index !== -1) {
      downloadQueue.value.splice(index, 1)
    }
  }

  // 清除已完成的下载
  const clearCompletedDownloads = () => {
    downloadQueue.value = downloadQueue.value.filter(item => item.status !== 'completed')
  }

  // 清除所有下载
  const clearAllDownloads = () => {
    downloadQueue.value = []
  }

  // 清除已完成和失败的记录
  const clearFinishedRecords = () => {
    uploadProgress.value = uploadProgress.value.filter(item => 
      item.status !== 'completed' && item.status !== 'error' && item.status !== 'failed'
    )
    downloadQueue.value = downloadQueue.value.filter(item => 
      item.status !== 'completed' && item.status !== 'error' && item.status !== 'failed'
    )
  }

  // 清除所有记录
  const clearAllRecords = () => {
    uploadProgress.value = []
    downloadQueue.value = []
  }

  // 移除指定的上传记录
  const removeUploadItem = (id) => {
    const index = uploadProgress.value.findIndex(item => item.id === id)
    if (index !== -1) {
      uploadProgress.value.splice(index, 1)
    }
  }

  // 取消上传任务
  const cancelUploadItem = (id) => {
    const index = uploadProgress.value.findIndex(item => item.id === id)
    if (index !== -1) {
      const item = uploadProgress.value[index]
      if (item.status === 'uploading' || item.status === 'pending') {
        // 更新状态为已取消
        Object.assign(uploadProgress.value[index], {
          status: 'cancelled',
          progress: 0,
          error: '用户取消上传'
        })
        return true
      }
    }
    return false
  }

  // 取消下载任务
  const cancelDownloadItem = (id) => {
    const index = downloadQueue.value.findIndex(item => item.id === id)
    if (index !== -1) {
      const item = downloadQueue.value[index]
      if (item.status === 'downloading' || item.status === 'pending') {
        // 更新状态为已取消
        Object.assign(downloadQueue.value[index], {
          status: 'cancelled',
          progress: 0,
          error: '用户取消下载'
        })
        return true
      }
    }
    return false
  }

  return {
    currentFolder,
    fileList,
    treeData,
    workspaceList,
    currentProjectId,
    currentProject,
    uploadProgress,
    downloadQueue,
    setCurrentFolder,
    setFileList,
    setTreeData,
    setWorkspaceList,
    setCurrentProjectId,
    setCurrentProject,
    addUploadItem,
    updateUploadItem,
    clearCompletedUploads,
    clearAllUploads,
    setUploadProgress,
    addDownloadItem,
    updateDownloadItem,
    removeDownloadItem,
    clearCompletedDownloads,
    clearAllDownloads,
    clearFinishedRecords,
    clearAllRecords,
    removeUploadItem,
    cancelUploadItem,
    cancelDownloadItem
  }
}, {
  persist: {
    key: 'file-store',
    storage: localStorage,
    paths: ['currentFolder', 'fileList', 'treeData', 'workspaceList', 'currentProjectId', 'currentProject']
  }
})

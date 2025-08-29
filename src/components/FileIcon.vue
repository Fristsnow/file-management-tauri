<template>
  <div class="file-icon-wrapper">
    <img 
      :src="getIconPath(fileType, isFolder)" 
      :alt="getIconAlt(fileType, isFolder)"
      class="file-icon"
    />
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  fileType: {
    type: String,
    default: ''
  },
  isFolder: {
    type: Boolean,
    default: false
  }
})

const iconMap = {
  word: ['doc', 'docx'],
  excel: ['xls', 'xlsx'],
  ppt: ['ppt', 'pptx'],
  pdf: ['pdf'],
  file: ['txt', 'md', 'log'],
  images: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'svg', 'webp'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg'],
  video: ['mp4', 'avi', 'mkv', 'mov', 'wmv', 'flv'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz']
};

const getIconPath = (fileType, isFolder) => {
  if (isFolder) {
    return new URL('../assets/logo/file/folder.png', import.meta.url).href;
  }

  const type = fileType?.toLowerCase() || '';

  for (const [key, exts] of Object.entries(iconMap)) {
    if (exts.includes(type)) {
      return new URL(`../assets/logo/file/${key}.png`, import.meta.url).href;
    }
  }

  // 默认文件图标
  return new URL('../assets/logo/file/file.png', import.meta.url).href;
};

const getIconAlt = (fileType, isFolder) => {
  if (isFolder) return '文件夹'
  return `${fileType || '文件'} 图标`
}
</script>

<style scoped>
.file-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
}

.file-icon {
  width: 20px;
  height: 20px;
  object-fit: contain;
}
</style>
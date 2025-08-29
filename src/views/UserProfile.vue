<template>
  <div class="user-profile">
    <div class="profile-header">
      <h2>个人信息</h2>
      <p>管理您的个人资料和系统设置</p>
    </div>

    <div class="profile-content">
      <!-- 用户基本信息 -->
      <el-card class="profile-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>基本信息</span>
            <el-button type="primary" size="small" @click="editMode = !editMode">
              {{ editMode ? '取消编辑' : '编辑信息' }}
            </el-button>
          </div>
        </template>
        
        <div class="user-info">
          <div class="avatar-section">
            <el-avatar :size="80" :src="userInfo.avatar" class="user-avatar">
              <el-icon><User /></el-icon>
            </el-avatar>
            <el-button v-if="editMode" size="small" type="text" @click="changeAvatar">
              更换头像
            </el-button>
          </div>
          
          <div class="info-section">
            <el-form :model="userInfo" label-width="100px" class="user-form">
              <el-form-item label="用户名">
                <el-input 
                  v-model="userInfo.username" 
                  :disabled="!editMode"
                  placeholder="请输入用户名"
                />
              </el-form-item>
              
              <el-form-item label="邮箱">
                <el-input 
                  v-model="userInfo.email" 
                  :disabled="!editMode"
                  placeholder="请输入邮箱地址"
                />
              </el-form-item>
              
              <el-form-item label="手机号">
                <el-input 
                  v-model="userInfo.phone" 
                  :disabled="!editMode"
                  placeholder="请输入手机号"
                />
              </el-form-item>
              
              <el-form-item label="部门">
                <el-input 
                  v-model="userInfo.department" 
                  :disabled="!editMode"
                  placeholder="请输入部门"
                />
              </el-form-item>
              
              <el-form-item v-if="editMode">
                <el-button type="primary" @click="saveUserInfo">保存</el-button>
                <el-button @click="resetUserInfo">重置</el-button>
              </el-form-item>
            </el-form>
          </div>
        </div>
      </el-card>

      <!-- 存储统计 -->
      <el-card class="profile-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>存储统计</span>
            <el-button size="small" @click="refreshStats" icon="Refresh">刷新</el-button>
          </div>
        </template>
        
        <div class="storage-stats">
          <div class="stat-item">
            <div class="stat-label">已用空间</div>
            <div class="stat-value">{{ formatFileSize(storageStats.usedSpace) }}</div>
          </div>
          
          <div class="stat-item">
            <div class="stat-label">总空间</div>
            <div class="stat-value">{{ formatFileSize(storageStats.totalSpace) }}</div>
          </div>
          
          <div class="stat-item">
            <div class="stat-label">文件数量</div>
            <div class="stat-value">{{ storageStats.fileCount }}</div>
          </div>
          
          <div class="stat-item">
            <div class="stat-label">文件夹数量</div>
            <div class="stat-value">{{ storageStats.folderCount }}</div>
          </div>
        </div>
        
        <div class="storage-progress">
          <div class="progress-label">
            <span>存储使用率</span>
            <span>{{ storageUsagePercent }}%</span>
          </div>
          <el-progress 
            :percentage="storageUsagePercent" 
            :stroke-width="8"
            :color="getProgressColor(storageUsagePercent)"
          />
        </div>
      </el-card>

      <!-- 系统设置 -->
      <el-card class="profile-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>系统设置</span>
          </div>
        </template>
        
        <el-form :model="systemSettings" label-width="120px" class="settings-form">
          <el-form-item label="主题模式">
            <el-radio-group v-model="systemSettings.theme">
              <el-radio label="light">浅色模式</el-radio>
              <el-radio label="dark">深色模式</el-radio>
              <el-radio label="auto">跟随系统</el-radio>
            </el-radio-group>
          </el-form-item>
          
          <el-form-item label="语言设置">
            <el-select v-model="systemSettings.language" placeholder="选择语言">
              <el-option label="简体中文" value="zh-CN" />
              <el-option label="English" value="en-US" />
            </el-select>
          </el-form-item>
          
          <el-form-item label="自动保存">
            <el-switch v-model="systemSettings.autoSave" />
          </el-form-item>
          
          <el-form-item label="桌面通知">
            <el-switch v-model="systemSettings.notifications" />
          </el-form-item>
          
          <el-form-item>
            <el-button type="primary" @click="saveSettings">保存设置</el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 安全设置 -->
      <el-card class="profile-card" shadow="hover">
        <template #header>
          <div class="card-header">
            <span>安全设置</span>
          </div>
        </template>
        
        <div class="security-section">
          <div class="security-item">
            <div class="security-info">
              <div class="security-title">修改密码</div>
              <div class="security-desc">定期修改密码以保护账户安全</div>
            </div>
            <el-button type="primary" @click="showChangePassword = true">修改密码</el-button>
          </div>
          
          <div class="security-item">
            <div class="security-info">
              <div class="security-title">登录日志</div>
              <div class="security-desc">查看最近的登录记录</div>
            </div>
            <el-button @click="showLoginLog = true">查看日志</el-button>
          </div>
          
          <div class="security-item">
            <div class="security-info">
              <div class="security-title">两步验证</div>
              <div class="security-desc">启用两步验证增强账户安全</div>
            </div>
            <el-switch v-model="securitySettings.twoFactorAuth" />
          </div>
        </div>
      </el-card>
    </div>

    <!-- 修改密码对话框 -->
    <el-dialog v-model="showChangePassword" title="修改密码" width="400px">
      <el-form :model="passwordForm" label-width="100px">
        <el-form-item label="当前密码">
          <el-input v-model="passwordForm.currentPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="passwordForm.newPassword" type="password" show-password />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="passwordForm.confirmPassword" type="password" show-password />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showChangePassword = false">取消</el-button>
        <el-button type="primary" @click="changePassword">确定</el-button>
      </template>
    </el-dialog>

    <!-- 登录日志对话框 -->
    <el-dialog v-model="showLoginLog" title="登录日志" width="600px">
      <el-table :data="loginLogs" style="width: 100%">
        <el-table-column prop="time" label="登录时间" width="180" />
        <el-table-column prop="ip" label="IP地址" width="120" />
        <el-table-column prop="location" label="登录地点" />
        <el-table-column prop="device" label="设备" />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { User, Refresh } from '@element-plus/icons-vue';

// 编辑模式
const editMode = ref(false);

// 用户信息
const userInfo = ref({
  username: '管理员',
  email: 'admin@example.com',
  phone: '138****8888',
  department: '技术部',
  avatar: ''
});

// 原始用户信息（用于重置）
const originalUserInfo = ref({ ...userInfo.value });

// 存储统计
const storageStats = ref({
  usedSpace: 1024 * 1024 * 1024 * 2.5, // 2.5GB
  totalSpace: 1024 * 1024 * 1024 * 10, // 10GB
  fileCount: 156,
  folderCount: 23
});

// 系统设置
const systemSettings = ref({
  theme: 'light',
  language: 'zh-CN',
  autoSave: true,
  notifications: true
});

// 安全设置
const securitySettings = ref({
  twoFactorAuth: false
});

// 密码修改
const showChangePassword = ref(false);
const passwordForm = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

// 登录日志
const showLoginLog = ref(false);
const loginLogs = ref([
  {
    time: '2024-01-15 14:30:25',
    ip: '192.168.1.100',
    location: '北京市',
    device: 'Chrome 浏览器'
  },
  {
    time: '2024-01-15 09:15:10',
    ip: '192.168.1.100',
    location: '北京市',
    device: 'Chrome 浏览器'
  },
  {
    time: '2024-01-14 16:45:33',
    ip: '192.168.1.101',
    location: '上海市',
    device: 'Firefox 浏览器'
  }
]);

// 计算存储使用率
const storageUsagePercent = computed(() => {
  return Math.round((storageStats.value.usedSpace / storageStats.value.totalSpace) * 100);
});

// 获取进度条颜色
const getProgressColor = (percentage) => {
  if (percentage < 50) return '#67c23a';
  if (percentage < 80) return '#e6a23c';
  return '#f56c6c';
};

// 格式化文件大小
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// 保存用户信息
const saveUserInfo = () => {
  // 这里应该调用API保存用户信息
  ElMessage.success('用户信息保存成功');
  editMode.value = false;
  originalUserInfo.value = { ...userInfo.value };
};

// 重置用户信息
const resetUserInfo = () => {
  userInfo.value = { ...originalUserInfo.value };
};

// 更换头像
const changeAvatar = () => {
  // 这里应该实现头像上传功能
  ElMessage.info('头像上传功能开发中');
};

// 刷新统计数据
const refreshStats = () => {
  // 这里应该调用API刷新统计数据
  ElMessage.success('统计数据已刷新');
};

// 保存系统设置
const saveSettings = () => {
  // 这里应该调用API保存设置
  ElMessage.success('设置保存成功');
};

// 修改密码
const changePassword = () => {
  if (!passwordForm.value.currentPassword) {
    ElMessage.error('请输入当前密码');
    return;
  }
  
  if (!passwordForm.value.newPassword) {
    ElMessage.error('请输入新密码');
    return;
  }
  
  if (passwordForm.value.newPassword !== passwordForm.value.confirmPassword) {
    ElMessage.error('两次输入的密码不一致');
    return;
  }
  
  // 这里应该调用API修改密码
  ElMessage.success('密码修改成功');
  showChangePassword.value = false;
  passwordForm.value = {
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };
};

// 初始化
onMounted(() => {
  // 这里可以加载用户数据
});
</script>

<style scoped>
.user-profile {
  padding: 24px;
  height: 100%;
  overflow-y: auto;
}

.profile-header {
  margin-bottom: 24px;
}

.profile-header h2 {
  margin: 0 0 8px 0;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.profile-header p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.profile-content {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

.profile-card {
  border-radius: 8px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-weight: 600;
  color: #333;
}

.user-info {
  display: flex;
  gap: 24px;
}

.avatar-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  border: 2px solid #e8eaec;
}

.info-section {
  flex: 1;
}

.user-form {
  max-width: 500px;
}

.storage-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 16px;
  margin-bottom: 24px;
}

.stat-item {
  text-align: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.stat-label {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
}

.stat-value {
  font-size: 20px;
  font-weight: 600;
  color: #333;
}

.storage-progress {
  margin-top: 16px;
}

.progress-label {
  display: flex;
  justify-content: space-between;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.settings-form {
  max-width: 500px;
}

.security-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.security-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: #f8f9fa;
  border-radius: 6px;
}

.security-info {
  flex: 1;
}

.security-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
}

.security-desc {
  font-size: 12px;
  color: #666;
}

/* 响应式设计 */
@media (max-width: 768px) {
  .user-profile {
    padding: 16px;
  }
  
  .user-info {
    flex-direction: column;
    align-items: center;
  }
  
  .storage-stats {
    grid-template-columns: repeat(2, 1fr);
  }
  
  .security-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
}

@media (max-width: 480px) {
  .storage-stats {
    grid-template-columns: 1fr;
  }
}
</style>
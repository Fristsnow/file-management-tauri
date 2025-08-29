<template>
    <div class="login-container">
        <!-- 背景粒子效果 -->
        <div class="particles-bg">
            <div v-for="i in 50" :key="i" class="particle" :style="getParticleStyle(i)"></div>
        </div>

        <!-- Logo区域 -->
        <div class="top-logo">
            <div class="logo-content">
                <div class="logo-icon">📁</div>
                <span class="logo-text">FileManager</span>
            </div>
        </div>

        <!-- 主要内容区域 -->
        <div class="main-content" :class="{ 'shake': loginError }">
            <!-- 左侧内容区 -->
            <div class="login-left">
                <div class="system-intro">
                    <h1 class="title-animated">文件管理系统</h1>
                    <p class="subtitle">安全、高效、智能的文件管理解决方案</p>
                    <div class="feature-list">
                        <div class="feature-item" v-for="(feature, index) in features" :key="index" :style="{ animationDelay: `${index * 0.2}s` }">
                            <i :class="feature.icon"></i>
                            <span>{{ feature.text }}</span>
                        </div>
                    </div>
                </div>
                <div class="background-decoration">
                    <div class="floating-shape shape-1"></div>
                    <div class="floating-shape shape-2"></div>
                    <div class="floating-shape shape-3"></div>
                </div>
            </div>

            <!-- 右侧登录表单 -->
            <div class="login-right">
                <div class="login-header">
                    <div class="login-type">
                        <span class="active">账号登录</span>
                    </div>
                    <div class="welcome-text">
                        <h2>欢迎回来</h2>
                        <p>请登录您的账户</p>
                    </div>
                </div>

                <!-- 账号登录表单 -->
                <div v-show="!isQRMode" class="login-form-container">
                    <el-form ref="ruleFormRef" :model="loginForm" :rules="loginRules" class="login-form">
                        <el-form-item prop="username">
                            <el-input
                                v-model="loginForm.username"
                                type="text"
                                placeholder="请输入用户名"
                                :prefix-icon="User"
                                size="large"
                                @keyup.enter="handleLogin"
                            />
                        </el-form-item>

                        <el-form-item prop="password">
                            <el-input
                                v-model="loginForm.password"
                                type="password"
                                placeholder="请输入密码"
                                :prefix-icon="Lock"
                                show-password
                                size="large"
                                @keyup.enter="handleLogin"
                            />
                        </el-form-item>

                        <!-- 记住密码和忘记密码 -->
                        <div class="form-options">
                            <el-checkbox v-model="rememberPassword" size="small">
                                记住密码
                            </el-checkbox>
                            <el-link type="primary" :underline="false" @click="handleForgotPassword">
                                忘记密码？
                            </el-link>
                        </div>

                        <el-form-item>
                            <el-button
                                type="primary"
                                class="login-button"
                                @click="handleLogin"
                                :loading="isLoading"
                                :disabled="isLoading"
                                size="large"
                            >
                                <span v-if="!isLoading">登录</span>
                                <span v-else>登录中...</span>
                            </el-button>
                        </el-form-item>
                    </el-form>
                </div>
            </div>
        </div>

        <!-- 底部信息 -->
        <div class="footer-info">
            <p>&copy; 2025 文件管理系统. All rights reserved.</p>
        </div>
    </div>
</template>

<script setup>
import { ref, reactive, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { User, Lock, Refresh } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { loginApi, getUserInfoApi } from '@/api/Login'
import { useUserStore } from '@/stores/userStore'

const router = useRouter()
const ruleFormRef = ref()
const userStore = useUserStore()

// 登录表单数据
const loginForm = reactive({
    username: 'root',
    password: '123456'
})

// 表单验证规则
const loginRules = reactive({
    username: [{ required: true, message: '请输入用户名', trigger: 'blur' }],
    password: [{ required: true, message: '请输入密码', trigger: 'blur' }]
})

// 状态管理
const isLoading = ref(false)
const loginError = ref(false)
const isQRMode = ref(false)
const rememberPassword = ref(false)

// 功能特性列表
const features = ref([
    { icon: '🚀', text: '高速上传下载' },
    { icon: '🔒', text: '安全加密存储' },
    { icon: '📱', text: '多端同步访问' },
    { icon: '🎯', text: '智能文件管理' }
])

// 粒子背景样式生成
const getParticleStyle = (index) => {
    const size = Math.random() * 4 + 2
    const left = Math.random() * 100
    const animationDuration = Math.random() * 20 + 10
    const animationDelay = Math.random() * 5

    return {
        width: `${size}px`,
        height: `${size}px`,
        left: `${left}%`,
        animationDuration: `${animationDuration}s`,
        animationDelay: `${animationDelay}s`
    }
}



// 切换到二维码登录
const switchToQR = () => {
    isQRMode.value = !isQRMode.value
}

// 刷新二维码
const refreshQR = () => {
    ElMessage.info('二维码已刷新')
}

// 忘记密码处理
const handleForgotPassword = () => {
    ElMessageBox.alert('请联系管理员重置密码', '忘记密码', {
        confirmButtonText: '确定'
    })
}

// 第三方登录处理
const handleSocialLogin = (type) => {
    ElMessage.info(`${type} 登录功能开发中...`)
}

// 登录错误动画
const triggerLoginError = () => {
    loginError.value = true
    setTimeout(() => {
        loginError.value = false
    }, 500)
}

// 组件挂载时初始化
onMounted(() => {
    // 检查是否记住密码
    const savedUsername = localStorage.getItem('rememberedUsername')
    const savedPassword = localStorage.getItem('rememberedPassword')
    if (savedUsername && savedPassword) {
        loginForm.username = savedUsername
        loginForm.password = savedPassword
        rememberPassword.value = true
    }
})

// 登录处理
const handleLogin = async () => {
  // 表单验证
  if (!loginForm.username.trim()) {
    ElMessage.warning('请输入用户名')
    return
  }

  if (!loginForm.password.trim()) {
    ElMessage.warning('请输入密码')
    return
  }



  isLoading.value = true

  try {
    const response = await loginApi({
      username: loginForm.username.trim(),
      password: loginForm.password.trim()
    })

    // 检查响应数据
    if (response.msg === 'ok' && response.data) {
      // 保存token到localStorage和store
      localStorage.setItem('token', response.data)
      userStore.setToken(response.data)
      userStore.setLoginStatus(true)

      try {
        // 获取用户信息
        const userInfoResponse = await getUserInfoApi()
        if (userInfoResponse.msg === 'ok' && userInfoResponse.data) {
          // 保存用户信息到store
          userStore.setUserInfo(userInfoResponse.data)
          console.log('用户信息已保存到store:', userInfoResponse.data)
        }
      } catch (userInfoError) {
        console.warn('获取用户信息失败:', userInfoError)
        // 即使获取用户信息失败，也不影响登录流程
      }

      // 记住密码功能
      if (rememberPassword.value) {
        localStorage.setItem('rememberedUsername', loginForm.username)
        localStorage.setItem('rememberedPassword', loginForm.password)
      } else {
        localStorage.removeItem('rememberedUsername')
        localStorage.removeItem('rememberedPassword')
      }

      ElMessage.success('登录成功！欢迎回来')

      // 跳转到主页
      await router.push('/')
    } else {
      throw new Error('登录响应数据格式错误')
    }

  } catch (error) {
    console.error('登录失败:', error)
    triggerLoginError()

    // 根据错误类型显示不同的错误信息
    if (error.response) {
      const status = error.response.status
      const message = error.response.data?.message || error.response.data?.error

      switch (status) {
        case 401:
          ElMessage.error(message || '用户名或密码错误')
          break
        case 400:
          ElMessage.error(message || '请求参数错误')
          break
        case 429:
          ElMessage.error('登录尝试过于频繁，请稍后再试')
          break
        case 500:
          ElMessage.error('服务器内部错误，请稍后再试')
          break
        default:
          ElMessage.error(message || '登录失败，请重试')
      }
    } else if (error.code === 'NETWORK_ERROR') {
      ElMessage.error('网络连接失败，请检查网络设置')
    } else {
      ElMessage.error(error.message || '登录失败，请重试')
    }

    // 清空密码
    loginForm.password = ''

  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
.login-container {
    width: 100vw;
    height: 100vh;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    position: relative;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    overflow: hidden;
}

/* 粒子背景 */
.particles-bg {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: 1;
}

.particle {
    position: absolute;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 50%;
    pointer-events: none;
    animation: float 6s ease-in-out infinite;
}

@keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(180deg); }
}

/* Logo样式 */
.logo-content {
    display: flex;
    align-items: center;
    gap: 8px;
    color: white;
    font-size: 18px;
    font-weight: 600;
}

.logo-icon {
    font-size: 24px;
}

.top-logo {
    position: absolute;
    top: 24px;
    left: 24px;
    z-index: 10;
}

.top-logo img {
    height: 32px;
}

.main-content {
    width: 900px;
    height: 500px;
    display: flex;
    background: #fff;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
    position: relative;
    z-index: 2;
    transition: transform 0.3s ease;
}

.main-content.shake {
    animation: shake 0.5s ease-in-out;
}

@keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
}

.login-left {
    width: 50%;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #fff;
    padding: 40px;
    overflow: hidden;
}

.system-intro {
    text-align: center;
    z-index: 1;
    max-width: 400px;
}

.title-animated {
    font-size: 2.5rem;
    margin-bottom: 1rem;
    font-weight: 700;
    background: linear-gradient(45deg, #fff, #e0e7ff);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
    animation: titleGlow 2s ease-in-out infinite alternate;
}

@keyframes titleGlow {
    from { filter: drop-shadow(0 0 10px rgba(255, 255, 255, 0.3)); }
    to { filter: drop-shadow(0 0 20px rgba(255, 255, 255, 0.6)); }
}

.subtitle {
    font-size: 1.1rem;
    margin-bottom: 2rem;
    opacity: 0.9;
    line-height: 1.6;
}

.feature-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}

.feature-item {
    display: flex;
    align-items: center;
    font-size: 1rem;
    opacity: 0;
    animation: slideInLeft 0.6s ease-out forwards;
}

.feature-item i {
    margin-right: 12px;
    font-size: 1.2rem;
}

@keyframes slideInLeft {
    from {
        opacity: 0;
        transform: translateX(-30px);
    }
    to {
        opacity: 0.9;
        transform: translateX(0);
    }
}

/* 背景装饰 */
.background-decoration {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
}

.floating-shape {
    position: absolute;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.1);
    animation: floatShape 8s ease-in-out infinite;
}

.shape-1 {
    width: 80px;
    height: 80px;
    top: 20%;
    left: 10%;
    animation-delay: 0s;
}

.shape-2 {
    width: 60px;
    height: 60px;
    top: 60%;
    right: 15%;
    animation-delay: 2s;
}

.shape-3 {
    width: 40px;
    height: 40px;
    bottom: 20%;
    left: 20%;
    animation-delay: 4s;
}

@keyframes floatShape {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-30px) rotate(180deg); }
}

.background-image {
    position: absolute;
    bottom: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-size: cover;
    background-position: center;
    opacity: 0.7;
}

.login-right {
    width: 50%;
    padding: 40px;
    display: flex;
    flex-direction: column;
    background: #fff;
}

.login-header {
    margin-bottom: 30px;
}

.welcome-text {
    margin-top: 20px;
}

.welcome-text h2 {
    font-size: 24px;
    color: #333;
    margin-bottom: 8px;
    font-weight: 600;
}

.welcome-text p {
    color: #666;
    font-size: 14px;
}

.login-type {
    display: flex;
    gap: 32px;
    margin-bottom: 32px;
    border-bottom: 1px solid #eee;
    padding: 0 4px;
}

.login-type span {
    font-size: 16px;
    color: #666;
    cursor: pointer;
    padding: 0 4px 12px;
    position: relative;
    transition: all 0.3s;
}

.login-type span:hover {
    color: #00a0e9;
}

.login-type span.active {
    color: #00a0e9;
    font-weight: 500;
}

.login-type span.active::after {
    content: '';
    position: absolute;
    bottom: -1px;
    left: 50%;
    transform: translateX(-50%);
    width: 100%;
    height: 2px;
    background: #00a0e9;
    transition: all 0.3s;
}

.login-form {
    flex: 1;
}

.captcha-item {
    display: flex;
    gap: 12px;
}

.captcha-item :deep(.el-input) {
    flex: 1;
}



/* 表单选项 */
.form-options {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;
}

/* 二维码登录 */
.qr-login-container {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
}

.qr-code {
    text-align: center;
}

.qr-placeholder {
    width: 200px;
    height: 200px;
    border: 2px dashed #ddd;
    border-radius: 8px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #999;
}

.qr-icon {
    font-size: 48px;
    margin-bottom: 16px;
}

.qr-placeholder p {
    margin: 8px 0;
    font-size: 14px;
}

.login-button {
    width: 100%;
    height: 40px;
    font-size: 16px;
    font-weight: 500;
    letter-spacing: 2px;
    background: #00a0e9;
    border-color: #00a0e9;
    border-radius: 4px;
    transition: all 0.3s;
}

.login-button:hover {
    background: #0095d9;
    border-color: #0095d9;
    transform: translateY(-1px);
}

.login-button:active {
    transform: translateY(1px);
}

.qrcode-login {
    text-align: center;
    margin: 16px 0;
}

.qrcode-login :deep(.el-button) {
    font-size: 14px;
    color: #666;
}

.qrcode-login :deep(.el-button:hover) {
    color: #00a0e9;
}

.other-login {
    margin-top: auto;
    padding-top: 24px;
}

.divider {
    text-align: center;
    margin: 20px 0;
    position: relative;
}

.divider span {
    background: #fff;
    padding: 0 16px;
    color: #999;
    font-size: 14px;
}

.divider::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    height: 1px;
    background: #eee;
}

.social-login {
    display: flex;
    justify-content: center;
    gap: 24px;
}

.social-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    cursor: pointer;
    transition: all 0.3s;
}

.social-item:hover {
    transform: translateY(-2px);
}

.social-icon {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 20px;
    margin-bottom: 8px;
    transition: all 0.3s;
}

.social-icon.wechat {
    background: #07c160;
    color: white;
}

.social-icon.qq {
    background: #12b7f5;
    color: white;
}

.social-icon.github {
    background: #333;
    color: white;
}

.social-item span {
    font-size: 12px;
    color: #666;
}

/* 底部信息 */
.footer-info {
    position: absolute;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    color: rgba(255, 255, 255, 0.7);
    font-size: 14px;
    z-index: 10;
}

.login-icons {
    display: flex;
    justify-content: center;
    gap: 32px;
}

.login-icons .el-icon {
    font-size: 22px;
    color: #666;
    cursor: pointer;
    transition: all 0.3s;
}

.login-icons .el-icon:hover {
    color: #00a0e9;
    transform: translateY(-2px);
}

:deep(.el-input__wrapper) {
    background-color: #f5f7fa;
    border-radius: 4px;
    padding: 0 15px;
    box-shadow: none;
    border: 1px solid #e4e7ed;
}

:deep(.el-input__wrapper:hover) {
    border-color: #00a0e9;
}

:deep(.el-input__wrapper.is-focus) {
    box-shadow: none;
    border-color: #00a0e9;
}

:deep(.el-input__inner) {
    height: 40px;
    font-size: 14px;
    color: #333;
}

:deep(.el-input__inner::placeholder) {
    color: #999;
}

:deep(.el-input__prefix) {
    font-size: 16px;
    color: #999;
}

:deep(.el-form-item) {
    margin-bottom: 24px;
}

:deep(.el-form-item__error) {
    padding-top: 4px;
    color: #ff4d4f;
}

/* 输入框样式增强 */
:deep(.el-input) {
    margin-bottom: 20px;
}

:deep(.el-input__wrapper:hover) {
    border-color: #c0c4cc;
}

:deep(.el-input.is-focus .el-input__wrapper) {
    box-shadow: 0 0 0 2px rgba(0, 160, 233, 0.1);
}

/* 表单项样式增强 */
:deep(.el-form-item__label) {
    color: #606266;
    font-weight: 500;
}

/* 复选框样式 */
:deep(.el-checkbox) {
    color: #666;
}

:deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
    background-color: #00a0e9;
    border-color: #00a0e9;
}

/* 链接样式 */
.forgot-password {
    color: #00a0e9;
    text-decoration: none;
    font-size: 14px;
    transition: color 0.3s;
}

.forgot-password:hover {
    color: #0056b3;
    text-decoration: underline;
}

/* 响应式布局 */
@media screen and (max-width: 1200px) {
    .main-content {
        max-width: 1000px;
        margin: 0 20px;
    }
}

@media screen and (max-width: 1024px) {
    .main-content {
        max-width: 900px;
        margin: 0 15px;
    }

    .login-left {
        padding: 30px;
    }

    .login-right {
        padding: 40px 30px;
    }
}

@media screen and (max-width: 768px) {
    .login-container {
        padding: 15px;
    }

    .main-content {
        width: 100%;
        height: auto;
        min-height: 500px;
        flex-direction: column;
        max-width: 100%;
        margin: 0;
        border-radius: 12px;
    }

    .login-left {
        width: 100%;
        padding: 25px 20px;
        min-height: 180px;
        border-radius: 12px 12px 0 0;
    }

    .login-right {
        width: 100%;
        padding: 25px 20px;
        border-radius: 0 0 12px 12px;
    }

    .title-animated {
        font-size: 1.8rem;
        margin-bottom: 0.8rem;
    }

    .subtitle {
        font-size: 0.95rem;
        margin-bottom: 1.2rem;
    }

    .feature-item {
        font-size: 0.85rem;
        padding: 8px 0;
    }

    .qr-placeholder {
        width: 160px;
        height: 160px;
    }

    .top-logo {
        padding: 15px 0;
    }

    .logo-content {
        font-size: 1.2rem;
    }
}

@media screen and (max-width: 480px) {
    .login-container {
        padding: 8px;
    }

    .main-content {
        width: 100%;
        padding: 8px;
        border-radius: 8px;
    }

    .login-left {
        padding: 20px 15px;
        border-radius: 8px 8px 0 0;
    }

    .login-right {
        padding: 20px 15px;
        border-radius: 0 0 8px 8px;
    }

    .title-animated {
        font-size: 1.5rem;
        margin-bottom: 0.6rem;
    }

    .subtitle {
        font-size: 0.85rem;
        margin-bottom: 1rem;
    }

    .feature-item {
        font-size: 0.8rem;
        padding: 6px 0;
    }

    .login-button {
        height: 44px;
        font-size: 16px;
        border-radius: 8px;
    }

    .qr-placeholder {
        width: 140px;
        height: 140px;
    }

    .qr-icon {
        font-size: 36px;
    }

    .social-login {
        gap: 12px;
        margin-top: 15px;
    }

    .social-icon {
        width: 36px;
        height: 36px;
        font-size: 16px;
    }

    .top-logo {
        padding: 10px 0;
    }

    .logo-content {
        font-size: 1rem;
    }

    .logo-icon {
        font-size: 1.2rem;
    }

    /* 优化表单输入框 */
    :deep(.el-input__wrapper) {
        padding: 12px 15px;
        font-size: 16px; /* 防止iOS缩放 */
    }

    :deep(.el-form-item) {
        margin-bottom: 20px;
    }

    .welcome-text h2 {
        font-size: 1.3rem;
        margin-bottom: 0.5rem;
    }

    .welcome-text p {
        font-size: 0.85rem;
    }
}

@media screen and (max-width: 360px) {
    .login-container {
        padding: 5px;
    }

    .main-content {
        padding: 5px;
    }

    .login-left,
    .login-right {
        padding: 15px 10px;
    }

    .title-animated {
        font-size: 1.3rem;
    }

    .feature-item {
        font-size: 0.75rem;
    }

    .login-button {
        height: 42px;
        font-size: 15px;
    }
}

/* 动画延迟 */
.feature-item:nth-child(1) { animation-delay: 0.1s; }
.feature-item:nth-child(2) { animation-delay: 0.2s; }
.feature-item:nth-child(3) { animation-delay: 0.3s; }
.feature-item:nth-child(4) { animation-delay: 0.4s; }

/* 加载状态 */
.login-button.is-loading {
    pointer-events: none;
}

/* 错误状态 */
:deep(.el-input.is-error .el-input__wrapper) {
    border-color: #f56c6c;
}

:deep(.el-input.is-error .el-input__wrapper:focus) {
    box-shadow: 0 0 0 2px rgba(245, 108, 108, 0.1);
}
</style>

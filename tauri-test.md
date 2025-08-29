# Tauri 文件拖拽功能测试指南

## 已完成的配置

### 1. Tauri 环境配置
- ✅ 安装 @tauri-apps/cli
- ✅ 安装 @tauri-apps/api
- ✅ 初始化 Tauri 项目配置
- ✅ 配置正确的开发服务器端口 (5173)
- ✅ 启用文件拖拽功能 (`fileDropEnabled: true`)

### 2. 前端代码适配
- ✅ 添加 Tauri 环境检测
- ✅ 实现 Tauri 文件拖拽事件监听
- ✅ 兼容浏览器和 Tauri 两种环境
- ✅ 添加文件类型检测和路径处理

## 测试步骤

### 在浏览器中测试
```bash
pnpm dev
```
访问 http://localhost:5173，测试网页版拖拽功能

### 在 Tauri 应用中测试
```bash
pnpm tauri:dev
```
这将启动 Tauri 桌面应用，测试原生拖拽功能

### 构建 Tauri 应用
```bash
pnpm tauri:build
```
构建生产版本的桌面应用

## 功能特性

### 浏览器环境
- 支持文件和文件夹拖拽
- 使用 WebKit Entry API 处理文件夹结构
- 保持完整的文件路径信息

### Tauri 环境
- 支持系统级文件拖拽
- 使用 Tauri 的文件系统 API
- 自动处理文件元数据和 MIME 类型
- 更好的性能和安全性

## 故障排除

如果遇到拖拽功能问题：
1. 确认 Tauri 配置中 `fileDropEnabled` 为 `true`
2. 检查浏览器控制台是否有错误信息
3. 确认 Rust 环境已正确安装
4. 验证 @tauri-apps/api 依赖已正确安装
# 部署配置说明

## 生产环境后端连接配置

### 问题描述
在开发环境中，前端通过Vite代理连接后端服务器。但在打包后的应用中，代理不再可用，需要直接连接后端服务器。

### 解决方案

#### 1. 环境变量配置
项目已配置环境变量来处理不同环境下的后端连接：

- **开发环境**: 使用 `.env` 文件
- **生产环境**: 使用 `.env.production` 文件

#### 2. 配置文件说明

**`.env.production`** (生产环境配置):
```env
# API服务器地址
VITE_API_BASE_URL=http://localhost:8089

# WebSocket服务器地址
VITE_WEBSOCKET_URL=ws://localhost:8089/ws/upload-progress
```

#### 3. 部署前配置步骤

1. **修改生产环境配置**
   根据实际部署情况修改 `.env.production` 文件：
   
   ```bash
   # 如果后端部署在同一台机器
   VITE_API_BASE_URL=http://localhost:8089
   VITE_WEBSOCKET_URL=ws://localhost:8089/ws/upload-progress
   
   # 如果后端部署在其他机器
   VITE_API_BASE_URL=http://192.168.1.100:8089
   VITE_WEBSOCKET_URL=ws://192.168.1.100:8089/ws/upload-progress
   
   # 如果使用域名
   VITE_API_BASE_URL=https://api.yourdomain.com
   VITE_WEBSOCKET_URL=wss://api.yourdomain.com/ws/upload-progress
   ```

2. **构建应用**
   ```bash
   pnpm build
   ```

3. **打包Tauri应用**
   ```bash
   pnpm tauri build
   ```

#### 4. Tauri配置说明

项目已在 `tauri.conf.json` 中添加了必要的网络权限：

```json
{
  "app": {
    "security": {
      "csp": null,
      "dangerousDisableAssetCspModification": true
    }
  },
  "plugins": {
    "http": {
      "all": true,
      "request": true,
      "scope": ["http://**", "https://**"]
    }
  }
}
```

#### 5. 网络要求

- 确保防火墙允许访问后端服务器端口（默认8089）
- 如果使用HTTPS，确保SSL证书配置正确
- WebSocket连接需要与API服务器使用相同的协议（HTTP对应WS，HTTPS对应WSS）

#### 6. 故障排除

**常见问题**:

1. **连接被拒绝**
   - 检查后端服务器是否正在运行
   - 验证IP地址和端口是否正确
   - 确认防火墙设置

2. **WebSocket连接失败**
   - 确保WebSocket URL与API URL使用相同的主机和端口
   - 检查后端是否支持WebSocket连接

3. **CORS错误**
   - 确保后端服务器配置了正确的CORS策略
   - 允许来自Tauri应用的请求

**调试方法**:

1. 打开开发者工具查看网络请求
2. 检查控制台错误信息
3. 验证环境变量是否正确加载

#### 7. 示例配置

**本地部署**:
```env
VITE_API_BASE_URL=http://localhost:8089
VITE_WEBSOCKET_URL=ws://localhost:8089/ws/upload-progress
```

**局域网部署**:
```env
VITE_API_BASE_URL=http://192.168.1.100:8089
VITE_WEBSOCKET_URL=ws://192.168.1.100:8089/ws/upload-progress
```

**云服务器部署**:
```env
VITE_API_BASE_URL=https://api.example.com
VITE_WEBSOCKET_URL=wss://api.example.com/ws/upload-progress
```

### 注意事项

1. 修改配置后需要重新构建和打包应用
2. 确保后端服务器在目标环境中可访问
3. 生产环境建议使用HTTPS/WSS协议
4. 定期检查和更新安全配置
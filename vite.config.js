/*
 * @Author: FirstsnowLucky firstsnow1119@163.com
 * @Date: 2025-08-19 23:18:54
 * @LastEditors: FirstsnowLucky firstsnow1119@163.com
 * @LastEditTime: 2025-08-25 15:33:02
 * @FilePath: \vue-file\vite.config.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import vue from '@vitejs/plugin-vue'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {

  const getWebSocketUrl = () => {
    if (mode === 'development') {
      return 'ws://127.0.0.1:8089/ws/upload-progress';
    }

    return 'ws://127.0.0.1:8089/ws/upload-progress';
  };
  return {
    plugins: [
      vue(),
      AutoImport({
        resolvers: [ElementPlusResolver()],
      }),
      Components({
        resolvers: [ElementPlusResolver()],
      }),
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url))
      },
    },
    define: {
      __WEBSOCKET_URL__: JSON.stringify(getWebSocketUrl()),
      __DEV_MODE__: JSON.stringify(mode === 'development')
    },
    envPrefix: ['VITE_'],
    server: {
      port: 17079,
      host: '0.0.0.0',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:8089',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, '')
        }
      }
    }
  };
});

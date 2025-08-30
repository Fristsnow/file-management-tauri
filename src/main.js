/*
 * @Author: FirstsnowLucky firstsnow1119@163.com
 * @Date: 2025-08-19 23:18:54
 * @LastEditors: FirstsnowLucky firstsnow1119@163.com
 * @LastEditTime: 2025-08-25 22:02:06
 * @FilePath: \vue-file\src\main.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import {createApp} from 'vue'
import App from './App.vue'
import './assets/style/main.css'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import ElementPlusLocaleZhCn from 'element-plus/es/locale/lang/zh-cn'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import router from "@/router/index.js";
import VueVirtualScroller from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'

const app = createApp(App)

// 创建pinia实例并配置持久化
const pinia = createPinia()
pinia.use(createPersistedState())

app.use(VueVirtualScroller)

for (const [key, component] of Object.entries(ElementPlusIconsVue)) {
    app.component(key, component)
}

// document.addEventListener('DOMContentLoaded', () => {
//     document.addEventListener('contextmenu', (e) => {
//         e.preventDefault();
//         return false;
//     });
// });

app.use(pinia)
app.use(router)
app.use(ElementPlus, {
    locale: ElementPlusLocaleZhCn,
});

app.mount('#app');
// {
//     "id": 1,
//     "fileName": "大型化工机械设备全生命周期管理软件.txt",
//     "result": 1,
//     "userId": 4,
//     "projectId": 1,
//     "deptId": null,
//     "createTime": "2025-08-28T03:31:52.000+00:00"
// },
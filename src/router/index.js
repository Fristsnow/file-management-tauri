/*
 * @Author: Lucky-Firstsnow firstsnow1119@163.com
 * @Date: 2025-03-06 17:02:22
 * @LastEditors: FirstsnowLucky firstsnow1119@163.com
 * @LastEditTime: 2025-04-17 14:53:05
 * @FilePath: \demo\src\router\index.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import {createRouter, createWebHistory} from 'vue-router'
import { useUserStore } from '@/stores/userStore'

const routes = [
    {
        path: '',
        component: () => import('@/layout/Layout.vue'),
        children: [
            {
                path: '',
                component: () => import('@/views/FileManager.vue'),
                name: 'FileManager',
            },
            {
                path: '/profile',
                component: () => import('@/views/UserProfile.vue'),
                name: 'UserProfile',
            },
            {
                path: '/settings',
                component: () => import('@/views/Settings.vue'),
                name: 'Settings',
            },
            {
                path: '/upload-log',
                component: () => import('@/views/UploadLog.vue'),
                name: 'UploadLog',
            }
        ]
    },
    {
        path: '/login',
        name: 'login',
        component: () => import('@/views/Login.vue'),
    },
    {
        path: '/:pathMatch(.*)*',
        name: 'NotFound',
        component: () => import('@/views/404.vue'),
    },
]

const router = createRouter({
    history: createWebHistory(import.meta.env.BASE_URL),
    routes // 路由配置
})

// 路由守卫
router.beforeEach((to, from, next) => {
    const userStore = useUserStore()
    
    // 检查是否有token
    const token = localStorage.getItem('token') || userStore.token
    
    // 如果要去登录页面，直接放行
    if (to.path === '/login') {
        // 如果已经登录了，重定向到首页
        if (token) {
            next('/')
        } else {
            next()
        }
        return
    }
    
    // 如果没有token，重定向到登录页
    if (!token) {
        next('/login')
        return
    }
    
    // 有token，正常访问
    next()
})

export default router

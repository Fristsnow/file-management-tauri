import request, { upload } from '@/utils/request.js';

export const loginApi = (data) => {
    return request({
        method: 'POST',
        url: '/login',
        data: data
    });
}

// 获取用户信息
export const getUserInfoApi = () => {
    return request({
        method: 'POST',
        url: '/sysUser/getUserInfo'
    });
}

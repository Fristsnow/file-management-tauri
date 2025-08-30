import request from "@/utils/request.js";

/**
 * 查询所有当前用户的上传日志
 * @param {Object} params - 查询参数
 * @param {number} params.pageNum - 页码，默认1
 * @param {number} params.pageSize - 每页大小，默认10
 * @param {number} [params.result] - 上传结果筛选：1成功 0失败
 * @param {string} [params.fileName] - 文件名筛选
 * @param {string} [params.startTime] - 开始时间
 * @param {string} [params.endTime] - 结束时间
 * @returns {Promise<*>}
 */
export const getAllDoingUserApi = async (params = {}) => {
    const { pageNum = 1, pageSize = 10 } = params
    return request({
        method: 'POST',
        url: `/sysOperationUploadLog/uploadLogList`,
        data: {
            pageNum,
            pageSize
        }
    })
}
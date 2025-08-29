use std::path::{PathBuf};
use tauri::command;
use serde::{Deserialize, Serialize};
use tokio::fs;
use reqwest;
use walkdir::WalkDir;


#[derive(Debug, Serialize, Deserialize)]
struct DownloadPathInfo {
    path: String,
    exists: bool,
    writable: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct SystemPaths {
    desktop: Option<String>,
    downloads: Option<String>,
    documents: Option<String>,
    pictures: Option<String>,
    home: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct DownloadResult {
    success: bool,
    message: String,
    file_path: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FileInfo {
    pub path: String,                     // 文件绝对路径
    pub name: String,                     // 文件名
    pub relative_path: String,            // 相对于选择目录的相对路径
    pub is_empty_folder_placeholder: bool // 是否是空文件夹占位
}


#[derive(Debug, Serialize, Deserialize)]
struct FolderScanResult {
    success: bool,
    message: String,
    files: Vec<FileInfo>,
    total_files: usize,
    total_folders: usize,
    empty_folders: usize,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct UploadConfig {
    base_url: String,
    bucket_name: String,
    token: Option<String>,
    target_path: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ScanResult {
    pub success: bool,
    pub message: String,
    pub files: Vec<FileInfo>,
}
#[derive(Debug, Serialize, Deserialize)]
struct UploadResult {
    success: bool,
    message: String,
    uploaded_files: usize,
    failed_files: Vec<String>,
}

/// 验证下载路径是否有效
#[command]
async fn validate_download_path(path: String) -> Result<DownloadPathInfo, String> {
    let path_buf = PathBuf::from(&path);
    
    let exists = path_buf.exists();
    let writable = if exists {
        // 检查是否可写
        match std::fs::metadata(&path_buf) {
            Ok(metadata) => !metadata.permissions().readonly(),
            Err(_) => false,
        }
    } else {
        // 尝试创建目录来检查是否可写
        match std::fs::create_dir_all(&path_buf) {
            Ok(_) => true,
            Err(_) => false,
        }
    };
    
    Ok(DownloadPathInfo {
        path,
        exists,
        writable,
    })
}

/// 获取系统默认路径
#[command]
async fn get_system_paths() -> Result<SystemPaths, String> {
    let mut paths = SystemPaths {
        desktop: None,
        downloads: None,
        documents: None,
        pictures: None,
        home: None,
    };
    
    // 获取各种系统路径
    if let Some(desktop) = dirs::desktop_dir() {
        paths.desktop = desktop.to_str().map(|s| s.to_string());
    }
    
    if let Some(downloads) = dirs::download_dir() {
        paths.downloads = downloads.to_str().map(|s| s.to_string());
    }
    
    if let Some(documents) = dirs::document_dir() {
        paths.documents = documents.to_str().map(|s| s.to_string());
    }
    
    if let Some(pictures) = dirs::picture_dir() {
        paths.pictures = pictures.to_str().map(|s| s.to_string());
    }
    
    if let Some(home) = dirs::home_dir() {
        paths.home = home.to_str().map(|s| s.to_string());
    }
    
    Ok(paths)
}

/// 确保下载目录存在
#[command]
async fn ensure_download_directory(path: String) -> Result<bool, String> {
    let path_buf = PathBuf::from(&path);
    
    if path_buf.exists() {
        return Ok(true);
    }
    
    match std::fs::create_dir_all(&path_buf) {
        Ok(_) => Ok(true),
        Err(e) => Err(format!("创建目录失败: {}", e)),
    }
}

/// 异步下载文件到指定路径
#[command]
async fn download_file_async(
    base_url: String,
    bucket_name: String,
    object_name: String,
    file_id: Option<String>,
    id: Option<String>,
    file_path: Option<String>,
    file_name: String,
    token: Option<String>,
) -> Result<DownloadResult, String> {
    let download_task = tokio::spawn(async move {
        // 辅助函数：获取默认下载路径
        fn get_default_download_path() -> String {
            match dirs::download_dir() {
                Some(dir) => dir.to_string_lossy().to_string(),
                None => {
                    match dirs::desktop_dir() {
                        Some(dir) => dir.to_string_lossy().to_string(),
                        None => ".".to_string(), // 最后回退到当前目录
                    }
                }
            }
        }

        println!("接收到的 file_path 参数: {:?}", file_path);

        // 确定下载目录或完整路径
        let raw_path = match file_path {
            Some(ref path) if !path.trim().is_empty() => {
                path.trim().trim_matches('"').trim_matches('\'').to_string()
            }
            _ => get_default_download_path(),
        };

        println!("清理后的路径: '{}'", raw_path);

        let mut full_path = PathBuf::from(&raw_path);

        // 判断是目录还是完整文件路径
        // 如果路径没有扩展名，或者已经存在且是目录，则当作目录处理
        let treat_as_dir = full_path.extension().is_none() 
            || (full_path.exists() && full_path.is_dir());
        
        println!("路径判断: 扩展名={:?}, 存在={}, 是目录={}, 当作目录处理={}", 
                full_path.extension(), full_path.exists(), 
                full_path.exists() && full_path.is_dir(), treat_as_dir);

        if treat_as_dir {
            // 如果是目录，拼接文件名
            full_path = full_path.join(&file_name);
        }

        println!("最终写入路径: {:?}", full_path);

        // 确保父目录存在
        if let Some(parent) = full_path.parent() {
            if let Err(e) = fs::create_dir_all(parent).await {
                return DownloadResult {
                    success: false,
                    message: format!("创建目录失败: {}", e),
                    file_path: None,
                };
            }
        }

        // 构建请求数据
        let mut request_data = serde_json::json!({
            "bucketName": bucket_name,
            "objectName": object_name
        });

        if let Some(fid) = file_id {
            request_data["fileId"] = serde_json::Value::String(fid);
        }

        if let Some(i) = id {
            request_data["id"] = serde_json::Value::String(i);
        }

        let client = reqwest::Client::new();
        let download_url = format!("{}/file/download", base_url.trim_end_matches('/'));

        // 构建请求，添加认证header
        let mut request_builder = client.post(&download_url).json(&request_data);
        
        // 如果有token，添加Authorization header
        if let Some(auth_token) = token {
            println!("添加认证token: {}", auth_token);
            request_builder = request_builder.header("Authorization", auth_token);
        }

        let response = match request_builder.send().await {
            Ok(resp) => resp,
            Err(e) => {
                return DownloadResult {
                    success: false,
                    message: format!("请求失败: {}", e),
                    file_path: None,
                };
            }
        };

        if !response.status().is_success() {
            return DownloadResult {
                success: false,
                message: format!("HTTP错误: {}", response.status()),
                file_path: None,
            };
        }

        let bytes = match response.bytes().await {
            Ok(bytes) => bytes,
            Err(e) => {
                return DownloadResult {
                    success: false,
                    message: format!("读取响应失败: {}", e),
                    file_path: None,
                };
            }
        };

        match fs::write(&full_path, &bytes).await {
            Ok(_) => {
                println!("文件写入成功: {:?}", full_path);
                DownloadResult {
                    success: true,
                    message: "下载成功".to_string(),
                    file_path: Some(full_path.to_string_lossy().to_string()),
                }
            }
            Err(e) => {
                println!("文件写入失败: {:?}, 错误: {}", full_path, e);
                DownloadResult {
                    success: false,
                    message: format!("写入文件失败: {}", e),
                    file_path: None,
                }
            }
        }
    });

    match download_task.await {
        Ok(result) => Ok(result),
        Err(e) => Err(format!("下载任务失败: {}", e)),
    }
}


/// 扫描文件夹结构，生成相对路径（空文件夹放 .folder_placeholder）
#[tauri::command]
async fn scan_folder_structure(folder_path: String) -> Result<ScanResult, String> {
    let mut files = Vec::new();
    let base = PathBuf::from(&folder_path);

    if !base.exists() {
        return Ok(ScanResult {
            success: false,
            message: format!("文件夹不存在: {}", folder_path),
            files,
        });
    }

    // 获取选择文件夹的名称
    let folder_name = base.file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("unknown");
    
    println!("[DEBUG] 扫描文件夹: {}, 文件夹名称: {}", folder_path, folder_name);

    for entry in WalkDir::new(&base).into_iter().filter_map(|e| e.ok()) {
        let path = entry.path();

        if path.is_file() {
            let relative = path.strip_prefix(&base).unwrap_or(path);
            let inner_relative_path = relative.to_string_lossy().replace("\\", "/");
            // 包含文件夹名称的完整相对路径
            let relative_path = if inner_relative_path.is_empty() {
                folder_name.to_string()
            } else {
                format!("{}/{}", folder_name, inner_relative_path)
            };

            println!("[DEBUG] 文件: {} -> relative_path: {}", path.display(), relative_path);

            files.push(FileInfo {
                path: path.to_string_lossy().to_string(),
                name: path.file_name().unwrap().to_string_lossy().to_string(),
                relative_path,
                is_empty_folder_placeholder: false,
            });
        } else if path.is_dir() && path != base {
            // 检查目录是否为空
            let mut dir = fs::read_dir(path).await.map_err(|e| e.to_string())?;
            if dir.next_entry().await.map_err(|e| e.to_string())?.is_none() {
                let relative = path.strip_prefix(&base).unwrap_or(path);
                let inner_relative_path = relative.to_string_lossy().replace("\\", "/");
                // 包含文件夹名称的完整相对路径
                let relative_path = if inner_relative_path.is_empty() {
                    folder_name.to_string()
                } else {
                    format!("{}/{}", folder_name, inner_relative_path)
                };

                // 在本地真实生成一个占位文件，避免上传丢失
                let placeholder_path = path.join(".folder_placeholder");
                if !placeholder_path.exists() {
                    if let Err(e) = fs::write(&placeholder_path, b"").await {
                        eprintln!("创建占位文件失败: {}", e);
                    }
                }

                println!("[DEBUG] 空文件夹: {} -> relative_path: {}", path.display(), relative_path);

                files.push(FileInfo {
                    path: placeholder_path.to_string_lossy().to_string(),
                    name: ".folder_placeholder".to_string(),
                    relative_path: format!("{}/.folder_placeholder", relative_path),
                    is_empty_folder_placeholder: true,
                });
            }
        }
    }

    Ok(ScanResult {
        success: true,
        message: "扫描完成".to_string(),
        files,
    })
}

/// 上传文件夹结构（包含空文件夹）
#[tauri::command]
async fn upload_folder_with_structure(
    folder_path: String,
    config: UploadConfig,
) -> Result<UploadResult, String> {
    println!("[DEBUG] 开始上传文件夹: {}", folder_path);
    println!("[DEBUG] 配置信息: {:?}", config);

    let scan_result = scan_folder_structure(folder_path.clone()).await?;
    if !scan_result.success {
        return Err(scan_result.message);
    }
    println!("[DEBUG] 扫描到 {} 个文件", scan_result.files.len());

    let client = reqwest::Client::new();
    let upload_url = format!("{}/file/upload/folder", config.base_url);
    println!("[DEBUG] 上传URL: {}", upload_url);

    let mut form = reqwest::multipart::Form::new()
        .text("bucketName", config.bucket_name.clone());

    for file_info in &scan_result.files {
        let file_bytes = match fs::read(&file_info.path).await {
            Ok(bytes) => {
                println!("[DEBUG] 读取文件 {} 成功，大小: {} 字节", file_info.name, bytes.len());
                bytes
            },
            Err(e) => {
                println!("[DEBUG] 读取文件 {} 失败: {}，使用空字节", file_info.name, e);
                Vec::new() // 对于占位文件或读取失败的文件，使用空字节
            }
        };

        // 确保即使是空文件也能正常上传
        form = form.part(
            "files",
            reqwest::multipart::Part::bytes(file_bytes)
                .file_name(file_info.name.clone())
                .mime_str("application/octet-stream")
                .map_err(|e| format!("MIME 设置失败: {}", e))?,
        );

        println!("[DEBUG] 添加文件到表单: {}", file_info.name);

        // 现在 relative_path 已经包含了文件夹名称，直接使用即可
        let object_name = if config.target_path.is_empty() || config.target_path == "/" {
            file_info.relative_path.clone()
        } else {
            let clean_target_path = config.target_path.trim_start_matches('/').trim_end_matches('/');
            format!("{}/{}", clean_target_path, file_info.relative_path)
        };

        println!("[DEBUG] 文件: {} -> objectName: {}", file_info.name, object_name);
        form = form.text("objectNames", object_name);
        form = form.text("originalFileNames", file_info.name.clone());
    }

    let mut request = client.post(&upload_url).multipart(form);
    if let Some(token) = &config.token {
        request = request.header("Authorization", token);
    }

    let response = request.send().await.map_err(|e| format!("网络请求失败: {}", e))?;

    if !response.status().is_success() {
        let status = response.status();
        let error_text = response.text().await.unwrap_or_else(|_| "未知错误".to_string());
        return Err(format!("上传失败 ({}): {}", status, error_text));
    }

    let uploaded: Vec<String> = response
        .json()
        .await
        .map_err(|e| format!("解析响应失败: {}", e))?;

    Ok(UploadResult {
        success: true,
        message: format!("文件夹上传完成，共上传 {} 个文件", uploaded.len()),
        uploaded_files: uploaded.len(),
        failed_files: vec![],
    })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .invoke_handler(tauri::generate_handler![
        validate_download_path,
        get_system_paths,
        ensure_download_directory,
        download_file_async,
        scan_folder_structure,
        upload_folder_with_structure
    ])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

/**
 * 高德地图配置文件模板 (Template)
 * 本地开发：请复制一份为 config.js，并填入您的高德地图 Key 与安全密钥
 * 云端部署 (Cloudflare Pages)：无需提交 config.js，通过环境变量 AMAP_KEY 和 AMAP_SECURITY_CODE 自动注入生成
 */
window.BUS_MAP_CONFIG = {
  // 高德 Web 端 Key（在开放平台应用管理中创建，选择“Web端(JS API)”类型）
  amapKey: 'YOUR_AMAP_KEY_HERE',

  // 高德 Web 端安全密钥（Security Secret）
  securityJsCode: 'YOUR_SECURITY_JS_CODE_HERE',

  // 地图初始中心坐标（北京天安门/市中心）
  defaultCenter: [116.397451, 39.909187],

  // 初始缩放级别
  defaultZoom: 11,

  // 默认地图样式：'amap://styles/dark' (科技暗夜) 或 'amap://styles/normal' (标准清新)
  mapStyle: 'amap://styles/dark'
};

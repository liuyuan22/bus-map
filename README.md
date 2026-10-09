# 🚌 北京公交线路地图 (Beijing Bus Map)

> 🌐 **在线演示 (Live Demo)**：[https://bus-map.pages.dev](https://bus-map.pages.dev)

基于高德地图 WebGL 硬件加速与北京公交车头仿真 LED 电子路牌的全量公交路线可视化系统。

收录北京市 **3,555 条公交线路**（包含常规干线、快速直达专线、BRT快速公交、微循环专字头、夜班车及各郊区支线），提供实时搜索、多线并发上图、双环互联、沿途站点避让渲染与高精轨迹对齐展示。

---

## ✨ 核心特性

- **🚀 100% GPU WebGL 硬件加速**：
  沿途站点采用高德地图原生的 `AMap.LabelsLayer` + `AMap.LabelMarker` 光栅化渲染，DOM Marker 数量降为 0，启用智能碰撞避让（Collision），无论多条环线重叠平移缩放均稳稳 60FPS。
- **📟 经典北京公交车头 LED 仿真路牌**：
  双列始发站/终到站自然排版，中间醒目红色点阵路号，超长路号（如 快速直达专线168路）支持仿真左右循环走字（LED Marquee）。
- **⚡️ 高性能虚拟滚动列表**：
  左侧线路列表内置原生虚拟滚动，即使包含近 400 条专字头路线，DOM 节点恒定保持在 8~12 个，杜绝掉帧与内存泄漏。
- **📦 极速数据分发**：
  近 100MB 的全量高精线路数据紧凑压缩为 **10MB Gzip 格式**，结合现代浏览器原生 `DecompressionStream('gzip')` 毫秒级流式解压，首屏瞬开。
- **🌓 视觉风格**：
  默认科技暗夜底图（深色高对比），支持一键无缝切换标准清新高德底图。

---

## 🛠️ 本地运行

1. 克隆代码库：
   ```bash
   git clone https://github.com/liuyuan22/bus-map.git
   cd bus-map
   ```
2. 配置高德地图 Key：
   复制配置文件模板并填入您的高德 Web 端 JS API Key 与安全密钥：
   ```bash
   cp config.example.js config.js
   ```
   编辑 `config.js`：
   ```javascript
   window.BUS_MAP_CONFIG = {
     amapKey: '您的高德Web端Key',
     securityJsCode: '您的安全密钥',
     defaultCenter: [116.397451, 39.909187],
     defaultZoom: 11,
     mapStyle: 'amap://styles/dark'
   };
   ```
3. 启动本地静态服务器：
   ```bash
   # Python 3
   python3 -m http.server 8080
   # 或使用任何静态服务器
   npx serve .
   ```
4. 访问 `http://localhost:8080` 即可体验。

---

## ☁️ 部署到 Cloudflare Pages

本项目为纯静态单页应用，天然完美支持 Cloudflare Pages、Vercel 等静态托管平台。

### 本地一键打包发布 (推荐，超快速)：
如果您在本地已通过 `npx wrangler login` 授权，日常修改代码后只需在终端执行一行命令：
```bash
npm run deploy
```
系统会自动执行构建打包（提取纯净静态资源与 Gzip 数据），并在数秒内全自动同步发布至 Cloudflare Pages 线上生产环境！

### 通过 GitHub 自动构建部署：
1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，进入 **Workers & Pages** -> **Create application** -> **Pages** -> **Connect to Git**；
2. 选择本仓库 `bus-map`；
3. **构建设置 (Build configuration)**：
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `/` (或者留空，即根目录)
4. **环境变量 (Environment variables)**：
   在构建设置的“Environment variables”中添加以下两个变量：
   - `AMAP_KEY`: 您的高德地图 Web 端 JS API Key
   - `AMAP_SECURITY_CODE`: 您的高德地图安全密钥（Security Secret）
5. 点击 **Save and Deploy**，Cloudflare Pages 会在几秒内自动完成构建并分发全球 CDN 域名（如 `https://bus-map-xxx.pages.dev`）！
6. **高德开放平台白名单设置**：
   前往高德地图控制台 -> 应用管理，为该 Key 添加“域名白名单”，填入 `*.pages.dev`（或您的自定义域名），确保公网地图正常加载。

---

## 📄 开源协议

本项目采用 [MIT](LICENSE) 协议开源。

/**
 * 高德地图管理模块
 * 负责高德 JS API 2.0 的动态加载、底图初始化、折线与站点绘制、Hover/Click 交互
 */

class MapManager {
  constructor() {
    this.map = null;
    this.isLoaded = false;
    this.currentTheme = 'dark'; // 'dark' 或 'normal'
    this.showStopsEnabled = true; // 全局站点显示开关，默认开启
    
    // 常驻显示的线路折线与站点集合：{ [routeId]: { polyline, markers: [], color } }
    this.activeRouteOverlays = new Map();
    
    // 鼠标悬停时的临时高亮折线与临时标记
    this.hoverPolyline = null;
    this.hoverMarkers = [];
    this.infoWindow = null;
    
    // 经典高辨识度路线双主题配色盘
    // 1. 深色模式（夜光科技荧光盘）
    this.paletteDark = [
      '#10B981', // 翡翠绿
      '#3B82F6', // 科技蓝
      '#8B5CF6', // 活力紫
      '#EC4899', // 霓虹粉
      '#06B6D4', // 青碧
      '#F59E0B', // 琥珀黄
      '#14B8A6', // 松石绿
      '#6366F1', // 靛蓝
      '#EF4444', // 珊瑚红
      '#84CC16'  // 嫩青
    ];

    // 2. 标准浅色模式（专业高质感 Transit 交通盘，高对比度深邃纯正色）
    this.paletteLight = [
      '#0052D9', // 皇室深蓝
      '#D9363E', // 经典公交正红
      '#008858', // 墨翠深绿
      '#722ED1', // 典雅深紫
      '#D46B08', // 赤岩暖橙
      '#08979C', // 孔雀深青
      '#1D39C4', // 浓郁群青
      '#C41D7F', // 品红紫罗兰
      '#873800', // 熟褐铜红
      '#135200'  // 深森绿
    ];
    this.colorIndex = 0;
  }

  /**
   * 获取当前主题对应的调色盘
   */
  getPalette() {
    return this.currentTheme === 'dark' ? this.paletteDark : this.paletteLight;
  }

  /**
   * 获取当前主题对应的折线外描边颜色
   * 深色模式为暗黑背景衬托 (#0a0d14)，浅色模式为纯白晶透立体描边 (#FFFFFF)
   */
  getOutlineColor() {
    return this.currentTheme === 'dark' ? '#0a0d14' : '#FFFFFF';
  }

  /**
   * 获取当前主题对应的外描边宽度
   */
  getOutlineWeight() {
    return this.currentTheme === 'dark' ? 1 : 1.5;
  }

  /**
   * 获取当前主题对应的折线不透明度
   */
  getLineOpacity(isPermanent) {
    if (this.currentTheme === 'dark') {
      return isPermanent ? 0.92 : 0.78;
    } else {
      return isPermanent ? 0.95 : 0.85;
    }
  }

  /**
   * 获取有效的 Key 和 Secret（优先从 localStorage 取，其次从 config.js 取）
   */
  getCredentials() {
    const localKey = localStorage.getItem('amap_key');
    const localSecret = localStorage.getItem('amap_secret');
    const config = window.BUS_MAP_CONFIG || {};

    return {
      key: localKey || config.amapKey || '',
      secret: localSecret || config.securityJsCode || ''
    };
  }

  /**
   * 保存 Key 和 Secret
   */
  saveCredentials(key, secret) {
    if (key) localStorage.setItem('amap_key', key.trim());
    if (secret) localStorage.setItem('amap_secret', secret.trim());
  }

  /**
   * 异步加载高德地图 JS API 2.0
   */
  loadAMapScript() {
    return new Promise((resolve, reject) => {
      if (window.AMap) {
        resolve(window.AMap);
        return;
      }

      const { key, secret } = this.getCredentials();
      if (!key) {
        reject(new Error('NO_KEY'));
        return;
      }

      // 设置高德安全密钥
      window._AMapSecurityConfig = {
        securityJsCode: secret
      };

      const script = document.createElement('script');
      script.type = 'text/javascript';
      script.src = `https://webapi.amap.com/maps?v=2.0&key=${key}`;
      script.async = true;

      script.onload = () => {
        if (window.AMap) {
          resolve(window.AMap);
        } else {
          reject(new Error('AMap script loaded but window.AMap is undefined'));
        }
      };

      script.onerror = (err) => {
        reject(new Error('高德地图脚本加载失败，请检查网络或 Key 权限'));
      };

      document.head.appendChild(script);
    });
  }

  /**
   * 初始化地图实例
   */
  async init(containerId = 'amap-container') {
    try {
      await this.loadAMapScript();

      const config = window.BUS_MAP_CONFIG || {};
      const center = config.defaultCenter || [116.397451, 39.909187];
      const zoom = config.defaultZoom || 11;
      this.currentTheme = config.mapStyle && config.mapStyle.includes('normal') ? 'normal' : 'dark';

      this.map = new AMap.Map(containerId, {
        zoom: zoom,
        center: center,
        mapStyle: this.currentTheme === 'dark' ? 'amap://styles/dark' : 'amap://styles/normal',
        viewMode: '2D',
        showBuildingBlock: true,
        features: ['bg', 'road', 'building', 'point']
      });

      // 初始化 WebGL 硬件加速站点标注图层（高性能 GPU 渲染 + 原生文字智能碰撞避让）
      this.labelsLayer = new AMap.LabelsLayer({
        zooms: [3, 20],
        zIndex: 1000,
        collision: true,
        animation: false
      });
      this.map.add(this.labelsLayer);

      this.infoWindow = new AMap.InfoWindow({
        offset: new AMap.Pixel(0, -20),
        closeWhenClickMap: true
      });

      this.isLoaded = true;

      // 若已有选中的线路（如默认全量展示），地图初始化完成后自动补绘
      if (window.busApp && window.busApp.selectedRouteIds && window.busApp.selectedRouteIds.size > 0) {
        const toShow = window.busApp.allRoutes.filter(r => window.busApp.selectedRouteIds.has(r.id));
        this.showAllRoutes(toShow);
      }

      return true;
    } catch (err) {
      console.warn('地图初始化暂缓:', err.message);
      this.isLoaded = false;
      return false;
    }
  }

  /**
   * 切换底图主题（暗夜 / 清新标准）并动态刷新已绘折线配色
   */
  toggleTheme() {
    if (!this.map) return;
    this.currentTheme = this.currentTheme === 'dark' ? 'normal' : 'dark';
    const style = this.currentTheme === 'dark' ? 'amap://styles/dark' : 'amap://styles/normal';
    this.map.setMapStyle(style);

    // 动态同步更新当前地图上所有已绘制折线与站点的主题配色
    this.updateAllOverlaysTheme();
  }

  /**
   * 动态刷新所有已上图线路的描边与颜色以适配当前明暗主题
   */
  updateAllOverlaysTheme() {
    const palette = this.getPalette();
    const outlineColor = this.getOutlineColor();
    const borderWeight = this.getOutlineWeight();
    const isDark = this.currentTheme === 'dark';
    const themeClass = isDark ? 'theme-dark' : 'theme-light';

    this.activeRouteOverlays.forEach((overlay) => {
      const newColor = palette[overlay.colorIndex % palette.length];
      overlay.color = newColor;

      if (overlay.polyline) {
        overlay.polyline.setOptions({
          strokeColor: newColor,
          outlineColor: outlineColor,
          borderWeight: borderWeight,
          strokeOpacity: this.getLineOpacity(overlay.isPermanent)
        });
      }

      if (overlay.markers && overlay.markers.length > 0 && overlay.route) {
        if (this.labelsLayer) {
          this.labelsLayer.remove(overlay.markers);
        }
        overlay.markers = this.createStopMarkers(overlay.route, newColor);
        if (this.labelsLayer && this.showStopsEnabled) {
          this.labelsLayer.add(overlay.markers);
        }
      }
    });

    // 如果当前处于 Hover 临时高亮中，更新 Hover 线的描边与高亮色
    if (this.hoverPolyline) {
      const hoverStroke = isDark ? '#FF6B00' : '#E11D48';
      this.hoverPolyline.setOptions({
        strokeColor: hoverStroke,
        outlineColor: '#FFFFFF',
        borderWeight: isDark ? 2 : 2.5
      });
    }
  }

  /**
   * 鼠标悬停 (Hover)：临时高亮某条线路
   */
  highlightRoute(route) {
    if (!this.map || !window.AMap || !route || !route.path || route.path.length === 0) return;

    // 清除上一个 Hover
    this.clearHighlight();

    const isDark = this.currentTheme === 'dark';
    const strokeColor = isDark ? '#FF6B00' : '#E11D48';
    const outlineColor = '#FFFFFF';
    const borderWeight = isDark ? 2 : 2.5;

    // 创建高亮 Polyline（暗黑下橙黄发光，明亮下鲜红亮白立体描边）
    this.hoverPolyline = new AMap.Polyline({
      path: route.path,
      isOutline: true,
      outlineColor: outlineColor,
      borderWeight: borderWeight,
      strokeColor: strokeColor,
      strokeOpacity: 0.98,
      strokeWeight: 6,
      strokeStyle: 'solid',
      strokeLineJoin: 'round',
      strokeLineCap: 'round',
      zIndex: 99
    });

    this.map.add(this.hoverPolyline);

    // 绘制首末站显著标记
    if (route.stops && route.stops.length > 0) {
      const firstStop = route.stops[0];
      const lastStop = route.stops[route.stops.length - 1];

      const createStopMarker = (stop, labelText, color) => {
        return new AMap.Marker({
          position: stop.coord,
          content: `<div style="background:${color}; color:#fff; font-size:10px; font-weight:700; padding:2px 6px; border-radius:10px; border:1px solid #fff; white-space:nowrap; box-shadow:0 2px 6px rgba(0,0,0,0.4);">${labelText}: ${stop.name || ''}</div>`,
          offset: new AMap.Pixel(-10, -24),
          zIndex: 100
        });
      };

      const mStart = createStopMarker(firstStop, '起点', '#10B981');
      const mEnd = createStopMarker(lastStop, '终点', '#EF4444');
      this.hoverMarkers = [mStart, mEnd];
      this.map.add(this.hoverMarkers);
    }
  }

  /**
   * 清除鼠标悬停临时高亮
   */
  clearHighlight() {
    if (!this.map) return;
    if (this.hoverPolyline) {
      this.map.remove(this.hoverPolyline);
      this.hoverPolyline = null;
    }
    if (this.hoverMarkers.length > 0) {
      this.map.remove(this.hoverMarkers);
      this.hoverMarkers = [];
    }
  }

  /**
   * 点击切换常驻显示 (Click Toggle)
   */
  toggleRouteDisplay(route) {
    if (!this.map || !route) return false;

    if (this.activeRouteOverlays.has(route.id)) {
      this.hideRoute(route.id);
      return false; // 当前已隐藏
    } else {
      this.showRoute(route);
      return true;  // 当前已显示
    }
  }

  /**
   * 批量高效展示所有线路（默认全量展示）
   * 为保证数百上千条折线下的流畅帧率，批量模式下仅绘制平滑矢量折线，在悬停/聚焦时绘制具体站点
   */
  /**
   * 创建线路的视觉折线与透明加宽感应热区折线
   * 支持亮暗主题自适应描边与高辨识度配色，底层覆盖 26px 隐形感应带
   */
  createRouteOverlays(route, colorIndex, isPermanent = false) {
    const palette = this.getPalette();
    const color = palette[colorIndex % palette.length];
    const outlineColor = this.getOutlineColor();
    const borderWeight = this.getOutlineWeight();
    const strokeOpacity = this.getLineOpacity(isPermanent);

    // 1. 纤细精致的视觉折线 (3~5px，带纯白立体描边或暗黑阴影描边)
    const polyline = new AMap.Polyline({
      path: route.path,
      isOutline: true,
      outlineColor: outlineColor,
      borderWeight: borderWeight,
      strokeColor: color,
      strokeOpacity: strokeOpacity,
      strokeWeight: isPermanent ? 5 : 4,
      strokeStyle: 'solid',
      strokeLineJoin: 'round',
      strokeLineCap: 'round',
      cursor: 'pointer',
      zIndex: isPermanent ? 50 : 35
    });

    // 2. 透明加宽感应热区折线（26px 宽，透明度 0.002，鼠标靠近 13px 范围内自动触发）
    const hitPolyline = new AMap.Polyline({
      path: route.path,
      strokeColor: '#000000',
      strokeOpacity: 0.002, // 几乎完全透明，WebGL 拾取稳定生效
      strokeWeight: 26,     // 26px 超宽感应带
      strokeLineJoin: 'round',
      strokeLineCap: 'round',
      cursor: 'pointer',
      zIndex: 120           // 高于高亮层，保证鼠标滑过时持续稳定拾取，不产生闪烁
    });

    // 事件处理器
    const handleMouseOver = () => {
      this.highlightRoute(route);
      if (window.busApp) window.busApp.showTooltip(route);
    };

    const handleMouseOut = () => {
      this.clearHighlight();
      if (window.busApp) window.busApp.hideTooltip();
    };

    const handleClick = (e) => {
      this.showInfoWindow(route, e.lnglat);
    };

    hitPolyline.on('mouseover', handleMouseOver);
    hitPolyline.on('mouseout', handleMouseOut);
    hitPolyline.on('click', handleClick);

    polyline.on('mouseover', handleMouseOver);
    polyline.on('mouseout', handleMouseOut);
    polyline.on('click', handleClick);

    return { polyline, hitPolyline, color };
  }

  /**
   * 批量高效展示所有线路
   */
  showAllRoutes(routes) {
    if (!this.map || !window.AMap || !routes || routes.length === 0) return;

    this.clearAllActiveRoutes();

    const polylinesToAdd = [];

    routes.forEach((route, idx) => {
      if (!route.path || route.path.length === 0) return;

      const colorIndex = idx;
      const { polyline, hitPolyline, color } = this.createRouteOverlays(route, colorIndex, false);

      polylinesToAdd.push(polyline, hitPolyline);
      this.activeRouteOverlays.set(route.id, {
        polyline,
        hitPolyline,
        markers: [],
        colorIndex,
        color,
        isPermanent: false
      });
    });

    if (polylinesToAdd.length > 0) {
      this.map.add(polylinesToAdd);
    }
  }

  /**
   * 为线路生成全量站点 WebGL 硬件加速 LabelMarker 标记
   * 基于 AMap.LabelsLayer 实现 GPU 硬件加速光栅化批量渲染与文字智能避让
   */
  createStopMarkers(route, color) {
    const markers = [];
    if (!route.stops || route.stops.length === 0) return markers;

    const total = route.stops.length;
    const isDark = this.currentTheme === 'dark';

    route.stops.forEach((stop, idx) => {
      const isStart = idx === 0;
      const isEnd = idx === total - 1;
      const isTerminal = isStart || isEnd;

      let labelText = stop.name || '站点';
      if (isStart) {
        labelText = `起点: ${stop.name || '起点'}`;
      } else if (isEnd) {
        labelText = `终点: ${stop.name || '终点'}`;
      }

      // 起点翠绿、终点正红、沿途站点深色半透明胶囊带线路同色边框
      let bgColor = isDark ? 'rgba(15, 23, 42, 0.88)' : 'rgba(255, 255, 255, 0.92)';
      let borderColor = color;
      let textColor = isDark ? '#f8fafc' : '#0f172a';
      let strokeColor = isDark ? '#000000' : '#ffffff';
      let zIndex = 80;

      if (isStart) {
        bgColor = 'rgba(16, 185, 129, 0.95)';
        borderColor = '#ffffff';
        textColor = '#ffffff';
        strokeColor = '#065f46';
        zIndex = 150;
      } else if (isEnd) {
        bgColor = 'rgba(239, 68, 68, 0.95)';
        borderColor = '#ffffff';
        textColor = '#ffffff';
        strokeColor = '#991b1b';
        zIndex = 150;
      }

      const labelMarker = new AMap.LabelMarker({
        name: stop.name,
        position: stop.coord,
        zooms: [3, 20],
        opacity: 1,
        zIndex: zIndex,
        text: {
          content: labelText,
          direction: 'center',
          style: {
            fontSize: isTerminal ? 11 : 10,
            fontWeight: isTerminal ? 'bold' : 'normal',
            fillColor: textColor,
            strokeColor: strokeColor,
            strokeWidth: 2,
            backgroundColor: bgColor,
            borderColor: borderColor,
            borderWidth: isTerminal ? 1.5 : 1,
            padding: isTerminal ? [3, 7, 3, 7] : [2, 5, 2, 5],
            borderRadius: 10
          }
        }
      });

      labelMarker.on('click', () => {
        const routeDisplayName = this.formatRouteDisplayName(route.name);
        this.infoWindow.setContent(`
          <div style="padding:8px 12px; font-size:12px; color:#1f2937; line-height:1.5;">
            <strong style="font-size:13px; color:#0f172a;">🚏 ${stop.name || '站点'}</strong><br/>
            <span style="color:#64748b;">所属线路: <strong>${routeDisplayName}</strong></span><br/>
            <span style="color:#94a3b8; font-size:11px;">站点序号: 第 ${idx + 1} 站 / 共 ${total} 站</span>
          </div>
        `);
        this.infoWindow.open(this.map, stop.coord);
      });

      markers.push(labelMarker);
    });

    return markers;
  }

  /**
   * 批量展示一组线路（如某个分组）
   */
  showRoutesBatch(routes) {
    if (!this.map || !window.AMap || !routes || routes.length === 0) return;

    const polylinesToAdd = [];
    const markersToAdd = [];

    routes.forEach((route) => {
      if (!route.path || route.path.length === 0) return;
      if (this.activeRouteOverlays.has(route.id)) return;

      const colorIndex = this.colorIndex++;
      const { polyline, hitPolyline, color } = this.createRouteOverlays(route, colorIndex, false);

      polylinesToAdd.push(polyline, hitPolyline);

      const markers = this.createStopMarkers(route, color);
      if (markers.length > 0) {
        markersToAdd.push(...markers);
      }

      this.activeRouteOverlays.set(route.id, {
        polyline,
        hitPolyline,
        markers,
        colorIndex,
        color,
        isPermanent: false,
        route
      });
    });

    if (polylinesToAdd.length > 0) {
      this.map.add(polylinesToAdd);
    }
    if (markersToAdd.length > 0 && this.labelsLayer && this.showStopsEnabled) {
      this.labelsLayer.add(markersToAdd);
    }
  }

  /**
   * 全局控制是否显示沿途站点 (Toggle Stops Visibility)
   */
  setStopsVisibility(enabled) {
    this.showStopsEnabled = !!enabled;
    if (!this.labelsLayer) return;
    if (this.showStopsEnabled) {
      this.labelsLayer.show();
    } else {
      this.labelsLayer.hide();
    }
  }

  /**
   * 批量隐藏一组线路
   */
  hideRoutesBatch(routes) {
    if (!this.map || !routes || routes.length === 0) return;

    const polylinesToRemove = [];
    const markersToRemove = [];
    routes.forEach(route => {
      const overlay = this.activeRouteOverlays.get(route.id);
      if (overlay) {
        if (overlay.hitPolyline) polylinesToRemove.push(overlay.hitPolyline);
        if (overlay.polyline) polylinesToRemove.push(overlay.polyline);
        if (overlay.markers && overlay.markers.length > 0) {
          markersToRemove.push(...overlay.markers);
        }
        this.activeRouteOverlays.delete(route.id);
      }
    });

    if (polylinesToRemove.length > 0) {
      this.map.remove(polylinesToRemove);
    }
    if (markersToRemove.length > 0 && this.labelsLayer) {
      this.labelsLayer.remove(markersToRemove);
    }
  }

  /**
   * 常驻显示某条线路（全量展示路径与所有站点名称）
   */
  showRoute(route) {
    if (!this.map || !route || !route.path || route.path.length === 0) return;
    if (this.activeRouteOverlays.has(route.id)) return;

    const colorIndex = this.colorIndex++;
    const { polyline, hitPolyline, color } = this.createRouteOverlays(route, colorIndex, true);
    this.map.add([polyline, hitPolyline]);

    // WebGL 硬件加速站点 Markers
    const markers = this.createStopMarkers(route, color);
    if (markers.length > 0 && this.labelsLayer && this.showStopsEnabled) {
      this.labelsLayer.add(markers);
    }

    this.activeRouteOverlays.set(route.id, {
      polyline,
      hitPolyline,
      markers,
      colorIndex,
      color,
      isPermanent: true,
      route
    });
  }

  /**
   * 隐藏某条线路
   */
  hideRoute(routeId) {
    if (!this.map || !this.activeRouteOverlays.has(routeId)) return;

    const overlay = this.activeRouteOverlays.get(routeId);
    if (overlay.hitPolyline) this.map.remove(overlay.hitPolyline);
    if (overlay.polyline) this.map.remove(overlay.polyline);
    if (overlay.markers && overlay.markers.length > 0 && this.labelsLayer) {
      this.labelsLayer.remove(overlay.markers);
    }

    this.activeRouteOverlays.delete(routeId);
  }

  /**
   * 聚焦并居中高亮单条线路 (Focus Route)
   */
  focusRoute(route) {
    if (!this.map || !route) return;

    // 如果该线路尚未在地图上绘制，先将其显示
    if (!this.activeRouteOverlays.has(route.id)) {
      this.showRoute(route);
    }

    const overlay = this.activeRouteOverlays.get(route.id);
    if (!overlay) return;

    // 恢复其他线路的普通 zIndex，将当前聚焦线路的折线与站点提升至顶层
    this.activeRouteOverlays.forEach((ov, id) => {
      if (id === route.id) {
        if (ov.polyline) ov.polyline.setOptions({ zIndex: 90, strokeWeight: 6 });
        if (ov.markers) ov.markers.forEach(m => m.setzIndex(160));
      } else {
        if (ov.polyline) ov.polyline.setOptions({ zIndex: ov.isPermanent ? 50 : 35, strokeWeight: ov.isPermanent ? 5 : 4 });
        if (ov.markers) ov.markers.forEach((m, idx) => {
          const isTerminal = idx === 0 || idx === ov.markers.length - 1;
          m.setzIndex(isTerminal ? 150 : 80);
        });
      }
    });

    // 自动缩放居中平滑聚焦该线路
    // 考虑左侧面板宽度 (约 450px)，让线路在右侧地图可视区完美居中
    const isSidebarCollapsed = document.querySelector('.sidebar')?.classList.contains('collapsed');
    const leftPadding = isSidebarCollapsed ? 80 : 440;

    if (overlay.polyline) {
      this.map.setFitView([overlay.polyline], false, [60, 60, 60, leftPadding]);
    }
  }

  /**
   * 清空所有在地图上显示的线路
   */
  clearAllActiveRoutes() {
    if (!this.map) return;
    this.activeRouteOverlays.forEach((overlay) => {
      if (overlay.hitPolyline) this.map.remove(overlay.hitPolyline);
      if (overlay.polyline) this.map.remove(overlay.polyline);
    });
    if (this.labelsLayer) {
      this.labelsLayer.clear();
    }
    this.activeRouteOverlays.clear();
    this.clearHighlight();
  }

  /**
   * 自动缩放自适应当前所有激活的线路
   */
  fitAllActiveRoutes() {
    if (!this.map) return;
    const allPolylines = [];
    this.activeRouteOverlays.forEach((overlay) => {
      if (overlay.polyline) allPolylines.push(overlay.polyline);
    });

    if (allPolylines.length > 0) {
      const isSidebarCollapsed = document.querySelector('.sidebar')?.classList.contains('collapsed');
      const leftPadding = isSidebarCollapsed ? 80 : 440;
      this.map.setFitView(allPolylines, false, [60, 60, 60, leftPadding], 14);
    }
  }

  /**
   * 重置全城视角
   */
  resetView() {
    if (!this.map) return;
    const config = window.BUS_MAP_CONFIG || {};
    const center = config.defaultCenter || [116.397451, 39.909187];
    const zoom = config.defaultZoom || 11;
    this.map.setZoomAndCenter(zoom, center);
  }

  /**
   * 线路规范显示名称（如 快专、BRT）
   */
  formatRouteDisplayName(name) {
    if (!name) return '';
    let s = name.trim();
    s = s.replace(/快速直达专线?/g, '快专');
    s = s.replace(/快速公交(\d+)线(\/BRT\d+号线)?/g, 'BRT$1');
    s = s.replace(/快速公交/g, 'BRT');
    return s;
  }

  /**
   * 显示线路弹窗信息
   */
  showInfoWindow(route, lnglat) {
    if (!this.map) return;
    const routeDisplayName = this.formatRouteDisplayName(route.name);
    const content = `
      <div style="padding:10px 14px; font-family:sans-serif; color:#1e293b; min-width:200px;">
        <h4 style="margin:0 0 6px; font-size:14px; color:#0f172a;">🚌 ${routeDisplayName}</h4>
        <p style="margin:0 0 4px; font-size:12px; color:#475569;">
          <strong>起止：</strong>${route.from || '起点'} ➔ ${route.to || '终点'}
        </p>
        <p style="margin:0 0 4px; font-size:12px; color:#475569;">
          <strong>站点：</strong>共 ${route.stop_count || (route.stops ? route.stops.length : 0)} 站
        </p>
        ${route.opening_hours ? `<p style="margin:0; font-size:11px; color:#64748b;"><strong>时间：</strong>${route.opening_hours}</p>` : ''}
      </div>
    `;
    this.infoWindow.setContent(content);
    this.infoWindow.open(this.map, lnglat);
  }
}

window.mapManager = new MapManager();

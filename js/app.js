/**
 * 前端主交互逻辑模块 app.js
 * 采用 Master-Detail 双栏联动模式：
 * - 左列：按大区及功能划分的固定号段分类导航（含【已上图】专栏、搜索匹配指示与激活点）
 * - 右列：当前选中分类的紧凑线路列表，支持一键整组全显/隐藏、单线切换、Hover 磁吸高亮
 */

// 4 大分类板块及下属精细号段定义
const ROUTE_SECTIONS = [
  {
    title: '市区常规干线',
    groups: [
      { key: 'num_1_99', label: '1~99路', title: '1~99路 (核心城区骨干干线)' },
      { key: 'num_1xx', label: '1字头 (100+)', title: '1字头 (100~199 电车/核心线)' },
      { key: 'num_2xx', label: '2字头 (200+)', title: '2字头 (200~299 二环干线)' },
      { key: 'num_3xx', label: '3字头 (300+)', title: '3字头 (300~399 三环骨干干线)' },
      { key: 'num_4xx', label: '4字头 (400+)', title: '4字头 (400~499 四环放射干线)' },
      { key: 'num_5xx', label: '5字头 (500+)', title: '5字头 (500~599 居住区微循环接驳)' },
      { key: 'num_6xx', label: '6字头 (600+)', title: '6字头 (600~699 跨区主要干线)' },
      { key: 'num_8xx', label: '8字头 (800+)', title: '8字头 (800~899 近郊主要干线)' },
      { key: 'num_9xx', label: '9字头 (900+)', title: '9字头 (900~999 远郊长途干线)' }
    ]
  },
  {
    title: '特色与定制专线',
    groups: [
      { key: 'night', label: '夜字头 (夜班)', title: '夜字头 (通宵夜班公交线网)' },
      { key: 'zhuan', label: '专字头 (微循环)', title: '专字头 (社区微循环专线)' },
      { key: 'brt_direct', label: '快专 (快速直达)', title: '快专 / 快速直达专线 (点对点直达快车)' },
      { key: 'brt_trunk', label: 'BRT (快速公交)', title: '快速公交 BRT (专用道走廊)' },
      { key: 'custom_tour', label: '通游专线', title: '通游专线 (旅游景区直通车)' },
      { key: 'custom_med', label: '通医专线', title: '通医专线 (医院就诊专线)' },
      { key: 'custom_commute', label: '通勤专线', title: '通勤专线 (科技园定制早晚通勤)' },
      { key: 'jiao', label: '郊字头', title: '郊字头 (跨省市郊客运专线)' }
    ]
  },
  {
    title: '郊区客运 (英文字母)',
    groups: [
      { key: 'prefix_x', label: 'X字头 (大兴)', title: 'X字头 (大兴区客运线路)' },
      { key: 'prefix_c', label: 'C字头 (昌平)', title: 'C字头 (昌平区客运线路)' },
      { key: 'prefix_s', label: 'S字头 (顺义)', title: 'S字头 (顺义区客运线路)' },
      { key: 'prefix_t', label: 'T字头 (通州)', title: 'T字头 (通州区客运线路)' },
      { key: 'prefix_f', label: 'F字头 (房山)', title: 'F字头 (房山区客运线路)' },
      { key: 'prefix_h', label: 'H字头 (怀柔)', title: 'H字头 (怀柔区客运线路)' },
      { key: 'prefix_m', label: 'M字头 (门头沟)', title: 'M字头 (门头沟区客运线路)' },
      { key: 'prefix_y', label: 'Y字头 (延庆)', title: 'Y字头 (延庆区客运线路)' }
    ]
  },
  {
    title: '各区属地公交 (汉字)',
    groups: [
      { key: 'prefix_xing', label: '兴字头 (大兴)', title: '兴字头 (大兴区属地公交线路)' },
      { key: 'prefix_chang', label: '昌字头 (昌平)', title: '昌字头 (昌平区属地公交线路)' },
      { key: 'prefix_shun', label: '顺字头 (顺义)', title: '顺字头 (顺义区属地公交线路)' },
      { key: 'prefix_mi', label: '密字头 (密云)', title: '密字头 (密云区属地公交线路)' },
      { key: 'prefix_ping', label: '平字头 (平谷)', title: '平字头 (平谷区属地公交线路)' },
      { key: 'prefix_tong', label: '通字头 (通州)', title: '通字头 (通州区属地公交线路)' },
      { key: 'prefix_huai', label: '怀字头 (怀柔)', title: '怀字头 (怀柔区属地公交线路)' },
      { key: 'other', label: '其它特色线路', title: '其它特色定制与特殊线路' }
    ]
  }
];

// 建立 Group Key -> Definition 快速索引表
const ROUTE_GROUP_MAP = new Map();
ROUTE_SECTIONS.forEach(sec => {
  sec.groups.forEach(g => ROUTE_GROUP_MAP.set(g.key, g));
});

class BusApp {
  constructor() {
    this.allRoutes = [];
    this.groupedRoutes = new Map(); // groupKey -> route[]
    this.selectedRouteIds = new Set(); // 在地图上显示的线路 ID 集合（对应开关开启）
    this.focusedRouteId = null;        // 当前卡片选中焦点线路 ID
    this.currentCategoryKey = 'num_1_99'; // 默认选中 1~99路
    this.searchKeyword = '';

    // DOM 元素引用
    this.navCategoriesPanel = document.getElementById('nav-categories-panel');
    this.detailHeader = document.getElementById('detail-header');
    this.detailRoutesList = document.getElementById('detail-routes-list');
    this.searchInputEl = document.getElementById('search-input');
    this.clearSearchBtn = document.getElementById('clear-search-btn');
    this.totalBadgeEl = document.getElementById('total-routes-badge');
    this.activeBadgeEl = document.getElementById('active-routes-badge');
    this.clearAllBtn = document.getElementById('clear-all-selected-btn');
    this.hoverTooltipEl = document.getElementById('route-hover-tooltip');
  }

  async init() {
    this.bindEvents();

    // 清除可能残留的浏览器自动填充
    if (this.searchInputEl) {
      this.searchInputEl.value = '';
      this.searchKeyword = '';
      setTimeout(() => {
        if (!this.searchKeyword && this.searchInputEl.value) {
          this.searchInputEl.value = '';
          this.clearSearchBtn.style.display = 'none';
        }
      }, 350);
    }

    // 初始化高德地图
    await window.mapManager.init('amap-container');

    // 监听窗口尺寸变化及字体加载完成，自适应更新超长路号走字参数
    window.addEventListener('resize', () => {
      if (this._resizeMarqueeTimer) clearTimeout(this._resizeMarqueeTimer);
      this._resizeMarqueeTimer = setTimeout(() => this.adjustLedMarquees(), 150);
    });

    if (document.fonts) {
      document.fonts.ready.then(() => {
        this.adjustLedMarquees();
      });
    }

    // 加载公交数据
    await this.loadRoutesData();
  }

  /**
   * 按线路号开头提取精细分组 Key
   */
  getRouteGroupKey(route) {
    const ref = route.ref || '';
    const name = route.name || '';

    // 1. 功能性专线
    if (ref.startsWith('快速直达') || ref.startsWith('快专') || name.includes('快速直达') || name.includes('快专')) return 'brt_direct';
    if (ref.startsWith('快速公交') || ref.startsWith('BRT')) return 'brt_trunk';
    if (ref.startsWith('通游专线') || ref.startsWith('通游')) return 'custom_tour';
    if (ref.startsWith('通医专线') || ref.startsWith('通医')) return 'custom_med';
    if (ref.startsWith('通勤专线') || ref.startsWith('通勤')) return 'custom_commute';
    if (ref.startsWith('夜') || ref.includes('夜')) return 'night';
    if (ref.startsWith('专')) return 'zhuan';
    if (ref.startsWith('郊')) return 'jiao';

    // 2. 字母前缀（各郊区客运，严格独立）
    if (ref.startsWith('X')) return 'prefix_x';
    if (ref.startsWith('C')) return 'prefix_c';
    if (ref.startsWith('S')) return 'prefix_s';
    if (ref.startsWith('T')) return 'prefix_t';
    if (ref.startsWith('F')) return 'prefix_f';
    if (ref.startsWith('H')) return 'prefix_h';
    if (ref.startsWith('M')) return 'prefix_m';
    if (ref.startsWith('Y')) return 'prefix_y';

    // 3. 汉字属地前缀（各区本地公交，严格独立）
    if (ref.startsWith('兴')) return 'prefix_xing';
    if (ref.startsWith('昌')) return 'prefix_chang';
    if (ref.startsWith('顺')) return 'prefix_shun';
    if (ref.startsWith('密')) return 'prefix_mi';
    if (ref.startsWith('平')) return 'prefix_ping';
    if (ref.startsWith('通')) return 'prefix_tong';
    if (ref.startsWith('怀')) return 'prefix_huai';

    // 4. 数字常规干线
    const m = ref.match(/^(\d+)/);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n < 100) return 'num_1_99';
      if (n < 200) return 'num_1xx';
      if (n < 300) return 'num_2xx';
      if (n < 400) return 'num_3xx';
      if (n < 500) return 'num_4xx';
      if (n < 600) return 'num_5xx';
      if (n < 700) return 'num_6xx';
      if (n < 900) return 'num_8xx';
      if (n < 1000) return 'num_9xx';
    }

    return 'other';
  }

  /**
   * 绑定事件监听器
   */
  bindEvents() {
    // 搜索输入防抖
    let debounceTimer = null;
    this.searchInputEl.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      const val = e.target.value.trim().toLowerCase();
      this.clearSearchBtn.style.display = val ? 'block' : 'none';
      debounceTimer = setTimeout(() => {
        this.searchKeyword = val;
        if (val) {
          // 搜索触发时自动切到“全部搜索匹配”
          this.currentCategoryKey = '__search_all__';
        } else {
          // 清空时恢复到 1~99路
          if (this.currentCategoryKey === '__search_all__') {
            this.currentCategoryKey = 'num_1_99';
          }
        }
        this.renderDualColumns();
      }, 150);
    });

    // 清空搜索
    this.clearSearchBtn.addEventListener('click', () => {
      this.searchInputEl.value = '';
      this.searchKeyword = '';
      this.clearSearchBtn.style.display = 'none';
      if (this.currentCategoryKey === '__search_all__') {
        this.currentCategoryKey = 'num_1_99';
      }
      this.renderDualColumns();
    });

    // 全部隐藏按钮
    if (this.clearAllBtn) {
      this.clearAllBtn.addEventListener('click', () => {
        this.clearAllSelected();
      });
    }

    // 侧边栏整体展开/收起切换
    const sidebarEl = document.querySelector('.sidebar');
    const sidebarToggleBtn = document.getElementById('sidebar-toggle-btn');
    if (sidebarToggleBtn && sidebarEl) {
      sidebarToggleBtn.addEventListener('click', () => {
        const isCollapsed = sidebarEl.classList.toggle('collapsed');
        sidebarToggleBtn.title = isCollapsed ? '展开左侧面板' : '收起左侧面板';
        sidebarToggleBtn.setAttribute('aria-label', isCollapsed ? '展开左侧面板' : '收起左侧面板');

        // 动画过渡后触发 resize，使高德地图自动适配全屏/半屏
        setTimeout(() => {
          window.dispatchEvent(new Event('resize'));
        }, 320);
      });
    }

    // 地图控制按钮（深色/标准底图切换）
    const themeBtn = document.getElementById('toggle-theme-btn');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        window.mapManager.toggleTheme();
      });
    }

    // 全局沿途站点显示开关（默认开启）
    const globalStopsToggle = document.getElementById('global-stops-toggle');
    if (globalStopsToggle) {
      globalStopsToggle.addEventListener('change', (e) => {
        window.mapManager.setStopsVisibility(e.target.checked);
      });
    }
  }

  /**
   * 线路自然数字升序比较函数
   * 支持纯数字、前后缀（如 夜1路、专2路、X101路、1路区间、300路内环等）的自然升序
   */
  compareRoutesNaturally(a, b) {
    const parseRouteRef = (route) => {
      const ref = (route.ref || '').trim();
      const match = ref.match(/^([^\d]*)(\d+)(.*)$/);
      if (match) {
        return {
          prefix: match[1] || '',
          num: parseInt(match[2], 10),
          suffix: match[3] || '',
          name: route.name || ''
        };
      }
      return {
        prefix: ref,
        num: 0,
        suffix: '',
        name: route.name || ''
      };
    };

    const pa = parseRouteRef(a);
    const pb = parseRouteRef(b);

    // 1. 前缀比较（按中文拼音/字母排序）
    if (pa.prefix !== pb.prefix) {
      return pa.prefix.localeCompare(pb.prefix, 'zh-Hans-CN');
    }

    // 2. 核心数字大小比较（自然数值升序，如 2 < 10）
    if (pa.num !== pb.num) {
      return pa.num - pb.num;
    }

    // 3. 后缀比较（如 '路' 在 '路区间' 之前，'内环' 与 '外环' 等）
    if (pa.suffix !== pb.suffix) {
      return pa.suffix.localeCompare(pb.suffix, 'zh-Hans-CN');
    }

    // 4. 方向与名称比较，保持上下行稳定成对排列
    return pa.name.localeCompare(pb.name, 'zh-Hans-CN');
  }

  /**
   * 加载公交路线数据（优先请求 10MB 的 Gzip 压缩包并利用浏览器原生 DecompressionStream 极速流式解压）
   */
  async loadRoutesData(retryCount = 3) {
    try {
      let data;
      let resp = await fetch(`data/beijing_bus_routes.json.gz?t=${Date.now()}`);
      if (resp.ok) {
        if (typeof DecompressionStream !== 'undefined') {
          const ds = new DecompressionStream('gzip');
          const decompressedStream = resp.body.pipeThrough(ds);
          const jsonText = await new Response(decompressedStream).text();
          data = JSON.parse(jsonText);
        } else {
          data = await resp.json();
        }
      } else {
        // 回退机制：尝试读取未压缩的 json 文件
        resp = await fetch(`data/beijing_bus_routes.json?t=${Date.now()}`);
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        data = await resp.json();
      }
      // 严格过滤非公交车次（如市郊铁路火车、地铁等）
      this.allRoutes = (data || []).filter(r => {
        const ref = r.ref || '';
        const name = r.name || '';
        return !ref.startsWith('市郊铁路') && !name.includes('市郊铁路') && ref !== 'S1线';
      });

      // 对全量线路进行自然数字升序排序（保证后续分类浏览、搜索及已上图均按自然数字整齐排列）
      this.allRoutes.sort((a, b) => this.compareRoutesNaturally(a, b));

      // 按分组整理归类
      this.groupedRoutes.clear();
      ROUTE_GROUP_MAP.forEach((_, key) => this.groupedRoutes.set(key, []));

      this.allRoutes.forEach(r => {
        const gk = this.getRouteGroupKey(r);
        if (!this.groupedRoutes.has(gk)) {
          this.groupedRoutes.set(gk, []);
        }
        this.groupedRoutes.get(gk).push(r);
      });

      // 默认初始展示：1路（单向）、200内、300内、400外
      this.selectedRouteIds = new Set();
      const defaultRoutes = this.getDefaultInitialRoutes();
      defaultRoutes.forEach(r => this.selectedRouteIds.add(r.id));

      if (window.mapManager && defaultRoutes.length > 0) {
        window.mapManager.clearAllActiveRoutes();
        defaultRoutes.forEach(r => window.mapManager.showRoute(r));
        window.mapManager.fitAllActiveRoutes();
      }

      this.updateBadges();
      this.renderDualColumns();
    } catch (err) {
      if (retryCount > 0) {
        setTimeout(() => this.loadRoutesData(retryCount - 1), 600);
        return;
      }
      console.warn('读取公交数据失败:', err);
      this.detailRoutesList.innerHTML = `
        <div class="empty-state">
          <p>⚠️ 读取公交数据遇到问题</p>
          <small style="color:var(--text-muted); margin-top:8px;">请点击右上角“刷新数据”重试</small>
        </div>
      `;
    }
  }

  /**
   * 获取默认初始展示的四条北京骨干城市线路：
   * 1路（单向，首钢园至四惠）、200内（二环）、300内（三环）、400外（四环）
   */
  getDefaultInitialRoutes() {
    const selected = [];

    // 1. 1路 (单向，首钢园至四惠枢纽站)
    const r1 = this.allRoutes.find(r => r.id === 'amap_900000258460') ||
               this.allRoutes.find(r => r.ref === '1路');
    if (r1) selected.push(r1);

    // 2. 200路内环 (二环)
    const r200 = this.allRoutes.find(r => r.id === 'amap_110100012633') ||
                 this.allRoutes.find(r => r.ref === '200路内环') ||
                 this.allRoutes.find(r => (r.ref && r.ref.includes('200') && r.name && r.name.includes('内环')));
    if (r200) selected.push(r200);

    // 3. 300路内环 (三环)
    const r300 = this.allRoutes.find(r => r.id === 'amap_110100013505') ||
                 this.allRoutes.find(r => r.ref === '300路内环') ||
                 this.allRoutes.find(r => (r.ref && r.ref.includes('300') && r.name && r.name.includes('300路内环')));
    if (r300) selected.push(r300);

    // 4. 400路外环 (四环)
    const r400 = this.allRoutes.find(r => r.id === 'amap_110100014345') ||
                 this.allRoutes.find(r => r.ref === '400路外环') ||
                 this.allRoutes.find(r => (r.ref && r.ref.includes('400') && r.name && r.name.includes('400路外环')));
    if (r400) selected.push(r400);

    return selected;
  }

  /**
   * 线路编号拟真格式化（车头 LED 屏规范）
   * - 快速直达专线 -> 快专
   * - 快速公交 -> BRT (如 快速公交1线 -> BRT1, 快速公交2线区间 -> BRT2区间)
   */
  formatRouteRef(ref) {
    if (!ref) return '公交';
    let s = ref.trim();
    s = s.replace(/快速直达专线?/g, '快专');
    s = s.replace(/快速公交(\d+)线(\/BRT\d+号线)?/g, 'BRT$1');
    s = s.replace(/快速公交/g, 'BRT');
    return s;
  }

  /**
   * 线路名称规范化（用于弹窗、标题、Tooltip）
   */
  formatRouteName(name) {
    if (!name) return '';
    let s = name.trim();
    s = s.replace(/快速直达专线?/g, '快专');
    s = s.replace(/快速公交(\d+)线(\/BRT\d+号线)?/g, 'BRT$1');
    s = s.replace(/快速公交/g, 'BRT');
    return s;
  }

  /**
   * 北京公交车头 LED 站名排版智能双行切分
   * 3字及以下短站名保持单行大字；
   * 4字及以上长站名根据地名语义后缀或自然折半切分为上下两行
   */
  splitStationName(name) {
    if (!name) return ['', ''];
    const s = name.trim();
    if (s.length <= 4) {
      return [s, ''];
    }

    const suffixes = [
      '公交场站', '客运站', '火车站', '枢纽站',
      '南广场', '北广场', '东广场', '西广场',
      '金融港', '科技园', '商业街', '工业园',
      '地铁站', '轻轨站', '高架桥',
      '环岛西', '环岛东', '环岛南', '环岛北',
      '小区西', '小区东', '小区南', '小区北', '小区',
      '西站', '东站', '南站', '北站',
      '西口', '东口', '南口', '北口',
      '西门', '东门', '南门', '北门',
      '场站', '车场', '总站'
    ];

    for (const suf of suffixes) {
      if (s.endsWith(suf) && s.length > suf.length) {
        return [s.slice(0, -suf.length), suf];
      }
    }

    // 单字方位或设施后缀（南、北、东、西、桥、站）
    if (s.length >= 5 && ['南', '北', '东', '西', '桥', '站'].includes(s[s.length - 1])) {
      return [s.slice(0, -1), s[s.length - 1]];
    }

    // 自然折半切分
    const mid = Math.ceil(s.length / 2);
    return [s.slice(0, mid), s.slice(mid)];
  }

  /**
   * 线路过滤匹配辅助方法
   */
  matchesSearch(route, kw) {
    if (!kw) return true;
    const kwLower = kw.toLowerCase().trim();
    const ref = (route.ref || '').toLowerCase();
    const name = (route.name || '').toLowerCase();
    const from = (route.from || '').toLowerCase();
    const to = (route.to || '').toLowerCase();
    const displayRef = this.formatRouteRef(route.ref).toLowerCase();
    const displayName = this.formatRouteName(route.name).toLowerCase();

    // BRT 与 快速公交 互通搜索
    let isBrtMatch = false;
    if (kwLower === 'brt' || kwLower.startsWith('brt') || kwLower === '快速公交' || kwLower.startsWith('快速公交')) {
      if (ref.includes('快速公交') || ref.includes('brt') || name.includes('快速公交') || name.includes('brt')) {
        const numMatch = kwLower.match(/\d+/);
        if (numMatch) {
          const reqNum = numMatch[0];
          if (displayRef.includes(reqNum) || displayName.includes(reqNum)) {
            isBrtMatch = true;
          }
        } else {
          isBrtMatch = true;
        }
      }
    }

    return isBrtMatch ||
           ref.includes(kwLower) || 
           name.includes(kwLower) || 
           from.includes(kwLower) || 
           to.includes(kwLower) || 
           displayRef.includes(kwLower) || 
           displayName.includes(kwLower);
  }

  /**
   * 全部隐藏
   */
  clearAllSelected() {
    this.selectedRouteIds.clear();
    this.focusedRouteId = null;
    window.mapManager.clearAllActiveRoutes();
    this.updateBadges();
    this.renderDualColumns();
  }

  /**
   * 批量切换当前分组上图
   */
  toggleRoutesBatch(routes) {
    if (!routes || routes.length === 0) return;
    const allShown = routes.every(r => this.selectedRouteIds.has(r.id));

    if (allShown) {
      // 批量隐藏本组
      routes.forEach(r => this.selectedRouteIds.delete(r.id));
      window.mapManager.hideRoutesBatch(routes);
    } else {
      // 批量展示本组
      routes.forEach(r => this.selectedRouteIds.add(r.id));
      window.mapManager.showRoutesBatch(routes);
    }

    this.updateBadges();
    this.renderDualColumns();
  }

  /**
   * 渲染双栏联动界面
   */
  renderDualColumns() {
    this.renderCategoryNav();
    this.renderRouteDetail();
  }

  /**
   * 渲染左列分类导航
   */
  renderCategoryNav() {
    if (!this.navCategoriesPanel) return;
    const kw = this.searchKeyword;
    const navFrag = document.createDocumentFragment();

    // 1. 首项置顶：【🗺️ 已上图路线】专属图层管理项
    const activeCount = this.selectedRouteIds.size;
    const activeNavEl = document.createElement('div');
    const isActiveMapSelected = this.currentCategoryKey === '__active_map__';
    activeNavEl.className = `nav-cat-item featured-active-map ${isActiveMapSelected ? 'active' : ''}`;
    activeNavEl.innerHTML = `
      <span class="nav-cat-label">🗺️ 已上图线路</span>
      <div class="nav-cat-badges">
        <span class="nav-cat-active-pill">${activeCount} 条</span>
      </div>
    `;
    activeNavEl.addEventListener('click', () => {
      this.currentCategoryKey = '__active_map__';
      this.renderDualColumns();
    });
    navFrag.appendChild(activeNavEl);

    // 2. 若存在搜索词，展示【🔍 搜索全部匹配】选项
    if (kw) {
      const allMatchedRoutes = this.allRoutes.filter(r => this.matchesSearch(r, kw));
      const searchAllEl = document.createElement('div');
      const isSearchAllSelected = this.currentCategoryKey === '__search_all__';
      searchAllEl.className = `nav-cat-item ${isSearchAllSelected ? 'active' : ''}`;
      searchAllEl.style.borderBottom = '1px solid rgba(59, 130, 246, 0.2)';
      searchAllEl.style.marginBottom = '4px';
      searchAllEl.innerHTML = `
        <span class="nav-cat-label">🔍 搜索结果</span>
        <div class="nav-cat-badges">
          <span class="nav-cat-count" style="color:#60a5fa; background:rgba(59, 130, 246, 0.15);">${allMatchedRoutes.length} 条</span>
        </div>
      `;
      searchAllEl.addEventListener('click', () => {
        this.currentCategoryKey = '__search_all__';
        this.renderDualColumns();
      });
      navFrag.appendChild(searchAllEl);
    }

    // 3. 渲染四大板块及具体号段分组
    ROUTE_SECTIONS.forEach(sec => {
      // 检查本 Section 在搜索下是否有匹配项
      let secMatchedTotal = 0;
      sec.groups.forEach(g => {
        const routes = this.groupedRoutes.get(g.key) || [];
        const count = kw ? routes.filter(r => this.matchesSearch(r, kw)).length : routes.length;
        secMatchedTotal += count;
      });

      // 搜索模式下若整个板块无匹配则隐去
      if (kw && secMatchedTotal === 0) return;

      // Section 标题
      const secTitleEl = document.createElement('div');
      secTitleEl.className = 'nav-section-title';
      secTitleEl.textContent = sec.title;
      navFrag.appendChild(secTitleEl);

      // Section 下各分组
      sec.groups.forEach(g => {
        const allGroupRoutes = this.groupedRoutes.get(g.key) || [];
        if (allGroupRoutes.length === 0) return;

        const displayRoutes = kw ? allGroupRoutes.filter(r => this.matchesSearch(r, kw)) : allGroupRoutes;
        // 搜索模式下无匹配项则隐藏
        if (kw && displayRoutes.length === 0) return;

        // 当前组在地图上显示的线路数
        const groupActiveCount = allGroupRoutes.filter(r => this.selectedRouteIds.has(r.id)).length;
        const isCurrentActive = this.currentCategoryKey === g.key;

        const catEl = document.createElement('div');
        catEl.className = `nav-cat-item ${isCurrentActive ? 'active' : ''}`;
        catEl.dataset.key = g.key;

        catEl.innerHTML = `
          <span class="nav-cat-label" title="${g.title}">${g.label}</span>
          <div class="nav-cat-badges">
            ${groupActiveCount > 0 ? `<span class="nav-cat-active-pill" title="已在地图显示 ${groupActiveCount} 条">● ${groupActiveCount}</span>` : ''}
            <span class="nav-cat-count">${kw ? displayRoutes.length : allGroupRoutes.length}</span>
          </div>
        `;

        catEl.addEventListener('click', () => {
          this.currentCategoryKey = g.key;
          this.renderDualColumns();
        });

        navFrag.appendChild(catEl);
      });
    });

    this.navCategoriesPanel.innerHTML = '';
    this.navCategoriesPanel.appendChild(navFrag);
  }

  /**
   * 渲染右列线路详情与操作区
   */
  renderRouteDetail() {
    if (!this.detailHeader || !this.detailRoutesList) return;
    const kw = this.searchKeyword;

    let title = '';
    let subtitle = '';
    let routesToDisplay = [];
    let showBatchAction = true;
    let isAllActiveMapMode = false;

    // 分情况确定展示内容
    if (this.currentCategoryKey === '__active_map__') {
      isAllActiveMapMode = true;
      title = '🗺️ 已在地图显示的路线';
      // 筛选当前已选路线
      routesToDisplay = this.allRoutes.filter(r => this.selectedRouteIds.has(r.id));
      subtitle = `当前共 ${routesToDisplay.length} 条路线在地图上呈现`;
      showBatchAction = routesToDisplay.length > 0;
    } else if (this.currentCategoryKey === '__search_all__') {
      title = `🔍 搜索结果: "${kw}"`;
      routesToDisplay = this.allRoutes.filter(r => this.matchesSearch(r, kw));
      subtitle = `全城共搜索到 ${routesToDisplay.length} 条匹配路线`;
      showBatchAction = routesToDisplay.length > 0;
    } else {
      const def = ROUTE_GROUP_MAP.get(this.currentCategoryKey) || { title: '公交线路', label: '线路' };
      title = def.title;
      const allGroupRoutes = this.groupedRoutes.get(this.currentCategoryKey) || [];
      routesToDisplay = kw ? allGroupRoutes.filter(r => this.matchesSearch(r, kw)) : allGroupRoutes;
      const shownInThisGroup = routesToDisplay.filter(r => this.selectedRouteIds.has(r.id)).length;
      subtitle = `共 ${routesToDisplay.length} 条路线 · 已显示 ${shownInThisGroup} 条`;
      showBatchAction = routesToDisplay.length > 0;
    }

    // 检查是否全显
    const allShown = routesToDisplay.length > 0 && routesToDisplay.every(r => this.selectedRouteIds.has(r.id));
    const hasAnyShown = routesToDisplay.some(r => this.selectedRouteIds.has(r.id));

    // 1. 渲染 Header
    this.detailHeader.innerHTML = `
      <div class="detail-header-info">
        <div class="detail-header-title" title="${title}">${title}</div>
        <div class="detail-header-subtitle">${subtitle}</div>
      </div>
      <div class="detail-header-actions">
        ${showBatchAction ? `
          <button class="detail-action-btn ${allShown ? 'all-shown' : ''}" id="batch-toggle-btn" title="批量上图或隐藏">
            ${isAllActiveMapMode ? '全部隐藏' : (allShown ? '隐藏本组' : (hasAnyShown ? '全部展示' : '在地图全显'))}
          </button>
        ` : ''}
      </div>
    `;

    // 绑定批量操作按钮
    const batchBtn = document.getElementById('batch-toggle-btn');
    if (batchBtn) {
      batchBtn.addEventListener('click', () => {
        if (isAllActiveMapMode) {
          this.clearAllSelected();
        } else {
          this.toggleRoutesBatch(routesToDisplay);
        }
      });
    }

    // 2. 渲染线路卡片列表（采用高性能虚拟滚动，保持 DOM 极简并提供 60FPS 丝滑体验）
    this.detailRoutesList.scrollTop = 0;
    this.initVirtualScroll(routesToDisplay, batchBtn, isAllActiveMapMode);
  }

  /**
   * 初始化并刷新虚拟列表
   */
  initVirtualScroll(routesToDisplay, batchBtn, isAllActiveMapMode) {
    this.currentVirtualRoutes = routesToDisplay || [];
    this.currentBatchBtn = batchBtn;
    this.isAllActiveMapMode = isAllActiveMapMode;

    this.detailRoutesList.innerHTML = '';

    if (!routesToDisplay || routesToDisplay.length === 0) {
      if (isAllActiveMapMode) {
        this.detailRoutesList.innerHTML = `
          <div class="empty-state">
            <p>🗺️ 当前地图上暂无已显示线路</p>
            <small style="color:var(--text-muted); line-height: 1.6;">
              请在左侧点击号段分类（如 1~99路、X字头等）<br>并勾选感兴趣的路线展示到地图上。
            </small>
          </div>
        `;
      } else {
        this.detailRoutesList.innerHTML = `
          <div class="empty-state">
            <p>🔍 没有匹配的公交线路</p>
            <small style="color:var(--text-muted);">可尝试清空搜索框或切换其他号段</small>
          </div>
        `;
      }
      return;
    }

    const ITEM_HEIGHT = 92; // 86px 卡片定高 + 6px 间距
    const totalHeight = routesToDisplay.length * ITEM_HEIGHT + 16; // 加上下各 8px padding

    this.virtualSpacerEl = document.createElement('div');
    this.virtualSpacerEl.className = 'virtual-scroll-spacer';
    this.virtualSpacerEl.style.height = `${totalHeight}px`;

    this.virtualContentEl = document.createElement('div');
    this.virtualContentEl.className = 'virtual-scroll-content';

    this.detailRoutesList.appendChild(this.virtualSpacerEl);
    this.detailRoutesList.appendChild(this.virtualContentEl);

    // 重置切片索引，强制刷新首屏
    this._virtualLastStart = -1;
    this._virtualLastEnd = -1;

    // 绑定原生滚动监听（全局仅注册一次）
    if (!this._virtualScrollBound) {
      this._virtualScrollBound = true;
      this.detailRoutesList.addEventListener('scroll', () => {
        if (this._virtualRafId) cancelAnimationFrame(this._virtualRafId);
        this._virtualRafId = requestAnimationFrame(() => {
          this.updateVirtualSlice();
        });
      }, { passive: true });
    }

    // 立即执行当前视窗切片渲染
    this.updateVirtualSlice();
  }

  /**
   * 动态计算并渲染当前可视窗口与前后缓冲区内的卡片
   */
  updateVirtualSlice() {
    if (!this.currentVirtualRoutes || !this.virtualContentEl) return;
    const routes = this.currentVirtualRoutes;
    const total = routes.length;
    if (total === 0) return;

    const ITEM_HEIGHT = 92;
    const BUFFER = 3; // 上下各缓冲 3 项
    const scrollTop = this.detailRoutesList.scrollTop;
    const clientHeight = this.detailRoutesList.clientHeight || 600;

    const rawStart = Math.floor(scrollTop / ITEM_HEIGHT);
    const startIndex = Math.max(0, rawStart - BUFFER);
    const rawEnd = Math.ceil((scrollTop + clientHeight) / ITEM_HEIGHT);
    const endIndex = Math.min(total, rawEnd + BUFFER);

    if (startIndex === this._virtualLastStart && endIndex === this._virtualLastEnd) {
      return;
    }

    this._virtualLastStart = startIndex;
    this._virtualLastEnd = endIndex;

    const offsetY = startIndex * ITEM_HEIGHT;
    this.virtualContentEl.style.transform = `translateY(${offsetY}px)`;

    const slice = routes.slice(startIndex, endIndex);
    const fragment = document.createDocumentFragment();

    slice.forEach(route => {
      const card = this.createRouteCardElement(route, this.currentBatchBtn, this.isAllActiveMapMode);
      fragment.appendChild(card);
    });

    this.virtualContentEl.innerHTML = '';
    this.virtualContentEl.appendChild(fragment);

    // 渲染完成后测量并激活当前可视切片内的超长路号走字
    this.adjustLedMarquees();
  }

  /**
   * 创建单张 LED 电子路牌卡片 DOM 节点
   */
  createRouteCardElement(route, batchBtn, isAllActiveMapMode) {
    const isSelected = this.selectedRouteIds.has(route.id);
    const card = document.createElement('div');
    card.className = `route-card led-board ${isSelected ? 'is-selected' : ''}`;
    card.dataset.routeId = route.id;
    card.title = isSelected ? '点击取消选中（从地图隐藏）' : '点击选中（在地图显示该路线及沿途站点）';

    const fromName = route.from || '起点';
    const toName = route.to || '终点';
    const displayRef = this.formatRouteRef(route.ref);

    const fromParts = this.splitStationName(fromName);
    const toParts = this.splitStationName(toName);

    const renderStationStack = (parts, alignClass) => {
      if (!parts[1]) {
        return `
          <div class="led-station-stack single-line ${alignClass}">
            <span class="station-line-text">${parts[0]}</span>
          </div>
        `;
      }
      return `
        <div class="led-station-stack multi-line ${alignClass}">
          <span class="station-line-text line-top">${parts[0]}</span>
          <span class="station-line-text line-bot">${parts[1]}</span>
        </div>
      `;
    };

    card.innerHTML = `
      <div class="led-screen">
        <div class="led-screen-glare"></div>
        <div class="led-station led-start" title="起点: ${fromName}">
          ${renderStationStack(fromParts, 'align-start')}
        </div>
        <div class="led-number-box">
          <span class="led-number">${displayRef}</span>
        </div>
        <div class="led-station led-end" title="终点: ${toName}">
          ${renderStationStack(toParts, 'align-end')}
        </div>
      </div>
      <div class="led-footer">
        <span class="led-meta-stops">🚏 ${route.stop_count || (route.stops ? route.stops.length : 0)} 站</span>
      </div>
    `;

    // Hover 临时高亮
    card.addEventListener('mouseenter', () => {
      card.classList.add('highlighted');
      window.mapManager.highlightRoute(route);
      this.showTooltip(route);
    });

    card.addEventListener('mouseleave', () => {
      card.classList.remove('highlighted');
      window.mapManager.clearHighlight();
      this.hideTooltip();
    });

    // 点击整条卡片：切换选中/取消选中
    card.addEventListener('click', () => {
      const isNowActive = window.mapManager.toggleRouteDisplay(route);
      if (isNowActive) {
        this.selectedRouteIds.add(route.id);
        card.classList.add('is-selected');
        card.title = '点击取消选中（从地图隐藏）';

        // 选中的线路平滑居中聚焦
        window.mapManager.focusRoute(route);
      } else {
        this.selectedRouteIds.delete(route.id);
        card.classList.remove('is-selected');
        card.title = '点击选中（在地图显示该路线及沿途站点）';

        // 如果当前正处于【已上图】专栏，点击取消则更新列表并重新渲染虚拟列表
        if (isAllActiveMapMode) {
          const updatedActive = this.allRoutes.filter(r => this.selectedRouteIds.has(r.id));
          this.initVirtualScroll(updatedActive, batchBtn, isAllActiveMapMode);
        }
      }

      this.updateBadges();
      this.renderCategoryNav(); // 实时更新左侧分类的计数和指示红绿点
      this.updateDetailHeaderStats(this.currentVirtualRoutes, batchBtn, isAllActiveMapMode);
    });

    return card;
  }

  /**
   * 自动检测长路号并激活仿真 LED 左右平滑往返走字 (LED Marquee)
   * 保护两侧始发站和终到站空间，使超长线路号在中间视窗平滑循环滚动
   */
  adjustLedMarquees() {
    if (!this.detailRoutesList) return;
    const cards = this.detailRoutesList.querySelectorAll('.route-card.led-board');
    if (!cards || cards.length === 0) return;

    cards.forEach(card => {
      const box = card.querySelector('.led-number-box');
      const num = card.querySelector('.led-number');
      if (!box || !num) return;

      // 视窗可用内宽（扣除内边距）
      const style = window.getComputedStyle(box);
      const paddingLeft = parseFloat(style.paddingLeft) || 0;
      const paddingRight = parseFloat(style.paddingRight) || 0;
      const clientWidth = box.clientWidth - paddingLeft - paddingRight;

      // 文本实际排版渲染宽度
      const scrollWidth = num.scrollWidth;

      if (scrollWidth > clientWidth + 2) {
        // 留出 4px 的舒适边缘停顿距离，确保最末尾字完整展示
        const overflowDist = scrollWidth - clientWidth + 4;
        // 匀速走字时长：基础首尾停顿 2.8s + 滚动时间（按 20px/s 舒适车牌走字速度）
        const duration = 2.8 + (overflowDist / 20);

        box.classList.add('has-marquee');
        num.classList.add('is-marquee');
        num.style.setProperty('--marquee-dist', `-${overflowDist.toFixed(1)}px`);
        num.style.setProperty('--marquee-dur', `${duration.toFixed(2)}s`);
      } else {
        box.classList.remove('has-marquee');
        num.classList.remove('is-marquee');
        num.style.removeProperty('--marquee-dist');
        num.style.removeProperty('--marquee-dur');
      }
    });
  }

  /**
   * 辅助方法：更新右列 Header 的副标题与批量按钮状态
   */
  updateDetailHeaderStats(routesToDisplay, batchBtn, isAllActiveMapMode) {
    if (!this.detailHeader) return;
    if (isAllActiveMapMode) {
      const count = this.selectedRouteIds.size;
      this.detailHeader.querySelector('.detail-header-subtitle').textContent = `当前共 ${count} 条路线在地图上呈现`;
      if (count === 0) {
        this.renderRouteDetail();
      }
    } else {
      const shown = routesToDisplay.filter(r => this.selectedRouteIds.has(r.id)).length;
      this.detailHeader.querySelector('.detail-header-subtitle').textContent = `共 ${routesToDisplay.length} 条路线 · 已显示 ${shown} 条`;
      const allNowShown = shown > 0 && shown === routesToDisplay.length;
      const anyNowShown = shown > 0;
      if (batchBtn) {
        batchBtn.className = `detail-action-btn ${allNowShown ? 'all-shown' : ''}`;
        batchBtn.textContent = allNowShown ? '隐藏本组' : (anyNowShown ? '全部展示' : '在地图全显');
      }
    }
  }

  /**
   * 更新全局统计徽章
   */
  updateBadges() {
    if (this.totalBadgeEl) {
      this.totalBadgeEl.textContent = `共 ${this.allRoutes.length} 条线路`;
    }
    if (this.activeBadgeEl) {
      this.activeBadgeEl.textContent = `已显示: ${this.selectedRouteIds.size}`;
    }
  }

  showTooltip(route) {
    const displayName = this.formatRouteName(route.name);
    this.hoverTooltipEl.innerHTML = `
      <h4>🚌 ${displayName}</h4>
      <p><strong>起止：</strong>${route.from || '起点'} ➔ ${route.to || '终点'}</p>
      <p><strong>站点：</strong>共 ${route.stop_count || 0} 站 | 轨迹精度: ${route.path_count || 0} 个坐标点</p>
    `;
    this.hoverTooltipEl.style.display = 'block';
  }

  hideTooltip() {
    this.hoverTooltipEl.style.display = 'none';
  }
}

// 启动应用
document.addEventListener('DOMContentLoaded', () => {
  window.busApp = new BusApp();
  window.busApp.init();
});

// docs/static/components/reset-calc.js
class ResetCalc extends HTMLElement {
  setDynamicVh() {
    // 如果浏览器不支持 dvh，就用 JS 兜底
    const supportsDvh = CSS && CSS.supports && CSS.supports('height', '1dvh');
    if (supportsDvh) return; // 有 dvh 就不需要兜底

    const setVar = () => {
      const vh = window.innerHeight * 0.01;
      this.style.setProperty('--rc-vh', `${vh}px`);
    };
    setVar();
    // 标记使用 js-vh 的样式
    this.querySelector('.rc-panel')?.classList.add('use-js-vh');
    this.querySelector('.rc-scroller')?.classList.add('use-js-vh');

    // 监听窗口变化（含地址栏收起/展开）
    this._vhHandler = () => { setVar(); };
    window.addEventListener('resize', this._vhHandler, { passive: true });
    window.addEventListener('orientationchange', this._vhHandler, { passive: true });
  }

  disconnectedCallback() {
    // 清理监听
    if (this._vhHandler) {
      window.removeEventListener('resize', this._vhHandler);
      window.removeEventListener('orientationchange', this._vhHandler);
    }
  }

  connectedCallback() {
    // ---- 读取属性 ----
    this.dataUrl = this.getAttribute("data-url") || "/static/components/resetexp.json";
    this.initialCollapsed = this.hasAttribute("collapsed");
    this.noToggle = this.hasAttribute("no-toggle");
    this.autoFilter = this.hasAttribute("auto-filter");
    this.panelHeight = this.getAttribute("panel-height") || "60vh"; // 表格滚动区域最大高度

    this.typeMap = { HT: "重坦", MT: "中坦", LT: "轻坦", TD: "TD", SPG: "火炮" };

    // 默认：按“总经验 → 升序”
    this.sortKey = "allExp"; // none | allExp
    this.sortDir = "asc";    // asc | desc

    // ---- 初始 DOM ----
    this.innerHTML = this.template();
    this.cacheEls();
    this.bindEvents();

    // 同步排序控件默认值
    this.elSort.value = this.sortKey;
    this.elOrder.textContent = this.sortDir === "desc" ? "↓ 降序" : "↑ 升序";

    // no-toggle 模式：直接展开并加载
    if (this.noToggle) {
      this.elPanel.classList.remove("hidden");
      this.elToggle?.classList.add("hidden");
      this.loadData();
    } else if (!this.initialCollapsed) {
      this.loadData();
    }

    this.setDynamicVh();
  }

  template() {
    const toggleText = this.initialCollapsed ? "显示重置计算器" : "隐藏重置计算器";
    return `
<style>
  /* 数字对齐：右对齐 + 等宽数字 + 不换行 */
  .rc-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .rc-num-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace; }

  /* 不换行（支持中文不拆字） */
  .rc-nowrap { white-space: nowrap; word-break: keep-all; }

  /* 单元格统一行高与对齐，行间分隔线 */
  .rc-panel table th, .rc-panel table td { vertical-align: top; border-bottom: 1px solid rgba(255,255,255,.06); }

  /* 斑马纹 + 悬浮高亮 */
  .rc-body tr:nth-child(odd)  { background-color: rgba(255,255,255,.02); }
  .rc-body tr:nth-child(even) { background-color: rgba(255,255,255,.05); }
  .rc-body tr:hover { background-color: rgba(59,130,246,.15); }

  /* 两行布局：上是名字，下是数值；均不拆词 */
  .rc-cell-name { color:#e5e7eb; line-height:1.2; white-space: nowrap; word-break: keep-all; }
  .rc-cell-exp  { color:#9ca3af; font-size:12px; line-height:1.2; white-space: nowrap; word-break: keep-all; }

  /* 修正 sticky 表头在带圆角容器内可能的裁切 */
  /* 外层面板不滚动，只让表格区滚动 */
  .rc-panel { 
    max-height: 90vh;
    overflow: hidden;
  }

  /* 表格滚动容器：默认 60vh，阻止滚动冒泡 */
  .rc-scroller {
    position: relative;
    max-height: 60vh;                 /* 桌面与通用回退 */
    overflow: auto;
    overscroll-behavior: contain;     /* 阻断滚动链 */
    -webkit-overflow-scrolling: touch;/* iOS 惯性 */
  }

  /* 支持 dvh 的浏览器，用 60dvh 更贴合移动端地址栏收起/展开 */
  @supports (height: 1dvh) {
    .rc-panel { max-height: 90dvh; }
    .rc-scroller { max-height: 60dvh; }
  }

  /* JS 动态 vh 回退（通过 --rc-vh 注入） */
  .rc-scroller.use-js-vh {
    max-height: calc(var(--rc-vh, 1vh) * 60);
  }
  .rc-panel.use-js-vh {
    max-height: calc(var(--rc-vh, 1vh) * 90);
  }

  /* 小屏优化（<=640px）：保留两列，但更紧凑 */
  @media (max-width: 640px) {
    .rc-panel table { font-size: 0.875rem; }         /* 14px */
    .rc-panel table th, .rc-panel table td { padding: 8px 10px; }
    .rc-scroller { max-height: 70vh; }
  }
</style>

<section class="space-y-4">
  <!-- 显示/隐藏（可通过 no-toggle 隐藏） -->
  <button class="rc-toggle ${this.noToggle ? "hidden" : ""} bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white font-semibold px-4 py-2 rounded shadow-lg">
    ${toggleText}
  </button>

  <!-- 主面板 -->
  <div class="rc-panel ${this.initialCollapsed && !this.noToggle ? "hidden" : ""} bg-white/5 backdrop-blur-sm rounded-lg shadow-inner p-4">

    <!-- 过滤区 -->
    <div class="grid md:grid-cols-4 gap-3">
      <div>
        <label class="block text-sm text-gray-300 mb-1">系别（国家/阵营）</label>
        <select class="rc-country w-full bg-gray-800 text-white rounded px-3 py-2">
          <option value="">全部</option>
        </select>
      </div>
      <div>
        <label class="block text-sm text-gray-300 mb-1">车型</label>
        <select class="rc-type w-full bg-gray-800 text-white rounded px-3 py-2">
          <option value="">全部</option>
          <option value="HT">重坦</option>
          <option value="MT">中坦</option>
          <option value="LT">轻坦</option>
          <option value="TD">TD</option>
          <option value="SPG">火炮</option>
        </select>
      </div>
      <div class="md:col-span-2">
        <label class="block text-sm text-gray-300 mb-1">车名（支持模糊匹配）</label>
        <input class="rc-name w-full bg-gray-800 text-white rounded px-3 py-2" placeholder="输入车名片段…" />
      </div>
    </div>

    <!-- 操作区：筛选 + 排序 -->
    <div class="flex flex-wrap items-center gap-2 mt-3">
      <button class="rc-apply ${this.autoFilter ? "hidden" : ""} bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-3 py-2 rounded">应用筛选</button>
      <button class="rc-clear bg-gray-600 hover:bg-gray-700 text-white text-sm font-semibold px-3 py-2 rounded">清空筛选</button>

      <div class="flex items-center gap-2 ml-0 md:ml-4">
        <label class="text-sm text-gray-300">排序：</label>
        <select class="rc-sort w-36 bg-gray-800 text-white rounded px-2 py-2 text-sm">
          <option value="none">不排序</option>
          <option value="allExp">总经验</option>
        </select>
        <button class="rc-order bg-gray-700 hover:bg-gray-600 text-white text-xs font-semibold px-2 py-2 rounded" title="切换升/降序">
          ↑ 升序
        </button>
      </div>

      <span class="rc-count text-sm text-gray-300 ml-auto">—</span>
    </div>

    <!-- 表格：外层滚动盒，固定最大高度 -->
    <div class="overflow-x-auto mt-4 rc-scroller" style="max-height:${this.panelHeight}; overflow:auto;">
      <table class="min-w-full text-sm text-gray-200 table-fixed border-separate border-spacing-0">
        <colgroup>
          <col style="width:100px" />   <!-- 系别 -->
          <col style="width:80px"  />   <!-- 车型 -->
          <col style="width:120px" />   <!-- 总重置经验 -->
          <col style="width:160px" />   <!-- VI -->
          <col style="width:160px" />   <!-- VII -->
          <col style="width:160px" />   <!-- VIII -->
          <col style="width:160px" />   <!-- IX -->
          <col style="width:160px" />   <!-- X -->
        </colgroup>
        <thead class="bg-gray-800 text-gray-100 sticky top-0 z-10">
          <tr>
            <th class="px-3 py-2 text-left rc-nowrap">系别</th>
            <th class="px-3 py-2 text-left rc-nowrap">车型</th>
            <th class="px-3 py-2 text-right rc-nowrap">总重置经验</th>
            <th class="px-3 py-2 text-left rc-nowrap">VI</th>
            <th class="px-3 py-2 text-left rc-nowrap">VII</th>
            <th class="px-3 py-2 text-left rc-nowrap">VIII</th>
            <th class="px-3 py-2 text-left rc-nowrap">IX</th>
            <th class="px-3 py-2 text-left rc-nowrap">X</th>
          </tr>
        </thead>
        <tbody class="rc-body"></tbody>
      </table>
    </div>
  </div>
</section>
    `;
  }

  cacheEls() {
    this.elToggle = this.querySelector(".rc-toggle");
    this.elPanel = this.querySelector(".rc-panel");
    this.elCountry = this.querySelector(".rc-country");
    this.elType = this.querySelector(".rc-type");
    this.elName = this.querySelector(".rc-name");
    this.elApply = this.querySelector(".rc-apply");
    this.elClear = this.querySelector(".rc-clear");
    this.elSort = this.querySelector(".rc-sort");
    this.elOrder = this.querySelector(".rc-order");
    this.elCount = this.querySelector(".rc-count");
    this.elBody = this.querySelector(".rc-body");
  }

  bindEvents() {
    // 显示/隐藏
    this.elToggle?.addEventListener("click", () => {
      const show = this.elPanel.classList.contains("hidden");
      this.elPanel.classList.toggle("hidden", !show);
      this.elToggle.textContent = show ? "隐藏重置计算器" : "显示重置计算器";
      if (show && !this._loaded) this.loadData();
    });

    // 筛选（两种模式：手动按钮 or 动态）
    if (this.autoFilter) {
      const doRender = () => this.render(this.filter());
      this.elCountry.addEventListener("change", doRender);
      this.elType.addEventListener("change", doRender);
      let timer = null;
      this.elName.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(doRender, 150);
      });
    } else {
      this.elApply.addEventListener("click", () => this.render(this.filter()));
      this.elName.addEventListener("keydown", (e) => { if (e.key === "Enter") this.render(this.filter()); });
    }

    // 清空筛选
    this.elClear.addEventListener("click", () => {
      this.elCountry.value = "";
      this.elType.value = "";
      this.elName.value = "";
      this.render(this.filter());
    });

    // 排序
    this.elSort.addEventListener("change", () => { this.sortKey = this.elSort.value; this.render(this.filter()); });
    this.elOrder.addEventListener("click", () => {
      this.sortDir = this.sortDir === "desc" ? "asc" : "desc";
      this.elOrder.textContent = this.sortDir === "desc" ? "↓ 降序" : "↑ 升序";
      this.render(this.filter());
    });
  }

  async loadData() {
    this._loaded = true;
    try {
      const res = await fetch(this.dataUrl + "?v=" + Date.now(), { cache: "no-store" });
      const json = await res.json();
      this.raw = Array.isArray(json) ? this.extractFromDumpOrUse(json) : [];
      if (!Array.isArray(this.raw)) this.raw = [];

      const countries = [...new Set(this.raw.map((r) => r.country))].sort();
      this.elCountry.innerHTML = ['<option value="">全部</option>']
        .concat(countries.map((c) => `<option value="${this.esc(c)}">${this.esc(c)}</option>`))
        .join("");

      this.render(this.filter());
    } catch (e) {
      console.error("reset-calc: 数据加载失败", e);
      this.elCount.textContent = "数据加载失败";
    }
  }

  extractFromDumpOrUse(arr) {
    if (arr.length && arr[0] && typeof arr[0] === "object" && "country" in arr[0]) {
      return arr.map((r) => this.normalizeRow(r));
    }
    const t = arr.find((x) => x && x.type === "table" && x.name === "resetexp" && x.data);
    if (!t) return [];
    return t.data.map((r) => this.normalizeRow(r));
  }

  normalizeRow(r) {
    return {
      country: r.country || "",
      vehicleType: r.vehicleType || "",
      allExp: this.toInt(r.allExp),
      name6: r.name6 || "",
      exp6: this.toInt(r.exp6),
      name7: r.name7 || "",
      exp7: this.toInt(r.exp7),
      name8: r.name8 || "",
      exp8: this.toInt(r.exp8),
      name9: r.name9 || "",
      exp9: this.toInt(r.exp9),
      name10: r.name10 || "",
      exp10: this.toInt(r.exp10),
    };
  }

  filter() {
    const ctry = (this.elCountry.value || "").trim();
    const type = (this.elType.value || "").trim();
    const key = (this.elName.value || "").trim().toLowerCase();

    return (this.raw || []).filter((r) => {
      if (ctry && r.country !== ctry) return false;
      if (type && r.vehicleType !== type) return false;
      if (key) {
        const hay = [r.name6, r.name7, r.name8, r.name9, r.name10].join(" ").toLowerCase();
        if (!hay.includes(key)) return false;
      }
      return true;
    });
  }

  render(rows) {
    // 排序（稳定）
    if (this.sortKey !== "none") {
      const key = this.sortKey;
      const dir = this.sortDir === "desc" ? -1 : 1;
      rows = rows
        .map((r, i) => ({ r, i }))
        .sort((a, b) => {
          const va = typeof a.r[key] === "number" ? a.r[key] : 0;
          const vb = typeof b.r[key] === "number" ? b.r[key] : 0;
          if (va === vb) return a.i - b.i;
          return va < vb ? -1 * dir : 1 * dir;
        })
        .map((x) => x.r);
    }

    const num = (n) => (typeof n === "number" ? n.toLocaleString() : n);
    const esc = (s) => this.esc(s || "-");
    const typeCN = (v) => this.typeMap[v] || v || "-";

    this.elBody.innerHTML = rows.map((r) => `
      <tr>
        <td class="px-3 py-2 rc-nowrap">${esc(r.country)}</td>
        <td class="px-3 py-2 rc-nowrap">${esc(typeCN(r.vehicleType))}</td>
        <td class="px-3 py-2 rc-num rc-num-mono tabular-nums rc-nowrap">${num(r.allExp)}</td>
        <td class="px-3 py-2">
          <div class="rc-cell-name">${esc(r.name6)}</div>
          <div class="rc-cell-exp rc-num rc-num-mono">${r.exp6 ? num(r.exp6) : "-"}</div>
        </td>
        <td class="px-3 py-2">
          <div class="rc-cell-name">${esc(r.name7)}</div>
          <div class="rc-cell-exp rc-num rc-num-mono">${r.exp7 ? num(r.exp7) : "-"}</div>
        </td>
        <td class="px-3 py-2">
          <div class="rc-cell-name">${esc(r.name8)}</div>
          <div class="rc-cell-exp rc-num rc-num-mono">${r.exp8 ? num(r.exp8) : "-"}</div>
        </td>
        <td class="px-3 py-2">
          <div class="rc-cell-name">${esc(r.name9)}</div>
          <div class="rc-cell-exp rc-num rc-num-mono">${r.exp9 ? num(r.exp9) : "-"}</div>
        </td>
        <td class="px-3 py-2">
          <div class="rc-cell-name">${esc(r.name10)}</div>
          <div class="rc-cell-exp rc-num rc-num-mono">${r.exp10 ? num(r.exp10) : "-"}</div>
        </td>
      </tr>`).join("");

    this.elCount.textContent = `结果：${rows.length} 条`;
  }

  // 工具
  toInt(v) {
    const n = parseInt(String(v ?? "0").replace(/[^\d-]/g, ""), 10);
    return Number.isNaN(n) ? 0 : n;
  }
  esc(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]));
  }
}
customElements.define("reset-calc", ResetCalc);

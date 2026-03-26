// ==========================================
// 1. 配置与全局状态
// ==========================================
const API_BASE = 'https://lesta-skins-api.onlyax.com'; // 你的自定义域名
let adminToken = '';
let isUploadMode = false;
let allSkins = [];              // 存储所有数据，用于本地秒级筛选排序
let currentRenderedSkins = [];  // 记录当前展示的数据，用于窗口缩放时重绘

let currentEditId = null;       // 记录当前正在编辑的涂装 ID
let currentEditImageUrl = '';   // 记录当前编辑涂装的原始图片链接

// 监听窗口尺寸改变，自动重新调整列数排版 (防抖处理)
window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (currentRenderedSkins.length > 0) renderWaterfall(currentRenderedSkins);
    }, 200); 
});

// ==========================================
// 2. 初始化与事件绑定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 解析 URL 参数鉴权
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        isUploadMode = true;
        adminToken = token;
        document.getElementById('adminBadge').style.display = 'block';
        document.getElementById('uploadSection').style.display = 'block';
    }

    // 初始获取数据
    fetchSkins();

    // 绑定表单交互事件
    const uploadForm = document.getElementById('uploadForm');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (uploadForm) uploadForm.addEventListener('submit', handleUpload);
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

    // 绑定筛选与排序事件
    const searchInput = document.getElementById('searchInput');
    const tierFilter = document.getElementById('tierFilter');
    const sortFilter = document.getElementById('sortFilter');
    if (searchInput) searchInput.addEventListener('input', applyFiltersAndSort);
    if (tierFilter) tierFilter.addEventListener('change', applyFiltersAndSort);
    if (sortFilter) sortFilter.addEventListener('change', applyFiltersAndSort);

    // 绑定 UML 教程按钮与弹窗
    const umlGuideBtn = document.getElementById('umlGuideBtn');
    const closeUmlBtn = document.getElementById('closeUmlModal');
    if (umlGuideBtn) umlGuideBtn.addEventListener('click', openUmlModal);
    if (closeUmlBtn) closeUmlBtn.addEventListener('click', closeUmlModal);

    // 绑定 UML 插件的直接下载按钮
    const downloadUmlBtn = document.getElementById('downloadUmlBtn');
    if (downloadUmlBtn) {
        downloadUmlBtn.addEventListener('click', () => {
            const umlUrl = "https://wwaxk.lanzoue.com/b019vreyfi";
            const umlPwd = "ch58";
            executeDownload(umlUrl, umlPwd, null);
        });
    }

    // 绑定大图预览关闭事件 (点击 X 或点击黑色背景)
    const lightbox = document.getElementById('lightbox');
    const lightboxClose = document.getElementById('lightboxClose');
    if (lightbox) {
        lightbox.addEventListener('click', (e) => {
            if (e.target === lightbox || e.target === lightboxClose) {
                lightbox.style.display = 'none';
            }
        });
    }
});

// ==========================================
// 3. UI 交互与通用工具函数
// ==========================================
// 罗马数字转换
function getRomanTier(tier) {
    const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI' };
    return romanMap[tier] || tier;
}

// 现代化 Toast 提示系统
function showToast(message, duration = 2500) {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'toast-msg';
    toast.innerHTML = message;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// UML 弹窗控制
function openUmlModal() {
    const isHidden = localStorage.getItem('hideUmlGuide') === 'true';
    document.getElementById('noMoreUmlPrompt').checked = isHidden;
    document.getElementById('umlModal').style.display = 'flex';
}

function closeUmlModal() {
    const isChecked = document.getElementById('noMoreUmlPrompt').checked;
    if (isChecked) {
        localStorage.setItem('hideUmlGuide', 'true');
    } else {
        localStorage.removeItem('hideUmlGuide');
    }
    document.getElementById('umlModal').style.display = 'none';
}

// 大图预览控制
function openLightbox(imageUrl) {
    document.getElementById('lightboxImg').src = imageUrl;
    document.getElementById('lightbox').style.display = 'flex';
}

// ==========================================
// 4. 数据获取、过滤与排序
// ==========================================
async function fetchSkins() {
    try {
        const res = await fetch(`${API_BASE}/api/skins`);
        if (res.ok) {
            allSkins = await res.json();
            applyFiltersAndSort(); // 获取完数据直接触发前端排序和渲染
        } else {
            showToast('获取涂装列表失败，请刷新重试');
        }
    } catch (error) {
        console.error('网络请求失败:', error);
    }
}

// 终极过滤与排序中枢
function applyFiltersAndSort() {
    if (!allSkins || allSkins.length === 0) return;

    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const tierVal = document.getElementById('tierFilter').value;
    const sortVal = document.getElementById('sortFilter').value;

    // 1. 执行过滤
    let result = allSkins.filter(skin => {
        const matchSearch = skin.tank_model.toLowerCase().includes(searchTerm) || 
                            (skin.author && skin.author.toLowerCase().includes(searchTerm));
        let matchTier = true;
        if (tierVal !== 'all') {
            if (tierVal === '<=7') {
                matchTier = skin.tier <= 7;
            } else {
                matchTier = skin.tier === parseInt(tierVal);
            }
        }
        return matchSearch && matchTier;
    });

    // 2. 执行排序
    const now = Date.now();
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;

    result.sort((a, b) => {
        const timeA = a.updated_at ? new Date(a.updated_at).getTime() : (a.created_at ? new Date(a.created_at).getTime() : 0);
        const timeB = b.updated_at ? new Date(b.updated_at).getTime() : (b.created_at ? new Date(b.created_at).getTime() : 0);
        const dlA = a.download_count || 0;
        const dlB = b.download_count || 0;

        switch (sortVal) {
            case 'hot':
                const aIsRecent = (now - timeA) < thirtyDays;
                const bIsRecent = (now - timeB) < thirtyDays;
                if (aIsRecent && bIsRecent) {
                    if (dlB !== dlA) return dlB - dlA; 
                    return timeB - timeA; 
                }
                if (aIsRecent && !bIsRecent) return -1;
                if (!aIsRecent && bIsRecent) return 1;
                return timeB - timeA;
            case 'newest':
                return timeB - timeA;
            case 'downloads':
                return dlB - dlA;
            case 'name':
                return a.tank_model.localeCompare(b.tank_model, 'zh-CN');
            default:
                return 0;
        }
    });

    // 3. 渲染
    renderWaterfall(result);
}

// ==========================================
// 5. 核心渲染引擎 (瀑布流分发)
// ==========================================
function renderWaterfall(skins) {
    currentRenderedSkins = skins;
    const grid = document.getElementById('waterfallGrid');
    grid.innerHTML = '';

    if (skins.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#888; width:100%; margin-top:40px;">没有找到符合条件的涂装 😿</p>';
        return;
    }

    // 找出数据库中“最新的一天”，用于打 NEW 标签
    let latestDayString = '';
    const validTimes = skins.map(s => s.updated_at || s.created_at).filter(t => t).map(t => new Date(t).getTime());
    if (validTimes.length > 0) {
        const maxTime = Math.max(...validTimes);
        latestDayString = new Date(maxTime).toDateString();
    }

    // === 修复版：严格依赖宽度的列数计算 (完美适配 iPad 和手机) ===
    const winWidth = window.innerWidth;
    let colCount = 1;

    if (winWidth > 1024) {
        colCount = 4; // 大宽屏电脑
    } else if (winWidth > 768) {
        colCount = 3; // iPad 横屏或小尺寸笔记本
    } else if (winWidth > 600) {
        colCount = 2; // iPad 竖屏 (768px) 或大尺寸折叠屏
    } else {
        colCount = 1; // 手机屏幕 (<=600px)，配合 CSS 变为横向卡片
    }

    const columns = [];
    for (let i = 0; i < colCount; i++) {
        const col = document.createElement('div');
        col.className = 'masonry-column';
        grid.appendChild(col);
        columns.push(col);
    }

    // 像发牌一样分发卡片
    skins.forEach((skin, index) => {
        let coverImg = 'placeholder.jpg';
        let downloads = [];
        try {
            const images = JSON.parse(skin.preview_images);
            if (images.length > 0) coverImg = images[0];
            downloads = JSON.parse(skin.downloads);
        } catch (e) { }

        const card = document.createElement('div');
        card.className = 'skin-card';

        // 管理员操作面板
        let adminHtml = '';
        if (isUploadMode) {
            const safeSkinData = encodeURIComponent(JSON.stringify(skin));
            adminHtml = `
            <div class="admin-actions">
              <button onclick="editSkin('${safeSkinData}')" class="edit-btn">修改</button>
              <button onclick="deleteSkin(${skin.id})" class="delete-btn">删除</button>
            </div>
          `;
        }

        // 标签系统计算
        let isNew = false;
        const skinTimeRaw = skin.updated_at || skin.created_at;
        if (skinTimeRaw && latestDayString && new Date(skinTimeRaw).toDateString() === latestDayString) {
            isNew = true;
        }
        const newTagHtml = isNew ? `<div class="new-tag">NEW</div>` : '';
        const umlTagHtml = skin.is_uml_required ? `<div class="uml-tag">UML 必需</div>` : '';
        
        const metaHtml = `
          <div class="card-meta">
            ${skin.author ? `<span class="author-text">🎨 ${skin.author}</span>` : '<span></span>'}
            ${skin.download_count > 0 ? `<span class="download-count">🔥 ${skin.download_count}</span>` : ''}
          </div>
        `;

        card.innerHTML = `
          <div class="img-wrapper">
            ${newTagHtml}
            ${umlTagHtml}
            <img src="${coverImg}" loading="lazy" class="cover-img" alt="${skin.tank_model}" onload="this.classList.add('loaded')" onerror="this.src='/fallback.jpg'; this.classList.add('loaded');" />
          </div>
          <div class="card-info">
            <h3>${skin.tank_model} <span class="tier-tag">${getRomanTier(skin.tier)}</span></h3>
            ${metaHtml}
            <button class="download-btn">获取涂装</button>
            ${adminHtml}
          </div>
        `;

        // 绑定卡片内部事件
        card.querySelector('.cover-img').addEventListener('click', () => openLightbox(coverImg));
        card.querySelector('.download-btn').addEventListener('click', () => handleDownload(skin));

        // 放入对应列
        columns[index % colCount].appendChild(card);
    });
}

// ==========================================
// 6. 核心业务：下载、上传、删改
// ==========================================

// --- 纯净的下载与拦截逻辑 ---
async function executeDownload(url, pwd, skinId) {
    if (!url) return;

    // 触发后端计次 (带本地防刷限制)
    if (skinId) {
        const downloadedKey = `downloaded_${skinId}`;
        if (!localStorage.getItem(downloadedKey)) {
            fetch(`${API_BASE}/api/download`, {
                method: 'POST',
                body: JSON.stringify({ id: skinId }),
                headers: { 'Content-Type': 'application/json' }
            }).then(res => {
                if (res.ok) localStorage.setItem(downloadedKey, 'true');
            }).catch(err => console.error("计数失败", err));
        }
    }

    // 复制密码并跳转
    if (pwd) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(pwd);
                document.getElementById('umlModal').style.display = 'none'; // 如果有弹窗，自动关掉
                showToast(`🎉 提取码 <b style="color: #eccc68;">${pwd}</b> 已复制<br><span style="font-size: 0.85em; opacity: 0.8;">即将前往下载...</span>`, 2000);
            } else {
                showToast(`📌 提取码为 <b style="color: #eccc68;">${pwd}</b><br><span style="font-size: 0.85em; opacity: 0.8;">(本地环境需手动复制) 即将前往...</span>`, 2500);
            }
        } catch (err) {
            showToast(`📌 提取码为 <b style="color: #eccc68;">${pwd}</b><br><span style="font-size: 0.85em; opacity: 0.8;">即将前往下载...</span>`, 2500);
        }
        setTimeout(() => window.open(url, '_blank'), 1500);
    } else {
        showToast(`🚀 即将前往下载页面...`, 1000);
        setTimeout(() => window.open(url, '_blank'), 800);
    }
}

// --- 卡片点击下载入口 ---
async function handleDownload(skin) {
    if (skin.is_uml_required) {
        const hideGuide = localStorage.getItem('hideUmlGuide') === 'true';
        if (!hideGuide) return openUmlModal(); // 弹出教程中断下载
    }

    let downloads = [];
    try { downloads = JSON.parse(skin.downloads); } catch (e) { }
    if (downloads.length === 0) return;

    await executeDownload(downloads[0].url, downloads[0].pwd, skin.id);
}

// --- 智能表单提交 (区分新建与更新) ---
async function handleUpload(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const fileInput = document.getElementById('skinFile');
    const file = fileInput.files[0];

    if (!currentEditId && !file) {
        return showToast('❌ 请选择涂装预览图');
    }

    submitBtn.disabled = true;
    submitBtn.textContent = currentEditId ? '保存中...' : '上传中...';

    try {
        let finalImageUrl = currentEditImageUrl;

        // 若有新图片，先传 R2
        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fetch(`${API_BASE}/api/upload`, {
                method: 'POST',
                headers: { 'Authorization': encodeURIComponent(adminToken) },
                body: formData
            });

            if (!uploadRes.ok) throw new Error('图片上传失败，请检查 Token');
            const { url } = await uploadRes.json();
            finalImageUrl = url; 
        }

        const skinData = {
            tank_model: document.getElementById('tankModel').value,
            tier: parseInt(document.getElementById('tankTier').value),
            preview_images: [finalImageUrl],
            downloads: [{
                url: document.getElementById('lanzouUrl').value,
                pwd: document.getElementById('lanzouPwd').value
            }],
            author: document.getElementById('skinAuthor').value || '佚名',
            is_uml_required: parseInt(document.getElementById('isUml').value) || 0
        };

        const fetchUrl = currentEditId ? `${API_BASE}/api/skins/${currentEditId}` : `${API_BASE}/api/skins`;
        const fetchMethod = currentEditId ? 'PUT' : 'POST';

        const dbRes = await fetch(fetchUrl, {
            method: fetchMethod,
            headers: { 'Authorization': encodeURIComponent(adminToken), 'Content-Type': 'application/json' },
            body: JSON.stringify(skinData)
        });

        if (dbRes.ok) {
            showToast(currentEditId ? '✨ 涂装信息已更新！' : '✨ 涂装发布成功！');
            cancelEdit(); 
            fetchSkins(); 
        } else {
            throw new Error('数据库写入失败');
        }
    } catch (error) {
        showToast(`❌ 错误: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = currentEditId ? '保存修改' : '发布涂装';
    }
}

// --- 后台管理：删除涂装 ---
async function deleteSkin(id) {
    if (!confirm('🚨 确定要永久删除这个涂装吗？操作不可逆！')) return;
    try {
        const res = await fetch(`${API_BASE}/api/skins/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': encodeURIComponent(adminToken) }
        });
        if (res.ok) {
            showToast('🗑️ 涂装已删除');
            fetchSkins();
        } else {
            throw new Error('删除失败，请检查 Token');
        }
    } catch (error) {
        showToast(`❌ 错误: ${error.message}`);
    }
}

// --- 后台管理：进入编辑状态 ---
function editSkin(encodedSkin) {
    const skin = JSON.parse(decodeURIComponent(encodedSkin));
    currentEditId = skin.id;

    let url = '', pwd = '';
    try {
        const downloads = JSON.parse(skin.downloads);
        if (downloads.length > 0) { url = downloads[0].url; pwd = downloads[0].pwd; }
    } catch (e) { }

    try {
        const images = JSON.parse(skin.preview_images);
        if (images.length > 0) currentEditImageUrl = images[0];
    } catch (e) { }

    document.getElementById('tankModel').value = skin.tank_model;
    document.getElementById('tankTier').value = skin.tier;
    document.getElementById('lanzouUrl').value = url;
    document.getElementById('lanzouPwd').value = pwd;
    document.getElementById('skinAuthor').value = skin.author || '';
    document.getElementById('isUml').value = skin.is_uml_required ? "1" : "0";

    document.getElementById('skinFile').required = false;
    document.getElementById('submitBtn').textContent = '保存修改';
    document.getElementById('cancelEditBtn').style.display = 'block';

    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- 后台管理：取消编辑状态 ---
function cancelEdit() {
    currentEditId = null;
    currentEditImageUrl = '';
    document.getElementById('uploadForm').reset();
    document.getElementById('skinFile').required = true; 
    document.getElementById('submitBtn').textContent = '发布涂装';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('isUml').value = "0";
}
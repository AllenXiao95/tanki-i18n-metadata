// ==========================================
// 1. 配置与全局状态
// ==========================================
const API_BASE = 'https://lesta-skins-api.onlyax.com'; // 你的自定义域名
let adminToken = '';
let isUploadMode = false;
let allSkins = []; // 存储所有数据，用于本地秒级筛选
let currentEditId = null;       // 记录当前正在编辑的涂装 ID
let currentEditImageUrl = '';   // 记录当前编辑涂装的原始图片链接

let currentRenderedSkins = []; // 记录当前展示的数据

// 监听窗口尺寸改变，自动重新调整列数排版
window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (currentRenderedSkins.length > 0) renderWaterfall(currentRenderedSkins);
    }, 200); // 200ms 防抖
});

// ==========================================
// 2. 初始化与事件绑定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    // 解析 URL 参数鉴权
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const cancelEditBtn = document.getElementById('cancelEditBtn');
    if (cancelEditBtn) cancelEditBtn.addEventListener('click', cancelEdit);

    if (token) {
        isUploadMode = true;
        adminToken = token;
        document.getElementById('adminBadge').style.display = 'block';
        document.getElementById('uploadSection').style.display = 'block';
    }

    // 初始获取数据
    fetchSkins();

    // 绑定表单提交
    const uploadForm = document.getElementById('uploadForm');
    if (uploadForm) uploadForm.addEventListener('submit', handleUpload);

    // 绑定筛选事件
    const searchInput = document.getElementById('searchInput');
    const tierFilter = document.getElementById('tierFilter');
    if (searchInput) searchInput.addEventListener('input', applyFilters);
    if (tierFilter) tierFilter.addEventListener('change', applyFilters);

    // 绑定 UML 插件的下载按钮
    const downloadUmlBtn = document.getElementById('downloadUmlBtn');
    if (downloadUmlBtn) {
        downloadUmlBtn.addEventListener('click', () => {
            // 请在这里填入你真实的 UML 蓝奏云链接和密码
            const umlUrl = "https://wwaxk.lanzoue.com/b019vreyfi";
            const umlPwd = "ch58";
            executeDownload(umlUrl, umlPwd, null);
        });
    }

    // 绑定 UML 教程按钮与弹窗
    const umlGuideBtn = document.getElementById('umlGuideBtn');
    const closeUmlBtn = document.getElementById('closeUmlModal');
    if (umlGuideBtn) umlGuideBtn.addEventListener('click', openUmlModal);
    if (closeUmlBtn) closeUmlBtn.addEventListener('click', closeUmlModal);

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
// 3. 核心工具函数
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

// ==========================================
// 4. 数据获取与筛选渲染
// ==========================================
async function fetchSkins() {
    try {
        const res = await fetch(`${API_BASE}/api/skins`);
        if (res.ok) {
            allSkins = await res.json();
            renderWaterfall(allSkins);
        } else {
            console.error('获取失败，状态码:', res.status);
            showToast('获取涂装列表失败，请刷新重试');
        }
    } catch (error) {
        console.error('网络请求失败:', error);
    }
}

function applyFilters() {
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    const tierValue = document.getElementById('tierFilter').value;

    const filtered = allSkins.filter(skin => {
        const matchName = skin.tank_model.toLowerCase().includes(searchTerm);
        let matchTier = false;

        if (tierValue === 'all') {
            matchTier = true;
        } else if (tierValue === '7-') {
            matchTier = skin.tier <= 7;
        } else {
            matchTier = skin.tier.toString() === tierValue;
        }

        return matchName && matchTier;
    });

    renderWaterfall(filtered);
}

function renderWaterfall(skins) {
    currentRenderedSkins = skins;
    const grid = document.getElementById('waterfallGrid');
    grid.innerHTML = '';

    if (skins.length === 0) {
        grid.innerHTML = '<p style="text-align:center; color:#888; width:100%; margin-top:40px;">没有找到符合条件的涂装 😿</p>';
        return;
    }

    // === 核心算法：找出数据库中“最新的一天” ===
    let latestDayString = '';
    // 提取所有有效的时间戳
    const validTimes = skins
        .map(s => s.updated_at || s.created_at)
        .filter(t => t) // 过滤掉空值
        .map(t => new Date(t).getTime());

    if (validTimes.length > 0) {
        const maxTime = Math.max(...validTimes); // 找到最近的那个时间戳
        latestDayString = new Date(maxTime).toDateString(); // 转换为本地日期字符串 (如: "Wed Mar 25 2026")，抹除具体时分秒
    }
    // =========================================

    let colCount = 2;
    if (window.innerWidth >= 768) colCount = 3;
    if (window.innerWidth >= 1024) colCount = 4;

    const columns = [];
    for (let i = 0; i < colCount; i++) {
        const col = document.createElement('div');
        col.className = 'masonry-column';
        grid.appendChild(col);
        columns.push(col);
    }

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

        // === 判断当前涂装是否属于“最新的一天” ===
        let isNew = false;
        const skinTimeRaw = skin.updated_at || skin.created_at;
        if (skinTimeRaw && latestDayString) {
            // 只要日期部分和最新的一天吻合，哪怕一天传了 10 个，这 10 个都是 NEW
            if (new Date(skinTimeRaw).toDateString() === latestDayString) {
                isNew = true;
            }
        }
        const newTagHtml = isNew ? `<div class="new-tag">NEW</div>` : '';
        // =========================================

        const umlTagHtml = skin.is_uml_required ? `<div class="uml-tag">UML 必需</div>` : '';
        const metaHtml = `
      <div class="card-meta">
        ${skin.author ? `<span class="author-text">🎨 ${skin.author}</span>` : '<span></span>'}
        ${skin.download_count > 0 ? `<span class="download-count">🔥 ${skin.download_count}</span>` : ''}
      </div>
    `;

        // 记得在 img-wrapper 里保留 ${newTagHtml} 
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

        const imgElement = card.querySelector('.cover-img');
        imgElement.addEventListener('click', () => openLightbox(coverImg));

        const btn = card.querySelector('.download-btn');
        btn.addEventListener('click', () => handleDownload(skin));

        const targetColIndex = index % colCount;
        columns[targetColIndex].appendChild(card);
    });
}

// ==========================================
// 5. 核心业务逻辑：下载、上传、删改
// ==========================================

// --- 下载与复制逻辑 ---
async function executeDownload(url, pwd, skinId) {
    if (!url) return;

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

    if (pwd) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(pwd);
                document.getElementById('umlModal').style.display = 'none';

                showToast(`🎉 提取码 <b style="color: #eccc68;">${pwd}</b> 已复制<br><span style="font-size: 0.85em; opacity: 0.8;">即将前往下载...</span>`, 2000);
            } else {
                showToast(`📌 提取码为 <b style="color: #eccc68;">${pwd}</b><br><span style="font-size: 0.85em; opacity: 0.8;">(本地环境需手动复制) 即将前往...</span>`, 2500);
            }
        } catch (err) {
            console.error('复制拦截:', err);
            showToast(`📌 提取码为 <b style="color: #eccc68;">${pwd}</b><br><span style="font-size: 0.85em; opacity: 0.8;">即将前往下载...</span>`, 2500);
        }
        setTimeout(() => window.open(url, '_blank'), 1500);
    } else {
        showToast(`🚀 即将前往下载页面...`, 1000);
        setTimeout(() => window.open(url, '_blank'), 800);
    }
}

// --- 卡片点击下载逻辑 (包裹了 UML 拦截) ---
async function handleDownload(skin) {
    // 1. 检查 UML 依赖并触发弹窗 (如果需要的话)
    if (skin.is_uml_required) {
        const hideGuide = localStorage.getItem('hideUmlGuide') === 'true';
        if (!hideGuide) {
            return openUmlModal(); // 弹出教程
        }
    }

    // 2. 解析当前涂装的下载链接
    let downloads = [];
    try { downloads = JSON.parse(skin.downloads); } catch (e) { }
    if (downloads.length === 0) return;

    const { url, pwd } = downloads[0];

    // 3. 调用核心下载逻辑
    await executeDownload(url, pwd, skin.id);
}

// --- 上传逻辑 ---
async function handleUpload(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const fileInput = document.getElementById('skinFile');
    const file = fileInput.files[0];

    if (!file) return;

    submitBtn.disabled = true;
    submitBtn.textContent = '上传中...';

    try {
        // 1. 传图至 R2
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await fetch(`${API_BASE}/api/upload`, {
            method: 'POST',
            headers: { 'Authorization': encodeURIComponent(adminToken) },
            body: formData
        });

        if (!uploadRes.ok) throw new Error('图片上传失败，Token 可能无效');
        const { url: imageUrl } = await uploadRes.json();

        // 2. 存数据至 D1
        const skinData = {
            tank_model: document.getElementById('tankModel').value,
            tier: parseInt(document.getElementById('tankTier').value),
            preview_images: [imageUrl],
            downloads: [{
                url: document.getElementById('lanzouUrl').value,
                pwd: document.getElementById('lanzouPwd').value
            }]
        };

        const dbRes = await fetch(`${API_BASE}/api/skins`, {
            method: 'POST',
            headers: {
                'Authorization': encodeURIComponent(adminToken),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(skinData)
        });

        if (dbRes.ok) {
            showToast('✨ 涂装发布成功！');
            document.getElementById('uploadForm').reset();
            fetchSkins();
        } else {
            throw new Error('数据库写入失败');
        }
    } catch (error) {
        showToast(`❌ 错误: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '发布涂装';
    }
}

// --- 管理员：删除涂装 ---
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

// --- 管理员：修改涂装 ---
async function openEditModal(encodedSkin) {
    const skin = JSON.parse(decodeURIComponent(encodedSkin));
    let url = '', pwd = '';
    try {
        const downloads = JSON.parse(skin.downloads);
        if (downloads.length > 0) {
            url = downloads[0].url;
            pwd = downloads[0].pwd;
        }
    } catch (e) { }

    const newModel = prompt("修改车型名称：", skin.tank_model);
    if (newModel === null) return;

    const newTier = prompt("修改等级 (1-11)：", skin.tier);
    if (newTier === null) return;

    const newUrl = prompt("修改蓝奏云链接：", url);
    if (newUrl === null) return;

    const newPwd = prompt("修改提取密码 (无密码留空)：", pwd) || "";

    try {
        const res = await fetch(`${API_BASE}/api/skins/${skin.id}`, {
            method: 'PUT',
            headers: {
                'Authorization': encodeURIComponent(adminToken),
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                tank_model: newModel,
                tier: parseInt(newTier) || skin.tier,
                lanzouUrl: newUrl,
                lanzouPwd: newPwd
            })
        });

        if (res.ok) {
            showToast('✨ 涂装信息已更新');
            fetchSkins();
        } else {
            throw new Error('更新失败');
        }
    } catch (error) {
        showToast(`❌ 错误: ${error.message}`);
    }
}

// --- 管理员：将数据回填至表单进行编辑 ---
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

    // 回填数据
    document.getElementById('tankModel').value = skin.tank_model;
    document.getElementById('tankTier').value = skin.tier;
    document.getElementById('lanzouUrl').value = url;
    document.getElementById('lanzouPwd').value = pwd;
    document.getElementById('skinAuthor').value = skin.author || '';
    document.getElementById('isUml').value = skin.is_uml_required ? "1" : "0";

    // 编辑模式下，图片改为非必填项
    document.getElementById('skinFile').required = false;

    // 改变 UI 状态
    document.getElementById('submitBtn').textContent = '保存修改';
    document.getElementById('cancelEditBtn').style.display = 'block';

    // 页面平滑滚动回顶部，方便用户立刻看到表单
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// --- 管理员：取消编辑状态 ---
function cancelEdit() {
    currentEditId = null;
    currentEditImageUrl = '';

    // 清空表单并恢复新建模式的 UI 状态
    document.getElementById('uploadForm').reset();
    document.getElementById('skinFile').required = true; // 恢复图片必填
    document.getElementById('submitBtn').textContent = '发布涂装';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('isUml').value = "0";
}

// --- 核心：处理表单提交 (智能区分 新建 / 更新) ---
async function handleUpload(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const fileInput = document.getElementById('skinFile');
    const file = fileInput.files[0];

    // 如果是新建模式，但没选文件，拦截并提示
    if (!currentEditId && !file) {
        showToast('❌ 请选择涂装预览图');
        return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = currentEditId ? '保存中...' : '上传中...';

    try {
        let finalImageUrl = currentEditImageUrl;

        // 如果用户在表单里选择了新图片，先执行上传 R2
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
            finalImageUrl = url; // 使用新生成的 R2 链接
        }

        // 组装最终要写进 D1 的数据
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

        let dbRes;
        if (currentEditId) {
            // 走 PUT 更新逻辑
            dbRes = await fetch(`${API_BASE}/api/skins/${currentEditId}`, {
                method: 'PUT',
                headers: { 'Authorization': encodeURIComponent(adminToken), 'Content-Type': 'application/json' },
                body: JSON.stringify(skinData)
            });
        } else {
            // 走 POST 新建逻辑
            dbRes = await fetch(`${API_BASE}/api/skins`, {
                method: 'POST',
                headers: { 'Authorization': encodeURIComponent(adminToken), 'Content-Type': 'application/json' },
                body: JSON.stringify(skinData)
            });
        }

        if (dbRes.ok) {
            showToast(currentEditId ? '✨ 涂装信息已更新！' : '✨ 涂装发布成功！');
            cancelEdit(); // 无论新建还是更新成功，都重置表单状态
            fetchSkins(); // 刷新瀑布流
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

// --- UML 弹窗控制逻辑 ---
function openUmlModal() {
    // 每次打开时，同步 checkbox 的状态
    const isHidden = localStorage.getItem('hideUmlGuide') === 'true';
    document.getElementById('noMoreUmlPrompt').checked = isHidden;
    document.getElementById('umlModal').style.display = 'flex';
}

function closeUmlModal() {
    // 关闭时，保存 checkbox 的状态到本地存储
    const isChecked = document.getElementById('noMoreUmlPrompt').checked;
    if (isChecked) {
        localStorage.setItem('hideUmlGuide', 'true');
    } else {
        localStorage.removeItem('hideUmlGuide');
    }
    document.getElementById('umlModal').style.display = 'none';
}

// --- 大图预览控制逻辑 ---
function openLightbox(imageUrl) {
    document.getElementById('lightboxImg').src = imageUrl;
    document.getElementById('lightbox').style.display = 'flex';
}
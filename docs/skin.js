// ==========================================
// 1. 全局配置与状态
// ==========================================
const API_BASE = 'https://lesta-skins-api.onlyax.com';
const PARSE_WORKER_URL = "https://lanzou-api.onlyax.com";
const PARSE_SECRET_KEY = "0p.+HcezRABD}#!8J!2i";

let adminToken = '';
let isUploadMode = false;
let allSkins = [];
let currentRenderedSkins = [];
let currentEditId = null;
let currentEditImageUrl = '';

let isElectronBox = false;
let downloadedSkinIds = new Set();

// ==========================================
// 2. Electron JS Bridge (双向通信)
// ==========================================
window.addEventListener('message', (event) => {
    const msg = event.data;
    if (!msg || !msg.type) return;

    switch (msg.type) {
        case 'SYNC_DOWNLOADED_STATE':
            isElectronBox = true;
            if (Array.isArray(msg.payload)) {
                downloadedSkinIds = new Set(msg.payload);
                updateAllButtonsUI();
            }
            break;
        case 'DOWNLOAD_COMPLETED':
            if (msg.payload?.skinId) {
                downloadedSkinIds.add(msg.payload.skinId);
                updateAllButtonsUI();
                showToast('🎉 涂装下载安装完成！', 2000);
            }
            break;
    }
});

document.addEventListener('DOMContentLoaded', () => {
    if (window !== window.top) {
        window.parent.postMessage({ type: 'SKIN_WEB_READY' }, '*');
    }
});

// ==========================================
// 3. 安全与加密模块
// ==========================================
async function generateSecurePayload(url, pwd) {
    const dataStr = JSON.stringify({ url, pwd, timestamp: Date.now() });
    const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PARSE_SECRET_KEY));
    const cryptoKey = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt']);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(dataStr));

    const payloadBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    payloadBuffer.set(iv, 0);
    payloadBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

    return btoa(String.fromCharCode.apply(null, payloadBuffer));
}

// ==========================================
// 4. 初始化与事件绑定
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
        isUploadMode = true;
        adminToken = token;
        document.getElementById('adminBadge').style.display = 'block';
        document.getElementById('uploadSection').style.display = 'block';
    }

    fetchSkins();

    document.getElementById('uploadForm')?.addEventListener('submit', handleUpload);
    document.getElementById('cancelEditBtn')?.addEventListener('click', cancelEdit);

    document.getElementById('searchInput')?.addEventListener('input', applyFiltersAndSort);
    document.getElementById('tierFilter')?.addEventListener('change', applyFiltersAndSort);
    document.getElementById('sortFilter')?.addEventListener('change', applyFiltersAndSort);

    document.getElementById('umlGuideBtn')?.addEventListener('click', openUmlModal);
    document.getElementById('closeUmlModal')?.addEventListener('click', closeUmlModal);

    document.getElementById('downloadUmlBtn')?.addEventListener('click', () => {
        executeDownload("https://wwaxk.lanzoue.com/b019vreyfi", "ch58", null);
    });

    const lightbox = document.getElementById('lightbox');
    lightbox?.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.id === 'lightboxClose') {
            lightbox.style.display = 'none';
        }
    });
});

window.addEventListener('resize', () => {
    clearTimeout(window.resizeTimer);
    window.resizeTimer = setTimeout(() => {
        if (currentRenderedSkins.length > 0) renderWaterfall(currentRenderedSkins);
    }, 200);
});

// ==========================================
// 5. UI 与通用工具函数
// ==========================================
function getRomanTier(tier) {
    const romanMap = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV', 5: 'V', 6: 'VI', 7: 'VII', 8: 'VIII', 9: 'IX', 10: 'X', 11: 'XI' };
    return romanMap[tier] || tier;
}

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

function showGlobalLoading(text = "正在解析直链...") {
    let overlay = document.getElementById('globalLoading');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'globalLoading';
        overlay.className = 'global-loading-overlay';
        overlay.innerHTML = `<div class="loading-spinner"></div><div class="loading-text" id="globalLoadingText"></div>`;
        document.body.appendChild(overlay);
    }
    document.getElementById('globalLoadingText').innerHTML = text;
    overlay.classList.add('active');
}

function hideGlobalLoading() {
    document.getElementById('globalLoading')?.classList.remove('active');
}

function openUmlModal() {
    document.getElementById('noMoreUmlPrompt').checked = (localStorage.getItem('hideUmlGuide') === 'true');
    document.getElementById('umlModal').style.display = 'flex';
}

function closeUmlModal() {
    if (document.getElementById('noMoreUmlPrompt').checked) {
        localStorage.setItem('hideUmlGuide', 'true');
    } else {
        localStorage.removeItem('hideUmlGuide');
    }
    document.getElementById('umlModal').style.display = 'none';
}

function openLightbox(imageUrl) {
    document.getElementById('lightboxImg').src = imageUrl;
    document.getElementById('lightbox').style.display = 'flex';
}

function updateAllButtonsUI() {
    document.querySelectorAll('.skin-card').forEach(card => {
        const btn = card.querySelector('.download-btn');
        const skinId = parseInt(btn.dataset.id);
        if (downloadedSkinIds.has(skinId)) {
            btn.textContent = '已安装';
            btn.classList.add('installed-btn');
            btn.disabled = true;
        }
    });
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    Object.assign(textArea.style, { top: "0", left: "0", position: "fixed", opacity: "0" });
    
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch (err) { console.error('复制失败', err); }
    document.body.removeChild(textArea);
}

// ==========================================
// 6. 数据管理 (获取、过滤、排序)
// ==========================================
async function fetchSkins() {
    try {
        const res = await fetch(`${API_BASE}/api/skins`);
        if (res.ok) {
            allSkins = await res.json();
            applyFiltersAndSort();
        } else {
            showToast('获取涂装列表失败，请刷新重试');
        }
    } catch (error) {
        console.error('网络请求失败:', error);
    }
}

function applyFiltersAndSort() {
    if (!allSkins?.length) return;

    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const tierVal = document.getElementById('tierFilter')?.value || 'all';
    const sortVal = document.getElementById('sortFilter')?.value || 'hot';

    let result = allSkins.filter(skin => {
        const matchSearch = skin.tank_model.toLowerCase().includes(searchTerm) || skin.author?.toLowerCase().includes(searchTerm);
        const matchTier = tierVal === 'all' ? true : (tierVal === '<=7' ? skin.tier <= 7 : skin.tier === parseInt(tierVal));
        return matchSearch && matchTier;
    });

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
                if (aIsRecent && bIsRecent) return dlB !== dlA ? dlB - dlA : timeB - timeA;
                if (aIsRecent && !bIsRecent) return -1;
                if (!aIsRecent && bIsRecent) return 1;
                return timeB - timeA;
            case 'newest': return timeB - timeA;
            case 'downloads': return dlB - dlA;
            case 'name': return a.tank_model.localeCompare(b.tank_model, 'zh-CN');
            default: return 0;
        }
    });

    renderWaterfall(result);
}

// ==========================================
// 7. 渲染引擎
// ==========================================
function renderWaterfall(skins) {
    currentRenderedSkins = skins;
    const grid = document.getElementById('waterfallGrid');
    grid.innerHTML = '';

    if (!skins.length) {
        grid.innerHTML = '<p style="text-align:center; color:#888; width:100%; margin-top:40px;">没有找到符合条件的涂装 😿</p>';
        return;
    }

    const validTimes = skins.map(s => s.updated_at || s.created_at).filter(t => t).map(t => new Date(t).getTime());
    const latestDayString = validTimes.length ? new Date(Math.max(...validTimes)).toDateString() : '';

    const winWidth = window.innerWidth;
    const colCount = winWidth > 1024 ? 4 : (winWidth > 768 ? 3 : (winWidth > 600 ? 2 : 1));
    const columns = Array.from({ length: colCount }, () => {
        const col = document.createElement('div');
        col.className = 'masonry-column';
        grid.appendChild(col);
        return col;
    });

    skins.forEach((skin, index) => {
        let coverImg = 'placeholder.jpg';
        try {
            const images = JSON.parse(skin.preview_images);
            if (images.length) coverImg = images[0];
        } catch (e) {}

        const isNew = skin.updated_at || skin.created_at ? new Date(skin.updated_at || skin.created_at).toDateString() === latestDayString : false;
        const safeSkinData = encodeURIComponent(JSON.stringify(skin));
        
        // 判断本地安装状态并分配类名
        const isDownloaded = downloadedSkinIds.has(skin.id);
        const btnClass = isDownloaded ? 'download-btn installed-btn' : 'download-btn';

        const card = document.createElement('div');
        card.className = 'skin-card';
        card.innerHTML = `
            <div class="img-wrapper">
                ${isNew ? `<div class="new-tag">NEW</div>` : ''}
                ${skin.is_uml_required ? `<div class="uml-tag">UML 必需</div>` : ''}
                <img src="${coverImg}" loading="lazy" class="cover-img" alt="${skin.tank_model}" onload="this.classList.add('loaded')" onerror="this.src='/fallback.jpg'; this.classList.add('loaded');" />
            </div>
            <div class="card-info">
                <h3>${skin.tank_model} <span class="tier-tag">${getRomanTier(skin.tier)}</span></h3>
                <div class="card-meta">
                    ${skin.author ? `<span class="author-text">🎨 ${skin.author}</span>` : '<span></span>'}
                    ${skin.download_count > 0 ? `<span class="download-count">🔥 ${skin.download_count}</span>` : ''}
                </div>
                <button class="${btnClass}" data-id="${skin.id}" ${isDownloaded ? 'disabled' : ''}>
                    ${isDownloaded ? '已安装' : '获取涂装'}
                </button>
                ${isUploadMode ? `
                <div class="admin-actions">
                    <button onclick="editSkin('${safeSkinData}')" class="edit-btn">修改</button>
                    <button onclick="deleteSkin(${skin.id})" class="delete-btn">删除</button>
                </div>` : ''}
            </div>
        `;

        card.querySelector('.cover-img').addEventListener('click', () => openLightbox(coverImg));
        card.querySelector('.download-btn').addEventListener('click', () => handleDownload(skin));
        columns[index % colCount].appendChild(card);
    });
}

// ==========================================
// 8. 核心业务 (下载、上传、删改)
// ==========================================
async function executeDownload(url, pwd, skinId) {
    if (!url) return;

    if (skinId) {
        const downloadedKey = `downloaded_${skinId}`;
        if (!localStorage.getItem(downloadedKey)) {
            fetch(`${API_BASE}/api/download`, {
                method: 'POST', body: JSON.stringify({ id: skinId }), headers: { 'Content-Type': 'application/json' }
            }).then(res => {
                if (res.ok) localStorage.setItem(downloadedKey, 'true');
            }).catch(() => {});
        }
    }

    const umlModal = document.getElementById('umlModal');
    if (umlModal) umlModal.style.display = 'none';

    // 前置复制双保险
    if (pwd) {
        try {
            (navigator.clipboard && window.isSecureContext) ? await navigator.clipboard.writeText(pwd) : fallbackCopyTextToClipboard(pwd);
        } catch (err) {
            fallbackCopyTextToClipboard(pwd);
        }
    }

    showGlobalLoading("⏳ 正在请求极速直链<br><span style='font-size:0.8rem; font-weight:normal; opacity:0.8; display:block; margin-top:8px;'>正在请求服务器...</span>");

    try {
        const securePayload = await generateSecurePayload(url, pwd);
        const res = await fetch(PARSE_WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ payload: securePayload })
        });

        if (!res.ok) throw new Error("解析接口返回非 200 状态");
        const data = await res.json();

        if (data.code === 200 && data.downUrl) {
            // 解析成功后再次确认状态，防止并发误操作
            if (downloadedSkinIds.has(skinId)) {
                hideGlobalLoading();
                return showToast('✅ 该涂装已在本地安装，无需重复下载', 2000);
            }

            if (isElectronBox) {
                showToast(`⏳ 正在交由盒子下载安装...`, 2000);
                window.parent.postMessage({ type: 'START_DOWNLOAD', payload: { skinId, url: data.downUrl } }, '*');
                hideGlobalLoading();
            } else {
                document.getElementById('globalLoadingText').innerHTML = "🚀 解析成功！即将调起下载...";
                setTimeout(() => {
                    hideGlobalLoading();
                    window.location.href = data.downUrl;
                }, 800);
            }
        } else {
            throw new Error(data.msg || "解析结果异常");
        }
    } catch (error) {
        console.warn('直链解析受阻，启动备用下载模式:', error);
        hideGlobalLoading();
        fallbackDownload(url, pwd);
    }
}

async function fallbackDownload(url, pwd) {
    if (pwd) {
        showToast(`⚠️ 直链通道拥挤，已为您自动降级。<br>提取码 <b style="color: #eccc68;">${pwd}</b> 已复制，请手动提取`, 3500);
        setTimeout(() => window.open(url, '_blank'), 2000);
    } else {
        showToast(`⚠️ 直链通道拥挤，即将前往源页面...`, 2000);
        setTimeout(() => window.open(url, '_blank'), 1000);
    }
}

async function handleDownload(skin) {
    // 最外层拦截：如果是已安装，直接中断
    if (downloadedSkinIds.has(skin.id)) {
        return showToast('✅ 该涂装已在本地安装，无需重复获取', 2000);
    }

    if (skin.is_uml_required && localStorage.getItem('hideUmlGuide') !== 'true') {
        return openUmlModal();
    }

    try {
        const downloads = JSON.parse(skin.downloads);
        if (downloads.length > 0) {
            await executeDownload(downloads[0].url, downloads[0].pwd, skin.id);
        }
    } catch (e) {}
}

async function handleUpload(e) {
    e.preventDefault();
    const submitBtn = document.getElementById('submitBtn');
    const file = document.getElementById('skinFile').files[0];

    if (!currentEditId && !file) return showToast('❌ 请选择涂装预览图');

    submitBtn.disabled = true;
    submitBtn.textContent = currentEditId ? '保存中...' : '上传中...';

    try {
        let finalImageUrl = currentEditImageUrl;

        if (file) {
            const formData = new FormData();
            formData.append('file', file);
            const uploadRes = await fetch(`${API_BASE}/api/upload`, {
                method: 'POST',
                headers: { 'Authorization': encodeURIComponent(adminToken) },
                body: formData
            });

            if (!uploadRes.ok) throw new Error('图片上传失败');
            finalImageUrl = (await uploadRes.json()).url;
        }

        const skinData = {
            tank_model: document.getElementById('tankModel').value,
            tier: parseInt(document.getElementById('tankTier').value),
            preview_images: [finalImageUrl],
            downloads: [{ url: document.getElementById('lanzouUrl').value, pwd: document.getElementById('lanzouPwd').value }],
            author: document.getElementById('skinAuthor').value || '佚名',
            is_uml_required: parseInt(document.getElementById('isUml').value) || 0
        };

        const dbRes = await fetch(currentEditId ? `${API_BASE}/api/skins/${currentEditId}` : `${API_BASE}/api/skins`, {
            method: currentEditId ? 'PUT' : 'POST',
            headers: { 'Authorization': encodeURIComponent(adminToken), 'Content-Type': 'application/json' },
            body: JSON.stringify(skinData)
        });

        if (!dbRes.ok) throw new Error('数据库写入失败');

        showToast(currentEditId ? '✨ 涂装信息已更新！' : '✨ 涂装发布成功！');
        cancelEdit();
        fetchSkins();
    } catch (error) {
        showToast(`❌ 错误: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = currentEditId ? '保存修改' : '发布涂装';
    }
}

async function deleteSkin(id) {
    if (!confirm('🚨 确定要永久删除这个涂装吗？操作不可逆！')) return;
    try {
        const res = await fetch(`${API_BASE}/api/skins/${id}`, {
            method: 'DELETE',
            headers: { 'Authorization': encodeURIComponent(adminToken) }
        });
        if (!res.ok) throw new Error('删除失败，请检查 Token');
        
        showToast('🗑️ 涂装已删除');
        fetchSkins();
    } catch (error) {
        showToast(`❌ 错误: ${error.message}`);
    }
}

function editSkin(encodedSkin) {
    const skin = JSON.parse(decodeURIComponent(encodedSkin));
    currentEditId = skin.id;

    let url = '', pwd = '';
    try {
        const downloads = JSON.parse(skin.downloads);
        if (downloads.length > 0) { url = downloads[0].url; pwd = downloads[0].pwd; }
    } catch (e) {}

    try {
        const images = JSON.parse(skin.preview_images);
        if (images.length > 0) currentEditImageUrl = images[0];
    } catch (e) {}

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

function cancelEdit() {
    currentEditId = null;
    currentEditImageUrl = '';
    document.getElementById('uploadForm').reset();
    document.getElementById('skinFile').required = true;
    document.getElementById('submitBtn').textContent = '发布涂装';
    document.getElementById('cancelEditBtn').style.display = 'none';
    document.getElementById('isUml').value = "0";
}
/* ================================
   main.js  — onlyax 统一脚本（整合版）
   ================================ */

/* ---------- 事件追踪 ---------- */
function track(name, props = {}) {
  try {
    const evt = {
      name,
      props,
      ts: Date.now(),
      path: location.pathname,
    };
    const body = JSON.stringify(evt);

    if (navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      navigator.sendBeacon("/track", blob);
    } else {
      fetch("/track", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      });
    }
  } catch (e) {
    // 静默失败，避免影响主流程
    console && console.debug && console.debug("track error:", e);
  }
}

/* ---------- Cookie 提示条 ---------- */
(function cookieBannerInit() {
  const banner = document.getElementById("cookie-banner");
  const acceptBtn = document.getElementById("cookie-accept-btn");
  if (!banner || !acceptBtn) return;

  try {
    if (!localStorage.getItem("cookieAccepted")) {
      banner.style.display = "flex";
    }
    acceptBtn.addEventListener("click", function () {
      try { localStorage.setItem("cookieAccepted", "true"); } catch (e) {}
      banner.style.display = "none";
      track("cookieAccepted", { action: "accept" });
    });
  } catch (e) {
    // 禁用 localStorage 的情况下也能点击关闭
    acceptBtn.addEventListener("click", function () {
      banner.style.display = "none";
    });
  }
})();

/* ---------- 广告点击追踪 ---------- */
(function adBannerInit() {
  const ad = document.getElementById("ad-banner");
  if (!ad) return;
  ad.addEventListener("click", () => {
    track("adClick", { source: "ad_banner" });
    window.open(
      "https://item.taobao.com/item.htm?ft=t&id=871605997681",
      "_blank"
    );
  });
})();

/* ---------- QQ 群号复制（一次绑定，含降级） ---------- */
(function copyInit() {
  const btns = document.querySelectorAll(".copy-btn");
  if (!btns.length) return;

  btns.forEach((btn) => {
    btn.addEventListener("click", async () => {
      const qq = btn.dataset.qq || btn.textContent.trim();
      let ok = false;
      if (navigator.clipboard && navigator.clipboard.writeText) {
        try {
          await navigator.clipboard.writeText(qq);
          ok = true;
        } catch (_) {}
      }
      if (!ok) {
        // 旧浏览器降级方案
        const textarea = document.createElement("textarea");
        textarea.value = qq;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try { ok = document.execCommand("copy"); } catch (_) {}
        document.body.removeChild(textarea);
      }

      // 反馈文案（兼容两种结构：整体按钮 或 内部 .copy-text）
      const textSpan = btn.querySelector(".copy-text") || btn;
      const original = textSpan.textContent;
      textSpan.textContent = ok ? "✅ 已复制" : "❌ 复制失败";
      setTimeout(() => (textSpan.textContent = original), 2000);
    });
  });
})();

/* ---------- 二维码预览弹窗（全局暴露） ---------- */
function showQrModal(src) {
  const modal = document.getElementById("qr-modal");
  const img = document.getElementById("qr-modal-img");
  if (!modal || !img) return;
  img.src = src;
  modal.classList.remove("hidden");
  modal.classList.add("flex");
}
function hideQrModal() {
  const modal = document.getElementById("qr-modal");
  if (!modal) return;
  modal.classList.remove("flex");
  modal.classList.add("hidden");
}
window.showQrModal = showQrModal;
window.hideQrModal = hideQrModal;

/* ---------- QQ 群弹窗（全局暴露） ---------- */
function toggleModal(show) {
  const modal = document.getElementById("qq-modal");
  if (!modal) return;
  modal.classList.toggle("hidden", !show);
  modal.classList.toggle("flex", show);
}
window.toggleModal = toggleModal;

/* ---------- 重置计算器弹窗（全局暴露） ---------- */
const _resetModal = document.getElementById("reset-modal");
function openResetModal() {
  if (!_resetModal) return;
  _resetModal.classList.remove("hidden");
  _resetModal.classList.add("flex");
  document.body.style.overflow = "hidden"; // 锁定背景滚动
}
function closeResetModal() {
  if (!_resetModal) return;
  _resetModal.classList.remove("flex");
  _resetModal.classList.add("hidden");
  document.body.style.overflow = "";
}
window.openResetModal = openResetModal;
window.closeResetModal = closeResetModal;

/* ---------- 妙妙盒下载（全局暴露） ---------- */
function openBox() {
    window.open('https://goover.cn', '_blank');
}
window.openBox = openBox;

/* ---------- 战舰汉化（全局暴露） ---------- */
function openShip() {
    window.open('https://localizedkorabli.org', '_blank');
}
window.openShip = openShip;

/* 背景点击 & ESC 关闭重置弹窗 */
(function resetModalBinders() {
  if (!_resetModal) return;
  _resetModal.addEventListener("click", (e) => {
    if (e.target === _resetModal) closeResetModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && _resetModal.classList.contains("flex")) {
      closeResetModal();
    }
  });
})();

/* ---------- 悬浮按钮（#qq-toggle）自动收起/展开 ---------- */
document.addEventListener("DOMContentLoaded", () => {
  checkRegionAndOptimizeDownload();
  const toggleWrap = document.getElementById("qq-toggle");
  if (!toggleWrap) return;

  let hideTimer = null;
  let scrolling = false;
  let hovering = false;

  const showButtons = () => toggleWrap.classList.remove("compact");
  const hideButtons = () => {
    if (!hovering) toggleWrap.classList.add("compact");
  };

  toggleWrap.addEventListener("mouseenter", () => {
    hovering = true;
    if (hideTimer) clearTimeout(hideTimer);
    showButtons();
  });
  toggleWrap.addEventListener("mouseleave", () => {
    hovering = false;
    scheduleCompact();
  });

  ["touchstart", "mousedown"].forEach((ev) =>
    document.addEventListener(
      ev,
      () => {
        showButtons();
        if (hideTimer) clearTimeout(hideTimer);
      },
      { passive: true }
    )
  );

  window.addEventListener(
    "scroll",
    () => {
      showButtons();
      scrolling = true;
      if (hideTimer) clearTimeout(hideTimer);

      hideTimer = setTimeout(() => {
        scrolling = false;
        scheduleCompact();
      }, 300);
    },
    { passive: true }
  );

  ["touchend", "mouseup"].forEach((ev) =>
    document.addEventListener(
      ev,
      () => {
        if (!scrolling) scheduleCompact();
      },
      { passive: true }
    )
  );

  function scheduleCompact() {
    if (hideTimer) clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!hovering) hideButtons();
    }, 3000);
  }
});

/* ==========================================
   蓝奏云直链加密通信与下载模块 (极简版)
   ========================================== */
const PARSE_SECRET_KEY = "0p.+HcezRABD}#!8J!2i";
const PARSE_WORKER_URL = "https://lanzou-api.onlyax.com";

async function generateSecurePayload(url, pwd) {
    const dataStr = JSON.stringify({ url: url, pwd: pwd, timestamp: Date.now() });
    const keyHash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(PARSE_SECRET_KEY));
    const cryptoKey = await crypto.subtle.importKey('raw', keyHash, { name: 'AES-GCM' }, false, ['encrypt']);

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, cryptoKey, new TextEncoder().encode(dataStr));

    const payloadBuffer = new Uint8Array(iv.length + encryptedBuffer.byteLength);
    payloadBuffer.set(iv, 0);
    payloadBuffer.set(new Uint8Array(encryptedBuffer), iv.length);

    return btoa(String.fromCharCode.apply(null, payloadBuffer));
}

function fallbackCopyTextToClipboard(text) {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    Object.assign(textArea.style, { top: "0", left: "0", position: "fixed", opacity: "0" });
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try { document.execCommand('copy'); } catch (err) {}
    document.body.removeChild(textArea);
}

// 极简下载执行器（无UI弹窗，瞬间跳转）
async function executeDownload(url, pwd) {
    if (!url) return;

    // 前置静默复制密码 (为降级或源站做准备)
    if (pwd) {
        try {
            (navigator.clipboard && window.isSecureContext) ? await navigator.clipboard.writeText(pwd) : fallbackCopyTextToClipboard(pwd);
        } catch (err) {
            fallbackCopyTextToClipboard(pwd);
        }
    }

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
            // 解析成功，直接调起系统底层下载逻辑
            window.location.href = data.downUrl;
        } else {
            throw new Error(data.msg || "解析结果异常");
        }
    } catch (error) {
        console.warn('直链解析受阻，已静默降级为源链接:', error);
        window.open(url, '_blank');
    }
}

// 封装的按钮绑定器：接管点击事件，增加 Loading 和 防连点 机制
function bindDownloadButtonWithLoading(btnId, defaultText, url, pwd) {
    const btn = document.getElementById(btnId);
    if (!btn) return;

    // 剥夺默认行为
    btn.href = "javascript:void(0);";
    btn.removeAttribute('target');
    btn.innerHTML = defaultText;

    btn.addEventListener('click', async (e) => {
        e.preventDefault();

        // 1. 开启 Loading 状态 (防连点)
        btn.innerHTML = `
            <span class="flex items-center justify-center gap-2">
                <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                正在请求加速通道...
            </span>
        `;
        btn.style.pointerEvents = 'none'; // 关键：禁用鼠标事件，防止疯狂连点
        btn.style.opacity = '0.8';

        // 2. 挂起等待直链解析与下载 (注意这里必须是 await)
        await executeDownload(url, pwd);

        // 3. 恢复按钮状态
        // (如果解析成功，浏览器其实已经直接切走去下载了；如果解析失败走了降级，页面还在，这里正好恢复按钮，方便用户二次操作)
        btn.innerHTML = defaultText;
        btn.style.pointerEvents = 'auto';
        btn.style.opacity = '1';
    });
}

async function checkRegionAndOptimizeDownload() {
    try {
        const res = await fetch('/cdn-cgi/trace');
        const traceText = await res.text();
        
        const locMatch = traceText.match(/loc=([A-Z]{2})/);
        const userCountry = locMatch ? locMatch[1] : null;

        if (userCountry === 'CN') {
            bindDownloadButtonWithLoading(
                'btn-win10', 
                'Windows 8 / 10 / 11 下载', 
                'https://wwbfa.lanzoup.com/iXlyn3kw5j9e', 
                'df61'
            );

            bindDownloadButtonWithLoading(
                'btn-win7', 
                'Windows 7 下载', 
                'https://wwbfa.lanzoup.com/iK9sw3kw5jyj', 
                'df61'
            );
            
        }
    } catch (error) {
        console.warn("地区检测接口异常，保持默认下载源", error);
    }
}
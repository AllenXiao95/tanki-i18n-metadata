/* ================================
   main.js  — onlyax 统一脚本
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
      try { localStorage.setItem("cookieAccepted", "true"); } catch (e) { }
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
        } catch (_) { }
      }
      if (!ok) {
        // 旧浏览器降级方案
        const textarea = document.createElement("textarea");
        textarea.value = qq;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        try { ok = document.execCommand("copy"); } catch (_) { }
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
   OSS 直链下载模块
   ========================================== */

// 封装的按钮绑定器：接管点击事件，增加 Loading 和 防连点 机制
function bindDownloadButtonWithLoading(btnId, defaultText, url) {
  var btn = document.getElementById(btnId);
  if (!btn) return;

  // 剥夺默认行为
  btn.href = "javascript:void(0);";
  btn.removeAttribute('target');
  btn.innerHTML = defaultText;

  btn.addEventListener('click', function (e) {
    e.preventDefault();

    // 1. 开启 Loading 状态 (防连点)
    btn.innerHTML = ['\u003cspan class="flex items-center justify-center gap-2"\u003e',
      '\u003csvg class="animate-spin-safe h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"\u003e',
      '\u003ccircle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"\u003e\u003c/circle\u003e',
      '\u003cpath class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"\u003e\u003c/path\u003e',
      '\u003c/svg\u003e', '\u6b63\u5728\u8bf7\u6c42\u52a0\u901f\u901a\u9053...', '\u003c/span\u003e'].join('');
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.8';

    // 2. 直接跳转 OSS 下载链接触发浏览器下载
    window.location.href = url;

    // 3. 延迟恢复按钮状态 (若浏览器未跳走，比如被拦截)
    setTimeout(function () {
      btn.innerHTML = defaultText;
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '1';
    }, 3000);
  });
}

async function checkRegionAndOptimizeDownload() {
  try {
    var res = await fetch('/cdn-cgi/trace');
    var traceText = await res.text();

    var locMatch = traceText.match(/loc=([A-Z]{2})/);
    var userCountry = locMatch ? locMatch[1] : null;

    if (userCountry === 'CN') {
      bindDownloadButtonWithLoading(
        'btn-win10',
        'Windows 8 / 10 / 11 下载',
        ['https://cos.goover.cn/tankBox_ru/plugin/hanhuaClient/',
          '\u5766\u514b\u4e16\u754c\u83b1\u670d\u6c49\u5316\u5b89\u88c5\u5668_2_5_signed.exe'].join('')
      );

      bindDownloadButtonWithLoading(
        'btn-win7',
        'Windows 7 下载',
        ['https://cos.goover.cn/tankBox_ru/plugin/hanhuaClient/',
          '\u5766\u514b\u4e16\u754c\u83b1\u670d\u6c49\u5316\u5b89\u88c5\u5668_2_5_signed_win7.exe'].join('')
      );

    }
  } catch (error) {
    console.warn('地区检测接口异常，保持默认下载源', error);
  }
}

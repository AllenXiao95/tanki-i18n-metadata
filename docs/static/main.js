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
/* 需求：
   - 任何交互（触摸/鼠标/滚动）立即展开
   - 停止交互 3s 后收起
   - 鼠标 hover 在 toggle 区域上时不允许收起
*/
document.addEventListener("DOMContentLoaded", () => {
  const toggleWrap = document.getElementById("qq-toggle");
  if (!toggleWrap) return;

  let hideTimer = null;
  let scrolling = false;
  let hovering = false;

  const showButtons = () => toggleWrap.classList.remove("compact");
  const hideButtons = () => {
    if (!hovering) toggleWrap.classList.add("compact");
  };

  // 悬停：不允许收起
  toggleWrap.addEventListener("mouseenter", () => {
    hovering = true;
    if (hideTimer) clearTimeout(hideTimer);
    showButtons();
  });
  toggleWrap.addEventListener("mouseleave", () => {
    hovering = false;
    scheduleCompact();
  });

  // 任意点击/触摸：立即展开并清除计时
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

  // 滚动：显示；停止 300ms 后进入 3s 收起倒计时
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

  // 触摸/鼠标结束：若未在滚动中，则启动收起倒计时
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

// static/version.render.js
(async function () {
  // 格式化中文日期，例如 "2023-10-05" -> "2023 年 10 月 5 日"
  function fmtCn(d) {
    if (!d) return "";
    var a = d.split("-");
    if (a.length !== 3) return d;
    // 使用 +a[1] 和 +a[2] 去除可能的前导零
    return a[0] + " 年 " + (+a[1]) + " 月 " + (+a[2]) + " 日";
  }

  // 比较版本号大小
  function compareVersions(v1, v2) {
    var p1 = v1.match(/\d+/g) || [];
    var p2 = v2.match(/\d+/g) || [];
    var len = Math.max(p1.length, p2.length);

    for (var i = 0; i < len; i++) {
      var num1 = parseInt(p1[i] || 0, 10);
      var num2 = parseInt(p2[i] || 0, 10);
      if (num1 > num2) return 1;
      if (num1 < num2) return -1;
    }
    return 0;
  }

  // 去掉 tag 前缀，保留 v 及之后的数字
  function formatVersionStr(tag) {
    if (!tag) return "";
    return tag.replace(/^[^\-]+-/, '');
  }

  try {
    const res = await fetch('https://get-release.onlyax.com/');
    const data = await res.json();

    let latestRu = null;
    let latestPt = null;

    data.forEach(function (item) {
      var tag = item.tag_name;
      if (!tag) return;

      if (tag.startsWith('ru-')) {
        if (!latestRu || compareVersions(tag, latestRu.tag_name) > 0) {
          latestRu = item;
        }
      } else if (tag.startsWith('pt-')) {
        if (!latestPt || compareVersions(tag, latestPt.tag_name) > 0) {
          latestPt = item;
        }
      }
    });

    // 将解析出的纯净版本号和日期存入配置
    var cfg = {
      release: latestRu ? { version: formatVersionStr(latestRu.tag_name), date: latestRu.updateDate || "" } : null,
      test: latestPt ? { version: formatVersionStr(latestPt.tag_name), date: latestPt.updateDate || "" } : null
    };

    debugger

    // 1. 渲染 guide.html (依然保留日期展示逻辑)
    var gRel = document.querySelector('[data-slot="guide-release"]');
    if (gRel && cfg.release) {
      gRel.textContent = cfg.release.version + (cfg.release.date ? "（" + cfg.release.date + "）" : "");
    }

    var gTest = document.querySelector('[data-slot="guide-test"]');
    if (gTest && cfg.test) {
      gTest.textContent = cfg.test.version + (cfg.test.date ? "（" + cfg.test.date + "）" : "");
    }

    // 2. 渲染 index.html (UI 已改为徽章样式，此处仅填充版本号)
    var iRelV = document.querySelector('[data-slot="index-release-version"]');
    if (iRelV && cfg.release) iRelV.textContent = cfg.release.version;

    var iTestV = document.querySelector('[data-slot="index-test-version"]');
    if (iTestV && cfg.test) iTestV.textContent = cfg.test.version;

    // (预留) 如果你以后又想在 index.html 某处加回日期，加上对应的 data-slot 即可自动生效
    var iRelD = document.querySelector('[data-slot="index-release-date"]');
    if (iRelD && cfg.release) iRelD.textContent = cfg.release.date ? "(" + fmtCn(cfg.release.date) + ")" : "";

    var iTestD = document.querySelector('[data-slot="index-test-date"]');
    if (iTestD && cfg.test) iTestD.textContent = cfg.test.date ? "(" + fmtCn(cfg.test.date) + ")" : "";

  } catch (error) {
    console.error("获取版本列表失败:", error);
  }
})();
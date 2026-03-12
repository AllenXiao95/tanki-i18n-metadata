// static/version.render.js
(async function () {
  function fmtCn(d) {
    if (!d) return "";
    var a = d.split("-");
    if (a.length !== 3) return d;
    return a[0] + " 年 " + (+a[1]) + " 月 " + a[2] + " 日";
  }

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

  // 新增：去掉前缀的格式化函数
  function formatVersionStr(tag) {
    if (!tag) return "";
    // 匹配并移除第一个 '-' 及之前的所有字符，例如 "ru-v1.41.0.2" -> "v1.41.0.2"
    return tag.replace(/^[^\-]+-/, '');
  }

  try {
    const res = await fetch('https://kfc.goover.cn/feedback/getI18nList');
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

    // 在这里调用 formatVersionStr，把处理过后的干净版本号存入配置
    var cfg = {
      release: latestRu ? { version: formatVersionStr(latestRu.tag_name), date: "" } : null,
      test: latestPt ? { version: formatVersionStr(latestPt.tag_name), date: "" } : null
    };

    var gRel = document.querySelector('[data-slot="guide-release"]');
    if (gRel && cfg.release) {
      gRel.textContent = cfg.release.version + (cfg.release.date ? "（" + cfg.release.date + "）" : "");
    }

    var gTest = document.querySelector('[data-slot="guide-test"]');
    if (gTest && cfg.test) {
      gTest.textContent = cfg.test.version + (cfg.test.date ? "（" + cfg.test.date + "）" : "");
    }

    var iRelV = document.querySelector('[data-slot="index-release-version"]');
    var iRelD = document.querySelector('[data-slot="index-release-date"]');
    if (iRelV && cfg.release) iRelV.textContent = cfg.release.version;
    if (iRelD && cfg.release) iRelD.textContent = cfg.release.date ? "(" + fmtCn(cfg.release.date) + ")" : "";

    var iTestV = document.querySelector('[data-slot="index-test-version"]');
    var iTestD = document.querySelector('[data-slot="index-test-date"]');
    if (iTestV && cfg.test) iTestV.textContent = cfg.test.version;
    if (iTestD && cfg.test) iTestD.textContent = cfg.test.date ? "(" + fmtCn(cfg.test.date) + ")" : "";

  } catch (error) {
    console.error("获取版本列表失败:", error);
  }
})();
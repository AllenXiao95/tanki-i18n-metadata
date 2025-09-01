// static/version.render.js
(function () {
  var cfg = window.VERSION_CONFIG || {};
  function fmtCn(d){ var a=d.split("-"); return a[0]+" 年 "+(+a[1])+" 月 "+a[2]+" 日"; }

  // guide.html 里的占位（整体一段）
  var gRel = document.querySelector('[data-slot="guide-release"]');
  if (gRel && cfg.release) gRel.textContent = cfg.release.version + "（" + cfg.release.date + "）";
  var gTest = document.querySelector('[data-slot="guide-test"]');
  if (gTest && cfg.test)   gTest.textContent = cfg.test.version   + "（" + cfg.test.date   + "）";

  // index.html 两种格式：版本 + （中文日期）
  var iRelV = document.querySelector('[data-slot="index-release-version"]');
  var iRelD = document.querySelector('[data-slot="index-release-date"]');
  if (iRelV && cfg.release) iRelV.textContent = cfg.release.version;
  if (iRelD && cfg.release) iRelD.textContent = "(" + fmtCn(cfg.release.date) + ")";

  var iTestV = document.querySelector('[data-slot="index-test-version"]');
  var iTestD = document.querySelector('[data-slot="index-test-date"]');
  if (iTestV && cfg.test) iTestV.textContent = cfg.test.version;
  if (iTestD && cfg.test) iTestD.textContent = "(" + fmtCn(cfg.test.date) + ")";
})();

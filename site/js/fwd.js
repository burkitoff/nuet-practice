(function () {
  var go = function () { if (/^#\//.test(location.hash)) location.replace("/app/" + location.hash); };
  go();
  addEventListener("hashchange", go);
})();

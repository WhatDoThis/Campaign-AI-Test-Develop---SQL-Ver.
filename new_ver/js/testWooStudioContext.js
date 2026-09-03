/*
 * testWooStudioContext.js (Studio 컨텍스트 조회)
 * ==================================================
 * litmus 동기 __v=161. Env ui.listLimit · listAiFolders.
 * AI Studio 2차: @isAiFolder=1 Program/폴더만 queryDef 조회.
 * Write·삭제 없음. WKF 클론은 testWooWorkflowClone.js.
 *
 * [Main Functions]
 * ===========
 * - listAiFolders — {id,name,label}[] AI 폴더 목록
 *
 * [Dependencies]
 * =========
 * - xtk:folder — queryDef @isAiFolder=1 (woo 확장 병합 후)
 * - testWooAiStudioJs.jssp — Studio UI에서 loadLibrary 호출
 */

if (typeof testWoo === "undefined") testWoo = {};

testWoo.studioContext = (function () {
  var FOLDER_SCHEMA = "xtk:folder";

  function _uiLimits() {
    try {
      if (testWoo.cfg && testWoo.cfg.getConfig) return testWoo.cfg.getConfig().ui;
    } catch (eC) {}
    try {
      if (testWoo.env && testWoo.env.getEnv) return testWoo.env.getEnv().ui;
    } catch (eE) {}
    return { listLimit: 200, listLimitMax: 500 };
  }

  // 1. @isAiFolder=1 폴더 목록
  function listAiFolders(limit) {
    var ui = _uiLimits();
    var defLim = Number(ui.listLimit) || 200;
    var maxLim = Number(ui.listLimitMax) || 500;
    var lim = parseInt(limit, 10);
    if (isNaN(lim) || lim <= 0) lim = defLim;
    if (lim > maxLim) lim = maxLim;

    var items = [];
    try {
      var q = xtk.queryDef.create(
        <queryDef schema={FOLDER_SCHEMA} operation="select" lineCount={String(lim)}>
          <select>
            <node expr="@id"/>
            <node expr="@name"/>
            <node expr="@label"/>
          </select>
          <where>
            <condition expr="@isAiFolder = 1"/>
          </where>
          <orderBy>
            <node expr="@label"/>
          </orderBy>
        </queryDef>
      );
      var res = q.ExecuteQuery();
      if (res && res.folder) {
        for each (var r in res.folder) {
          var fid = String(r.@id || "");
          var fnm = twSanitizeXmlText ? twSanitizeXmlText(r.@name || "") : String(r.@name || "");
          var flb = twSanitizeXmlText
            ? twSanitizeXmlText(r.@label || r.@name || "")
            : String(r.@label || r.@name || "");
          items.push({
            id: fid,
            name: fnm,
            label: flb || fnm
          });
        }
      }
    } catch (eQ) {
      try {
        logWarning("[testWoo.studioContext.listAiFolders] " + eQ);
      } catch (eL) {}
      throw new Error(
        "[testWoo.studioContext.listAiFolders] " +
          (eQ && eQ.message != null ? eQ.message : eQ)
      );
    }
    return items;
  }

  return {
    listAiFolders: listAiFolders
  };
})();
testWoo.studioContext.__v = "161";

/*
 * testWooStudioContext.js (Studio 컨텍스트 조회)
 * ==================================================
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
  var DEFAULT_LIMIT = 200;
  var MAX_LIMIT = 500;

  // 1. @isAiFolder=1 폴더 목록
  function listAiFolders(limit) {
    var lim = parseInt(limit, 10);
    if (isNaN(lim) || lim <= 0) lim = DEFAULT_LIMIT;
    if (lim > MAX_LIMIT) lim = MAX_LIMIT;

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
          items.push({
            id: String(r.@id || ""),
            name: String(r.@name || ""),
            label: String(r.@label || r.@name || "")
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

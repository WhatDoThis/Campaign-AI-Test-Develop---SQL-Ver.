/*
 * testWooStudioContext.js (Studio 컨텍스트 · 폴더 목록 · server-side)
 * ================================================================
 * AI Studio 2차: @isAiFolder=1 폴더만 queryDef 조회. Write/삭제 경로 없음.
 * prefix AI_Folder* 매칭 금지 (UI-3-2).
 * 3차 WKF 클론·잠금은 testWooWorkflowClone.js (Context JSSP가 로드).
 *
 * [Main Functions]
 * ===========
 * - listAiFolders(limit) — {id,name,label}[]  (AI 프로그램/폴더)
 *
 * [Dependencies]
 * =========
 * - xtk.queryDef on xtk:folder (woo:folder 확장 병합 후 @isAiFolder)
 * - Rhino-safe (no map/forEach/=>)
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

var t = vars.aiTmpTable;
var cnt = sqlGetInt("SELECT COUNT(*) FROM " + t);
logInfo("[ai-sql-test] case=" + vars.aiCaseId + " rows=" + cnt);

sqlExec("INSERT INTO tmp_woo_ai_runlog"
      + " (sCaseId, iRowCount, iAiRows, tsRun, iWorkflowId) VALUES ('"
      + vars.aiCaseId + "', " + cnt + ", " + cnt
      + ", CURRENT_TIMESTAMP, " + instance.id + ")");

var list = "";
if (cnt > 0) {
  list = sqlGetString("SELECT string_agg(sCustomer_id, chr(39) || ',' || chr(39))"
                    + " FROM " + t);
}
vars.aiIdList = list ? list : "";
logInfo("[ai-sql-test] idList=" + vars.aiIdList);

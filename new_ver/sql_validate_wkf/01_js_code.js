vars.aiSchema = "woo:testWooSampleCustomer";     // ← 스키마 이름
vars.aiPk     = "sCustomer_id";           // ← 기본키 컬럼명
vars.aiTmpTable = "tmp_woo_ai_target";
vars.aiCaseId = "C1";                     // 케이스마다 이것만 변경 -> 굳이 사용하지 않아도 됨

function exists(t) {
  return sqlGetInt("SELECT COUNT(*) FROM information_schema.tables"
                 + " WHERE table_name = '" + t.toLowerCase() + "'");
}

if (exists(vars.aiTmpTable) > 0) {
  sqlExec("DROP TABLE " + vars.aiTmpTable);
  logInfo("[ai-sql-test] 이전 임시테이블 삭제");
}

if (exists("tmp_woo_ai_runlog") === 0) {
  sqlExec("CREATE TABLE tmp_woo_ai_runlog ("
        + " sCaseId VARCHAR(100), iRowCount INTEGER, iAiRows INTEGER,"
        + " tsRun TIMESTAMP, iWorkflowId INTEGER)");
}

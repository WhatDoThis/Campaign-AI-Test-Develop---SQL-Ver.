
CREATE TABLE <%= vars.aiTmpTable %> AS
SELECT c.*
FROM (

/* ===== ▼ AI Studio SQL 을 그대로 붙여넣기 ▼ ===== */



/* ===== ▲ 붙여넣기 끝 ▲ ===== */

) t
JOIN testWooSampleCustomer c ON c.sCustomer_id = t.sCustomer_id
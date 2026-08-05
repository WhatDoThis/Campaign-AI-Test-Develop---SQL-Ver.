// testWooSampleSeed.js — AUTO-GENERATED (do not edit by hand)
// ===========================================================
// WF: Start → JavaScript code → End
// woo:testWooSample* Update database structure 후 Run
// CLEAR=true → 기존 삭제 후 재적재 / false → 데이터 있으면 중단
// Generated: 2026-08-05 09:21:42

var CLEAR = true;
var SCHEMA_CUST = "woo:testWooSampleCustomer";
var SCHEMA_SUB = "woo:testWooSampleSubscription";

function _countRows(schema) {
  var q = xtk.queryDef.create(
    <queryDef schema={schema} operation="select">
      <select><node expr="count(@id)" alias="@cnt"/></select>
    </queryDef>
  );
  return parseInt(String(q.ExecuteQuery().@cnt), 10) || 0;
}

function _clearCustomers() {
  var q = xtk.queryDef.create(
    <queryDef schema={SCHEMA_CUST} operation="select">
      <select><node expr="@id"/></select>
    </queryDef>
  );
  var res = q.ExecuteQuery();
  var n = 0;
  for each (var row in res.testWooSampleCustomer) {
    if (!row || row.@id == null) continue;
    var doc = <testWooSampleCustomer xtkschema={SCHEMA_CUST} _operation="delete"/>;
    doc.@id = row.@id;
    xtk.session.Write(doc);
    n++;
  }
  return n;
}

function _clearSubscriptions() {
  var q = xtk.queryDef.create(
    <queryDef schema={SCHEMA_SUB} operation="select">
      <select><node expr="@id"/></select>
    </queryDef>
  );
  var res = q.ExecuteQuery();
  var n = 0;
  for each (var row in res.testWooSampleSubscription) {
    if (!row || row.@id == null) continue;
    var doc = <testWooSampleSubscription xtkschema={SCHEMA_SUB} _operation="delete"/>;
    doc.@id = row.@id;
    xtk.session.Write(doc);
    n++;
  }
  return n;
}

function _writeCustomer(c) {
  var doc = <testWooSampleCustomer xtkschema={SCHEMA_CUST} _operation="insert"/>;
  doc.@customer_id = c.customer_id;
  doc.@name = c.name;
  doc.@age = c.age;
  doc.@gender = c.gender;
  doc.@birth_date = c.birth_date;
  doc.@region = c.region;
  doc.@marketing_consent = c.marketing_consent;
  doc.@sms_consent = c.sms_consent;
  doc.@email = c.email;
  doc.@status = c.status;
  doc.@created_date = c.created_date;
  xtk.session.Write(doc);
}

function _writeSubscription(s) {
  var doc = <testWooSampleSubscription xtkschema={SCHEMA_SUB} _operation="insert"/>;
  doc.@customer_id = s.customer_id;
  doc.@plan_code = s.plan_code;
  doc.@plan_label = s.plan_label;
  doc.@start_date = s.start_date;
  doc.@status = s.status;
  if (s.end_date) doc.@end_date = s.end_date;
  xtk.session.Write(doc);
}

var customers = [
  {
    "customer_id": "CUS0001",
    "name": "강건우",
    "age": 48,
    "gender": "M",
    "birth_date": "1978-12-28",
    "region": "광주",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user1@example.test",
    "status": "active",
    "created_date": "2024/01/04 11:39:00"
  },
  {
    "customer_id": "CUS0002",
    "name": "이서연",
    "age": 51,
    "gender": "F",
    "birth_date": "1975-11-11",
    "region": "대구",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user2@example.test",
    "status": "dormant",
    "created_date": "2026/01/11 21:54:00"
  },
  {
    "customer_id": "CUS0003",
    "name": "류다은",
    "age": 67,
    "gender": "F",
    "birth_date": "1959-01-13",
    "region": "서울",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user3@example.test",
    "status": "active",
    "created_date": "2023/12/12 00:53:00"
  },
  {
    "customer_id": "CUS0004",
    "name": "조승현",
    "age": 36,
    "gender": "M",
    "birth_date": "1990-01-14",
    "region": "울산",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user4@example.test",
    "status": "active",
    "created_date": "2026/04/21 05:14:00"
  },
  {
    "customer_id": "CUS0005",
    "name": "장혜진",
    "age": 30,
    "gender": "F",
    "birth_date": "1996-10-02",
    "region": "세종",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user5@example.test",
    "status": "dormant",
    "created_date": "2025/07/09 18:10:00"
  },
  {
    "customer_id": "CUS0006",
    "name": "장민수",
    "age": 20,
    "gender": "M",
    "birth_date": "2006-12-14",
    "region": "인천",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user6@example.test",
    "status": "active",
    "created_date": "2023/12/28 12:23:00"
  },
  {
    "customer_id": "CUS0007",
    "name": "김예준",
    "age": 61,
    "gender": "M",
    "birth_date": "1965-05-18",
    "region": "부산",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user7@example.test",
    "status": "active",
    "created_date": "2025/02/03 16:56:00"
  },
  {
    "customer_id": "CUS0008",
    "name": "한성민",
    "age": 26,
    "gender": "M",
    "birth_date": "2000-03-09",
    "region": "경북",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user8@example.test",
    "status": "dormant",
    "created_date": "2023/11/21 18:00:00"
  },
  {
    "customer_id": "CUS0009",
    "name": "권윤서",
    "age": 26,
    "gender": "F",
    "birth_date": "2000-11-13",
    "region": "경북",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user9@example.test",
    "status": "active",
    "created_date": "2024/11/01 09:22:00"
  },
  {
    "customer_id": "CUS0010",
    "name": "신하은",
    "age": 69,
    "gender": "F",
    "birth_date": "1957-11-10",
    "region": "경기",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user10@example.test",
    "status": "active",
    "created_date": "2025/02/26 07:36:00"
  },
  {
    "customer_id": "CUS0011",
    "name": "최태현",
    "age": 48,
    "gender": "M",
    "birth_date": "1978-10-12",
    "region": "충북",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user11@example.test",
    "status": "active",
    "created_date": "2025/10/11 18:51:00"
  },
  {
    "customer_id": "CUS0012",
    "name": "김다은",
    "age": 48,
    "gender": "F",
    "birth_date": "1978-03-21",
    "region": "경남",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user12@example.test",
    "status": "active",
    "created_date": "2025/01/11 16:34:00"
  },
  {
    "customer_id": "CUS0013",
    "name": "이상철",
    "age": 51,
    "gender": "M",
    "birth_date": "1975-12-19",
    "region": "광주",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user13@example.test",
    "status": "active",
    "created_date": "2025/06/20 05:59:00"
  },
  {
    "customer_id": "CUS0014",
    "name": "안민지",
    "age": 60,
    "gender": "F",
    "birth_date": "1966-07-05",
    "region": "충북",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user14@example.test",
    "status": "active",
    "created_date": "2023/05/01 14:37:00"
  },
  {
    "customer_id": "CUS0015",
    "name": "강승현",
    "age": 24,
    "gender": "M",
    "birth_date": "2002-08-18",
    "region": "충남",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user15@example.test",
    "status": "active",
    "created_date": "2024/10/06 13:15:00"
  },
  {
    "customer_id": "CUS0016",
    "name": "임하은",
    "age": 45,
    "gender": "F",
    "birth_date": "1981-04-14",
    "region": "울산",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user16@example.test",
    "status": "active",
    "created_date": "2026/02/26 12:55:00"
  },
  {
    "customer_id": "CUS0017",
    "name": "홍현우",
    "age": 53,
    "gender": "M",
    "birth_date": "1973-07-07",
    "region": "세종",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user17@example.test",
    "status": "active",
    "created_date": "2023/08/21 00:19:00"
  },
  {
    "customer_id": "CUS0018",
    "name": "오소율",
    "age": 65,
    "gender": "F",
    "birth_date": "1961-01-16",
    "region": "세종",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user18@example.test",
    "status": "active",
    "created_date": "2025/10/05 18:31:00"
  },
  {
    "customer_id": "CUS0019",
    "name": "정시우",
    "age": 49,
    "gender": "M",
    "birth_date": "1977-04-24",
    "region": "충남",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user19@example.test",
    "status": "active",
    "created_date": "2024/01/19 22:43:00"
  },
  {
    "customer_id": "CUS0020",
    "name": "송예준",
    "age": 54,
    "gender": "M",
    "birth_date": "1972-06-27",
    "region": "광주",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user20@example.test",
    "status": "active",
    "created_date": "2024/06/23 16:55:00"
  },
  {
    "customer_id": "CUS0021",
    "name": "홍수빈",
    "age": 63,
    "gender": "F",
    "birth_date": "1963-06-27",
    "region": "충남",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user21@example.test",
    "status": "active",
    "created_date": "2025/12/24 21:26:00"
  },
  {
    "customer_id": "CUS0022",
    "name": "황건우",
    "age": 21,
    "gender": "M",
    "birth_date": "2005-06-06",
    "region": "대구",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user22@example.test",
    "status": "active",
    "created_date": "2025/07/13 02:36:00"
  },
  {
    "customer_id": "CUS0023",
    "name": "장태현",
    "age": 45,
    "gender": "M",
    "birth_date": "1981-01-03",
    "region": "전북",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user23@example.test",
    "status": "active",
    "created_date": "2024/10/06 13:46:00"
  },
  {
    "customer_id": "CUS0024",
    "name": "조현우",
    "age": 25,
    "gender": "M",
    "birth_date": "2001-05-20",
    "region": "전북",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user24@example.test",
    "status": "active",
    "created_date": "2023/04/26 02:35:00"
  },
  {
    "customer_id": "CUS0025",
    "name": "장준호",
    "age": 18,
    "gender": "M",
    "birth_date": "2008-08-28",
    "region": "대구",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user25@example.test",
    "status": "active",
    "created_date": "2025/04/12 15:44:00"
  },
  {
    "customer_id": "CUS0026",
    "name": "안하은",
    "age": 37,
    "gender": "F",
    "birth_date": "1989-07-20",
    "region": "전남",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user26@example.test",
    "status": "active",
    "created_date": "2023/10/03 05:25:00"
  },
  {
    "customer_id": "CUS0027",
    "name": "오윤서",
    "age": 57,
    "gender": "F",
    "birth_date": "1969-10-23",
    "region": "제주",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user27@example.test",
    "status": "dormant",
    "created_date": "2026/05/29 13:52:00"
  },
  {
    "customer_id": "CUS0028",
    "name": "류우진",
    "age": 18,
    "gender": "M",
    "birth_date": "2008-01-13",
    "region": "전북",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user28@example.test",
    "status": "active",
    "created_date": "2023/07/28 18:41:00"
  },
  {
    "customer_id": "CUS0029",
    "name": "송지민",
    "age": 27,
    "gender": "F",
    "birth_date": "1999-05-16",
    "region": "인천",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user29@example.test",
    "status": "active",
    "created_date": "2024/07/27 03:38:00"
  },
  {
    "customer_id": "CUS0030",
    "name": "한수연",
    "age": 48,
    "gender": "F",
    "birth_date": "1978-03-09",
    "region": "세종",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user30@example.test",
    "status": "active",
    "created_date": "2023/07/31 05:02:00"
  },
  {
    "customer_id": "CUS0031",
    "name": "안서연",
    "age": 32,
    "gender": "F",
    "birth_date": "1994-08-14",
    "region": "울산",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user31@example.test",
    "status": "active",
    "created_date": "2024/07/12 10:18:00"
  },
  {
    "customer_id": "CUS0032",
    "name": "최하은",
    "age": 58,
    "gender": "F",
    "birth_date": "1968-09-19",
    "region": "경북",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user32@example.test",
    "status": "active",
    "created_date": "2024/07/26 22:13:00"
  },
  {
    "customer_id": "CUS0033",
    "name": "정지아",
    "age": 45,
    "gender": "F",
    "birth_date": "1981-09-25",
    "region": "대전",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user33@example.test",
    "status": "dormant",
    "created_date": "2024/09/20 17:21:00"
  },
  {
    "customer_id": "CUS0034",
    "name": "오민수",
    "age": 19,
    "gender": "M",
    "birth_date": "2007-03-09",
    "region": "제주",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user34@example.test",
    "status": "active",
    "created_date": "2023/11/17 08:23:00"
  },
  {
    "customer_id": "CUS0035",
    "name": "임소율",
    "age": 59,
    "gender": "F",
    "birth_date": "1967-02-02",
    "region": "대전",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user35@example.test",
    "status": "active",
    "created_date": "2024/03/21 15:15:00"
  },
  {
    "customer_id": "CUS0036",
    "name": "최민수",
    "age": 17,
    "gender": "M",
    "birth_date": "2009-05-13",
    "region": "전북",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user36@example.test",
    "status": "active",
    "created_date": "2023/06/05 07:26:00"
  },
  {
    "customer_id": "CUS0037",
    "name": "황지아",
    "age": 26,
    "gender": "F",
    "birth_date": "2000-02-20",
    "region": "세종",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user37@example.test",
    "status": "active",
    "created_date": "2026/02/28 04:56:00"
  },
  {
    "customer_id": "CUS0038",
    "name": "정혜진",
    "age": 65,
    "gender": "F",
    "birth_date": "1961-05-21",
    "region": "경기",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user38@example.test",
    "status": "active",
    "created_date": "2024/02/05 16:46:00"
  },
  {
    "customer_id": "CUS0039",
    "name": "박지원",
    "age": 35,
    "gender": "F",
    "birth_date": "1991-08-04",
    "region": "울산",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user39@example.test",
    "status": "dormant",
    "created_date": "2023/05/19 17:14:00"
  },
  {
    "customer_id": "CUS0040",
    "name": "신채원",
    "age": 23,
    "gender": "F",
    "birth_date": "2003-11-15",
    "region": "경기",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user40@example.test",
    "status": "active",
    "created_date": "2025/08/01 14:40:00"
  },
  {
    "customer_id": "CUS0041",
    "name": "강시우",
    "age": 16,
    "gender": "M",
    "birth_date": "2010-07-25",
    "region": "서울",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user41@example.test",
    "status": "active",
    "created_date": "2025/09/20 18:12:00"
  },
  {
    "customer_id": "CUS0042",
    "name": "황소율",
    "age": 29,
    "gender": "F",
    "birth_date": "1997-09-04",
    "region": "경북",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user42@example.test",
    "status": "active",
    "created_date": "2023/08/19 02:12:00"
  },
  {
    "customer_id": "CUS0043",
    "name": "안현우",
    "age": 17,
    "gender": "M",
    "birth_date": "2009-12-20",
    "region": "강원",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user43@example.test",
    "status": "active",
    "created_date": "2026/05/14 20:34:00"
  },
  {
    "customer_id": "CUS0044",
    "name": "장수빈",
    "age": 24,
    "gender": "F",
    "birth_date": "2002-11-11",
    "region": "제주",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user44@example.test",
    "status": "dormant",
    "created_date": "2026/05/21 02:26:00"
  },
  {
    "customer_id": "CUS0045",
    "name": "정예준",
    "age": 36,
    "gender": "M",
    "birth_date": "1990-09-01",
    "region": "충북",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user45@example.test",
    "status": "active",
    "created_date": "2023/05/09 15:56:00"
  },
  {
    "customer_id": "CUS0046",
    "name": "오유진",
    "age": 26,
    "gender": "F",
    "birth_date": "2000-04-14",
    "region": "대전",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user46@example.test",
    "status": "active",
    "created_date": "2026/01/09 11:07:00"
  },
  {
    "customer_id": "CUS0047",
    "name": "강성민",
    "age": 39,
    "gender": "M",
    "birth_date": "1987-03-26",
    "region": "인천",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user47@example.test",
    "status": "active",
    "created_date": "2025/07/28 05:14:00"
  },
  {
    "customer_id": "CUS0048",
    "name": "안다은",
    "age": 56,
    "gender": "F",
    "birth_date": "1970-01-16",
    "region": "제주",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user48@example.test",
    "status": "active",
    "created_date": "2026/05/31 21:37:00"
  },
  {
    "customer_id": "CUS0049",
    "name": "정혜진",
    "age": 17,
    "gender": "F",
    "birth_date": "2009-08-18",
    "region": "전남",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user49@example.test",
    "status": "active",
    "created_date": "2025/03/31 21:07:00"
  },
  {
    "customer_id": "CUS0050",
    "name": "박수연",
    "age": 36,
    "gender": "F",
    "birth_date": "1990-11-26",
    "region": "대전",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user50@example.test",
    "status": "dormant",
    "created_date": "2026/06/14 22:14:00"
  },
  {
    "customer_id": "CUS0051",
    "name": "홍도윤",
    "age": 33,
    "gender": "M",
    "birth_date": "1993-12-19",
    "region": "광주",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user51@example.test",
    "status": "active",
    "created_date": "2025/06/11 16:47:00"
  },
  {
    "customer_id": "CUS0052",
    "name": "최도윤",
    "age": 31,
    "gender": "M",
    "birth_date": "1995-07-01",
    "region": "경북",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user52@example.test",
    "status": "active",
    "created_date": "2024/05/12 10:13:00"
  },
  {
    "customer_id": "CUS0053",
    "name": "안우진",
    "age": 46,
    "gender": "M",
    "birth_date": "1980-06-03",
    "region": "대구",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user53@example.test",
    "status": "active",
    "created_date": "2023/06/27 13:44:00"
  },
  {
    "customer_id": "CUS0054",
    "name": "신하은",
    "age": 68,
    "gender": "F",
    "birth_date": "1958-09-01",
    "region": "충남",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user54@example.test",
    "status": "active",
    "created_date": "2023/11/29 19:10:00"
  },
  {
    "customer_id": "CUS0055",
    "name": "황지아",
    "age": 67,
    "gender": "F",
    "birth_date": "1959-01-22",
    "region": "강원",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user55@example.test",
    "status": "active",
    "created_date": "2025/01/24 20:53:00"
  },
  {
    "customer_id": "CUS0056",
    "name": "홍수빈",
    "age": 43,
    "gender": "F",
    "birth_date": "1983-08-20",
    "region": "울산",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user56@example.test",
    "status": "active",
    "created_date": "2024/06/07 18:48:00"
  },
  {
    "customer_id": "CUS0057",
    "name": "조하은",
    "age": 29,
    "gender": "F",
    "birth_date": "1997-07-12",
    "region": "서울",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user57@example.test",
    "status": "active",
    "created_date": "2025/10/27 00:14:00"
  },
  {
    "customer_id": "CUS0058",
    "name": "홍태현",
    "age": 18,
    "gender": "M",
    "birth_date": "2008-07-05",
    "region": "대전",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user58@example.test",
    "status": "active",
    "created_date": "2024/10/02 17:09:00"
  },
  {
    "customer_id": "CUS0059",
    "name": "홍재현",
    "age": 55,
    "gender": "M",
    "birth_date": "1971-05-08",
    "region": "충북",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user59@example.test",
    "status": "active",
    "created_date": "2025/06/27 20:22:00"
  },
  {
    "customer_id": "CUS0060",
    "name": "윤서연",
    "age": 15,
    "gender": "F",
    "birth_date": "2011-04-15",
    "region": "전남",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user60@example.test",
    "status": "active",
    "created_date": "2024/01/04 17:18:00"
  },
  {
    "customer_id": "CUS0061",
    "name": "윤지민",
    "age": 37,
    "gender": "F",
    "birth_date": "1989-05-25",
    "region": "경북",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user61@example.test",
    "status": "active",
    "created_date": "2024/12/09 11:49:00"
  },
  {
    "customer_id": "CUS0062",
    "name": "홍우진",
    "age": 20,
    "gender": "M",
    "birth_date": "2006-08-01",
    "region": "대전",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user62@example.test",
    "status": "dormant",
    "created_date": "2024/10/03 00:02:00"
  },
  {
    "customer_id": "CUS0063",
    "name": "오재현",
    "age": 36,
    "gender": "M",
    "birth_date": "1990-12-06",
    "region": "전남",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user63@example.test",
    "status": "active",
    "created_date": "2024/09/20 12:01:00"
  },
  {
    "customer_id": "CUS0064",
    "name": "한지민",
    "age": 26,
    "gender": "F",
    "birth_date": "2000-08-13",
    "region": "강원",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user64@example.test",
    "status": "active",
    "created_date": "2024/10/01 09:27:00"
  },
  {
    "customer_id": "CUS0065",
    "name": "박소율",
    "age": 53,
    "gender": "F",
    "birth_date": "1973-05-24",
    "region": "서울",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user65@example.test",
    "status": "active",
    "created_date": "2024/01/22 18:50:00"
  },
  {
    "customer_id": "CUS0066",
    "name": "조하은",
    "age": 40,
    "gender": "F",
    "birth_date": "1986-05-21",
    "region": "경남",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user66@example.test",
    "status": "dormant",
    "created_date": "2025/10/22 14:49:00"
  },
  {
    "customer_id": "CUS0067",
    "name": "신예은",
    "age": 66,
    "gender": "F",
    "birth_date": "1960-06-06",
    "region": "광주",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user67@example.test",
    "status": "active",
    "created_date": "2025/01/21 01:09:00"
  },
  {
    "customer_id": "CUS0068",
    "name": "임예은",
    "age": 23,
    "gender": "F",
    "birth_date": "2003-03-04",
    "region": "인천",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user68@example.test",
    "status": "active",
    "created_date": "2023/10/13 04:43:00"
  },
  {
    "customer_id": "CUS0069",
    "name": "장지민",
    "age": 17,
    "gender": "F",
    "birth_date": "2009-03-14",
    "region": "강원",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user69@example.test",
    "status": "active",
    "created_date": "2024/12/29 07:13:00"
  },
  {
    "customer_id": "CUS0070",
    "name": "이재현",
    "age": 17,
    "gender": "M",
    "birth_date": "2009-02-02",
    "region": "경북",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user70@example.test",
    "status": "active",
    "created_date": "2025/01/25 00:40:00"
  },
  {
    "customer_id": "CUS0071",
    "name": "안영호",
    "age": 64,
    "gender": "M",
    "birth_date": "1962-09-08",
    "region": "경남",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user71@example.test",
    "status": "active",
    "created_date": "2024/07/25 15:57:00"
  },
  {
    "customer_id": "CUS0072",
    "name": "박현우",
    "age": 24,
    "gender": "M",
    "birth_date": "2002-02-01",
    "region": "광주",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user72@example.test",
    "status": "active",
    "created_date": "2024/12/09 04:40:00"
  },
  {
    "customer_id": "CUS0073",
    "name": "안서연",
    "age": 20,
    "gender": "F",
    "birth_date": "2006-08-01",
    "region": "경기",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user73@example.test",
    "status": "active",
    "created_date": "2024/04/25 14:18:00"
  },
  {
    "customer_id": "CUS0074",
    "name": "홍성민",
    "age": 31,
    "gender": "M",
    "birth_date": "1995-03-18",
    "region": "서울",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user74@example.test",
    "status": "active",
    "created_date": "2023/08/11 20:02:00"
  },
  {
    "customer_id": "CUS0075",
    "name": "윤민수",
    "age": 36,
    "gender": "M",
    "birth_date": "1990-01-26",
    "region": "세종",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user75@example.test",
    "status": "active",
    "created_date": "2026/06/25 16:50:00"
  },
  {
    "customer_id": "CUS0076",
    "name": "장지민",
    "age": 45,
    "gender": "F",
    "birth_date": "1981-03-25",
    "region": "부산",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user76@example.test",
    "status": "active",
    "created_date": "2026/05/29 00:00:00"
  },
  {
    "customer_id": "CUS0077",
    "name": "서상철",
    "age": 24,
    "gender": "M",
    "birth_date": "2002-04-11",
    "region": "광주",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user77@example.test",
    "status": "active",
    "created_date": "2025/01/13 02:17:00"
  },
  {
    "customer_id": "CUS0078",
    "name": "안현우",
    "age": 41,
    "gender": "M",
    "birth_date": "1985-05-26",
    "region": "인천",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user78@example.test",
    "status": "active",
    "created_date": "2023/07/08 15:43:00"
  },
  {
    "customer_id": "CUS0079",
    "name": "최성민",
    "age": 26,
    "gender": "M",
    "birth_date": "2000-11-24",
    "region": "충북",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user79@example.test",
    "status": "active",
    "created_date": "2025/03/18 21:29:00"
  },
  {
    "customer_id": "CUS0080",
    "name": "정지민",
    "age": 37,
    "gender": "F",
    "birth_date": "1989-11-27",
    "region": "세종",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user80@example.test",
    "status": "active",
    "created_date": "2023/11/21 03:13:00"
  },
  {
    "customer_id": "CUS0081",
    "name": "안지아",
    "age": 25,
    "gender": "F",
    "birth_date": "2001-08-05",
    "region": "전북",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user81@example.test",
    "status": "dormant",
    "created_date": "2023/11/07 20:21:00"
  },
  {
    "customer_id": "CUS0082",
    "name": "황하은",
    "age": 50,
    "gender": "F",
    "birth_date": "1976-05-18",
    "region": "울산",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user82@example.test",
    "status": "active",
    "created_date": "2024/06/16 12:34:00"
  },
  {
    "customer_id": "CUS0083",
    "name": "이다은",
    "age": 59,
    "gender": "F",
    "birth_date": "1967-12-26",
    "region": "부산",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user83@example.test",
    "status": "active",
    "created_date": "2023/12/14 05:17:00"
  },
  {
    "customer_id": "CUS0084",
    "name": "박윤서",
    "age": 58,
    "gender": "F",
    "birth_date": "1968-04-03",
    "region": "세종",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user84@example.test",
    "status": "active",
    "created_date": "2024/03/12 19:34:00"
  },
  {
    "customer_id": "CUS0085",
    "name": "최소율",
    "age": 69,
    "gender": "F",
    "birth_date": "1957-06-20",
    "region": "충남",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user85@example.test",
    "status": "active",
    "created_date": "2026/01/29 21:42:00"
  },
  {
    "customer_id": "CUS0086",
    "name": "박하은",
    "age": 16,
    "gender": "F",
    "birth_date": "2010-02-17",
    "region": "제주",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user86@example.test",
    "status": "dormant",
    "created_date": "2026/01/18 05:38:00"
  },
  {
    "customer_id": "CUS0087",
    "name": "임태현",
    "age": 18,
    "gender": "M",
    "birth_date": "2008-06-19",
    "region": "강원",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user87@example.test",
    "status": "active",
    "created_date": "2023/08/05 16:39:00"
  },
  {
    "customer_id": "CUS0088",
    "name": "박성민",
    "age": 16,
    "gender": "M",
    "birth_date": "2010-03-21",
    "region": "광주",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user88@example.test",
    "status": "dormant",
    "created_date": "2023/09/30 15:28:00"
  },
  {
    "customer_id": "CUS0089",
    "name": "장윤서",
    "age": 25,
    "gender": "F",
    "birth_date": "2001-01-12",
    "region": "강원",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user89@example.test",
    "status": "active",
    "created_date": "2026/07/05 13:37:00"
  },
  {
    "customer_id": "CUS0090",
    "name": "권혜진",
    "age": 49,
    "gender": "F",
    "birth_date": "1977-01-05",
    "region": "서울",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user90@example.test",
    "status": "active",
    "created_date": "2025/02/26 07:57:00"
  },
  {
    "customer_id": "CUS0091",
    "name": "박소율",
    "age": 18,
    "gender": "F",
    "birth_date": "2008-01-21",
    "region": "서울",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user91@example.test",
    "status": "active",
    "created_date": "2025/01/22 21:12:00"
  },
  {
    "customer_id": "CUS0092",
    "name": "오서연",
    "age": 45,
    "gender": "F",
    "birth_date": "1981-10-12",
    "region": "경남",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user92@example.test",
    "status": "active",
    "created_date": "2025/02/18 08:49:00"
  },
  {
    "customer_id": "CUS0093",
    "name": "홍준호",
    "age": 18,
    "gender": "M",
    "birth_date": "2008-08-18",
    "region": "울산",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user93@example.test",
    "status": "active",
    "created_date": "2024/03/08 22:43:00"
  },
  {
    "customer_id": "CUS0094",
    "name": "신윤서",
    "age": 19,
    "gender": "F",
    "birth_date": "2007-09-12",
    "region": "울산",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user94@example.test",
    "status": "active",
    "created_date": "2025/03/25 05:19:00"
  },
  {
    "customer_id": "CUS0095",
    "name": "최예은",
    "age": 29,
    "gender": "F",
    "birth_date": "1997-10-15",
    "region": "울산",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user95@example.test",
    "status": "active",
    "created_date": "2026/01/18 13:45:00"
  },
  {
    "customer_id": "CUS0096",
    "name": "권건우",
    "age": 56,
    "gender": "M",
    "birth_date": "1970-03-25",
    "region": "울산",
    "marketing_consent": 0,
    "sms_consent": 0,
    "email": "user96@example.test",
    "status": "active",
    "created_date": "2025/12/18 04:23:00"
  },
  {
    "customer_id": "CUS0097",
    "name": "황수연",
    "age": 35,
    "gender": "F",
    "birth_date": "1991-10-04",
    "region": "부산",
    "marketing_consent": 1,
    "sms_consent": 0,
    "email": "user97@example.test",
    "status": "active",
    "created_date": "2025/03/22 15:06:00"
  },
  {
    "customer_id": "CUS0098",
    "name": "장예준",
    "age": 33,
    "gender": "M",
    "birth_date": "1993-04-17",
    "region": "인천",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user98@example.test",
    "status": "active",
    "created_date": "2023/05/10 10:15:00"
  },
  {
    "customer_id": "CUS0099",
    "name": "오서연",
    "age": 41,
    "gender": "F",
    "birth_date": "1985-09-01",
    "region": "대전",
    "marketing_consent": 0,
    "sms_consent": 1,
    "email": "user99@example.test",
    "status": "active",
    "created_date": "2025/04/30 15:50:00"
  },
  {
    "customer_id": "CUS0100",
    "name": "최태현",
    "age": 65,
    "gender": "M",
    "birth_date": "1961-05-01",
    "region": "세종",
    "marketing_consent": 1,
    "sms_consent": 1,
    "email": "user100@example.test",
    "status": "active",
    "created_date": "2026/04/12 23:33:00"
  }
];
var subscriptions = [
  {
    "customer_id": "CUS0001",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-13",
    "status": "active"
  },
  {
    "customer_id": "CUS0002",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-31",
    "status": "active"
  },
  {
    "customer_id": "CUS0003",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-08-03",
    "status": "active"
  },
  {
    "customer_id": "CUS0004",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-27",
    "status": "active"
  },
  {
    "customer_id": "CUS0005",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-20",
    "status": "active"
  },
  {
    "customer_id": "CUS0006",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-24",
    "status": "active"
  },
  {
    "customer_id": "CUS0007",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-08-01",
    "status": "active"
  },
  {
    "customer_id": "CUS0008",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-18",
    "status": "active"
  },
  {
    "customer_id": "CUS0009",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-08",
    "status": "churned",
    "end_date": "2026-08-02"
  },
  {
    "customer_id": "CUS0010",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-09",
    "status": "active"
  },
  {
    "customer_id": "CUS0011",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-17",
    "status": "active"
  },
  {
    "customer_id": "CUS0012",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-22",
    "status": "active"
  },
  {
    "customer_id": "CUS0013",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-31",
    "status": "active"
  },
  {
    "customer_id": "CUS0014",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-25",
    "status": "active"
  },
  {
    "customer_id": "CUS0015",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-09",
    "status": "active"
  },
  {
    "customer_id": "CUS0016",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-29",
    "status": "active"
  },
  {
    "customer_id": "CUS0017",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-19",
    "status": "active"
  },
  {
    "customer_id": "CUS0018",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-17",
    "status": "active"
  },
  {
    "customer_id": "CUS0019",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2024-01-19",
    "status": "churned",
    "end_date": "2024-06-01"
  },
  {
    "customer_id": "CUS0020",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2024-08-04",
    "status": "active"
  },
  {
    "customer_id": "CUS0021",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2026-01-16",
    "status": "churned",
    "end_date": "2026-02-28"
  },
  {
    "customer_id": "CUS0022",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2025-09-11",
    "status": "churned",
    "end_date": "2026-04-30"
  },
  {
    "customer_id": "CUS0023",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2024-11-20",
    "status": "churned",
    "end_date": "2025-01-03"
  },
  {
    "customer_id": "CUS0024",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2023-05-23",
    "status": "active"
  },
  {
    "customer_id": "CUS0025",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2025-05-21",
    "status": "churned",
    "end_date": "2025-09-23"
  },
  {
    "customer_id": "CUS0026",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2023-11-20",
    "status": "active"
  },
  {
    "customer_id": "CUS0027",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-07-13",
    "status": "active"
  },
  {
    "customer_id": "CUS0028",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2023-08-17",
    "status": "active"
  },
  {
    "customer_id": "CUS0029",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2024-08-06",
    "status": "active"
  },
  {
    "customer_id": "CUS0030",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2023-09-13",
    "status": "churned",
    "end_date": "2024-03-13"
  },
  {
    "customer_id": "CUS0031",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2024-09-06",
    "status": "churned",
    "end_date": "2025-01-03"
  },
  {
    "customer_id": "CUS0032",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2024-09-04",
    "status": "churned",
    "end_date": "2025-04-22"
  },
  {
    "customer_id": "CUS0033",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2024-10-18",
    "status": "churned",
    "end_date": "2025-01-13"
  },
  {
    "customer_id": "CUS0034",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2024-01-05",
    "status": "active"
  },
  {
    "customer_id": "CUS0035",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2024-04-19",
    "status": "churned",
    "end_date": "2024-06-08"
  },
  {
    "customer_id": "CUS0036",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2023-07-12",
    "status": "churned",
    "end_date": "2023-12-15"
  },
  {
    "customer_id": "CUS0037",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2026-04-22",
    "status": "churned",
    "end_date": "2026-06-05"
  },
  {
    "customer_id": "CUS0038",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2024-04-03",
    "status": "churned",
    "end_date": "2024-09-06"
  },
  {
    "customer_id": "CUS0039",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2023-07-14",
    "status": "churned",
    "end_date": "2023-10-11"
  },
  {
    "customer_id": "CUS0040",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2025-08-12",
    "status": "active"
  },
  {
    "customer_id": "CUS0041",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2025-11-04",
    "status": "active"
  },
  {
    "customer_id": "CUS0042",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2023-09-06",
    "status": "active"
  },
  {
    "customer_id": "CUS0043",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-06-01",
    "status": "active"
  },
  {
    "customer_id": "CUS0044",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2026-07-06",
    "status": "churned",
    "end_date": "2026-08-02"
  },
  {
    "customer_id": "CUS0045",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2023-05-11",
    "status": "active"
  },
  {
    "customer_id": "CUS0046",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-01-15",
    "status": "churned",
    "end_date": "2026-07-23"
  },
  {
    "customer_id": "CUS0047",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-09-02",
    "status": "churned",
    "end_date": "2026-03-16"
  },
  {
    "customer_id": "CUS0048",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2026-06-10",
    "status": "active"
  },
  {
    "customer_id": "CUS0049",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2025-05-06",
    "status": "active"
  },
  {
    "customer_id": "CUS0050",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-01",
    "status": "active"
  },
  {
    "customer_id": "CUS0051",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2025-08-07",
    "status": "churned",
    "end_date": "2026-01-19"
  },
  {
    "customer_id": "CUS0052",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2024-06-08",
    "status": "active"
  },
  {
    "customer_id": "CUS0053",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2023-07-17",
    "status": "churned",
    "end_date": "2023-09-20"
  },
  {
    "customer_id": "CUS0054",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2024-01-07",
    "status": "active"
  },
  {
    "customer_id": "CUS0055",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2025-02-15",
    "status": "active"
  },
  {
    "customer_id": "CUS0056",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2024-07-29",
    "status": "active"
  },
  {
    "customer_id": "CUS0057",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2025-10-30",
    "status": "churned",
    "end_date": "2026-03-15"
  },
  {
    "customer_id": "CUS0058",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2024-10-22",
    "status": "churned",
    "end_date": "2025-01-07"
  },
  {
    "customer_id": "CUS0059",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2025-08-19",
    "status": "active"
  },
  {
    "customer_id": "CUS0060",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2024-03-02",
    "status": "active"
  },
  {
    "customer_id": "CUS0061",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2025-01-08",
    "status": "churned",
    "end_date": "2025-07-10"
  },
  {
    "customer_id": "CUS0062",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2024-10-23",
    "status": "churned",
    "end_date": "2025-02-12"
  },
  {
    "customer_id": "CUS0063",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2024-09-20",
    "status": "active"
  },
  {
    "customer_id": "CUS0064",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2024-10-26",
    "status": "churned",
    "end_date": "2025-05-02"
  },
  {
    "customer_id": "CUS0065",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2024-03-07",
    "status": "churned",
    "end_date": "2024-04-30"
  },
  {
    "customer_id": "CUS0066",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-12-04",
    "status": "churned",
    "end_date": "2026-03-10"
  },
  {
    "customer_id": "CUS0067",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2025-01-25",
    "status": "active"
  },
  {
    "customer_id": "CUS0068",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2023-10-26",
    "status": "churned",
    "end_date": "2024-06-16"
  },
  {
    "customer_id": "CUS0069",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-02-10",
    "status": "churned",
    "end_date": "2025-08-05"
  },
  {
    "customer_id": "CUS0070",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2025-03-25",
    "status": "churned",
    "end_date": "2026-02-05"
  },
  {
    "customer_id": "CUS0071",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2024-09-11",
    "status": "active"
  },
  {
    "customer_id": "CUS0072",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2024-12-27",
    "status": "active"
  },
  {
    "customer_id": "CUS0073",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2024-05-17",
    "status": "active"
  },
  {
    "customer_id": "CUS0074",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2023-09-14",
    "status": "churned",
    "end_date": "2023-12-05"
  },
  {
    "customer_id": "CUS0075",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2026-07-09",
    "status": "churned",
    "end_date": "2026-07-29"
  },
  {
    "customer_id": "CUS0076",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2026-06-06",
    "status": "churned",
    "end_date": "2026-07-29"
  },
  {
    "customer_id": "CUS0077",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2025-02-07",
    "status": "active"
  },
  {
    "customer_id": "CUS0078",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2023-07-12",
    "status": "churned",
    "end_date": "2023-09-21"
  },
  {
    "customer_id": "CUS0079",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2025-04-27",
    "status": "churned",
    "end_date": "2025-11-30"
  },
  {
    "customer_id": "CUS0080",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2023-12-26",
    "status": "churned",
    "end_date": "2024-06-11"
  },
  {
    "customer_id": "CUS0081",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2023-12-22",
    "status": "churned",
    "end_date": "2024-09-02"
  },
  {
    "customer_id": "CUS0082",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2024-07-07",
    "status": "active"
  },
  {
    "customer_id": "CUS0083",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2024-02-03",
    "status": "active"
  },
  {
    "customer_id": "CUS0084",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2024-04-26",
    "status": "churned",
    "end_date": "2024-07-27"
  },
  {
    "customer_id": "CUS0085",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-03-07",
    "status": "churned",
    "end_date": "2026-07-14"
  },
  {
    "customer_id": "CUS0086",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2026-01-23",
    "status": "churned",
    "end_date": "2026-07-29"
  },
  {
    "customer_id": "CUS0087",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2023-09-10",
    "status": "churned",
    "end_date": "2024-03-04"
  },
  {
    "customer_id": "CUS0088",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2023-11-08",
    "status": "churned",
    "end_date": "2024-03-06"
  },
  {
    "customer_id": "CUS0089",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-07-29",
    "status": "active"
  },
  {
    "customer_id": "CUS0090",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2025-04-23",
    "status": "active"
  },
  {
    "customer_id": "CUS0091",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-01-26",
    "status": "active"
  },
  {
    "customer_id": "CUS0092",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2025-03-15",
    "status": "churned",
    "end_date": "2025-07-17"
  },
  {
    "customer_id": "CUS0093",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2024-03-17",
    "status": "churned",
    "end_date": "2024-08-21"
  },
  {
    "customer_id": "CUS0094",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2025-05-22",
    "status": "active"
  },
  {
    "customer_id": "CUS0095",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2026-03-13",
    "status": "active"
  },
  {
    "customer_id": "CUS0096",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-01-05",
    "status": "churned",
    "end_date": "2026-06-17"
  },
  {
    "customer_id": "CUS0097",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2025-05-05",
    "status": "churned",
    "end_date": "2025-10-24"
  },
  {
    "customer_id": "CUS0098",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2023-05-12",
    "status": "active"
  },
  {
    "customer_id": "CUS0099",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-06-21",
    "status": "active"
  },
  {
    "customer_id": "CUS0100",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-05-27",
    "status": "active"
  },
  {
    "customer_id": "CUS0019",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2024-06-13",
    "status": "active"
  },
  {
    "customer_id": "CUS0097",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2025-06-21",
    "status": "active"
  },
  {
    "customer_id": "CUS0032",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2025-04-25",
    "status": "active"
  },
  {
    "customer_id": "CUS0034",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2024-01-09",
    "status": "active"
  },
  {
    "customer_id": "CUS0048",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-07-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0038",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2024-09-13",
    "status": "active"
  },
  {
    "customer_id": "CUS0081",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2024-03-02",
    "status": "active"
  },
  {
    "customer_id": "CUS0014",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2026-07-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0044",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2026-08-24",
    "status": "active"
  },
  {
    "customer_id": "CUS0062",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2025-03-14",
    "status": "active"
  },
  {
    "customer_id": "CUS0079",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2025-12-27",
    "status": "active"
  },
  {
    "customer_id": "CUS0075",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-07-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0080",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2024-07-20",
    "status": "active"
  },
  {
    "customer_id": "CUS0022",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2026-06-11",
    "status": "active"
  },
  {
    "customer_id": "CUS0019",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2024-01-25",
    "status": "active"
  },
  {
    "customer_id": "CUS0047",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2026-05-13",
    "status": "active"
  },
  {
    "customer_id": "CUS0070",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2026-02-18",
    "status": "churned",
    "end_date": "2026-08-04"
  },
  {
    "customer_id": "CUS0066",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2026-04-15",
    "status": "active"
  },
  {
    "customer_id": "CUS0100",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2026-07-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0069",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2025-09-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0031",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-01-10",
    "status": "active"
  },
  {
    "customer_id": "CUS0062",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2024-11-26",
    "status": "active"
  },
  {
    "customer_id": "CUS0033",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-01-22",
    "status": "active"
  },
  {
    "customer_id": "CUS0052",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2024-06-10",
    "status": "active"
  },
  {
    "customer_id": "CUS0023",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2025-01-13",
    "status": "active"
  },
  {
    "customer_id": "CUS0097",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-12-04",
    "status": "active"
  },
  {
    "customer_id": "CUS0002",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-07-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0096",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2026-07-13",
    "status": "active"
  },
  {
    "customer_id": "CUS0051",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-11-24",
    "status": "active"
  },
  {
    "customer_id": "CUS0087",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2023-09-28",
    "status": "active"
  },
  {
    "customer_id": "CUS0074",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2024-01-29",
    "status": "active"
  },
  {
    "customer_id": "CUS0088",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2024-03-21",
    "status": "active"
  },
  {
    "customer_id": "CUS0023",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2024-11-21",
    "status": "active"
  },
  {
    "customer_id": "CUS0008",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2026-08-02",
    "status": "active"
  },
  {
    "customer_id": "CUS0038",
    "plan_code": "PREMIUM",
    "plan_label": "프리미엄",
    "start_date": "2024-05-04",
    "status": "active"
  },
  {
    "customer_id": "CUS0057",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2026-04-26",
    "status": "active"
  },
  {
    "customer_id": "CUS0045",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2023-06-27",
    "status": "active"
  },
  {
    "customer_id": "CUS0077",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2025-04-02",
    "status": "active"
  },
  {
    "customer_id": "CUS0085",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2026-07-29",
    "status": "active"
  },
  {
    "customer_id": "CUS0082",
    "plan_code": "Y_PLAN",
    "plan_label": "Y요금",
    "start_date": "2024-08-29",
    "status": "active"
  },
  {
    "customer_id": "CUS0009",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2026-09-08",
    "status": "active"
  },
  {
    "customer_id": "CUS0051",
    "plan_code": "VOICE_MAX",
    "plan_label": "보이스맥스",
    "start_date": "2026-03-02",
    "status": "active"
  },
  {
    "customer_id": "CUS0057",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2025-12-07",
    "status": "active"
  },
  {
    "customer_id": "CUS0013",
    "plan_code": "STUDENT",
    "plan_label": "학생요금",
    "start_date": "2026-07-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0036",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2023-12-26",
    "status": "active"
  },
  {
    "customer_id": "CUS0027",
    "plan_code": "DATA_PLUS",
    "plan_label": "데이터플러스",
    "start_date": "2026-07-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0046",
    "plan_code": "FAMILY",
    "plan_label": "패밀리",
    "start_date": "2026-08-20",
    "status": "active"
  },
  {
    "customer_id": "CUS0012",
    "plan_code": "BASIC",
    "plan_label": "베이직",
    "start_date": "2026-07-16",
    "status": "active"
  },
  {
    "customer_id": "CUS0080",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2023-12-27",
    "status": "active"
  },
  {
    "customer_id": "CUS0061",
    "plan_code": "Z_PLAN",
    "plan_label": "Z요금",
    "start_date": "2025-08-15",
    "status": "active"
  }
];

var beforeCust = _countRows(SCHEMA_CUST);
var beforeSub = _countRows(SCHEMA_SUB);
if (!CLEAR && (beforeCust > 0 || beforeSub > 0)) {
  throw new Error("[testWooSampleSeed] data exists. set CLEAR=true");
}

var clearedSub = 0, clearedCust = 0;
if (CLEAR) {
  clearedSub = _clearSubscriptions();
  clearedCust = _clearCustomers();
}

var i;
for (i = 0; i < customers.length; i++) _writeCustomer(customers[i]);
for (i = 0; i < subscriptions.length; i++) _writeSubscription(subscriptions[i]);

logInfo("[testWooSampleSeed] done cleared(cust=" + clearedCust + ",sub=" + clearedSub +
  ") loaded(cust=" + customers.length + ",sub=" + subscriptions.length +
  ") count(cust=" + _countRows(SCHEMA_CUST) + ",sub=" + _countRows(SCHEMA_SUB) + ")");

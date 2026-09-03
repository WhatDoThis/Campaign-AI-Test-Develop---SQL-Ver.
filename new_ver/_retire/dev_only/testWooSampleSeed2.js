/*
 * testWooSampleSeed2.js (샘플 단말·청구·앱 적재)
 * ==================================================
 * 기존 woo:testWooSampleCustomer 의 customer_id 만 조인해서
 * Device / Bill / App 1:1 행을 Write 한다. 고객·가입 테이블은 건드리지 않는다.
 * WF: Start → JavaScript code → End. 스키마 Update database structure 후 Run.
 *
 * [Main Functions]
 * ===========
 * - 실행 본체 — 기존 고객 ID 조회 → (CLEAR면 3테이블 삭제) → 3테이블 insert
 *
 * [Dependencies]
 * =========
 * - woo:testWooSampleCustomer — 조인 키 소스. 0건이면 중단
 * - woo:testWooSampleDevice · testWooSampleBill · testWooSampleApp
 * - xtk.session.Write / xtk.queryDef — SQL DML 금지
 * - CLEAR=true — 3테이블만 비우고 재적재. 고객·가입은 유지
 */
var CLEAR = true;
var SCHEMA_CUST = "woo:testWooSampleCustomer";
var SCHEMA_DEV = "woo:testWooSampleDevice";
var SCHEMA_BILL = "woo:testWooSampleBill";
var SCHEMA_APP = "woo:testWooSampleApp";

function _countRows(schema) {
  var q = xtk.queryDef.create(
    <queryDef schema={schema} operation="select">
      <select><node expr="count(@id)" alias="@cnt"/></select>
    </queryDef>
  );
  return parseInt(String(q.ExecuteQuery().@cnt), 10) || 0;
}

function _clearDevices() {
  var q = xtk.queryDef.create(
    <queryDef schema={SCHEMA_DEV} operation="select" lineCount="500">
      <select><node expr="@id"/></select>
    </queryDef>
  );
  var res = q.ExecuteQuery();
  var n = 0;
  var row;
  for each (row in res.testWooSampleDevice) {
    if (!row || row.@id == null) continue;
    var doc = <testWooSampleDevice xtkschema={SCHEMA_DEV} _operation="delete"/>;
    doc.@id = row.@id;
    xtk.session.Write(doc);
    n++;
  }
  return n;
}

function _clearBills() {
  var q = xtk.queryDef.create(
    <queryDef schema={SCHEMA_BILL} operation="select" lineCount="500">
      <select><node expr="@id"/></select>
    </queryDef>
  );
  var res = q.ExecuteQuery();
  var n = 0;
  var row;
  for each (row in res.testWooSampleBill) {
    if (!row || row.@id == null) continue;
    var doc = <testWooSampleBill xtkschema={SCHEMA_BILL} _operation="delete"/>;
    doc.@id = row.@id;
    xtk.session.Write(doc);
    n++;
  }
  return n;
}

function _clearApps() {
  var q = xtk.queryDef.create(
    <queryDef schema={SCHEMA_APP} operation="select" lineCount="500">
      <select><node expr="@id"/></select>
    </queryDef>
  );
  var res = q.ExecuteQuery();
  var n = 0;
  var row;
  for each (row in res.testWooSampleApp) {
    if (!row || row.@id == null) continue;
    var doc = <testWooSampleApp xtkschema={SCHEMA_APP} _operation="delete"/>;
    doc.@id = row.@id;
    xtk.session.Write(doc);
    n++;
  }
  return n;
}

function _existingCustomerIds() {
  var q = xtk.queryDef.create(
    <queryDef schema={SCHEMA_CUST} operation="select" lineCount="200">
      <select><node expr="@customer_id"/></select>
    </queryDef>
  );
  var res = q.ExecuteQuery();
  var seen = {};
  var list = [];
  var row;
  for each (row in res.testWooSampleCustomer) {
    var id = String(row.@customer_id || "");
    if (!id || seen[id]) continue;
    seen[id] = 1;
    list.push(id);
  }
  return list;
}

function _idNum(cid) {
  var m = String(cid).match(/(\d+)$/);
  return m ? parseInt(m[1], 10) : 0;
}

function _writeDevice(d) {
  var doc = <testWooSampleDevice xtkschema={SCHEMA_DEV} _operation="insert"/>;
  doc.@customer_id = d.customer_id;
  doc.@os = d.os;
  doc.@maker = d.maker;
  doc.@network_gen = d.network_gen;
  doc.@start_date = d.start_date;
  xtk.session.Write(doc);
}

function _writeBill(b) {
  var doc = <testWooSampleBill xtkschema={SCHEMA_BILL} _operation="insert"/>;
  doc.@customer_id = b.customer_id;
  doc.@bill_month = b.bill_month;
  doc.@bill_amt = b.bill_amt;
  doc.@unpaid = b.unpaid;
  doc.@pay_method = b.pay_method;
  xtk.session.Write(doc);
}

function _writeApp(a) {
  var doc = <testWooSampleApp xtkschema={SCHEMA_APP} _operation="insert"/>;
  doc.@customer_id = a.customer_id;
  doc.@app_status = a.app_status;
  doc.@push_consent = a.push_consent;
  if (a.last_login) doc.@last_login = a.last_login;
  doc.@channel = a.channel;
  xtk.session.Write(doc);
}

function _rowDevice(cid, n) {
  var osR = n % 5;
  var os = "Android";
  var maker = "삼성";
  if (osR === 0 || osR === 1) {
    os = "iOS";
    maker = "애플";
  } else if (osR === 4) {
    os = "기타";
    maker = "기타";
  }
  var netR = n % 4;
  var net = "LTE";
  if (netR === 0) net = "5G";
  else if (netR === 3) net = "3G";
  var y = 2023 + (n % 3);
  var mo = 1 + (n % 12);
  var moS = mo < 10 ? "0" + mo : String(mo);
  var day = 1 + (n % 28);
  var dayS = day < 10 ? "0" + day : String(day);
  return {
    customer_id: cid,
    os: os,
    maker: maker,
    network_gen: net,
    start_date: y + "-" + moS + "-" + dayS
  };
}

function _rowBill(cid, n) {
  var pays = ["자동이체", "카드", "계좌", "지로"];
  return {
    customer_id: cid,
    bill_month: "2026-07",
    bill_amt: 12000 + ((n * 1370) % 188000),
    unpaid: (n % 7 === 0) ? 1 : 0,
    pay_method: pays[n % 4]
  };
}

function _rowApp(cid, n) {
  var stR = n % 5;
  var status = "사용";
  var login = "2026-07-12";
  if (stR === 0) {
    status = "미설치";
    login = "";
  } else if (stR === 1) {
    status = "휴면";
    login = "2025-11-03";
  }
  var chans = ["앱", "ARS", "매장"];
  return {
    customer_id: cid,
    app_status: status,
    push_consent: (n % 2 === 0) ? 1 : 0,
    last_login: login,
    channel: chans[n % 3]
  };
}

var ids = _existingCustomerIds();
if (!ids.length)
  throw new Error("[testWooSampleSeed2] no customers. run testWooSampleSeed.js first");

var beforeDev = _countRows(SCHEMA_DEV);
var beforeBill = _countRows(SCHEMA_BILL);
var beforeApp = _countRows(SCHEMA_APP);
if (!CLEAR && (beforeDev > 0 || beforeBill > 0 || beforeApp > 0))
  throw new Error("[testWooSampleSeed2] data exists. set CLEAR=true");

var clearedDev = 0, clearedBill = 0, clearedApp = 0;
if (CLEAR) {
  clearedDev = _clearDevices();
  clearedBill = _clearBills();
  clearedApp = _clearApps();
}

var i, n;
var wroteDev = 0, wroteBill = 0, wroteApp = 0;
for (i = 0; i < ids.length; i++) {
  n = _idNum(ids[i]) || (i + 1);
  _writeDevice(_rowDevice(ids[i], n));
  wroteDev++;
  _writeBill(_rowBill(ids[i], n));
  wroteBill++;
  _writeApp(_rowApp(ids[i], n));
  wroteApp++;
}

logInfo("[testWooSampleSeed2] done ids=" + ids.length +
  " cleared(dev=" + clearedDev + ",bill=" + clearedBill + ",app=" + clearedApp +
  ") loaded(dev=" + wroteDev + ",bill=" + wroteBill + ",app=" + wroteApp +
  ") count(dev=" + _countRows(SCHEMA_DEV) +
  ",bill=" + _countRows(SCHEMA_BILL) +
  ",app=" + _countRows(SCHEMA_APP) + ")");

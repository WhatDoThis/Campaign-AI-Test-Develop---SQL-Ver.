# IE / urlViewer patterns (project-proven)

## XHR

```javascript
function twXhr(method, url, body, cb) {
  var x = null;
  try { x = new XMLHttpRequest(); } catch (e1) {}
  if (!x) {
    try { x = new ActiveXObject("MSXML2.XMLHTTP"); } catch (e2) {}
  }
  if (!x) { cb({ ok: false, error: "no_xhr" }); return; }
  x.onreadystatechange = function () {
    if (x.readyState !== 4) return;
    var txt = x.responseText || "";
    cb({ ok: x.status >= 200 && x.status < 300, status: x.status, text: txt });
  };
  x.open(method, url, true);
  if (body) {
    x.setRequestHeader("Content-Type", "application/json;charset=UTF-8");
    x.send(body);
  } else {
    x.send();
  }
}
```

## 2-step overwrite

1. First click: button label → "정말 덮어쓰기?" + armed flag
2. Second click within N seconds: perform write; else reset label

## Layout

- Outer: `<table width="100%">` with two cells (left AI / right list)
- Heights: fixed px (e.g. answer 280px, composer 120px, info bar 48px)
- Show/hide side panel: CSS class on table cell — avoid inline `display` fights in embed

## Cache

- Studio URL: `...?v=143&_r=<tick>`
- Form Reload/Apply may refresh `_r` via ShellPick tick

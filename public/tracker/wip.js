/**
 * CommitHappens lightweight tracker (MVP).
 *
 * Install on a customer site:
 *   <script async src="https://YOUR_APP_ORIGIN/tracker/wip.js" data-site-key="WEBSITE_UUID"></script>
 *
 * The script posts to the same origin as this file under `/api/v1/ingest`.
 * Custom events: window.__wipTrack("signup", { plan: "pro" });
 */
(function () {
  var COOKIE = "_wip_vid";
  var SESS_KEY = "_wip_sid";
  var SCRIPT = document.currentScript;
  if (!SCRIPT || !SCRIPT.getAttribute) return;

  var siteKey = SCRIPT.getAttribute("data-site-key");
  if (!siteKey) return;

  function apiOrigin() {
    try {
      var u = new URL(SCRIPT.src);
      if (u.hostname === "commithappens.com") {
        return "https://www.commithappens.com";
      }
      return u.origin;
    } catch {
      return "";
    }
  }

  function uuid() {
    if (crypto && crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  function readCookie(name) {
    var m = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
    return m ? decodeURIComponent(m[1]) : "";
  }

  function writeCookie(name, value, days) {
    var maxAge = days * 24 * 60 * 60;
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      encodeURIComponent(name) +
      "=" +
      encodeURIComponent(value) +
      "; Path=/; Max-Age=" +
      maxAge +
      "; SameSite=Lax" +
      secure;
  }

  function visitorKey() {
    var existing = readCookie(COOKIE);
    if (existing && existing.length > 8) return existing;
    var v = uuid();
    writeCookie(COOKIE, v, 400);
    return v;
  }

  function sessionKey() {
    try {
      var k = sessionStorage.getItem(SESS_KEY);
      if (k && k.length > 8) return k;
      k = uuid();
      sessionStorage.setItem(SESS_KEY, k);
      return k;
    } catch {
      return uuid();
    }
  }

  function deviceType() {
    var ua = navigator.userAgent || "";
    if (/Mobi|Android/i.test(ua)) return "mobile";
    if (/Tablet|iPad/i.test(ua)) return "tablet";
    return "desktop";
  }

  function attributionFromUrl() {
    try {
      var u = new URL(location.href);
      return {
        referrerUrl: document.referrer || null,
        utmSource: u.searchParams.get("utm_source"),
        utmMedium: u.searchParams.get("utm_medium"),
        utmCampaign: u.searchParams.get("utm_campaign"),
        utmTerm: u.searchParams.get("utm_term"),
        utmContent: u.searchParams.get("utm_content"),
      };
    } catch {
      return { referrerUrl: document.referrer || null };
    }
  }

  function send(events) {
    var origin = apiOrigin();
    if (!origin) return;
    var payload = JSON.stringify({
      siteKey: siteKey,
      visitorKey: visitorKey(),
      sessionKey: sessionKey(),
      context: {
        userAgent: navigator.userAgent,
        deviceType: deviceType(),
      },
      attribution: attributionFromUrl(),
      events: events,
    });
    var url = origin + "/api/v1/ingest";
    if (navigator.sendBeacon) {
      var blob = new Blob([payload], { type: "application/json" });
      navigator.sendBeacon(url, blob);
      return;
    }
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
      keepalive: true,
      mode: "cors",
    }).catch(function () {});
  }

  function classifyVital(name, value) {
    if (name === "LCP") {
      if (value <= 2500) return "good";
      if (value <= 4000) return "needs-improvement";
      return "poor";
    }
    if (name === "CLS") {
      if (value <= 0.1) return "good";
      if (value <= 0.25) return "needs-improvement";
      return "poor";
    }
    if (name === "INP") {
      if (value <= 200) return "good";
      if (value <= 500) return "needs-improvement";
      return "poor";
    }
    if (name === "FCP" || name === "TTFB") {
      if (value <= 1800) return "good";
      if (value <= 3000) return "needs-improvement";
      return "poor";
    }
    return null;
  }

  var sentVitals = {};
  var latestLcp = null;
  var clsValue = 0;
  var clsSessionValue = 0;
  var clsSessionEntries = [];
  var maxInp = 0;

  function emitVital(name, value, extraMeta) {
    if (!Number.isFinite(value)) return;
    if (sentVitals[name]) return;
    sentVitals[name] = true;
    send([
      {
        type: "web_vital",
        name: name,
        value: Number(value),
        rating: classifyVital(name, Number(value)),
        path: location.pathname || "/",
        metadata: extraMeta && typeof extraMeta === "object" ? extraMeta : {},
        occurredAt: new Date().toISOString(),
      },
    ]);
  }

  function setupVitalsCapture() {
    if (!("PerformanceObserver" in window)) {
      return;
    }
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      if (nav && nav[0] && typeof nav[0].responseStart === "number") {
        emitVital("TTFB", nav[0].responseStart);
      }
    } catch {}

    try {
      var poPaint = new PerformanceObserver(function (entryList) {
        entryList.getEntries().forEach(function (entry) {
          if (entry.name === "first-contentful-paint") {
            emitVital("FCP", entry.startTime);
          }
        });
      });
      poPaint.observe({ type: "paint", buffered: true });
    } catch {}

    try {
      var poLcp = new PerformanceObserver(function (entryList) {
        var entries = entryList.getEntries();
        if (entries.length > 0) {
          latestLcp = entries[entries.length - 1];
        }
      });
      poLcp.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {}

    try {
      var poCls = new PerformanceObserver(function (entryList) {
        entryList.getEntries().forEach(function (entry) {
          if (entry.hadRecentInput) return;
          if (
            clsSessionEntries.length &&
            entry.startTime - clsSessionEntries[clsSessionEntries.length - 1].startTime < 1000 &&
            entry.startTime - clsSessionEntries[0].startTime < 5000
          ) {
            clsSessionEntries.push(entry);
            clsSessionValue += entry.value;
          } else {
            clsSessionEntries = [entry];
            clsSessionValue = entry.value;
          }
          if (clsSessionValue > clsValue) clsValue = clsSessionValue;
        });
      });
      poCls.observe({ type: "layout-shift", buffered: true });
    } catch {}

    try {
      var poInp = new PerformanceObserver(function (entryList) {
        entryList.getEntries().forEach(function (entry) {
          var d = typeof entry.duration === "number" ? entry.duration : 0;
          if (d > maxInp) maxInp = d;
        });
      });
      poInp.observe({ type: "event", durationThreshold: 16, buffered: true });
    } catch {}

    function flushVitals() {
      if (latestLcp && Number.isFinite(latestLcp.startTime)) {
        emitVital("LCP", latestLcp.startTime);
      }
      if (clsValue > 0) {
        emitVital("CLS", clsValue);
      }
      if (maxInp > 0) {
        emitVital("INP", maxInp);
      }
    }
    addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") flushVitals();
    });
    addEventListener("pagehide", flushVitals);
  }

  function navLoadTimeMs() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType("navigation");
      if (!nav || !nav[0]) return null;
      var e = nav[0];
      if (typeof e.domContentLoadedEventEnd === "number" && e.domContentLoadedEventEnd > 0) {
        return Math.round(e.domContentLoadedEventEnd);
      }
      return null;
    } catch {
      return null;
    }
  }

  function pageview() {
    send([
      {
        type: "pageview",
        occurredAt: new Date().toISOString(),
        path: location.pathname || "/",
        query: location.search && location.search.length > 1 ? location.search.slice(1) : null,
        title: document.title || null,
        referrerUrl: document.referrer || null,
        fullUrl: location.href || null,
        loadTimeMs: navLoadTimeMs(),
      },
    ]);
  }

  function normalizeCustomPayload(input) {
    if (!input || typeof input !== "object") {
      return {
        category: null,
        path: null,
        value: null,
        isConversion: false,
        properties: {},
      };
    }
    var hasRich =
      Object.prototype.hasOwnProperty.call(input, "category") ||
      Object.prototype.hasOwnProperty.call(input, "path") ||
      Object.prototype.hasOwnProperty.call(input, "value") ||
      Object.prototype.hasOwnProperty.call(input, "isConversion") ||
      Object.prototype.hasOwnProperty.call(input, "properties");

    if (!hasRich) {
      return {
        category: null,
        path: location.pathname || null,
        value: null,
        isConversion: false,
        properties: input,
      };
    }

    var properties =
      input.properties && typeof input.properties === "object" ? input.properties : {};
    return {
      category: typeof input.category === "string" ? input.category : null,
      path: typeof input.path === "string" ? input.path : location.pathname || null,
      value: typeof input.value === "number" ? input.value : null,
      isConversion: input.isConversion === true,
      properties: properties,
    };
  }

  function track(name, properties) {
    if (!name || typeof name !== "string") return;
    var normalized = normalizeCustomPayload(properties);
    send([
      {
        type: "custom",
        name: name,
        category: normalized.category,
        path: normalized.path,
        value: normalized.value,
        isConversion: normalized.isConversion,
        properties: normalized.properties,
        occurredAt: new Date().toISOString(),
      },
    ]);
  }

  window.__wipTrack = track;

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(pageview, 0);
  } else {
    document.addEventListener("DOMContentLoaded", function () {
      setTimeout(pageview, 0);
    });
  }

  var pushState = history.pushState;
  history.pushState = function () {
    var ret = pushState.apply(history, arguments);
    setTimeout(pageview, 0);
    return ret;
  };
  var replaceState = history.replaceState;
  history.replaceState = function () {
    var ret = replaceState.apply(history, arguments);
    setTimeout(pageview, 0);
    return ret;
  };
  window.addEventListener("popstate", function () {
    setTimeout(pageview, 0);
  });

  setupVitalsCapture();
})();

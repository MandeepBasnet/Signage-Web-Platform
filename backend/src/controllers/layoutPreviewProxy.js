import crypto from "crypto";
import {
  getWebClient,
  getWebBaseUrl,
  invalidateWebSession,
  WebSessionNotConfiguredError,
} from "../utils/xiboWebSession.js";

// ---------------------------------------------------------------------------
// Faithful layout preview = an authenticated reverse-proxy of Xibo's own web
// preview (/layout/preview/{id}), served through the shared web session.
//
// The browser can't attach our JWT to an <iframe> or to the dozens of
// sub-resource requests the preview page fires (JS/CSS/getData/media). Cookies
// would be a third-party context (app on :5173, proxy on :5000) and get blocked
// by SameSite. So instead the authenticated entry handler mints a short-lived
// "preview session id" (sid) and bakes it into the proxy path
// (/api/xibo-web/{sid}/...). The sid is a capability: every rewritten URL and
// the injected <base> carry it, so all sub-resources resolve back to this
// authenticated proxy without needing a token per request.
// ---------------------------------------------------------------------------

const PREVIEW_TTL_MS = 60 * 60 * 1000; // 1 hour
const previewSessions = new Map(); // sid -> { expiresAt }

const makeSid = () => crypto.randomBytes(18).toString("hex");

const isValidSid = (sid) => {
  const entry = previewSessions.get(sid);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    previewSessions.delete(sid);
    return false;
  }
  return true;
};

// Opportunistic cleanup so the map doesn't grow unbounded.
const sweepSessions = () => {
  const now = Date.now();
  for (const [sid, entry] of previewSessions) {
    if (now > entry.expiresAt) previewSessions.delete(sid);
  }
};

// Absolute base the browser uses to reach THIS backend (e.g. http://localhost:5000).
const publicBase = (req) => `${req.protocol}://${req.get("host")}`;

// ----- URL rewriting -------------------------------------------------------

// Turn a single URL (attribute value or css url()) into one that points back
// through this proxy. Leaves data:/blob:/anchors and truly external URLs alone.
const makeProxify = (webBase, prefix) => (raw) => {
  if (raw == null) return raw;
  let u = String(raw).trim();
  if (u === "") return raw;
  if (/^(data:|blob:|mailto:|tel:|javascript:|about:|#)/i.test(u)) return raw;
  if (u.startsWith(prefix)) return raw; // already proxied
  if (u.startsWith(webBase)) return prefix + u.slice(webBase.length);
  if (/^https?:\/\//i.test(u) || u.startsWith("//")) return raw; // external CDN
  if (u.startsWith("/")) return prefix + u; // root-relative
  return raw; // document-relative — handled by <base>
};

// Rewrite the URL-bearing bits of an HTML document.
const rewriteHtml = (html, proxify) => {
  let out = html;

  // src / href / action / poster / data-src attributes
  out = out.replace(
    /\b(src|href|action|poster|data-src)\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (m, attr, _q, dq, sq) => {
      const val = dq !== undefined ? dq : sq;
      const quote = dq !== undefined ? '"' : "'";
      return `${attr}=${quote}${proxify(val)}${quote}`;
    }
  );

  // srcset (comma-separated "url descriptor" candidates)
  out = out.replace(
    /\bsrcset\s*=\s*("([^"]*)"|'([^']*)')/gi,
    (m, _q, dq, sq) => {
      const val = dq !== undefined ? dq : sq;
      const quote = dq !== undefined ? '"' : "'";
      const rewritten = val
        .split(",")
        .map((cand) => {
          const parts = cand.trim().split(/\s+/);
          parts[0] = proxify(parts[0]);
          return parts.join(" ");
        })
        .join(", ");
      return `srcset=${quote}${rewritten}${quote}`;
    }
  );

  // CSS url(...) inside <style> blocks / inline styles, plus @import
  out = rewriteCss(out, proxify);
  return out;
};

const rewriteCss = (css, proxify) => {
  let out = css.replace(
    /url\(\s*(['"]?)([^'")]+)\1\s*\)/gi,
    (m, q, url) => `url(${q}${proxify(url)}${q})`
  );
  out = out.replace(
    /@import\s+(['"])([^'"]+)\1/gi,
    (m, q, url) => `@import ${q}${proxify(url)}${q}`
  );
  return out;
};

// Inline shim injected at the very top of <head>: it patches the runtime URL
// surface (fetch / XHR / element src+href / setAttribute) so URLs the player
// JS builds dynamically (often root-relative like "/layout/getData/..") get
// routed through this proxy too. Static rewriting + <base> can't catch those.
const shimScript = (webBase, prefix) => `<script>(function(){
  var PREFIX=${JSON.stringify(prefix)},WEBBASE=${JSON.stringify(webBase)};
  function px(u){try{
    if(u==null)return u;u=String(u);if(!u)return u;
    if(u.indexOf(PREFIX)===0)return u;
    if(/^(data:|blob:|mailto:|tel:|javascript:|about:|#)/i.test(u))return u;
    if(u.indexOf(WEBBASE)===0)return PREFIX+u.slice(WEBBASE.length);
    var ORIGIN=location.origin;
    if(u.indexOf(ORIGIN)===0){
      // Same-origin absolute URL. The Xibo renderer builds these as
      // location.origin + "/layout/xlf/.." etc. Route the path through the
      // proxy unless it already is a proxy URL.
      var rest=u.slice(ORIGIN.length);
      if(rest.indexOf("/api/xibo-web/")===0)return u;
      return PREFIX+rest;
    }
    if(/^https?:\\/\\//i.test(u)||u.indexOf("//")===0)return u;
    if(u.charAt(0)==="/")return PREFIX+u;
    return u;
  }catch(e){return u;}}
  var of=window.fetch;
  if(of)window.fetch=function(input,init){
    try{if(typeof input==="string")input=px(input);
    else if(input&&input.url)input=new Request(px(input.url),input);}catch(e){}
    return of.call(this,input,init);};
  var xo=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(m,u){try{arguments[1]=px(u);}catch(e){}return xo.apply(this,arguments);};
  function patch(proto,prop){try{
    var d=Object.getOwnPropertyDescriptor(proto,prop);if(!d||!d.set)return;
    Object.defineProperty(proto,prop,{configurable:true,enumerable:d.enumerable,
      get:d.get,set:function(v){d.set.call(this,px(v));}});
  }catch(e){}}
  patch(HTMLImageElement.prototype,"src");
  patch(HTMLScriptElement.prototype,"src");
  patch(HTMLMediaElement.prototype,"src");
  patch(HTMLLinkElement.prototype,"href");
  patch(HTMLIFrameElement.prototype,"src");
  if(window.HTMLSourceElement)patch(HTMLSourceElement.prototype,"src");
  var sa=Element.prototype.setAttribute;
  Element.prototype.setAttribute=function(n,v){try{if(/^(src|href|poster|data-src)$/i.test(n))v=px(v);}catch(e){}return sa.call(this,n,v);};
})();</script>`;

// Insert the shim immediately after the opening <head> (or <html>) so it runs
// before any Xibo player script. No <base>: the proxied document already lives
// under the proxy prefix, so document-relative URLs resolve back through us on
// their own; only root-relative / absolute-origin URLs need rewriting.
const injectShim = (html, shim) => {
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/(<head[^>]*>)/i, `$1${shim}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/(<html[^>]*>)/i, `$1${shim}`);
  }
  return shim + html;
};

// XiboLayoutRenderer is configured inline with root-relative URL TEMPLATES
// (getXlfUrl, libraryDownloadUrl, getResourceUrl, …). The renderer fills these
// in and often injects them via innerHTML, which bypasses the runtime shim's
// setter/setAttribute hooks. So we rewrite the templates to absolute-proxied
// URLs right in the page — then every URL the renderer builds is correct no
// matter how it's used. (Slashes stay JSON-escaped as `\/`; mixing with the
// literal `/` in our prefix is still a valid JS string.)
const RENDERER_URL_KEYS =
  "getXlfUrl|getResourceUrl|libraryDownloadUrl|layoutBackgroundDownloadUrl|loaderUrl|layoutPreviewUrl|getDataUrl|widgetDataUrl";

const rewriteRendererConfig = (html, prefix) =>
  html.replace(
    new RegExp(
      `"(${RENDERER_URL_KEYS})"\\s*:\\s*"((?:\\\\\\/|\\/)[^"]*)"`,
      "g"
    ),
    (m, key, val) => `"${key}":"${prefix}${val}"`
  );

// Full HTML transform applied to the preview page AND every nested region
// iframe document the proxy serves.
const processHtml = (html, proxify, webBase, prefix) => {
  let out = stripCsp(html);
  // Webpack reads <meta name="public-path"> to build chunk URLs — point it at
  // the proxy so dynamically-loaded chunks resolve through us.
  out = out.replace(
    /(<meta[^>]+name=["']public-path["'][^>]*content=["'])([^"']*)(["'])/i,
    (m, pre, _val, post) => `${pre}${prefix}/${post}`
  );
  out = rewriteRendererConfig(out, prefix);
  out = rewriteHtml(out, proxify);
  out = injectShim(out, shimScript(webBase, prefix));
  return out;
};

// Drop any in-document Content-Security-Policy: it would block our injected
// inline shim and the rewritten cross-origin resource URLs. (We serve the page
// from our own origin, so the CMS's CSP no longer applies anyway.)
const stripCsp = (html) =>
  html.replace(
    /<meta[^>]+http-equiv=["']content-security-policy["'][^>]*>/gi,
    ""
  );

const looksLikeLogin = (html, responseUrl) =>
  (responseUrl && /\/login/i.test(responseUrl)) ||
  /name=["']csrfToken["']/i.test(html) ||
  /<title>[^<]*login/i.test(html);

const collectStream = (stream) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });

// ----- Handlers ------------------------------------------------------------

// Entry: GET /api/layouts/:layoutId/live-preview?token=JWT (verifyToken upstream)
export const getLayoutLivePreview = async (req, res) => {
  try {
    const { layoutId } = req.params;
    sweepSessions();

    const webBase = getWebBaseUrl();
    const sid = makeSid();
    previewSessions.set(sid, { expiresAt: Date.now() + PREVIEW_TTL_MS });

    const prefix = `${publicBase(req)}/api/xibo-web/${sid}`;
    const proxify = makeProxify(webBase, prefix);
    const pageUrl = `${webBase}/layout/preview/${layoutId}`;
    console.log(`[getLayoutLivePreview] layout ${layoutId} -> ${pageUrl} (sid ${sid.slice(0, 8)}…)`);

    const fetchPage = async () => {
      const client = await getWebClient();
      return client.get(pageUrl, {
        responseType: "text",
        validateStatus: (s) => s < 500,
      });
    };

    let response = await fetchPage();
    let html = String(response.data || "");
    let responseUrl = response.request?.res?.responseUrl || "";

    if (looksLikeLogin(html, responseUrl)) {
      invalidateWebSession();
      response = await fetchPage();
      html = String(response.data || "");
      responseUrl = response.request?.res?.responseUrl || "";
    }

    if (response.status >= 400 || looksLikeLogin(html, responseUrl)) {
      previewSessions.delete(sid);
      return res
        .status(502)
        .send("Layout preview is unavailable (could not load the Xibo preview).");
    }

    const rewritten = processHtml(html, proxify, webBase, prefix);

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    // Allow this document to be framed by our own app.
    res.removeHeader("X-Frame-Options");
    return res.send(rewritten);
  } catch (err) {
    if (err instanceof WebSessionNotConfiguredError) {
      return res
        .status(503)
        .send("Live preview unavailable: Xibo web session is not configured.");
    }
    console.error("Error building layout live preview:", err.message);
    return res.status(502).send("Failed to build layout preview.");
  }
};

// Catch-all: ANY /api/xibo-web/:sid/<path> — streams the Xibo web resource
// through the shared session. No JWT here; the sid in the path is the capability.
export const proxyWebResource = async (req, res) => {
  try {
    const { sid } = req.params;
    if (!isValidSid(sid)) {
      return res.status(403).send("Preview session expired. Reload the layout.");
    }

    const webBase = getWebBaseUrl();
    // Everything after /api/xibo-web/:sid/
    const rest = Array.isArray(req.params.splat)
      ? req.params.splat.join("/")
      : req.params.splat || req.params[0] || "";

    const qIndex = req.originalUrl.indexOf("?");
    const queryString = qIndex >= 0 ? req.originalUrl.slice(qIndex + 1) : "";
    const targetUrl = `${webBase}/${rest}${queryString ? `?${queryString}` : ""}`;

    const prefix = `${publicBase(req)}/api/xibo-web/${sid}`;
    const proxify = makeProxify(webBase, prefix);

    const forwardHeaders = {};
    if (req.headers.range) forwardHeaders.Range = req.headers.range;
    if (req.headers["if-range"]) forwardHeaders["If-Range"] = req.headers["if-range"];
    if (req.headers.accept) forwardHeaders.Accept = req.headers.accept;

    const doFetch = async () => {
      const client = await getWebClient();
      return client.request({
        url: targetUrl,
        method: req.method === "POST" ? "POST" : "GET",
        responseType: "stream",
        maxRedirects: 5,
        headers: forwardHeaders,
        data: req.method === "POST" ? req.body : undefined,
        validateStatus: (s) => s < 500,
      });
    };

    let upstream = await doFetch();
    let responseUrl = upstream.request?.res?.responseUrl || "";
    const contentType = upstream.headers["content-type"] || "";
    // Only log failures — a layout with video fires hundreds of range requests.
    if (upstream.status >= 400) {
      console.warn(`[xibo-web] ${upstream.status} <- /${rest}`);
    }

    // Detect a dead session (redirected to /login) and retry once.
    if (/\/login/i.test(responseUrl)) {
      invalidateWebSession();
      upstream = await doFetch();
      responseUrl = upstream.request?.res?.responseUrl || "";
    }

    const isText = /text\/html|text\/css/i.test(contentType);

    if (isText) {
      const buf = await collectStream(upstream.data);
      let body = buf.toString("utf8");
      if (/text\/css/i.test(contentType)) {
        body = rewriteCss(body, proxify);
      } else if (/^\s*(<!doctype html|<html|<head)/i.test(body)) {
        // A real HTML document (the preview page or a region's getResource) —
        // rewrite URLs + inject the shim.
        body = processHtml(body, proxify, webBase, prefix);
      }
      // else: text/html-typed but NOT an HTML document — notably the layout XLF,
      // which Xibo serves as text/html yet is "<?xml …><layout>". Leave it byte
      // for byte; the renderer parses it and any URLs it builds hit the shim.
      res.status(upstream.status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Cache-Control", upstream.headers["cache-control"] || "no-store");
      return res.send(body);
    }

    // Binary / non-rewritten (JS, JSON, images, fonts, video): stream through,
    // preserving the bits that matter for media + range requests.
    res.status(upstream.status);
    const passthrough = [
      "content-type",
      "content-length",
      "content-range",
      "accept-ranges",
      "cache-control",
      "expires",
      "last-modified",
      "etag",
    ];
    for (const h of passthrough) {
      if (upstream.headers[h]) res.setHeader(h, upstream.headers[h]);
    }
    return upstream.data.pipe(res);
  } catch (err) {
    if (err instanceof WebSessionNotConfiguredError) {
      return res.status(503).send("Xibo web session is not configured.");
    }
    console.error("Error proxying Xibo web resource:", err.message);
    return res.status(502).send("Proxy error.");
  }
};

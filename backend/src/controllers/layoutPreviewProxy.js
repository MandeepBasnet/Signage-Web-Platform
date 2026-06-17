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

const PREVIEW_TTL_MS = 30 * 60 * 1000; // 30 min — smaller window if a sid leaks
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
  out = injectShim(out, shimScript(webBase, prefix) + freezeScript());
  return out;
};

// Per-region freeze — injected into every proxied document. Suppresses video
// autoplay so each region holds on its first frame until *that region* is
// played. A region iframe's URL contains its regionId (/resource/{id}/…); a
// video plays only when its region is flagged in the entry page's
// __xlrPlayingRegions map (read from the same-origin parent window). The entry
// page itself has no regionId, so its own media (none) is never frozen.
const freezeScript = () => `<script>(function(){
  if(window.__xlrFreezeInstalled)return;window.__xlrFreezeInstalled=true;
  if(!window.__xlrPlayingRegions)window.__xlrPlayingRegions={};
  // A video's region: from the iframe URL (/resource/{id}/, HTML widgets) or the
  // ancestor region container id (R-{id}-N, native video rendered inline).
  function ridFor(v){
    var m=location.pathname.match(/\\/resource\\/(\\d+)\\//);if(m)return m[1];
    var el=v;while(el){if(el.id){var mm=el.id.match(/R-(\\d+)-/);if(mm)return mm[1];}el=el.parentElement;}
    return null;
  }
  function set(){try{return (window.parent&&window.parent.__xlrPlayingRegions)||window.__xlrPlayingRegions;}catch(e){return window.__xlrPlayingRegions;}}
  function frozen(v){var r=ridFor(v);if(!r)return false;var s=set();return !(s&&s[r]);}
  var op=HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play=function(){if(frozen(this)){try{this.pause();}catch(e){}return Promise.resolve();}return op.apply(this,arguments);};
  // Also catch attribute-driven autoplay (not just explicit .play() calls).
  document.addEventListener("play",function(e){var v=e.target;if(v&&v.tagName==="VIDEO"&&frozen(v)){try{v.pause();}catch(_){}}},true);
})();</script>`;

// --- No-autoplay: static poster + play button ------------------------------
//
// We do NOT auto-start playback (Xibo's preview calls playSchedules() right
// after init()). Instead we defer that call, and cover the canvas with a
// faithful static poster — each region's first media shown as its first-frame
// image at the correct position — plus a play button. Clicking removes the
// poster and triggers playback, just like the CMS editor's play control. This
// is deterministic (built from the XLF), so it doesn't fight the renderer's
// loading-spinner / fade-in transitions, and it works for video AND images.

const attr = (s, name) => {
  const m = s.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return m ? m[1] : null;
};

// Parse layout dimensions + each region's geometry and first media (file id).
export const parseXlf = (xlf) => {
  const lm = xlf.match(/<layout\b[^>]*>/i);
  const W = lm ? Number(attr(lm[0], "width")) : 0;
  const H = lm ? Number(attr(lm[0], "height")) : 0;
  const regions = [];
  const re = /<region\b([^>]*)>([\s\S]*?)<\/region>/gi;
  let m;
  while ((m = re.exec(xlf))) {
    const head = m[1];
    const mediaTags = m[2].match(/<media\b[^>]*>/gi) || [];
    let firstFileId = null;
    let firstType = null;
    let hasVideo = false;
    let videoFileId = null;
    for (const tag of mediaTags) {
      const type = attr(tag, "type");
      const fid = attr(tag, "fileId");
      if (firstType === null) {
        firstType = type;
        firstFileId = fid;
      }
      if (String(type) === "video") {
        hasVideo = true;
        if (!videoFileId) videoFileId = fid;
      }
    }
    regions.push({
      id: attr(head, "id"),
      x: Number(attr(head, "left")) || 0,
      y: Number(attr(head, "top")) || 0,
      w: Number(attr(head, "width")) || 0,
      h: Number(attr(head, "height")) || 0,
      fileId: firstFileId, // first media (used by the thumbnail fallback)
      type: firstType,
      hasVideo,
      videoFileId: videoFileId || firstFileId,
      mediaCount: mediaTags.length,
    });
  }
  return { W, H, regions };
};

const PLAY_SVG =
  '<svg viewBox="0 0 24 24" width="34" height="34" fill="#fff"><path d="M8 5v14l11-7z"/></svg>';
const PAUSE_SVG =
  '<svg viewBox="0 0 24 24" width="30" height="30" fill="#fff"><path d="M6 5h4v14H6zM14 5h4v14h-4z"/></svg>';

// Build a per-region control overlay: each region gets a poster (its first
// frame) and a play/pause toggle centered in it, positioned over that region.
// Clicking a region's button flips that region in __xlrPlayingRegions and
// plays/pauses only that region's iframe video(s) — independent per region.
const buildRegionControls = (xlf, prefix) => {
  let regionsHtml = "";
  try {
    const { W, H, regions } = parseXlf(xlf);
    if (W > 0 && H > 0) {
      for (const r of regions) {
        if (!r.id || r.w <= 0 || r.h <= 0) continue;
        // Only video regions get a play/pause control — that's the only content
        // that auto-plays and needs holding. Image/text/canvas regions render
        // their content directly (no misleading play button).
        if (!r.hasVideo) continue;
        const poster = r.videoFileId
          ? `<img class="xlr-poster" src="${prefix}/library/download/${r.videoFileId}?preview=1" loading="eager">`
          : "";
        regionsHtml +=
          `<div class="xlr-rgn" data-rid="${r.id}" data-playing="0" style="` +
          `left:${(r.x / W) * 100}%;top:${(r.y / H) * 100}%;` +
          `width:${(r.w / W) * 100}%;height:${(r.h / H) * 100}%">` +
          `${poster}<div class="xlr-btn">${PLAY_SVG}</div></div>`;
      }
    }
  } catch (e) {
    // no controls if XLF can't be parsed
  }

  return `${regionsHtml}
<style>
.xlr-rgn{position:fixed;z-index:2147483647;cursor:pointer;overflow:hidden}
.xlr-rgn .xlr-poster{position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000}
.xlr-btn{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:74px;height:74px;border-radius:50%;background:rgba(20,20,20,.55);display:flex;align-items:center;justify-content:center;transition:background .15s ease,transform .15s ease;pointer-events:none}
.xlr-rgn:hover .xlr-btn{background:rgba(20,20,20,.82);transform:translate(-50%,-50%) scale(1.06)}
</style>
<script>(function(){
  var W=window;W.__xlrPlayingRegions=W.__xlrPlayingRegions||{};
  var PLAY=${JSON.stringify(PLAY_SVG)},PAUSE=${JSON.stringify(PAUSE_SVG)};
  // Walk this window and all nested frames; a video belongs to a region via the
  // frame URL (/resource/{id}/) or its ancestor container id (R-{id}-N).
  function eachWin(win,cb){try{cb(win);}catch(e){}try{for(var i=0;i<win.frames.length;i++)eachWin(win.frames[i],cb);}catch(e){}}
  function vidRid(w,v){var m=String(w.location.pathname).match(/\\/resource\\/(\\d+)\\//);if(m)return m[1];
    var el=v;while(el){if(el.id){var mm=el.id.match(/R-(\\d+)-/);if(mm)return mm[1];}el=el.parentElement;}return null;}
  function videos(rid,play){eachWin(W,function(w){try{
    var d=w.document.querySelectorAll('video');
    for(var i=0;i<d.length;i++){if(vidRid(w,d[i])!==rid)continue;
      if(play){var p=d[i].play();if(p&&p.catch)p.catch(function(){});}else{d[i].pause();}}
  }catch(e){}});}
  function toggle(rgn){
    var rid=rgn.getAttribute('data-rid'),on=rgn.getAttribute('data-playing')==='1';
    var img=rgn.querySelector('.xlr-poster'),btn=rgn.querySelector('.xlr-btn');
    if(!on){W.__xlrPlayingRegions[rid]=true;if(img)img.style.display='none';videos(rid,true);
      rgn.setAttribute('data-playing','1');if(btn)btn.innerHTML=PAUSE;}
    else{W.__xlrPlayingRegions[rid]=false;videos(rid,false);if(img)img.style.display='';
      rgn.setAttribute('data-playing','0');if(btn)btn.innerHTML=PLAY;}
  }
  function wire(){var a=document.querySelectorAll('.xlr-rgn');
    for(var i=0;i<a.length;i++){(function(rgn){rgn.addEventListener('click',function(){toggle(rgn);});})(a[i]);}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',wire);else wire();
})();</script>`;
};

const injectBeforeBody = (html, blob) => {
  if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${blob}</body>`);
  return html + blob;
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
    // Record the owner (from the authenticated mint request) for audit; full
    // per-user enforcement on the proxy needs the cookie-auth work (2.1).
    previewSessions.set(sid, {
      userId: req.user?.id,
      expiresAt: Date.now() + PREVIEW_TTL_MS,
    });

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

    // Fetch the XLF to build per-region controls (first-frame poster + a
    // play/pause toggle centered in each region).
    let controls = "";
    try {
      const client = await getWebClient();
      const xlfRes = await client.get(`${webBase}/layout/xlf/${layoutId}`, {
        responseType: "text",
        validateStatus: (s) => s < 500,
      });
      controls = buildRegionControls(String(xlfRes.data || ""), prefix);
    } catch (e) {
      // no controls if the XLF can't be fetched
    }

    const rewritten = injectBeforeBody(
      processHtml(html, proxify, webBase, prefix),
      controls
    );

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

// Sensitive Xibo web routes the live preview never needs. The shared web
// session is an admin service account, so a SID holder must not be able to use
// this proxy to reach admin/data pages (privilege escalation). Matched against
// the first path segment; preview assets (layout/library/region/dist/theme/
// modules/fonts + static files) are unaffected.
const BLOCKED_PROXY_PATH =
  /^(?:user|usergroup|group|admin|application|settings?|command|auditlog|report|fault|maintenance|display|displaygroup|displayprofile|daypart|schedule|campaign|dataset|notification|resolution|template|tag|statusdashboard|log)(?:\/|$|\?)/i;

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

    if (BLOCKED_PROXY_PATH.test(rest)) {
      console.warn(`[xibo-web] blocked sensitive proxy path: /${rest}`);
      return res.status(403).send("Forbidden");
    }

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

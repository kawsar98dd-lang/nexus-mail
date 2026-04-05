/**
 * ============================================================================
 * TRUSTEDTOOLSWEB — META & SEO AUTOMATION ENGINE  (Firebase-Aware Edition)
 * ============================================================================
 * Waits for window.SITE_CONFIG_READY (exported by site-config.js) to resolve
 * before touching the DOM.  This guarantees that any Firestore overrides
 * (brandName, baseUrl, defaultDescription, etc.) are already merged into
 * window.SITE_CONFIG before the meta tags and JSON-LD schemas are written.
 *
 * Load order in HTML (before </body>):
 *   1. Firebase compat SDK
 *   2. site-config.js          ← sets SITE_CONFIG + SITE_CONFIG_READY
 *   3. meta-manager.js         ← this file
 * ============================================================================
 */

(function () {
  "use strict";

  /* ══════════════════════════════════════════════════════════════════════════
     CORE SEO ENGINE
     Encapsulated so it can be called cleanly after the async fetch resolves.
  ══════════════════════════════════════════════════════════════════════════ */

  function runMetaEngine() {
    const cfg = window.SITE_CONFIG;

    // Guard: config must exist (it always should, but be safe).
    if (!cfg) {
      console.error("[TTW Meta] SITE_CONFIG is not defined. Aborting meta sync.");
      return;
    }

    // ── Current clean URL (no query string / hash) ────────────────────────
    const fullURL  = window.location.href.split(/[?#]/)[0];
    const fileName = window.location.pathname.split("/").pop() || "index.html";

    /* ──────────────────────────────────────────────────────────────────────
       1. CANONICAL TAG
    ────────────────────────────────────────────────────────────────────── */
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) {
      canonical.setAttribute("href", fullURL);
    }

    /* ──────────────────────────────────────────────────────────────────────
       2. AUTHOR META
    ────────────────────────────────────────────────────────────────────── */
    const authorTag = document.querySelector('meta[name="author"]');
    if (authorTag) {
      authorTag.setAttribute("content", cfg.author || cfg.brandName || "");
    }

    /* ──────────────────────────────────────────────────────────────────────
       3. META DESCRIPTION  (overwrite only if the page doesn't have its own)
          If the page's existing description is the generic default from the
          static config, replace it with the Firestore value if available.
    ────────────────────────────────────────────────────────────────────── */
    const descTag = document.querySelector('meta[name="description"]');
    if (descTag && cfg.defaultDescription) {
      // Only overwrite if the tag is empty or still holds the fallback text
      const current = descTag.getAttribute("content") || "";
      if (current === "" || current === "Secure, Fast, and Client-Side Developer Tools for everyone.") {
        descTag.setAttribute("content", cfg.defaultDescription);
      }
    }

    /* ──────────────────────────────────────────────────────────────────────
       4. OG IMAGE — resolve relative paths against baseUrl
    ────────────────────────────────────────────────────────────────────── */
    const rawOgImg  = document.querySelector('meta[property="og:image"]')
                        ?.getAttribute("content") || cfg.defaultOGImage || "";
    const finalOgImg = rawOgImg.startsWith("http")
                        ? rawOgImg
                        : (cfg.baseUrl || "") + "/" + rawOgImg;

    const rawTwImg  = document.querySelector('meta[name="twitter:image"]')
                        ?.getAttribute("content") || cfg.defaultOGImage || "";
    const finalTwImg = rawTwImg.startsWith("http")
                        ? rawTwImg
                        : (cfg.baseUrl || "") + "/" + rawTwImg;

    /* ──────────────────────────────────────────────────────────────────────
       5. SOCIAL MEDIA META MAP  (OG + Twitter)
    ────────────────────────────────────────────────────────────────────── */
    const metaMap = {
      "og:url"          : fullURL,
      "og:site_name"    : cfg.ogSiteName    || cfg.brandName || "",
      "og:image"        : finalOgImg,
      "twitter:url"     : fullURL,
      "twitter:site"    : cfg.twitterHandle || "",
      "twitter:creator" : cfg.twitterHandle || "",
      "twitter:image"   : finalTwImg
    };

    for (const property in metaMap) {
      const tag = document.querySelector(
        `meta[property="${property}"], meta[name="${property}"]`
      );
      if (tag) tag.setAttribute("content", metaMap[property]);
    }

    /* ──────────────────────────────────────────────────────────────────────
       6. JSON-LD SCHEMA AUTOMATION
          Updates `url`, `author`, and `brand` fields inside every JSON-LD
          block on the page to stay in sync with the (possibly overridden)
          SITE_CONFIG values.
    ────────────────────────────────────────────────────────────────────── */
    const schemaScripts = document.querySelectorAll('script[type="application/ld+json"]');

    schemaScripts.forEach(function (script) {
      try {
        let data = JSON.parse(script.innerText);

        // ── url ────────────────────────────────────────────────────────
        if ("url" in data) {
          data.url = fullURL;
        }

        // ── author ─────────────────────────────────────────────────────
        if ("author" in data) {
          if (typeof data.author === "object" && data.author !== null) {
            data.author.name = cfg.author    || cfg.brandName || data.author.name;
            data.author.url  = cfg.baseUrl   || data.author.url;
          } else {
            data.author = cfg.author || cfg.brandName || data.author;
          }
        }

        // ── brand ──────────────────────────────────────────────────────
        if (data.brand && typeof data.brand === "object") {
          data.brand.name = cfg.brandName || data.brand.name;
        }

        // ── publisher (common in Article / NewsArticle schemas) ────────
        if (data.publisher && typeof data.publisher === "object") {
          data.publisher.name = cfg.brandName || data.publisher.name;
          if (data.publisher.logo && typeof data.publisher.logo === "object") {
            data.publisher.logo.url = cfg.logoUrl || data.publisher.logo.url;
          }
        }

        // Write the updated schema back
        script.innerText = JSON.stringify(data, null, 2);

      } catch (err) {
        console.error("[TTW Meta] Schema sync error in JSON-LD block:", err);
      }
    });

    /* ──────────────────────────────────────────────────────────────────────
       7. DOCUMENT TITLE  (mirror brandName if title is still the bare default)
    ────────────────────────────────────────────────────────────────────── */
    if (
      cfg.brandName &&
      (document.title === "" || document.title === "Trusted Tools Web")
    ) {
      document.title = cfg.brandName;
    }

    console.log("[TTW Meta] 🚀 SEO & Schema synced for: " + fileName);
  }

  /* ══════════════════════════════════════════════════════════════════════════
     ENTRY POINT
     We need two conditions before running the engine:
       (a) The DOM must be ready              → DOMContentLoaded (or already ready)
       (b) SITE_CONFIG must be fully merged   → window.SITE_CONFIG_READY resolves

     We wait for both in parallel using Promise.all so we add zero extra delay
     beyond whichever takes longer.
  ══════════════════════════════════════════════════════════════════════════ */

  /** Promise that resolves when the DOM is interactive. */
  const domReady = new Promise(function (resolve) {
    if (
      document.readyState === "interactive" ||
      document.readyState === "complete"
    ) {
      resolve();
    } else {
      document.addEventListener("DOMContentLoaded", resolve, { once: true });
    }
  });

  /**
   * window.SITE_CONFIG_READY is set by site-config.js.
   * If for any reason this script loads before site-config.js, we fall back
   * to a resolved promise so the engine still runs with whatever defaults exist.
   */
  const configReady =
    window.SITE_CONFIG_READY instanceof Promise
      ? window.SITE_CONFIG_READY
      : Promise.resolve();

  Promise.all([domReady, configReady])
    .then(runMetaEngine)
    .catch(function (err) {
      // Should never happen (both promises resolve, never reject), but be safe.
      console.error("[TTW Meta] Unexpected error during meta sync:", err);
      runMetaEngine(); // Attempt a best-effort run anyway
    });

})();

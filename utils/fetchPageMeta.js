const fetch = require("node-fetch");
const cheerio = require("cheerio");

async function fetchPageMeta(url) {
  try {
    const resp = await fetch(url, { timeout: 7000 });
    if (!resp.ok) return null;
    const html = await resp.text();
    const $ = cheerio.load(html);

    const ogTitle = $('meta[property="og:title"]').attr("content");
    const ogDesc  = $('meta[property="og:description"]').attr("content");
    const title   = $("title").text();
    const metaDesc= $('meta[name="description"]').attr("content");

    return {
      title: ogTitle || title || "",
      description: ogDesc || metaDesc || ""
    };
  } catch {
    return null;
  }
}

module.exports = { fetchPageMeta };
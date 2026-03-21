import fs from "node:fs";
import path from "node:path";
import Handlebars from "handlebars";
import { DateTime } from "luxon";
import pluginRss from "@11ty/eleventy-plugin-rss";
import pluginSyntaxHighlight from "@11ty/eleventy-plugin-syntaxhighlight";
import markdownIt from "markdown-it";
import markdownItFootnote from "markdown-it-footnote";

function registerPartials() {
  const partialsDir = path.join(process.cwd(), "_includes", "partials");
  if (!fs.existsSync(partialsDir)) return;

  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.isFile() || path.extname(entry.name) !== ".hbs") continue;
      const rel = path.relative(partialsDir, fullPath).replace(/\\/g, "/").replace(/\.hbs$/, "");
      Handlebars.registerPartial(rel, fs.readFileSync(fullPath, "utf8"));
    }
  };

  walk(partialsDir);
}

const toDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const normalizePath = (value = "/") => {
  const clean = String(value || "/").replace(/\/+$/, "");
  return clean === "" ? "/" : clean;
};

export default function (eleventyConfig) {
  eleventyConfig.addPlugin(pluginRss);
  eleventyConfig.addPlugin(pluginSyntaxHighlight);
  registerPartials();
  const md = markdownIt({
    html: true,
    breaks: false,
    linkify: true,
    typographer: true
  }).use(markdownItFootnote);
  eleventyConfig.setLibrary("md", md);

  eleventyConfig.addExtension("hbs", {
    key: "hbs",
    outputFileExtension: "html",
    compile: async (inputContent) => {
      const template = Handlebars.compile(inputContent);
      return (data) => template(data);
    }
  });

  eleventyConfig.addPassthroughCopy({ assets: "assets" });

  const readableDate = (dateObj, format = "dd LLL yyyy") => {
    const parsed = toDate(dateObj);
    if (!parsed) return "";
    return DateTime.fromJSDate(parsed, { zone: "utc" }).toFormat(format);
  };

  const htmlDateString = (dateObj) => {
    const parsed = toDate(dateObj);
    if (!parsed) return "";
    return DateTime.fromJSDate(parsed, { zone: "utc" }).toFormat("yyyy-LL-dd");
  };

  const year = (dateObj) => {
    const parsed = toDate(dateObj);
    if (!parsed) return "";
    return DateTime.fromJSDate(parsed, { zone: "utc" }).toFormat("yyyy");
  };

  const excerptWords = (value, words = 33) => {
    const clean = String(value || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!clean) return "";
    const parts = clean.split(" ");
    if (parts.length <= words) return clean;
    return `${parts.slice(0, words).join(" ")}…`;
  };

  Handlebars.registerHelper("readableDate", readableDate);
  Handlebars.registerHelper("htmlDateString", htmlDateString);
  Handlebars.registerHelper("year", year);
  Handlebars.registerHelper("isCurrent", (currentPath, itemUrl) => normalizePath(currentPath) === normalizePath(itemUrl));
  Handlebars.registerHelper("excerptWords", excerptWords);
  Handlebars.registerHelper("eq", (a, b) => a === b);
  Handlebars.registerHelper("gt", (a, b) => Number(a) > Number(b));

  eleventyConfig.addFilter("readableDate", readableDate);
  eleventyConfig.addFilter("htmlDateString", htmlDateString);
  eleventyConfig.addFilter("year", year);
  eleventyConfig.addFilter("excerptWords", excerptWords);

  eleventyConfig.addCollection("posts", (collectionApi) =>
    collectionApi
      .getFilteredByGlob("content/posts/*.{md,hbs,html}")
      .sort((a, b) => b.date - a.date)
  );

  eleventyConfig.addCollection("tagList", (collectionApi) => {
    const tagSet = new Set();
    for (const item of collectionApi.getFilteredByTag("posts")) {
      const tags = item.data.tags || [];
      for (const tag of tags) {
        if (["posts", "all", "nav"].includes(tag)) continue;
        tagSet.add(tag);
      }
    }
    return [...tagSet].sort((a, b) => a.localeCompare(b));
  });

  return {
    dir: {
      input: "content",
      includes: "../_includes",
      data: "../_data",
      output: "_site"
    },
    markdownTemplateEngine: false,
    htmlTemplateEngine: false,
    dataTemplateEngine: false,
    templateFormats: ["md", "hbs", "njk", "html"]
  };
}

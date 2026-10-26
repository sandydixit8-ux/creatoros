import { describe, it, expect } from "vitest";
import { BLOG_POSTS } from "./blog";

/**
 * The blog renderer shows paragraphs and bullets as plain text and only renders
 * `links[]` as anchors. A markdown link written into a paragraph therefore
 * shipped as literal "[text](/url)" on the page, so this suite guards the shape
 * the renderer actually consumes.
 */
describe("blog content", () => {
  const slugs = new Set(BLOG_POSTS.map((p) => p.slug));

  it("has unique slugs and valid dates", () => {
    expect(slugs.size).toBe(BLOG_POSTS.length);
    for (const post of BLOG_POSTS) {
      expect(post.slug).toMatch(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
      expect(Number.isNaN(new Date(post.date).getTime())).toBe(false);
    }
  });

  it("keeps markdown link syntax out of prose so it never renders literally", () => {
    for (const post of BLOG_POSTS) {
      for (const section of post.sections) {
        for (const text of [...section.paragraphs, ...(section.bullets ?? [])]) {
          expect(text, `${post.slug} / ${section.heading ?? "(intro)"}`).not.toMatch(/\[[^\]]+\]\([^)]+\)/);
        }
      }
    }
  });

  it("only links to posts that exist", () => {
    for (const post of BLOG_POSTS) {
      for (const section of post.sections) {
        for (const link of section.links ?? []) {
          expect(link.label.length).toBeGreaterThan(0);
          if (link.href.startsWith("/blog/")) {
            expect(slugs, `${post.slug} links to ${link.href}`).toContain(link.href.replace("/blog/", ""));
          } else {
            expect(link.href.startsWith("/")).toBe(true);
          }
        }
      }
    }
  });
});

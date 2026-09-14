/**
 * The section registry — in particular the API-path → SectionId translation,
 * where the nesting makes a naive prefix match silently wrong.
 */

import { isSectionId, SECTION_IDS, SECTIONS, sectionIdFromApiPath, sectionIdFromApiProgramUrl } from "../sections";

describe("registry shape", () => {
  it("keys every definition by its own id", () => {
    for (const id of SECTION_IDS) expect(SECTIONS[id].id).toBe(id);
  });

  it("round-trips every apiPath back to its id", () => {
    for (const id of SECTION_IDS) expect(sectionIdFromApiPath(SECTIONS[id].apiPath)).toBe(id);
  });

  it("gives every section a label and puts it on the channel its path starts with", () => {
    for (const id of SECTION_IDS) {
      const def = SECTIONS[id];
      expect(def.label).toBeTruthy();
      expect(def.apiPath.split("/")[0]).toBe(def.channel);
    }
  });

  it("treats only ljod sections as audio", () => {
    expect(SECTIONS.ljod.kind).toBe("audio");
    expect(SECTIONS["ljod-vit"].kind).toBe("audio");
    expect(SECTIONS.sjon.kind).toBe("video");
  });
});

describe("isSectionId", () => {
  it("accepts every known id", () => {
    for (const id of SECTION_IDS) expect(isSectionId(id)).toBe(true);
  });

  it("rejects the API's path form, the old flat id, and non-strings", () => {
    expect(isSectionId("sjon/vit")).toBe(false);
    expect(isSectionId("vit")).toBe(false);
    expect(isSectionId("")).toBe(false);
    expect(isSectionId(undefined)).toBe(false);
  });

  it("is not fooled by inherited object properties", () => {
    expect(isSectionId("constructor")).toBe(false);
    expect(isSectionId("toString")).toBe(false);
  });
});

describe("sectionIdFromApiProgramUrl", () => {
  it("resolves a top-level section", () => {
    expect(sectionIdFromApiProgramUrl("/api/ljod/programs/node-13205")).toBe("ljod");
    expect(sectionIdFromApiProgramUrl("/api/sjon/programs/dagur-og-vika")).toBe("sjon");
  });

  // The whole reason this is an exact lookup: "/api/sjon" is a prefix of
  // "/api/sjon/vit", so startsWith would route every VIT program to Sjón.
  it("resolves a nested section rather than its parent", () => {
    expect(sectionIdFromApiProgramUrl("/api/sjon/vit/programs/x")).toBe("sjon-vit");
    expect(sectionIdFromApiProgramUrl("/api/sjon/miks/programs/x")).toBe("sjon-miks");
    expect(sectionIdFromApiProgramUrl("/api/ljod/vit/programs/x")).toBe("ljod-vit");
  });

  it("returns null when there is nothing to resolve", () => {
    expect(sectionIdFromApiProgramUrl(null)).toBeNull();
    expect(sectionIdFromApiProgramUrl(undefined)).toBeNull();
    expect(sectionIdFromApiProgramUrl("")).toBeNull();
    // No /programs/ segment, and a section that no longer exists.
    expect(sectionIdFromApiProgramUrl("/api/sjon")).toBeNull();
    expect(sectionIdFromApiProgramUrl("/api/vit/programs/x")).toBeNull();
  });
});

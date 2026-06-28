import { beforeEach, describe, expect, it, vi } from "vitest";
import { applyUploadMetadata, assetImages, setNativeValue } from "./dom";

describe("Adobe DOM compatibility", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("discovers upload and portfolio fixtures independently", () => {
    document.body.innerHTML = '<img class="upload-tile__thumbnail upload-tile__thumbnail--portrait"><img class="content-thumbnail__img">';
    expect(assetImages("upload")).toHaveLength(1);
    expect(assetImages("portfolio")).toHaveLength(1);
  });

  it("updates controlled inputs with input and change events", () => {
    const input = document.createElement("input");
    const inputEvent = vi.fn();
    const changeEvent = vi.fn();
    input.addEventListener("input", inputEvent);
    input.addEventListener("change", changeEvent);
    setNativeValue(input, "new value");
    expect(input.value).toBe("new value");
    expect(inputEvent).toHaveBeenCalledOnce();
    expect(changeEvent).toHaveBeenCalledOnce();
  });

  it("fills upload title, keywords, category and saves", async () => {
    document.body.innerHTML = `
      <textarea id="content-title-ui-textarea"></textarea>
      <textarea id="content-keywords-ui-textarea"></textarea>
      <div role="option" data-key="10001"></div>
      <button class="button--action" type="submit"></button>`;
    const category = document.querySelector<HTMLElement>('[data-key="10001"]')!;
    const save = document.querySelector<HTMLButtonElement>("button")!;
    const categoryClick = vi.spyOn(category, "click");
    const saveClick = vi.spyOn(save, "click");
    await applyUploadMetadata({ title: "Wild bird", keywords: "bird, wildlife", category: "10001" });
    expect((document.querySelector("#content-title-ui-textarea") as HTMLTextAreaElement).value).toBe("Wild bird");
    expect(categoryClick).toHaveBeenCalledOnce();
    expect(saveClick).toHaveBeenCalledOnce();
  });
});

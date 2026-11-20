import { describe, expect, it } from "vitest";
import { sniffImage } from "@/lib/domain/image-check";

describe("tipo real do arquivo", () => {
  it("reconhece JPEG, PNG e WEBP", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]))).toBe("image/jpeg");
    expect(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))).toBe("image/png");
    expect(sniffImage(new TextEncoder().encode("RIFF1234WEBPVP8 "))).toBe("image/webp");
  });
  it("recusa PDF, HTML e arquivos disfarçados", () => {
    expect(sniffImage(new TextEncoder().encode("%PDF-1.7"))).toBeNull();
    expect(sniffImage(new TextEncoder().encode("<html><script>"))).toBeNull();
    expect(sniffImage(new Uint8Array([]))).toBeNull();
  });
});

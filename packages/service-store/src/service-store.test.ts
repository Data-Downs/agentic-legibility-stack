import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const SERVICES_DIR = path.resolve(__dirname, "../../../data/services");
const SERVICES = fs.readdirSync(SERVICES_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

describe("Service manifest loading from data/services/", () => {
  it("has at least 4 services", () => {
    expect(SERVICES.length).toBeGreaterThanOrEqual(4);
  });

  const expectedServices = [
    "renew-driving-licence",
    "apply-universal-credit",
    "check-state-pension",
    "become-a-robot",
  ];

  for (const svc of expectedServices) {
    describe(`Service: ${svc}`, () => {
      it("has manifest.json", () => {
        const manifestPath = path.join(SERVICES_DIR, svc, "manifest.json");
        expect(fs.existsSync(manifestPath)).toBe(true);
      });

      it("manifest has required fields (id, name, capabilities/description)", () => {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(SERVICES_DIR, svc, "manifest.json"), "utf-8")
        );
        expect(manifest.id).toBeTruthy();
        expect(manifest.name).toBeTruthy();
        expect(typeof manifest.id).toBe("string");
        expect(typeof manifest.name).toBe("string");
      });

      it("manifest has version and department", () => {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(SERVICES_DIR, svc, "manifest.json"), "utf-8")
        );
        expect(manifest.version).toBeTruthy();
        expect(manifest.department).toBeTruthy();
      });

      it("manifest has input_schema and output_schema", () => {
        const manifest = JSON.parse(
          fs.readFileSync(path.join(SERVICES_DIR, svc, "manifest.json"), "utf-8")
        );
        expect(manifest.input_schema).toBeDefined();
        expect(manifest.input_schema.type).toBe("object");
      });
    });
  }

  for (const svc of SERVICES) {
    it(`${svc}: manifest data is well-formed`, () => {
      const manifest = JSON.parse(
        fs.readFileSync(path.join(SERVICES_DIR, svc, "manifest.json"), "utf-8")
      );
      // id should not be empty
      expect(manifest.id.length).toBeGreaterThan(0);
      // name should not be empty
      expect(manifest.name.length).toBeGreaterThan(0);
    });
  }
});

#!/usr/bin/env bun
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { SURFACE_REGISTRY } from "../src/surface-registry.ts";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(scriptDir, "../../..");
const routesRoot = join(repoRoot, "apps/api/src/routes");
const mcpRoot = join(repoRoot, "apps/api/src/mcp");

function normalizePath(path: string): string {
  return path.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, ":param");
}

function collectRouteSignatures(dir: string): Set<string> {
  const signatures = new Set<string>();

  function walk(current: string): void {
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.endsWith(".ts")) {
        continue;
      }
      const source = readFileSync(fullPath, "utf8");
      const routePattern =
        /\.(get|post|patch|put|delete)\(\s*["']([^"']+)["']/gi;
      for (const match of source.matchAll(routePattern)) {
        const method = match[1]?.toUpperCase() ?? "";
        const path = normalizePath(match[2] ?? "");
        signatures.add(`${method} ${path}`);
      }
    }
  }

  walk(dir);
  return signatures;
}

function collectMcpToolNames(dir: string): Set<string> {
  const tools = new Set<string>();

  function walk(current: string): void {
    if (!statSync(current).isDirectory()) {
      return;
    }
    for (const entry of readdirSync(current)) {
      const fullPath = join(current, entry);
      if (statSync(fullPath).isDirectory()) {
        walk(fullPath);
        continue;
      }
      if (!entry.endsWith(".ts")) {
        continue;
      }
      const source = readFileSync(fullPath, "utf8");
      for (const match of source.matchAll(/tool:\s*["']([a-z0-9_]+)["']/g)) {
        tools.add(match[1] ?? "");
      }
      for (const match of source.matchAll(
        /["']([a-z0-9_]+)["']:\s*\{\s*surfaceId:/g
      )) {
        tools.add(match[1] ?? "");
      }
    }
  }

  walk(dir);
  return tools;
}

const routeSignatures = collectRouteSignatures(routesRoot);
const mcpTools = collectMcpToolNames(mcpRoot);
const errors: string[] = [];

for (const entry of SURFACE_REGISTRY) {
  if (entry.launchGate === false) {
    continue;
  }

  const restSig = `${entry.rest.method} ${normalizePath(entry.rest.path)}`;
  if (!routeSignatures.has(restSig)) {
    errors.push(`missing REST route for ${entry.id}: ${restSig}`);
  }

  if (!mcpTools.has(entry.mcp.tool)) {
    errors.push(`missing MCP tool registration for ${entry.id}: ${entry.mcp.tool}`);
  }
}

const gated = SURFACE_REGISTRY.filter((entry) => entry.launchGate === false);
if (gated.length === 0 || !gated.some((entry) => entry.id === "comments.create")) {
  errors.push("comments.create must remain launchGate: false for v1.0");
}

for (const entry of gated) {
  const restSig = `${entry.rest.method} ${normalizePath(entry.rest.path)}`;
  if (routeSignatures.has(restSig)) {
    errors.push(
      `launchGate entry ${entry.id} must not register REST route before fast-follow`
    );
  }
  if (mcpTools.has(entry.mcp.tool)) {
    errors.push(
      `launchGate entry ${entry.id} must not register MCP tool before fast-follow`
    );
  }
}

if (errors.length > 0) {
  console.error("surface registry validation failed:");
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exit(1);
}

console.log(
  `surface registry validation ok (${SURFACE_REGISTRY.length} entries, ${routeSignatures.size} routes scanned)`
);

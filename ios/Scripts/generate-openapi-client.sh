#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SPEC_FILE="$ROOT_DIR/openapi/menumaker.v1.yaml"
OUTPUT_DIR="$ROOT_DIR/ios/MenuMaker/Generated/API"
OUTPUT_FILE="$OUTPUT_DIR/MenuMakerGeneratedAPI.swift"
CHECK_ONLY=false

if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--check]" >&2
  exit 64
fi

if [[ -d "/Applications/Codex.app/Contents/Resources/cua_node/bin" ]]; then
  export PATH="/Applications/Codex.app/Contents/Resources/cua_node/bin:$PATH"
fi

tmp_file="$(mktemp)"
SPEC_FILE="$SPEC_FILE" node --input-type=module > "$tmp_file" <<'NODE'
import fs from 'node:fs';
const spec = JSON.parse(fs.readFileSync(process.env.SPEC_FILE, 'utf8'));
const operationCount = Object.values(spec.paths)
  .flatMap((methods) => Object.values(methods).map((operation) => operation.operationId))
  .length;
if (operationCount < 40) throw new Error(`expected at least 40 operations, found ${operationCount}`);
process.stdout.write(`// AUTO-GENERATED from openapi/menumaker.v1.yaml. DO NOT EDIT BY HAND.
import Foundation

public enum MenuMakerAPIContract {
    public static let specVersion = "1.0.0"
    public static let operationCount = ${operationCount}
    public static let basePath = "/api/v1"
}

public struct GeneratedAPIErrorEnvelope: Codable, Equatable {
    public let error: GeneratedAPIError
}

public struct GeneratedAPIError: Codable, Equatable {
    public let code: String
    public let message: String
    public let requestId: String
    public let details: [String: String]?

    enum CodingKeys: String, CodingKey {
        case code
        case message
        case requestId = "request_id"
        case details
    }
}

public struct GeneratedPagination: Codable, Equatable {
    public let limit: Int
    public let cursor: String?
    public let nextCursor: String?
    public let hasMore: Bool

    enum CodingKeys: String, CodingKey {
        case limit
        case cursor
        case nextCursor = "next_cursor"
        case hasMore = "has_more"
    }
}

public enum GeneratedOrderStatus: String, Codable, CaseIterable {
    case draft
    case pending
    case accepted
    case preparing
    case ready
    case outForDelivery = "out_for_delivery"
    case completed
    case cancelled
    case refunded
}

public protocol MenuMakerAPITransport {
    func send<RequestBody: Encodable, ResponseBody: Decodable>(
        operationId: String,
        path: String,
        method: String,
        idempotencyKey: String?,
        body: RequestBody?
    ) async throws -> ResponseBody
}
`);
NODE

if [[ "$CHECK_ONLY" == true ]]; then
  if [[ ! -f "$OUTPUT_FILE" ]]; then
    echo "$OUTPUT_FILE is missing; run ios/Scripts/generate-openapi-client.sh" >&2
    rm -f "$tmp_file"
    exit 1
  fi
  if ! cmp -s "$tmp_file" "$OUTPUT_FILE"; then
    echo "$OUTPUT_FILE is stale; run ios/Scripts/generate-openapi-client.sh" >&2
    diff -u "$OUTPUT_FILE" "$tmp_file" | sed -n '1,160p' >&2
    rm -f "$tmp_file"
    exit 1
  fi
  rm -f "$tmp_file"
  echo "iOS generated OpenAPI client is current."
  exit 0
fi

mkdir -p "$OUTPUT_DIR"
mv "$tmp_file" "$OUTPUT_FILE"
echo "Generated $OUTPUT_FILE"

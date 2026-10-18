#!/bin/bash
# Production mode security verification script
# This script verifies that the test reset endpoint is properly blocked in production

set -euo pipefail

echo "=== Production Security Verification ==="
echo ""

# Build backend
echo "Building backend..."
cd /workspace/backend
npm run build

# Test 1: Production mode blocks reset endpoint
echo ""
echo "Test 1: Production mode (should return 403)"
NODE_ENV=production PORT=3002 node dist/index.js &
PROD_PID=$!
sleep 2

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3002/api/test/reset)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "403" ]; then
    echo "✅ PASS: Production mode blocked with 403"
    echo "   Response: $BODY"
else
    echo "❌ FAIL: Expected 403, got $HTTP_CODE"
    echo "   Response: $BODY"
    kill $PROD_PID
    exit 1
fi

kill $PROD_PID
sleep 1

# Test 2: Production mode with ALLOW_TEST_RESET=true (should STILL block)
echo ""
echo "Test 2: Production mode with ALLOW_TEST_RESET=true (should still return 403)"
NODE_ENV=production ALLOW_TEST_RESET=true PORT=3003 node dist/index.js &
PROD_PID=$!
sleep 2

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3003/api/test/reset)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "403" ]; then
    echo "✅ PASS: Production mode blocked even with ALLOW_TEST_RESET=true"
    echo "   Response: $BODY"
else
    echo "❌ FAIL: Expected 403, got $HTTP_CODE"
    echo "   Response: $BODY"
    kill $PROD_PID
    exit 1
fi

kill $PROD_PID
sleep 1

# Test 3: Test mode allows reset endpoint
echo ""
echo "Test 3: Test mode (should return 200)"
NODE_ENV=test PORT=3004 node dist/index.js &
TEST_PID=$!
sleep 2

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST http://localhost:3004/api/test/reset)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ PASS: Test mode allowed with 200"
    echo "   Response: $BODY"
else
    echo "❌ FAIL: Expected 200, got $HTTP_CODE"
    echo "   Response: $BODY"
    kill $TEST_PID
    exit 1
fi

kill $TEST_PID

echo ""
echo "=== All Production Security Tests Passed ==="
exit 0

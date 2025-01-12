#!/bin/bash

# Replace this with your actual Replit URL
API_URL="https://your-replit-url.replit.dev"

echo "Testing single email validation:"
curl -X POST -H "Content-Type: application/json" \
     -d '{"email":"test@example.com"}' \
     "${API_URL}/api/validate-email"

echo -e "\n\nTesting bulk email validation:"
curl -X POST -H "Content-Type: application/json" \
     -d '{"emails":["test1@example.com","test2@example.com"]}' \
     "${API_URL}/api/validate-emails"
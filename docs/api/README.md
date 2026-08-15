# API Documentation

This directory contains auto-generated API documentation.

## Generation Setup

API docs should be generated from the OpenAPI spec at `/api/openapi.json` using a tool like:
- `swagger-ui` for interactive documentation
- `redoc` for clean reference docs
- Custom generator from typed route definitions

## Current Status

Auto-generation not yet configured. To set up:
1. Choose a documentation generator (swagger-ui, redoc, etc.)
2. Add generation script to `package.json`
3. Configure CI/CD to regenerate on API changes
4. Output generated docs to this directory

## Manual Reference

For now, see the live OpenAPI spec at `http://localhost:PORT/api/openapi.json` when the server is running.
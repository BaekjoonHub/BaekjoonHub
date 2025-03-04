#!/bin/bash

# Build script for the bundled BaekjoonHub extension
echo "Building BaekjoonHub extension..."

# Check if we need to copy source files from the old directory
if [ "$1" == "--copy-source" ] || [ ! -d "src/scripts" ]; then
  echo "Copying source files from old directory structure..."
  ./copy-source.sh
fi

# Clean output directories
rm -rf dist packages

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies..."
  npm install
fi

# Create directories for packaging
mkdir -p dist packages

# Build the bundled extension
echo "Building the extension..."
npm run build

# Create a release package
echo "Creating release package..."
cd dist && zip -r ../packages/baekjoonhub-v$(grep '"version"' ../package.json | awk -F'"' '{print $4}').zip * && cd ..

echo "Build complete! Extension is available in dist/ directory"
echo "Packaged extension is available in packages/ directory"
echo "To load the extension in Chrome:"
echo "1. Open chrome://extensions/"
echo "2. Enable Developer mode"
echo "3. Click 'Load unpacked' and select the dist directory"

echo ""
echo "Note: Use './build.sh --copy-source' if you need to copy files from the old directory again."
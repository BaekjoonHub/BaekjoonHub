#!/bin/bash

# This script packages the extension from the 'dist' directory into a zip file.
# It's intended to be run after 'npm run build'.

echo "Packaging BaekjoonHub extension..."

# Clean and create the packages directory
rm -rf packages
mkdir -p packages

# Get version from package.json (executed from root directory)
VERSION=$(grep '"version"' package.json | awk -F'"' '{print $4}')
ZIP_FILE_NAME="baekjoonhub-v${VERSION}.zip"

echo "Creating release package..."

# Determine the absolute path for the destination zip file in Windows format if on Windows
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  # Get current working directory in Windows format
  CURRENT_DIR_WIN=$(pwd -W)
  FULL_DEST_PATH_WIN="${CURRENT_DIR_WIN}\\packages\\${ZIP_FILE_NAME}"
else
  # Linux/macOS environment
  FULL_DEST_PATH_UNIX="$(pwd)/packages/${ZIP_FILE_NAME}"
fi

# Change to dist directory to zip its contents
cd dist || exit

# Check OS type for zipping
if [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]; then
  # Windows environment (e.g., Git Bash, Cygwin)
  # Use PowerShell's Compress-Archive
  # -Path '.' means zip the current directory's contents
  # -DestinationPath needs an absolute path in Windows format
  powershell -Command "Compress-Archive -Path '.' -DestinationPath '${FULL_DEST_PATH_WIN}' -Force"
else
  # Linux/macOS environment
  # Zip the contents of the current directory (which is 'dist')
  zip -r "${FULL_DEST_PATH_UNIX}" .
fi

# Go back to the original directory
cd .. || exit

echo "Packaging complete!"
echo "Packaged extension is available in the 'packages' directory."

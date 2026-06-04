#!/bin/bash

# Build script for creating Debian package
set -e

VERSION=$(node version.js)
PACKAGE_DIR="setup/deb"
NODE_VERSION="24.0.0"  # Use the same version as in your workflows

echo "Building Cachearoo Debian package version $VERSION"

# Clean previous builds
rm -rf "$PACKAGE_DIR/opt/cachearoo/*"

# Create the application structure
mkdir -p "$PACKAGE_DIR/opt/cachearoo/app"
mkdir -p "$PACKAGE_DIR/var/lib/cachearoo/buckets"
mkdir -p "$PACKAGE_DIR/opt/cachearoo/logs"

# Copy built application
cp -r build/* "$PACKAGE_DIR/opt/cachearoo/"

# Move the app files to the app subdirectory
mv "$PACKAGE_DIR/opt/cachearoo/app" "$PACKAGE_DIR/opt/cachearoo/app_temp"
mkdir -p "$PACKAGE_DIR/opt/cachearoo/app"
mv "$PACKAGE_DIR/opt/cachearoo/app_temp"/* "$PACKAGE_DIR/opt/cachearoo/app/"
rmdir "$PACKAGE_DIR/opt/cachearoo/app_temp"

# Copy the production node_modules
cd build
npm install --production --silent
cd ..
cp -r build/node_modules "$PACKAGE_DIR/opt/cachearoo/"

# Copy config file
cp config-linux.json "$PACKAGE_DIR/opt/cachearoo/config.json"

# Copy licensing / third-party notices for compliance
cp LICENSE "$PACKAGE_DIR/opt/cachearoo/LICENSE"
cp THIRD-PARTY-NOTICES.md "$PACKAGE_DIR/opt/cachearoo/THIRD-PARTY-NOTICES.md"

# Download Node.js binary for Linux
NODE_URL="https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.xz"
echo "Downloading Node.js $NODE_VERSION..."

# Download and extract Node.js
curl -L "$NODE_URL" -o /tmp/node.tar.xz
tar -xf /tmp/node.tar.xz -C /tmp/
cp "/tmp/node-v$NODE_VERSION-linux-x64/bin/node" "$PACKAGE_DIR/opt/cachearoo/node"
rm -rf /tmp/node-v$NODE_VERSION-linux-x64 /tmp/node.tar.xz

# Make node executable
chmod +x "$PACKAGE_DIR/opt/cachearoo/node"

# Update control file with current version
sed -i "s/Version: .*/Version: $VERSION/" "$PACKAGE_DIR/DEBIAN/control"

# Build the package
mkdir -p "setup/deb/output"
PACKAGE_NAME="cachearoo_${VERSION}_amd64.deb"
dpkg-deb --build "$PACKAGE_DIR" "setup/deb/output/$PACKAGE_NAME"

echo "Debian package created: setup/deb/output/$PACKAGE_NAME"
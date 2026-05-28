#!/bin/bash
cd ios
xcodebuild -project MenuMaker.xcodeproj -scheme MenuMaker -destination "generic/platform=iOS" -configuration Debug build

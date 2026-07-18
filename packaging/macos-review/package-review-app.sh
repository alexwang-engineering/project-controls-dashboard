#!/bin/zsh

set -euo pipefail

packaging_dir="${0:A:h}"
repository_root="${packaging_dir:h:h}"
desktop_path=$(/usr/bin/osascript -e 'POSIX path of (path to desktop folder)')
output_path="${1:-${desktop_path}Project Controls Dashboard.app}"
review_build_dir=$(mktemp -d)
staged_app="$review_build_dir/Project Controls Dashboard.app"

cd "$repository_root"
pnpm build

osacompile -o "$staged_app" "$packaging_dir/launcher.applescript"
mkdir -p "$staged_app/Contents/Resources/web"
cp -R "$repository_root/dist/." "$staged_app/Contents/Resources/web/"
cp "$packaging_dir/review_server.py" \
  "$staged_app/Contents/Resources/review_server.py"

for key in \
  NSAppleEventsUsageDescription \
  NSAppleMusicUsageDescription \
  NSCalendarsUsageDescription \
  NSCameraUsageDescription \
  NSContactsUsageDescription \
  NSHomeKitUsageDescription \
  NSMicrophoneUsageDescription \
  NSPhotoLibraryUsageDescription \
  NSRemindersUsageDescription \
  NSSiriUsageDescription \
  NSSystemAdministrationUsageDescription \
  LSRequiresCarbon; do
  plutil -remove "$key" "$staged_app/Contents/Info.plist"
done

plutil -insert CFBundleIdentifier -string \
  'com.alexwang.project-controls-dashboard.review' \
  "$staged_app/Contents/Info.plist"
plutil -insert CFBundleShortVersionString -string '0.1.0' \
  "$staged_app/Contents/Info.plist"
plutil -insert CFBundleVersion -string '1' \
  "$staged_app/Contents/Info.plist"

xattr -cr "$staged_app"
codesign --force --deep --sign - "$staged_app"
codesign --verify --deep --strict "$staged_app"

if [[ -e "$output_path" ]]; then
  mv "$output_path" "$review_build_dir/previous-review.app"
fi
ditto --noextattr --noqtn "$staged_app" "$output_path"
codesign --verify --deep --strict "$output_path"

print "Created $output_path"

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

mkdir -p "$staged_app/Contents/MacOS" "$staged_app/Contents/Resources/web"
cp "$packaging_dir/Info.plist" "$staged_app/Contents/Info.plist"
swiftc \
  -O \
  -warnings-as-errors \
  -target "$(uname -m)-apple-macos13.0" \
  -framework AppKit \
  -framework WebKit \
  "$packaging_dir/native_host.swift" \
  -o "$staged_app/Contents/MacOS/ProjectControlsDashboard"
chmod 755 "$staged_app/Contents/MacOS/ProjectControlsDashboard"
mkdir -p "$staged_app/Contents/Resources/web"
cp -R "$repository_root/dist/." "$staged_app/Contents/Resources/web/"
cp "$packaging_dir/review_server.py" \
  "$staged_app/Contents/Resources/review_server.py"

plutil -lint "$staged_app/Contents/Info.plist"
file "$staged_app/Contents/MacOS/ProjectControlsDashboard" | grep -q 'Mach-O 64-bit executable'

xattr -cr "$staged_app"
codesign --force --deep --sign - "$staged_app"
codesign --verify --deep --strict "$staged_app"

if [[ -e "$output_path" ]]; then
  mv "$output_path" "$review_build_dir/previous-review.app"
fi
ditto --noextattr --noqtn "$staged_app" "$output_path"
# iCloud-backed Desktop folders can add Finder/file-provider metadata during
# the copy. Remove only those two bundle-root attributes, then seal the final
# path so the package is independently verifiable where the reviewer opens it.
xattr -d com.apple.FinderInfo "$output_path" 2>/dev/null || true
xattr -d 'com.apple.fileprovider.fpfs#P' "$output_path" 2>/dev/null || true
codesign --force --deep --sign - "$output_path"
codesign --verify --deep --strict "$output_path"

print "Created $output_path"

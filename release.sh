#!/usr/bin/env bash
mkdir -p release
mkdir -p build

export SEEDR_CHROME_VERSION=$(cat manifest.json | grep \"version\" | grep -o '[0-9]*\.[0-9]*')
export SEEDR_FIREFOX_RELEASE=release/seedr_firefox_${SEEDR_CHROME_VERSION}.zip
export SEEDR_CHROME_RELEASE=release/seedr_chrome_${SEEDR_CHROME_VERSION}.zip
export SEEDR_OPERA_RELEASE=release/seedr_opera_${SEEDR_CHROME_VERSION}.zip

rm ${SEEDR_FIREFOX_RELEASE}
rm ${SEEDR_CHROME_RELEASE}
rm ${SEEDR_OPERA_RELEASE}

zip -r ${SEEDR_FIREFOX_RELEASE} ./* -x '*.git*' -x '*.DS_Store*' -x '.idea' -x '*.iml' -x 'release.sh' -x 'release*' -x 'build*'
zip -r ${SEEDR_CHROME_RELEASE} ./* -x '*.git*' -x '*.DS_Store*' -x '.idea' -x '*.iml' -x 'release.sh' -x 'release*' -x 'build*'
zip -r ${SEEDR_OPERA_RELEASE} ./* -x '*.git*' -x '*.DS_Store*' -x '.idea' -x '*.iml' -x 'release.sh' -x 'release*' -x 'build*'

cd build

jq 'del(.key,.externally_connectable)' ../manifest.json > manifest_firefox.json
cat ../manifest.json | sed -E '/(webRequestBlocking|all_urls)/d ' | sed 's/webRequest",/webRequest"/' > manifest_chrome.json
cp -f manifest_chrome.json manifest_opera.json

cp -f manifest_firefox.json manifest.json && zip ../${SEEDR_FIREFOX_RELEASE} manifest.json
cp -f manifest_chrome.json manifest.json && zip ../${SEEDR_CHROME_RELEASE} manifest.json
cp -f manifest_opera.json manifest.json && zip ../${SEEDR_OPERA_RELEASE} manifest.json

echo "All operations successful. Releases ready for version ${SEEDR_CHROME_VERSION}"

console.log('test')

import { s_storage } from "./storage.js";
import { oauth } from "./oauth.js";
import { notify } from "./notify.js";

// Constants and global variables
const notification_ids = {
    'not_enough_space': -1,
    'torrent_added': -1,
    'private_only': -1
};

let user_torrent_id = 0;

const is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

let keepAliveInstance = null;
function keepAlive() {
    if (keepAliveInstance) return; // Already running
    keepAliveInstance = setInterval(() => {
        chrome.runtime.sendMessage({type: 'keep_alive'});
    }, 1000 * 25);
}
function stopKeepAlive() {
    clearInterval(keepAliveInstance);
    keepAliveInstance = null;
}

// Listener for download events
const download_listener = async (item, suggest) => {
    const ext = item.filename.split('.').pop();
    if (ext.toLowerCase() === 'torrent' && await s_storage.get("control_torrents") === true) {
        // First suggest cancelling the download
        // suggest({
        //     filename: '',
        //     conflictAction: 'uniquify',
        //     cancel: true
        // });

        // Then ensure it's cancelled
        chrome.downloads.cancel(item.id);

        // Send message to tab
        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const tab = tabs[0];
            console.log(tab);
            chrome.tabs.sendMessage(tab.id, {
                type: "add_torrent",
                url: item.url,
                is_magnet: false
            }, (response) => {
                // Handle potential error if message fails
                if (chrome.runtime.lastError) {
                    console.log('Message sending failed:', chrome.runtime.lastError);
                }
            });
        });

        return true;  // handling asynchronously
    }
    return false;
};

const TORRENT_MIME_TYPE = 'application/x-bittorrent';
const TORRENT_EXTENSION = '.torrent';

const request_listener = async (details) => {
    if (!await s_storage.get("control_torrents")) return;

    const { statusCode, type, responseHeaders, url } = details;

    // Early return for non-relevant requests
    if (![200, 206, 304].includes(statusCode) || type === 'xmlhttprequest') {
        return;
    }

    let contentType, contentDisposition;

    // Single loop to find both headers
    for (const header of responseHeaders) {
        const headerName = header.name.toLowerCase();
        if (headerName === 'content-type') {
            contentType = header.value.toLowerCase();
        } else if (headerName === 'content-disposition') {
            contentDisposition = header.value;
        }

        // Break early if both headers are found
        if (contentType && contentDisposition) break;
    }

    const isTorrent =
        contentType === TORRENT_MIME_TYPE ||
        (contentDisposition && extractFilenameExtension(contentDisposition).toLowerCase() === TORRENT_EXTENSION);

    if (isTorrent) {
        console.log('Torrent intercepted:', url);
        interceptTorrent(url);
        return { redirectUrl: 'javascript:' };
    }
};

const extractFilenameExtension = (contentDisposition) => {
    const filenameMatch = /filename\*?=(?:UTF-8)?'?'?\\?"?([^"]+)"?'?;?/i.exec(contentDisposition);
    if (filenameMatch && filenameMatch[1]) {
        const filename = filenameMatch[1];
        const extMatch = /\.([^.]+)$/.exec(filename);
        return extMatch ? `.${extMatch[1].toLowerCase()}` : '';
    }
    return '';
};

const interceptTorrent = (url) => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0]) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: "add_torrent",
                url: url,
                is_magnet: false
            }, () => {
                if (chrome.runtime.lastError) {
                    console.error('Error sending message:', chrome.runtime.lastError);
                }
            });
        }
    });
};

function seedr_sync() {
    chrome.tabs.query({}, (tabs) => {
        const message = {type: 'seedr_sync'};
        for (const tab of tabs) {
            if (tab.url && tab.url.match(/^https:\/\/www.seedr.cc/) !== null) {
                chrome.tabs.sendMessage(tab.id, message);
            }
        }
    });
}

function add_re(data, rcb, tab_id) {
    stopKeepAlive()

    const notificationConfig = {
        message: '',
        type: '',
        timeout: 6000,
        buttons: []
    };

    switch (data.result) {
        case true:
            seedr_sync();
            console.log(data);
            user_torrent_id = data.user_torrent_id;
            notificationConfig.message = 'Seedr: Action successful! Torrent added to storage';
            notificationConfig.type = 'success';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Visit Seedr >',
                    url: `https://www.seedr.cc/torrent/${user_torrent_id}`
                }
            ];
            rcb({ result: true });
            break;

        case 'added_to_wishlist':
            notificationConfig.message = 'Seedr: Free account active torrents limited. Torrent added to wishlist';
            notificationConfig.type = 'warning';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-warning',
                    text: 'Go See >',
                    url: "https://www.seedr.cc/files/"
                },
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for more Slots +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'out_of_wishlist':
            notificationConfig.message = 'Seedr: Free account Wishlist limited. You may have up to 2 torrents in your wishlist';
            notificationConfig.type = 'error';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-warning',
                    text: 'Remove Wishlist Items >',
                    url: "https://www.seedr.cc/files"
                },
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for more Slots +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'private_not_allowed':
            notificationConfig.message = 'Seedr: Upgrade to use Private Torrents';
            notificationConfig.type = 'error';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for Private Torrents +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'out_of_bandwidth_memory':
            notificationConfig.message = 'Seedr: You are out of free space';
            notificationConfig.type = 'error';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-warning',
                    text: 'Clear some space >',
                    url: "https://www.seedr.cc/files"
                },
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for more Storage Space +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'not_enough_space_added_to_wishlist':
            notificationConfig.message = 'Seedr: Account storage limit reached. Torrent added to wishlist.';
            notificationConfig.type = 'warning';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-warning',
                    text: 'Go See >',
                    url: "https://www.seedr.cc/files"
                },
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for more Storage +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'not_enough_space_wishlist_full':
            notificationConfig.message = 'Seedr: Not enough free space. Free account Wishlist limited. You may have up to 2 torrents in your wishlist';
            notificationConfig.type = 'error';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-warning',
                    text: 'Remove Wishlist Items >',
                    url: "https://www.seedr.cc/files"
                },
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for more Slots +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'queue_full_added_to_wishlist':
            notificationConfig.message = 'You are already downloading a torrent -- Please wait for it to finish or upgrade.';
            notificationConfig.type = 'error';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-warning',
                    text: 'Clear some torrents >',
                    url: "https://www.seedr.cc/files"
                },
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for more Slots +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'queue_full_wishlist_full':
            notificationConfig.message = "Seedr: You don't have space left.";
            notificationConfig.type = 'error';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-warning',
                    text: 'Clear some Space >',
                    url: "https://www.seedr.cc/files"
                },
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for more Space +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'private_not_allowed_added_to_wishlist':
            notificationConfig.message = 'Seedr: Upgrade to use Private Torrents. Added to wishlist.';
            notificationConfig.type = 'warning';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for Private Torrents +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'private_not_allowed_wishlist_full':
            notificationConfig.message = 'Seedr: Upgrade to use Private Torrents.';
            notificationConfig.type = 'error';
            notificationConfig.buttons = [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for Private Torrents +',
                    url: "https://www.seedr.cc/premium"
                }
            ];
            rcb({ result: false });
            break;

        case 'parsing_error':
            notificationConfig.message = 'Seedr: Torrent file corrupt';
            notificationConfig.type = 'error';
            rcb({ result: false });
            break;

        case 'fetch_error':
            notificationConfig.message = 'Seedr: Failed to download torrent file, you may try again';
            notificationConfig.type = 'error';
            rcb({ result: false });
            break;

        default:
            notificationConfig.message = 'Seedr: Torrent addition failed';
            notificationConfig.type = 'error';
            rcb({ result: false });
            break;
    }

    notify(
        notificationConfig.message,
        notificationConfig.type,
        notificationConfig.timeout,
        notificationConfig.buttons,
        tab_id
    );
}

async function addMagnet(magnet, force, rcb, tab_id) {
    if (typeof magnet !== 'undefined' && ((await s_storage.get('control_magnets') === true) || force)) {
        keepAlive()
        const query = {'torrent_magnet': magnet};
        oauth.query('add_torrent', query)
            .then((data) => add_re(data, rcb, tab_id))
            .catch((error) => rcb(error, tab_id));
        return true;
    } else {
        if (await s_storage.get('control_magnets') === false) {
            rcb({result: 'use_default'});
        } else {
            rcb({result: false});
        }
        return false;
    }
}

function get_file_content(url, callback, errorCallback) {
    fetch(url)
        .then(response => {
            const header = response.headers.get('Content-Disposition');
            let filename;

            if (header) {
                const match = header.match(/filename\*?=(?:UTF-8)?'?'?\\?"?([0-9\w\^\&\'\@\{\}\[\}\,\$\=\!\-\#\(\)\.\%\+\~\_ ]+)"?'?;?/);
                filename = match ? match[1] : '';
            } else {
                filename = url.substring(url.lastIndexOf('/') + 1);
            }

            return response.blob().then(blob => callback(blob, filename));
        })
        .catch(error => {
            console.error('Error fetching file content:', error);
            if (errorCallback) errorCallback(error);
        });
}

let adding_torrent = false;
let adding_timeout = false;

async function addTorrent(torrent, force, rcb, tab_id) {
    if (adding_timeout) {
        if (adding_torrent == torrent) return false;
        else {
            clearTimeout(adding_timeout);
        }
    }

    adding_torrent = torrent;
    adding_timeout = setTimeout(() => {
        adding_torrent = false;
        adding_timeout = false;
    }, 5000);

    if (typeof torrent !== 'undefined' && ((await s_storage.get('control_torrents') === true) || force)) {
        keepAlive()
        get_file_content(torrent, (file_data, filename) => {
            if (filename == '') {
                filename = file_data.type == 'text/html' ? 'filler.html' : 'filler.torrent';
            }
            oauth.query('add_torrent', {
                torrent_file: {data: file_data, filename: filename},
                torrent_url: torrent
            })
                .then((data) => add_re(data, rcb, tab_id))
                .catch((error) => rcb(error));

            stopKeepAlive()
        }, (error) => {
            // Fetch failed - notify user and stop loading
            stopKeepAlive();
            rcb({ result: 'fetch_error' });
        });
    } else {
        if (await s_storage.get('control_torrents') === false) {
            rcb({result: 'use_default'});
        } else {
            rcb({result: false});
        }
        return false;
    }
    return true;
}

async function listenerAddTorrent(message, sender, sendResponse) {
    const tabId = sender.tab?.id;
    if (typeof message.torrent_url !== 'undefined') {
        await addTorrent(message.torrent_url, message.force, sendResponse, tabId);
    } else if (typeof message.magnet !== 'undefined') {
        await addMagnet(message.magnet, message.force, sendResponse, tabId);
    } else {
        sendResponse({result: 'no_data_passed'});
    }
}

// Batch add function - processes multiple links sequentially
async function addTorrentsBatch(links, force, sender) {
    const results = {
        success: 0,
        failed: 0,
        wishlist: 0,
        errors: []
    };

    const total = links.length;
    const tabId = sender?.tab?.id;

    for (let i = 0; i < links.length; i++) {
        const link = links[i];

        // Send progress update to content script (if tab still exists)
        if (tabId) {
            try {
                await chrome.tabs.sendMessage(tabId, {
                    type: 'batch_progress',
                    current: i + 1,
                    total: total,
                    status: `Adding ${i + 1} of ${total}`
                });
            } catch (e) {
                // Tab was closed, continue processing silently
            }
        }

        try {
            await new Promise((resolve) => {
                const callback = (data) => {
                    if (data.result === true) {
                        results.success++;
                    } else if (data.result === 'added_to_wishlist' || data.result === 'not_enough_space_added_to_wishlist') {
                        results.wishlist++;
                    } else {
                        results.failed++;
                        results.errors.push(data.result);
                    }
                    resolve();
                };

                // Use silent versions to avoid notification spam
                if (link.isMagnet) {
                    addMagnetSilent(link.url, callback);
                } else {
                    addTorrentSilent(link.url, callback);
                }
            });

            // Small delay between requests to avoid rate limiting
            if (i < links.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        } catch (error) {
            results.failed++;
            results.errors.push(error.message || 'Unknown error');
        }
    }

    // Sync Seedr UI once at the end
    if (results.success > 0) {
        seedr_sync();
    }

    return results;
}

// Silent versions for batch mode - no notifications
async function addMagnetSilent(magnet, callback) {
    keepAlive();
    const query = {'torrent_magnet': magnet};
    oauth.query('add_torrent', query)
        .then((data) => {
            stopKeepAlive();
            callback({ result: data.result });
        })
        .catch((error) => {
            stopKeepAlive();
            callback({ result: false, error });
        });
}

async function addTorrentSilent(torrent, callback) {
    keepAlive();
    try {
        const response = await fetch(torrent);
        const header = response.headers.get('Content-Disposition');
        let filename;

        if (header) {
            const match = header.match(/filename\*?=(?:UTF-8)?'?'?\\?"?([^"]+)"?'?;?/i);
            filename = match ? match[1] : '';
        } else {
            filename = torrent.substring(torrent.lastIndexOf('/') + 1);
        }

        const file_data = await response.blob();

        if (filename == '') {
            filename = file_data.type == 'text/html' ? 'filler.html' : 'filler.torrent';
        }

        oauth.query('add_torrent', {
            torrent_file: {data: file_data, filename: filename},
            torrent_url: torrent
        })
            .then((data) => {
                stopKeepAlive();
                callback({ result: data.result });
            })
            .catch((error) => {
                stopKeepAlive();
                callback({ result: false, error });
            });
    } catch (error) {
        stopKeepAlive();
        callback({ result: 'fetch_error', error });
    }
}

const listener_function = async (message, sender, sendResponse) => {
    switch (message.type) {
        case 'getStorage':
            try {
                const value = await s_storage.get(message.key);
                sendResponse({value: value});
            } catch (error) {
                console.error('Error getting storage:', error);
                sendResponse({error: error.message});
            }
            break;

        case 'setStorage':
            try {
                await s_storage.set(message.key, message.value);
                sendResponse({success: true});
            } catch (error) {
                console.error('Error setting storage:', error);
                sendResponse({error: error.message});
            }
            break;

        case 'checkLoginStatus':
            try {
                const result = await oauth.testToken();
                sendResponse({
                    loggedIn: result,
                    username: oauth.username
                });
            } catch (error) {
                console.error('Error checking login status:', error);
                sendResponse({loggedIn: false, error: error.message});
            }
            break;

        case 'logout':
            try {
                await oauth.logout();
                sendResponse({success: true});
            } catch (error) {
                console.error('Error logging out:', error);
                sendResponse({error: error.message});
            }
            break;

        case 'add_torrent':
            if (await s_storage.get('control_torrents') === false && !message.force) {
                sendResponse({result: 'use_default'});
            } else if (oauth.access_token === '') {
                sendResponse({result: 'login_required'});
            } else {
                await listenerAddTorrent(message, sender, sendResponse);
            }
            break;

        case 'add_torrents_batch':
            if (oauth.access_token === '') {
                sendResponse({result: 'login_required'});
            } else {
                // Process batch asynchronously
                addTorrentsBatch(message.links, message.force, sender)
                    .then(results => sendResponse(results))
                    .catch(error => sendResponse({result: false, error: error.message}));
            }
            break;

        case 'login':
            try {
                const data = await oauth.getAccessToken(message);
                sendResponse({result: data.result});
                chrome.tabs.query({}, (tabs) => {
                    const loginMessage = {type: 'login_successful'};
                    for (const tab of tabs) {
                        if (tab.url) {
                            chrome.tabs.sendMessage(tab.id, loginMessage);
                        }
                    }
                });
            } catch (error) {
                console.error('Login error:', error);
                sendResponse({result: false});
            }
            break;

        case 'open_window':
            chrome.tabs.create({url: message.url});
            break;

        case 'update_badge': {
            const count = message.count || 0;
            const text = count > 0 ? String(count) : '';
            chrome.action.setBadgeText({ text: text, tabId: sender.tab.id });
            chrome.action.setBadgeBackgroundColor({ color: '#4a90e2', tabId: sender.tab.id });
            // Store links per tab for popup
            if (!self.tabLinks) self.tabLinks = {};
            self.tabLinks[sender.tab.id] = message.links || [];
            sendResponse({ success: true });
            break;
        }

        case 'get_tab_links': {
            const tabId = message.tabId;
            sendResponse({ links: (self.tabLinks || {})[tabId] || [] });
            break;
        }

        default:
            console.warn('Unknown message type:', message.type);
            sendResponse({error: 'Unknown message type'});
    }

    return true; // Indicates that the response is sent asynchronously
};

// External message listener
const external_listener = async (request, sender, sendResponse) => {
    if (request.func == 'login') {
        await oauth.login(request.username, request.access_token, 3600 * 12, request.refresh_token);
    } else if (request.func == 'logout') {
        await oauth.logout();
    }
};

// Context menu setup
const contextMenuHandler = (info, tab) => {
    const magnet_start = "magnet:?xt=urn:btih:";
    const href = info.linkUrl;

    if (href.startsWith(magnet_start)) {
        chrome.tabs.sendMessage(tab.id, {type: "add_torrent", url: href, is_magnet: true}, (response) => {});
    } else {
        chrome.tabs.sendMessage(tab.id, {type: "add_torrent", url: href, is_magnet: false}, (response) => {});
    }
};
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        "id": "addToSeedr",
        "title": "Add to Seedr",
        "contexts": ["link"]
    });
    chrome.contextMenus.create({
        "id": "batchAddToSeedr",
        "title": "Batch Add Links",
        "contexts": ["page", "selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === "addToSeedr") {
        contextMenuHandler(info, tab);
    } else if (info.menuItemId === "batchAddToSeedr") {
        chrome.tabs.sendMessage(tab.id, { type: "show_batch_panel" });
    }
});

// Set up listeners based on browser type
if (!is_firefox) {
    chrome.downloads.onDeterminingFilename.addListener(download_listener);
} else if (browser.webRequest) {
    browser.webRequest.onHeadersReceived.addListener(
        request_listener,
        {urls: ["<all_urls>"], types: ["other"]},
        ['blocking', 'responseHeaders']
    );
}

// Set up message listeners
if (is_firefox) {
    browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
        listener_function(message, sender, sendResponse);
        return true; // Indicates async response
    });
} else {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        listener_function(message, sender, sendResponse);
        return true; // Indicates async response
    });
}

if (is_firefox) {
    browser.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
        external_listener(request, sender, sendResponse);
        return true; // Indicates async response
    });
} else {
    chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
        external_listener(request, sender, sendResponse);
        return true;
    });
}

// Clean up stored links when tab closes
chrome.tabs.onRemoved.addListener((tabId) => {
    if (self.tabLinks) delete self.tabLinks[tabId];
});
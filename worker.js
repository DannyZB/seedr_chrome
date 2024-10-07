import { s_storage } from "./storage.js";
import { SeedrOAuth } from "./oauth.js";
import "require.js";

// Constants and global variables
const notification_ids = {
    'not_enough_space': -1,
    'torrent_added': -1,
    'private_only': -1
};

let user_torrent_id = 0;

const hasNotificationsPermissions = false;
const is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

// Listener for download events
const download_listener = (item, suggest) => {
    const ext = item.filename.split('.').pop();
    if (ext.toLowerCase() === 'torrent' && s_storage.get("control_torrents") === true) {
        chrome.downloads.cancel(item.id, (data) => {
            console.log(data);
        });

        chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
            const tab = tabs[0];
            console.log(tab);
            chrome.tabs.sendMessage(tab.id, {
                type: "add_torrent",
                url: item.url,
                is_magnet: false
            }, (response) => {});
        });
        return true;  // handling asynchronously
    } else {
        return false;
    }
};
const TORRENT_MIME_TYPE = 'application/x-bittorrent';
const TORRENT_EXTENSION = '.torrent';

const request_listener = (details) => {
    if (!s_storage.get("control_torrents")) return;

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

// Set up listeners based on browser type
if (!is_firefox) {
    browser.downloads.onDeterminingFilename.addListener(download_listener);
} else if (chrome.webRequest) {
    chrome.webRequest.onHeadersReceived.addListener(
        request_listener,
        {urls: ["<all_urls>"], types: ["other"]},
        ['blocking', 'responseHeaders']
    );
}

// Helper functions
function setIcon() {
    // Implementation remains the same or can be updated if needed
}

function notify(message, type, timeout, buttons, tab_id) {
    if (typeof tab_id === 'undefined') {
        tab_id = false;
    }

    const notificationData = {
        type: "notify",
        notificationType: type,
        message: message,
        timeout: timeout,
        buttons: buttons
    };

    if (tab_id !== false) {
        chrome.tabs.sendMessage(tab_id, notificationData, {}, (response) => {});
    } else {
        chrome.tabs.query({active: true}, (tabs) => {
            const tab = tabs[0];
            if (tab) {
                console.log(tab);
                chrome.tabs.sendMessage(tab.id, notificationData, {}, (response) => {});
            }
        });
    }
}

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

function addMagnet(magnet, force, rcb, tab_id) {
    if (typeof magnet !== 'undefined' && ((s_storage.get('control_magnets') === true) || force)) {
        const query = {'torrent_magnet': magnet};
        oauth.query('add_torrent', query,
            (data) => add_re(data, rcb, tab_id),
            (data) => rcb(data, tab_id)
        );
        return true;
    } else {
        if (s_storage.get('control_magnets') === false) {
            rcb({result: 'use_default'});
        } else {
            rcb({result: false});
        }
        return false;
    }
}

function get_file_content(url, callback) {
    const oReq = new XMLHttpRequest();
    oReq.open("GET", url, true);
    oReq.responseType = "blob";

    oReq.onload = (oEvent) => {
        const blob = oReq.response;
        const header = oReq.getResponseHeader('Content-Disposition');
        let filename;

        if (header) {
            filename = header.match(/filename\*?=(?:UTF-8)?'?'?\\?"?([0-9\w\^\&\'\@\{\}\[\]\,\$\=\!\-\#\(\)\.\%\+\~\_ ]+)"?'?;?/)[1];
        } else {
            filename = oReq.responseURL.substring(oReq.responseURL.lastIndexOf('/') + 1);
        }
        callback(blob, filename);
    };

    oReq.send(null);
}

let adding_torrent = false;
let adding_timeout = false;

function addTorrent(torrent, force, rcb, tab_id) {
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
    }, 2000);

    if (typeof torrent !== 'undefined' && ((s_storage.get('control_torrents') === true) || force)) {
        get_file_content(torrent, (file_data, filename) => {
            if (filename == '') {
                filename = file_data.type == 'text/html' ? 'filler.html' : 'filler.torrent';
            }
            oauth.query('add_torrent', {torrent_file: {data: file_data, filename: filename}, torrent_url: torrent},
                (data) => add_re(data, rcb, tab_id),
                (data) => rcb(data)
            );
        });
    } else {
        if (s_storage.get('control_torrents') === false) {
            rcb({result: 'use_default'});
        } else {
            rcb({result: false});
        }
        return false;
    }
    return true;
}

function listenerAddTorrent(message, sender, sendResponse) {
    if (typeof message.torrent_url !== 'undefined') {
        addTorrent(message.torrent_url, message.force, sendResponse, sender.tab.id);
    } else if (message.magnet !== 'undefined') {
        addMagnet(message.magnet, message.force, sendResponse, sender.tab.id);
    } else {
        sendResponse({result: 'no_data_passed'});
    }
}

const listener_function = (message, sender, sendResponse) => {
    switch (message.type) {
        case 'add_torrent':
            if (s_storage.get('control_torrents') === false && !message.force) {
                sendResponse({result: 'use_default'});
            } else if (oauth.access_token === '') {
                sendResponse({result: 'login_required'});
            } else {
                listenerAddTorrent(message, sender, sendResponse);
            }
            break;
        case 'login':
            oauth.getAccessToken(message,
                (data) => {
                    sendResponse({result: data.result});
                    chrome.tabs.query({}, (tabs) => {
                        const loginMessage = {type: 'login_successful'};
                        for (const tab of tabs) {
                            if (tab.url) {
                                chrome.tabs.sendMessage(tab.id, loginMessage);
                            }
                        }
                    });
                }
            );
            break;
        case 'open_window':
            chrome.tabs.create({url: message.url});
            break;
    }
    return true;
};

// Set up message listeners
if (is_firefox) {
    browser.runtime.onMessage.addListener(listener_function);
} else {
    chrome.runtime.onMessage.addListener(listener_function);
}

// Initialize OAuth
const oauth = new SeedrOAuth("password", "seedr_chrome", "https://www.seedr.cc/oauth_test/token.php", "https://www.seedr.cc/oauth_test/resource.php");

setIcon();

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

chrome.contextMenus.create({
    "title": "Add to Seedr",
    "contexts": ["link"],
    "onclick": contextMenuHandler
});

// External message listener
const external_listener = (request, sender, sendResponse) => {
    if (request.func == 'login') {
        oauth.login(request.username, request.access_token, 3600 * 12, request.refresh_token);
    } else if (request.func == 'logout') {
        oauth.logout();
    }
};

if (is_firefox) {
    browser.runtime.onMessageExternal.addListener(external_listener);
} else {
    chrome.runtime.onMessageExternal.addListener(external_listener);
}
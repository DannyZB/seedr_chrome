var notification_ids = {
    'not_enough_space': -1,
    'torrent_added': -1,
    'private_only': -1
};

var user_torrent_id = 0;

var hasNotificationsPermissions = false;
var is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

var download_listener = function (item, suggest) {
    var ext = item.filename.split('.').pop();
    if (ext.toLowerCase() == 'torrent' && s_storage.get("control_torrents") === true) {
        chrome.downloads.cancel(item.id, function (data) {
            console.log(data);
        });

        chrome.tabs.query({active: true}, function (tabs) {
            var tab = tabs[0];
            console.log(tab);
            chrome.tabs.sendMessage(tab.id, {
                type: "add_torrent",
                url: item.url,
                is_magnet: false
            }, function (response) {
            });
        });
        return true;  // handling asynchronously
    } else {
        return false;
    }

};

var request_listener = function (details) {
    var code = details.statusCode;
    var type = details.type;
    if (
        (code == 200 || code == 206 || code == 304)
        &&
        type != 'xmlhttprequest'
    ) {
        var is_torrent = false;

        for (h of details.responseHeaders) {
            if (h.name.toLowerCase() == 'content-type') {

                if (h.value.toLowerCase() == 'application/x-bittorrent') {
                    is_torrent = true;
                    break;
                }

            } else if (h.name.toLowerCase() == 'content-disposition') {
                var r = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(h.value.toLowerCase());
                if (r) {
                    if (r.length) {
                        var f = r[1];
                        var ext = f.split('.').pop();
                        if (ext.toLowerCase() == 'torrent') {
                            is_torrent = true;
                            break;
                        }
                    }
                }
            }
        }

        if (is_torrent && s_storage.get("control_torrents")) {
            console.log(details.url);
            console.log(details);

            chrome.tabs.query({active: true}, function (tabs) {
                var tab = tabs[0];
                console.log(tab);
                chrome.tabs.sendMessage(tab.id, {
                    type: "add_torrent",
                    url: details.url,
                    is_magnet: false
                }, function (response) {
                });
            });
            return {redirectUrl: 'javascript:'};
        }
    }
};

if (!is_firefox) { // In chrome use downloads API
    chrome.downloads.onDeterminingFilename.addListener(download_listener);
} else { // In firefox use requests API
    chrome.webRequest.onHeadersReceived.addListener(request_listener, {urls: ["<all_urls>"]}, ['blocking', 'responseHeaders']);
}

function setIcon() {
    /*if (oauth.hasToken()) {
     chrome.browserAction.setIcon({ 'path' : 'img/icon-19-on.png'});
     } else {
     chrome.browserAction.setIcon({ 'path' : 'img/icon-19-off.png'});
     }*/
}

function notify(message, type, timeout, buttons, tab_id) {
    if (typeof notification_name === 'undefined') {
        notification_name = '';
    }
    if (typeof tab_id === 'undefined') {
        tab_id = false;
    }
    // if (hasNotificationsPermissions) {
    // 0 is PERMISSION_ALLOWED
    /*    chrome.notifications.create(
     'seedr_notif',
     {
     iconUrl:'favicon.png',
     title:title,
     message:message,
     type:'basic',
     buttons: buttons
     },
     function(i){
     notification_ids[notification_name] = i;
     setTimeout(function(){chrome.notifications.clear('seedr_notif',function(){});},hideAfter*1000);
     }
     );*/

    if (tab_id !== false) {
        chrome.tabs.sendMessage(tab_id,
            {
                type: "notify",
                notificationType: type,
                message: message,
                timeout: timeout,
                buttons: buttons
            },
            {},
            function (response) {
            });
    } else {
        chrome.tabs.query({active: true}, function (tabs) {
            var tab = tabs[0];
            if (tab) {
                console.log(tab);
                chrome.tabs.sendMessage(tab.id,
                    {
                        type: "notify",
                        notificationType: type,
                        message: message,
                        timeout: timeout,
                        buttons: buttons
                    },
                    {},
                    function (response) {
                    }
                );
            }
        });
    }
}

function seedr_sync() {
    chrome.tabs.query({}, function (tabs) {
        var message = {type: 'seedr_sync'};
        for (var i = 0; i < tabs.length; ++i) {
            chrome.tabs.sendMessage(tabs[i].id, message);
        }
    });
}

function add_re(data, rcb, tab_id) {
    if (data.result === true) {
        seedr_sync();
        console.log(data);
        user_torrent_id = data.user_torrent_id;
        notify('Seedr: Action successful! Torrent added to storage', 'success', 6000,
            [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Visit Seedr >',
                    url: "https://www.seedr.cc/torrent/" + user_torrent_id
                }
            ],
            tab_id
        );
        rcb({result: true});
    } else if (data.result == 'added_to_wishlist') {
        notify('Seedr: Free account active torrents limited. Torrent added to wishlist', 'warning', 6000,
            [
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
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'out_of_wishlist') {
        notify('Seedr: Free account Wishlist limited. You may have up to 2 torrents in your wishlist', 'error', 6000,
            [
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
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'private_not_allowed') {
        notify('Seedr: Upgrade to use Private Torrents', 'error', 6000,
            [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for Private Torrents +',
                    url: "https://www.seedr.cc/premium"
                }
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'out_of_bandwidth_memory') {
        notify('Seedr: You are out of free space', 'error', 6000,
            [
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
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'not_enough_space_added_to_wishlist') {
        notify('Seedr: Account storage limit reached. Torrent added to wishlist.', 'warning', 6000,
            [
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
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'not_enough_space_wishlist_full') {
        notify('Seedr: Not enough free space. Free account Wishlist limited. You may have up to 2 torrents in your wishlist', 'error', 6000,
            [
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
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'queue_full_added_to_wishlist') {
        notify('You are already downloading a torrent -- Please wait for it to finish or upgrade.', 'error', 6000,
            [
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
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'queue_full_wishlist_full') {
        notify('Seedr: You don\'t have space left.', 'error', 6000,
            [
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
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'private_not_allowed_added_to_wishlist') {
        notify('Seedr: Upgrade to use Private Torrents. Added to wishlist.', 'warning', 6000,
            [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for Private Torrents +',
                    url: "https://www.seedr.cc/premium"
                }
            ],
            tab_id
        );

        rcb({result: false});
    } else if (data.result == 'private_not_allowed_wishlist_full') {
        notify('Seedr: Upgrade to use Private Torrents.', 'error', 6000,
            [
                {
                    addClass: 'seedr-button seedr-reset seedr-button-success',
                    text: 'Upgrade for Private Torrents +',
                    url: "https://www.seedr.cc/premium"
                }
            ],
            tab_id
        );
        rcb({result: false});
    } else if (data.result == 'parsing_error') {
        notify('Seedr: Torrent file corrupt', 'error', 6000, false, tab_id);
        rcb({result: false});
    } else if (data.result == 'fetch_error') {
        notify('Seedr: Failed to download torrent file, you may try again', 'error', 6000, false, tab_id);
        rcb({result: false});
    } else {
        notify('Seedr: Torrent addition failed', 'error', 6000, false, tab_id);
        rcb({result: false});
    }
}

function addMagnet(magnet, force, rcb, tab_id) {
    var query;
    if (typeof magnet !== 'undefined' && ((s_storage.get('control_magnets') === true) || force)) {
        query = {'torrent_magnet': magnet};
    } else {
        if (s_storage.get('control_magnets') === false) {
            rcb({result: 'use_default'});
        } else {
            rcb({result: false});
        }
        return false;
    }

    oauth.query('add_torrent', query,
        function (data) {
            add_re(data, rcb, tab_id);

        },
        function (data) {
            rcb(data, tab_id);
        }
    );

    return true;
}

function get_file_content(url, callback) {
    var oReq = new XMLHttpRequest();
    oReq.open("GET", url, true);
    oReq.responseType = "blob";

    oReq.onload = function (oEvent) {
        var blob = oReq.response; // Note: not oReq.responseText

        var header = oReq.getResponseHeader('Content-Disposition');
        var filename;

        if (header) {
            filename = header.match(/filename='?"?(.+)"?'?/)[1]; // image.jpg
        } else {
            filename = oReq.responseURL.substring(oReq.responseURL.lastIndexOf('/') + 1);
        }
        callback(blob, filename);
    };

    oReq.send(null);
}

// Make sure we don't add it more than once (some sites fire loads of requests)

var adding_torrent = false;
var adding_timeout = false;

function addTorrent(torrent, force, rcb, tab_id) {
    if (adding_timeout) {
        if (adding_torrent == torrent) return false;
        else {
            clearTimeout(adding_timeout);
        }
    }

    adding_torrent = torrent;
    adding_timeout = setTimeout(function () {
        adding_torrent = false;
        adding_timeout = false;
    }, 2000);

    if (typeof torrent !== 'undefined' && ((s_storage.get('control_torrents') === true) || force)) {
        get_file_content(torrent, function (file_data, filename) {
            if (filename == '') {
                if (file_data.type == 'text/html') filename = 'filler.html';
                else                               filename = 'filler.torrent';
            }
            oauth.query('add_torrent', {torrent_file: {data: file_data, filename: filename}, torrent_url: torrent},
                function (data) {
                    add_re(data, rcb, tab_id);
                },
                function (data) {
                    rcb(data);
                }
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

var listener_function = function (message, sender, sendResponse) { // Listen to content script
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
                function (data) {
                    sendResponse({result: data.result});
                }
            );
            break;
        case 'open_window':
            chrome.tabs.create({url:message.url});
            break;
    }

    return true;
};

if (is_firefox) {
    browser.runtime.onMessage.addListener(listener_function);
} else {
    chrome.runtime.onMessage.addListener(listener_function);
}


var oauth = new SeedrOAuth("password", "seedr_chrome", "https://www.seedr.cc/oauth_test/token.php", "https://www.seedr.cc/oauth_test/resource.php");

setIcon();

var contextMenuHandler = function (info, tab) {
    var magnet_start = "magnet:?xt=urn:btih:";
    var torrent_regex = /.[^?]+\.([^?]+)(\?|$)/;
    var href = info.linkUrl;

    if (href.substr(0, magnet_start.length) == magnet_start) {
        chrome.tabs.sendMessage(tab.id, {type: "add_torrent", url: href, is_magnet: true}, function (response) {
        });
    } else {
        chrome.tabs.sendMessage(tab.id, {type: "add_torrent", url: href, is_magnet: false}, function (response) {
        });
    }
};

chrome.contextMenus.create({
    "title": "Add to Seedr",
    "contexts": ["link"],
    "onclick": contextMenuHandler
});

var external_listener =
    function (request, sender, sendResponse) {
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
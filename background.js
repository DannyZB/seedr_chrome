var notification_ids = {
  'not_enough_space' : -1,
  'torrent_added': -1,
  'private_only': -1
};

var user_torrent_id = 0;

var hasNotificationsPermissions = false;
chrome.notifications.getPermissionLevel(function(perm){
  hasNotificationsPermissions = perm == 'granted';
});


chrome.downloads.onDeterminingFilename.addListener(function(item, suggest) {
  var ext = item.filename.split('.').pop();
  if(ext.toLowerCase() == 'torrent' && s_storage.get("control_torrents") == true) {
    chrome.downloads.cancel(item.id,function(data){console.log(data);});

    chrome.tabs.getSelected(function(tab){
      console.log(tab);
      chrome.tabs.sendMessage(tab.id, {type: "add_torrent",url:item.url,is_magnet:false}, function(response) { });
    });
    return true;  // handling asynchronously
  } else {
    return false;
  }

});

function setIcon() {
  /*if (oauth.hasToken()) {
    chrome.browserAction.setIcon({ 'path' : 'img/icon-19-on.png'});
  } else {
    chrome.browserAction.setIcon({ 'path' : 'img/icon-19-off.png'});
  }*/
}

function notify(title, message, hideAfter,buttons,notification_name) {
  if(typeof notification_name === 'undefined') {
    notification_name='';
  }
  if (hasNotificationsPermissions) {
    // 0 is PERMISSION_ALLOWED
    chrome.notifications.create(
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
    );
  }
}  

function addMagnet(magnet,force,rcb) {
  var query;
  if(typeof magnet !== 'undefined' && ((s_storage.get('control_magnets') == true) || force)) {
    query = {'torrent_magnet':magnet};
  } else {    
    if(s_storage.get('control_magnets') == false){
      rcb({result:'use_default'});
    } else {
      rcb({result:false});
    }
    return false;
  }

  oauth.query('add_torrent',query,
    function(data){
      if(data.result == true){
        console.log(data);
        user_torrent_id = data.user_torrent_id;
        notify('Torrent addition','Action successful , torrent added to storage',5,[
          {
            title:'View Torrent',
            iconUrl: "/images/visit.png"
          }
        ],'torrent_added');
        rcb({result:true});
      } else if (data.result == 'added_to_wishlist') {
        notify('Torrent added to wishlist', 'You are already downloading 2 torrents, torrent added to wishlist',20,[
          {
            title:'Go See',
            iconUrl: "/images/clear.png"
          },
          {
            title:'Get More Slots',
            iconUrl: "/images/check.png"
          }
        ],'not_enough_space');
        rcb({result:false});
      } else if (data.result == 'out_of_wishlist') {
        notify('Torrent addition failed', 'You may have up to 2 torrents in your wishlist',20,[
          {
            title:'Go Clear',
            iconUrl: "/images/clear.png"
          },
          {
            title:'Get More Slots',
            iconUrl: "/images/check.png"
          }
        ],'not_enough_space');
        rcb({result:false});
      } else if (data.result == 'private_not_allowed') {
        notify('Torrent added to wishlist', 'Private torrents are not allowed on free accounts',20,[
          {
            title:'Go Clear',
            iconUrl: "/images/clear.png"
          },
          {
            title:'Get More Space',
            iconUrl: "/images/check.png"
          }
        ],'not_enough_space');
        rcb({result:false});
      } else if (data.result == 'out_of_bandwidth_memory') {
        notify('Torrent addition failed', 'Please clear space in your account to add this torrent',20,[
          {
            title:'Go Clear',
            iconUrl: "/images/clear.png"
          },
          {
            title:'Get More Space',
            iconUrl: "/images/check.png"
          }
        ],'not_enough_space');
        rcb({result:false});
      }   else if (data.result == 'not_enough_space_added_to_wishlist') {
        notify('There was a problem', 'You don\'t have enough space left -- Please clear some up or upgrade.\nTorrent added to wishlist.',20,[
          {
            title:'Clear Some Space'
          },
          {
            title:'Get bigger storage'
          }
        ],'not_enough_space');
        rcb({result:false});
      }  else if (data.result == 'not_enough_space_wishlist_full') {
        notify('There was a problem', 'You don\'t have enough space left -- Please clear some up or upgrade.\nYour wishlist is full -- Torrent wasn\'t added.',20,[
          {
            title:'Clear Some Space'
          },
          {
            title:'Get More Space'
          }
        ],'not_enough_space');
        rcb({result:false});
        }  else if (data.result == 'queue_full_added_to_wishlist') {
        notify('There was a problem', 'You are already downloading a torrent -- Please wait for it to finish or upgrade.\nTorrent added to wishlist.',20,[
          {
            title:'Watch torrent paint dry :)'
          },
          {
            title:'Download Immediately'
          }
        ],'not_enough_space');
        rcb({result:false});
      }  else if (data.result == 'queue_full_wishlist_full') {
        notify('There was a problem', 'You don\'t have enough space left -- Please clear some up or upgrade.\nYour wishlist is full -- Torrent wasn\'t added.',20,[
          {
            title:'Clear Some Space'
          },
          {
            title:'Get More Space'
          }
        ],'not_enough_space');
        rcb({result:false});
      }  else if (data.result == 'private_not_allowed_added_to_wishlist') {
        notify('There was a problem', 'Your account does not support private torrents.\nTorrent added to wishlist. ',20,[
          {
            title:'Enable private torrents support'
          }
        ],'private_only');
        rcb({result:false});
      }  else if (data.result == 'private_not_allowed_wishlist_full') {
        notify('There was a problem', 'Your account does not support private torrents.\nYour wishlist is full -- Torrent wasn\'t added. ',20,[
          {
            title:'Enable private torrents support'
          }
        ],'private_only');
        rcb({result:false});
      } else if (data.result == 'parsing_error') {
        notify('Torrent file corrupt', 'There was a problem parsing the given torrent file',20,[
        ],'not_enough_space');
        rcb({result:false});      
      } else if (data.result == 'fetch_error') {
        notify('Failed to add torrent', 'Torrent file corrupt.',20,[
        ],'not_enough_space');
        rcb({result:false});
      } else {
        notify('Torrent addition failed', data.error,20);
        rcb({result:false});
      }
    },
    function(data){
      rcb(data);
    }
  );

  return true;
}
function addTorrent(torrent,force,rcb) {
  var query;
  if(typeof torrent !== 'undefined' && ((s_storage.get('control_torrents') == true) || force)) {
    query = {'torrent_url':torrent};
  } else {    
    if(s_storage.get('control_torrents') == false){
      rcb({result:'use_default'});
    } else {
      rcb({result:false});
    }
    return false;
  }

  oauth.query('add_torrent',query,
    function(data){
      if(data.result == true){
        user_torrent_id = data.user_torrent_id;
        console.log(data);

        var r = [
          'Torrent added to storage, Cheers !',
          'Your wish is our command .. torrent added',
          'Torrent summoning successful',
          'The torrent elves have successfully added it to storage',
          'Torrent addition successful',
          'Torrenting started',
          'Here you go , we added it for you'
        ];

        var str = r[Math.floor(Math.random() * r.length)];

        notify('Success !',str,5,[
          {
            title:'View Torrent',
            iconUrl: "/images/visit.png"
          }
        ],'torrent_added');
        rcb({result:true});
      } else if (data.result == 'added_to_wishlist') {
        notify('Torrent added to wishlist', 'You are already downloading 2 torrents, torrent added to wishlist',20,[
          {
            title:'Go See',
            iconUrl: "/images/clear.png"
          },
          {
            title:'Get More Slots',
            iconUrl: "/images/check.png"
          }
        ],'not_enough_space');
        rcb({result:false});
      } else if (data.result == 'out_of_wishlist') {
        notify('Torrent addition failed', 'You may have up to 2 torrents in your wishlist',20,[
          {
            title:'Go Clear',
            iconUrl: "/images/clear.png"
          },
          {
            title:'Get More Slots',
            iconUrl: "/images/check.png"
          }
        ],'not_enough_space');
        rcb({result:false});
      } else if (data.result == 'private_not_allowed') {
        notify('Torrent added to wishlist', 'Private torrents are not allowed on free accounts',20,[
          {
            title:'Go Clear',
            iconUrl: "/images/clear.png"
          },
          {
            title:'Get More Space',
            iconUrl: "/images/check.png"
          }
        ],'not_enough_space');
        rcb({result:false});
      }  else if (data.result == 'out_of_bandwidth_memory') {
        notify('Torrent addition failed', 'Please clear space in your account to add this torrent',20,[
          {
            title:'Clear Some Space'
          },
          {
            title:'Get More Space'
          }
        ],'not_enough_space');
        rcb({result:false});
      }  else if (data.result == 'not_enough_space_added_to_wishlist') {
        notify('There was a problem', 'You don\'t have enough space left -- Please clear some up or upgrade.\nTorrent added to wishlist.',20,[
          {
            title:'Clear Some Space'
          },
          {
            title:'Get bigger storage'
          }
        ],'not_enough_space');
        rcb({result:false});
      }  else if (data.result == 'not_enough_space_wishlist_full') {
        notify('There was a problem', 'You don\'t have enough space left -- Please clear some up or upgrade.\nYour wishlist is full -- Torrent wasn\'t added.',20,[
          {
            title:'Clear Some Space'
          },
          {
            title:'Get More Space'
          }
        ],'not_enough_space');
        rcb({result:false});
        }  else if (data.result == 'queue_full_added_to_wishlist') {
        notify('There was a problem', 'You are already downloading a torrent -- Please wait for it to finish or upgrade.\nTorrent added to wishlist.',20,[
          {
            title:'Watch torrent paint dry :)'
          },
          {
            title:'Download Immediately'
          }
        ],'not_enough_space');
        rcb({result:false});
      }  else if (data.result == 'queue_full_wishlist_full') {
        notify('There was a problem', 'You don\'t have enough space left -- Please clear some up or upgrade.\nYour wishlist is full -- Torrent wasn\'t added.',20,[
          {
            title:'Clear Some Space'
          },
          {
            title:'Get More Space'
          }
        ],'not_enough_space');
        rcb({result:false});
      }  else if (data.result == 'private_not_allowed_added_to_wishlist') {
        notify('There was a problem', 'Your account does not support private torrents.\nTorrent added to wishlist. ',20,[
          {
            title:'Enable private torrents support'
          }
        ],'private_only');
        rcb({result:false});
      }  else if (data.result == 'private_not_allowed_wishlist_full') {
        notify('There was a problem', 'Your account does not support private torrents.\nYour wishlist is full -- Torrent wasn\'t added. ',20,[
          {
            title:'Enable private torrents support'
          }
        ],'private_only');
        rcb({result:false});
      } else if (data.result == 'parsing_error') {
        notify('Torrent file corrupt', 'There was a problem parsing the given torrent file',20,[
        ],'not_enough_space');
        rcb({result:false});      
      } else if (data.result == 'fetch_error') {
        notify('Failed to add torrent', 'Torrent file corrupt.',20,[
        ],'not_enough_space');
        rcb({result:false});
      } else {
        notify('Torrent addition failed', data.error,20);
        rcb({result:false});
      }
    },
    function(data){
      rcb(data);
    }
  );

  return true;
}

function listenerAddTorrent (message, sender, sendResponse) {
  if(typeof message.torrent_url !== 'undefined'){
    addTorrent(message.torrent_url,message.force,sendResponse);
  } else if(message.magnet !== 'undefined') {
    addMagnet(message.magnet,message.force,sendResponse);
  } else {
    console.error('no data passed to torrent add !');
    sendResponse({result:false});
  }
}

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) { // Listen to content script
  switch(message.type){
    case 'add_torrent':
      if(s_storage.get('control_torrents') == false && !message.force){
        sendResponse({result:'use_default'});
      } else if(oauth.access_token == '') {
        sendResponse({result:'login_required'});
      } else {
        listenerAddTorrent(message, sender, sendResponse);
      }
    break;
    case 'login':
      oauth.getAccessToken( message ,
      function(data){
        sendResponse({result:data.result});
      }
      );
    break;
  }

  return true;
});

var oauth = new SeedrOAuth("password","seedr_chrome","https://www.seedr.cc/oauth_test/token.php","https://www.seedr.cc/oauth_test/resource.php");

setIcon();

var contextMenuHandler = function(info,tab) {
  var magnet_start = "magnet:?xt=urn:btih:";
  var torrent_regex = /.[^?]+\.([^?]+)(\?|$)/;
  var href = info.linkUrl;

  if(href.substr(0,magnet_start.length) == magnet_start){
      chrome.tabs.sendMessage(tab.id, {type: "add_torrent",url:href,is_magnet:true}, function(response) { });
  } else {
      chrome.tabs.sendMessage(tab.id, {type: "add_torrent",url:href,is_magnet:false}, function(response) { });
  }
};

chrome.contextMenus.create({
  "title": "Add to Seedr",
  "contexts": ["link"],
  "onclick" : contextMenuHandler
});

chrome.runtime.onMessageExternal.addListener(
function(request, sender, sendResponse) {
  if(request.func == 'login'){
    oauth.login(request.username,request.access_token,request.access_token_expire,request.refresh_token);
  } else if (request.func == 'logout') {
    oauth.logout();
  }
});

chrome.notifications.onButtonClicked.addListener(function(notifId, btnIdx) {
  if(notifId == notification_ids['not_enough_space']){
    if (btnIdx === 0) {
        window.open("https://www.seedr.cc/files");
    } else if (btnIdx === 1) {
        window.open("https://www.seedr.cc/premium");
    }
  } else if (notifId == notification_ids['private_only']) {
        window.open("https://www.seedr.cc/premium");
  } else if (notifId == notification_ids['torrent_added']) {
    window.open("https://www.seedr.cc/torrent/" + user_torrent_id);
  }
});
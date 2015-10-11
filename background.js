var hasNotificationsPermissions = false;
chrome.notifications.getPermissionLevel(function(perm){
  hasNotificationsPermissions = perm == 'granted';
});


function setIcon() {
  /*if (oauth.hasToken()) {
    chrome.browserAction.setIcon({ 'path' : 'img/icon-19-on.png'});
  } else {
    chrome.browserAction.setIcon({ 'path' : 'img/icon-19-off.png'});
  }*/
};

function notify(title, message, hideAfter) {
  if (hasNotificationsPermissions) {
    // 0 is PERMISSION_ALLOWED
    chrome.notifications.create(
      'seedr_notif',
      {
        iconUrl:'favicon.png',
        title:title,
        message:message,
        type:'basic'
      },
      function(i){
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
        notify('Torrent addition','Action successful , torrent added to storage',5);
        rcb({result:true});
      } else if (data.result == 'out_of_bandwidth_memory') {
        notify('Torrent addition failed', 'Please clear space in your account to add this torrent',20);
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
        console.log(data);
        notify('Torrent addition','Action successful , torrent added to storage',5);
        rcb({result:true});
      } else if (data.result == 'out_of_bandwidth_memory') {
        notify('Torrent addition failed', 'Please clear space in your account to add this torrent',20);
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
      if(s_storage.get('control_torrents') == false){
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

var oauth = new SeedrOAuth("password","seedr_chrome","https://www.seedr.co.il/oauth/token.php","https://www.seedr.co.il/oauth/resource.php");

setIcon();

var contextMenuHandler = function(info,tab) {
  var magnet_start = "magnet:?xt=urn:btih:";
  var torrent_regex = /.[^?]+\.([^?]+)(\?|$)/;
  var href = info.linkUrl;

  if(href.substr(0,magnet_start.length) == magnet_start){
      chrome.tabs.sendMessage(tab.id, {type: "add_torrent",url:href,is_magnet:true}, function(response) { });
  } else {
    var base_link = href.split('?')[0];
    var matches = base_link.match(torrent_regex);
    if(matches != null) {
      if(matches[1] == "torrent") { // Torrent url
        chrome.tabs.sendMessage(tab.id, {type: "add_torrent",url:href,is_magnet:false}, function(response) { });
      } 
    }
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
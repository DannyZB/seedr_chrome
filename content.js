var seedr_chrome_add_after_login = '';
var seedr_chrome_add_after_login_magnet = false;
var seedr_chrome_add_after_login_force = false;

function notify(title,text){
	chrome.extension.getBackgroundPage().notify(title,text);
}

function showLoading()
{
	$("body").append($('\
	  <div id="seedr-chrome-loading-div" style="display: none; width:100%; height:90%; background:rgba(255,255,255,0.6); position:fixed; z-index:1000000; text-align:center; padding-top:10%;top:0;left:0">\
	    <div style="width:200px; background:white; border-radius:5px; border:1px solid #aaaaaa; padding:40px ; position:absolute; left:50%; margin-left:-100px;">\
	    <img src="'+chrome.extension.getURL("images/seedr.png")+'" style="padding:10px"><br />\
	    <img src="'+chrome.extension.getURL("images/chrome-adding-torrent.gif")+'">\
	  	</div>\
	  </div>\
	  ').delay(100).fadeIn());
}

function hideLoading()
{
    $("#seedr-chrome-loading-div").remove();
}

function showLogin()
{
	if($('#seedr-chrome-login-frame').length){
		$('#seedr-chrome-login-frame').fadeIn();
	} else {
		$("body").append($('<iframe src="https://www.seedr.cc/dev/extension_login/login_frame.html" id="seedr-chrome-login-frame"></iframe>')).delay(100).fadeIn();
	}
}

function hideLogin()
{
    $("#seedr-chrome-login-div").remove();
}

function addTorrent(url,is_magnet,force) {
	if(typeof force === 'undefined'){
		force = false;
	}

	showLoading();
	var data;
	if(is_magnet){
		data = {type:'add_torrent',magnet:url,force:force};
	} else {
		data = {type:'add_torrent',torrent_url:url,force:force}
	}
	chrome.runtime.sendMessage(data, function(response) {
	    if(response.result == "use_default"){
	    	hideLoading();
	    	window.location.href = url;
	    } else if(response.result == 'login_required'){
	    	seedr_chrome_add_after_login = url;
	    	seedr_chrome_add_after_login_magnet = is_magnet;
	    	seedr_chrome_add_after_login_force = force;
	    	hideLoading();
	    	showLogin();
	    } else {
	    	hideLoading();
	    	console.log('sendResponse was called with: ');
	    	console.log(response);
		}
	});
}

$("a").each(function(i,elem){
	if(typeof $(elem)[0].href !== 'undefined'){
		var magnet_start = "magnet:?xt=urn:btih:";
		var torrent_regex = /.[^?]+\.([^?]+)(\?|$)/;
		var href = $(elem)[0].href;

		if(href.substr(0,magnet_start.length) == magnet_start){
			var magnet = $(elem).attr('href');
			$(elem).click(function(e){
				e.preventDefault();
				addTorrent(magnet,true);
			});
		} else {
			var base_link = href.split('?')[0];
			var matches = base_link.match(torrent_regex);
			if(matches != null) {
				if(matches[1] == "torrent") { // Torrent url
					// make sure doesn't open in some idiotic tab
					$(elem).removeAttr('target');
					// $(elem).click(function(e){
					// 	e.preventDefault();
					// 	addTorrent(href,false);
					// });
				} 
			}
		}
	}
});

if($('#seedr-extension-element').length > 0){
	$('#seedr-extension-element').text('loaded');
}

function receiveMessage(event)
{
	// Do we trust the sender of this message?  (might be
	// different from what we originally opened, for example).
	if (event.origin !== "https://www.seedr.cc"){
		return;
	}

	message = event.data;

	switch(message.function) {
	    case 'close_login':
	    	$('#seedr-chrome-login-frame').fadeOut();
	    break;
	    case 'login':
			$("#seedr-chrome-login-frame").fadeOut();
			showLoading();

			data = {type:'login',username:message.username,password:message.password};

			chrome.runtime.sendMessage(data, function(response) {
				if(response.result == false){
					hideLoading();
					$("#seedr-chrome-login-frame").stop().css('opacity',1);
					$("#seedr-chrome-login-frame")[0].contentWindow.postMessage({function:'showError'},'https://www.seedr.cc');
				} else {
					hideLogin();
					hideLoading();
					addTorrent(seedr_chrome_add_after_login,seedr_chrome_add_after_login_magnet,seedr_chrome_add_after_login_force);
				}
			});
	    break;
	    case 'login_facebook':
			data = {type:'login_facebook',};
	    break;
	}
}

window.addEventListener("message", receiveMessage, false);

chrome.runtime.onMessage.addListener(function(message, sender, sendResponse) { // Listen to content script
  switch(message.type){
    case 'showLoading':
    	showLoading();
    break;
    case 'hideLoading':
    	hideLoading();
    break;
    case 'add_torrent':
    	addTorrent(message.url,message.is_magnet,true);
    break;
  }

  return true;
});
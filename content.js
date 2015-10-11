var seedr_chrome_add_after_login = '';
var seedr_chrome_add_after_login_magnet = false;

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
	$("body").append($('\
	  <div id="seedr-chrome-login-div">\
	    <div>\
	    	<div style="float:right; color:grey; font-size:0.7rem; padding:22px">Login to continue ...</div> \
	    	<img src="'+chrome.extension.getURL("images/seedr.png")+'" style="padding:10px"><br />\
    		<form name="login" method="post" id="seedr-chrome-login-form">\
			<p>\
			<label>Username:</label>\
			<input type="text" name="username" />\
			</p>\
			<p>\
			<label> <span>Password <a href="https://www.seedr.co.il/dynamic/forgot-password" style="float: right; font-size:0.8em; padding-top:0.1em; width:50%">Forgot your password?</a></span>\
			<input type="password" name="password" />\
			<small class="error" id="seedr-chrome-login-error" style="display:none">Incorrect email/password combination</small>\
			</p>\
			<p style="margin-top:-20px">\
				<input type="submit" value="Login"/>\
				<a id="seedr-chrome-login-cancel" style="float:right; padding-top:8px" href="#">Cancel</a>\
			</p>\
		</form>\
	  	</div>\
	  </div>\
  	').delay(100).fadeIn());
  	$('#seedr-chrome-login-cancel').click(function(){hideLogin();});
  	$('#seedr-chrome-login-form').submit(function(e){
  		e.preventDefault();
  		$("#seedr-chrome-login-div").fadeOut();
  		showLoading();

		data = {type:'login',username:$('input[name=username]',this).val(),password:$('input[name=password]',this).val()};

		chrome.runtime.sendMessage(data, function(response) {
		    if(response.result == false){
		    	hideLoading();
		    	$("#seedr-chrome-login-div").stop().fadeIn();
		    	$('#seedr-chrome-login-error').show();
		    } else {
		    	hideLogin();
		    	hideLoading();
		    	addTorrent(seedr_chrome_add_after_login,seedr_chrome_add_after_login_magnet);
			}
		});
  	});
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
					$(elem).click(function(e){
						e.preventDefault();
						addTorrent(href,false);
					});
				} 
			}
		}
	}
});

if($('#seedr-extension-element').length > 0){
	$('#seedr-extension-element').text('loaded');
}

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
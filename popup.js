function showHide(div){
	if(document.getElementById(div).style.display = 'block'){
		document.getElementById(div).style.display = 'none';
	}else{
		document.getElementById(div).style.display = 'block'; 
	}
}

function showLoading(){
    $("#loading-div").delay(200).fadeIn(150); 
}

function hideLoading(){
    $("#loading-div").stop().fadeOut(50);
}

$(document).ready(function(){
	$(document).foundation();

	var background_page = chrome.extension.getBackgroundPage();

	$("#forgot-account-link").click(function(){
		chrome.tabs.create({'url': 'https://www.seedr.co.il/dynamic/lost-password'}, function(tab) {window.close();});
	});

	$('#login-form').submit(function(e){
		e.preventDefault();
		showLoading();
		background_page.oauth.getAccessToken(
			{
				username:$("input[name='username']",this).val(),
				password:$("input[name='password']",this).val()
			},
			function(data){
				hideLoading();
				if(typeof data.error !== 'undefined'){
					$('#login-error').show();
				} else {
					$('#login-error').hide();
					$('#login-tab').hide();
					$('#account-tab').show();	
				}
			});
	});

	// Load settings
	if(background_page.s_storage.get('control_torrents')){
		$("#make-default-client-checkbox").attr('checked','checked');
	} 

	$('#logout').click(function(){
		background_page.oauth.logout();
		window.close();
	});

	$("#make-default-client-checkbox").click(function(){
		background_page.s_storage.set('control_torrents',$(this).is(':checked'));
		background_page.s_storage.set('control_magnets',$(this).is(':checked'));
	});

	if(background_page.oauth.access_token == ''){
		$('#seedr-status').css('color','grey');
		$('#seedr-status').text('Logged Out');
		background_page.oauth.getAccessToken(
			{
				username:'auto_load',
				password:'password'
			}, function(data) {
				if(typeof data.error === 'undefined'){
					$('#seedr-status').css('color','green');
					$('#seedr-status').text('Logged In');
				} else {
				}
			}
		);
	} else {
		background_page.oauth.testToken(function(result){
			if(result == true){
				$('#seedr-status').css('color','green');
				$('#seedr-status').text('Logged In');
			} else {
				$('#seedr-status').css('color','grey');
				$('#seedr-status').text('Logged Out');
			}
		});
	}

});
function showLoading(){
    $("#loading-div").delay(200).fadeIn(150); 
}

function hideLoading(){
    $("#loading-div").stop().fadeOut(50);
}

$(document).ready(function(){
	$(document).foundation();

	var background_page = chrome.extension.getBackgroundPage();

	// Load settings
	if(background_page.s_storage.get('control_torrents')){
		$("#make-default-client-checkbox").attr('checked','checked');
	} 

	$("#make-default-client-checkbox").click(function(){
		background_page.s_storage.set('control_torrents',$(this).is(':checked'));
		background_page.s_storage.set('control_magnets',$(this).is(':checked'));
	});

	if(background_page.oauth.access_token == ''){ // Not logged in 
		$('#seedr-status').css('color','grey');
		$('#seedr-status').text('Logged Out');
		$('#seedr-username').text('None');
	} else { // Has a token - test validity
		background_page.oauth.testToken(function(result){
			if(result == true){
				$('#seedr-status').css('color','green');
				$('#seedr-status').text('Logged In');
				$('#seedr-username').text(background_page.oauth.username);
				$('#logout-li').show();
				$('#logged-out-li').hide();
			} else {
				$('#seedr-status').css('color','grey');
				$('#seedr-status').text('Logged Out');
				$('#seedr-username').text('None');
			}
		});
	}

	$('#logout').click(function(){
		background_page.oauth.logout();
		window.close();
	});

	$('#visit-seedr-link').click(function(){
		window.open('https://www.seedr.co.il/'); 
		window.close();
	});
});
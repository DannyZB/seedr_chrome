// Helper functions
function showLoading() {
	document.getElementById('loading-div').style.display = 'block';
}

function hideLoading() {
	document.getElementById('loading-div').style.display = 'none';
}

function setStatus(status, username) {
	const statusElement = document.getElementById('seedr-status');
	const usernameElement = document.getElementById('seedr-username');
	const logoutLi = document.getElementById('logout-li');
	const loggedOutLi = document.getElementById('logged-out-li');

	if (status === 'logged_in') {
		statusElement.textContent = 'Logged In';
		statusElement.style.color = 'green';
		usernameElement.textContent = username || 'Logged In';
		logoutLi.style.display = 'block';
		loggedOutLi.style.display = 'none';
	} else {
		statusElement.textContent = 'Logged Out';
		statusElement.style.color = 'grey';
		usernameElement.textContent = 'None';
		logoutLi.style.display = 'none';
		loggedOutLi.style.display = 'block';
	}
}

// Main function
document.addEventListener('DOMContentLoaded', () => {
	const background_page = chrome.extension.getBackgroundPage();
	const is_firefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

	// Load settings
	const makeDefaultClientCheckbox = document.getElementById('make-default-client-checkbox');
	makeDefaultClientCheckbox.checked = background_page.s_storage.get('control_torrents');

	makeDefaultClientCheckbox.addEventListener('change', (event) => {
		background_page.s_storage.set('control_torrents', event.target.checked);
		background_page.s_storage.set('control_magnets', event.target.checked);
	});

	// Check login status
	if (background_page.oauth.access_token === '') {
		setStatus('logged_out');
	} else {
		background_page.oauth.testToken((result) => {
			setStatus(result ? 'logged_in' : 'logged_out');
		});
	}

	// Set up logout button
	document.getElementById('logout').addEventListener('click', () => {
		background_page.oauth.logout();
		window.close();
	});

	// Set up visit site link
	document.getElementById('visit-seedr-link').addEventListener('click', () => {
		chrome.tabs.create({ url: 'https://www.seedr.cc/' });
		window.close();
	});
});
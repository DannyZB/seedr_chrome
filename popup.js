// Helper functions
function showLoading() {
	document.getElementById('loading-div').style.display = 'block';
	document.getElementById('content-tab').style.display = 'none';
}

function hideLoading() {
	document.getElementById('loading-div').style.display = 'none';
	document.getElementById('content-tab').style.display = 'block';
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
document.addEventListener('DOMContentLoaded', async () => {
	const makeDefaultClientCheckbox = document.getElementById('make-default-client-checkbox');
	const logoutButton = document.getElementById('logout');
	const visitSeedrLink = document.getElementById('visit-seedr-link');
	const closeButton = document.getElementById('close-button');

	// Load settings
	showLoading();
	try {
		const result = await chrome.runtime.sendMessage({type: 'getStorage', key: 'control_torrents'});
		makeDefaultClientCheckbox.checked = result.value || false;
	} catch (error) {
		console.error('Error loading settings:', error);
	} finally {
		hideLoading();
	}

	makeDefaultClientCheckbox.addEventListener('change', async (event) => {
		showLoading();
		try {
			await chrome.runtime.sendMessage({type: 'setStorage', key: 'control_torrents', value: event.target.checked});
			await chrome.runtime.sendMessage({type: 'setStorage', key: 'control_magnets', value: event.target.checked});
		} catch (error) {
			console.error('Error saving settings:', error);
		} finally {
			hideLoading();
		}
	});

	// Check login status
	showLoading();
	try {
		const response = await chrome.runtime.sendMessage({type: 'checkLoginStatus'});
		setStatus(response.loggedIn ? 'logged_in' : 'logged_out', response.username);
	} catch (error) {
		console.error('Error checking login status:', error);
		setStatus('logged_out');
	} finally {
		hideLoading();
	}

	// Set up logout button
	logoutButton.addEventListener('click', async () => {
		showLoading();
		try {
			await chrome.runtime.sendMessage({type: 'logout'});
			setStatus('logged_out');
		} catch (error) {
			console.error('Error logging out:', error);
		} finally {
			hideLoading();
		}
	});

	// Set up visit site link
	visitSeedrLink.addEventListener('click', (e) => {
		e.preventDefault();
		chrome.tabs.create({ url: 'https://www.seedr.cc/' });
		window.close();
	});

	// Set up close button
	closeButton.addEventListener('click', () => {
		window.close();
	});
});
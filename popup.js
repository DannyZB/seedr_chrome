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

	// Load found links for active tab
	try {
		const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
		if (tab) {
			const response = await chrome.runtime.sendMessage({ type: 'get_tab_links', tabId: tab.id });
			const links = response?.links || [];
			const section = document.getElementById('found-links-section');
			const list = document.getElementById('found-links-list');
			const addAllBtn = document.getElementById('add-all-btn');

			if (links.length > 0) {
				section.style.display = 'block';
				links.forEach((link, i) => {
					const row = document.createElement('div');
					row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px; margin-bottom:6px; background:white; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);';

					const label = document.createElement('span');
					label.style.cssText = 'font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:220px;';
					const displayName = link.type === 'magnet'
						? (link.url.match(/dn=([^&]*)/)?.[1]?.replace(/\+/g, ' ')?.substring(0, 40) || link.url.substring(0, 50))
						: (link.url.split('/').pop()?.substring(0, 40) || link.url.substring(0, 50));
					label.textContent = (link.type === 'magnet' ? '\u{1F9F2} ' : '\u{1F4E6} ') + displayName;
					label.title = link.url;

					const btn = document.createElement('button');
					btn.textContent = 'Add';
					btn.style.cssText = 'background:#4a90e2; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px; flex-shrink:0; margin-left:8px;';
					btn.addEventListener('click', () => {
						const isMagnet = link.type === 'magnet';
						chrome.runtime.sendMessage({ type: 'add_torrent', url: link.url, is_magnet: isMagnet });
						btn.textContent = '\u2713';
						btn.style.backgroundColor = '#27ae60';
						btn.disabled = true;
					});

					row.appendChild(label);
					row.appendChild(btn);
					list.appendChild(row);
				});

				addAllBtn.addEventListener('click', () => {
					links.forEach(link => {
						chrome.runtime.sendMessage({ type: 'add_torrent', url: link.url, is_magnet: link.type === 'magnet' });
					});
					addAllBtn.textContent = 'Added!';
					addAllBtn.style.backgroundColor = '#27ae60';
					addAllBtn.disabled = true;
				});
			}
		}
	} catch (error) {
		console.error('Error loading found links:', error);
	}
});
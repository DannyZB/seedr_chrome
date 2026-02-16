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
						const msg = isMagnet
							? { type: 'add_torrent', magnet: link.url, force: true }
							: { type: 'add_torrent', torrent_url: link.url, force: true };
						chrome.runtime.sendMessage(msg);
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
						const isMagnet = link.type === 'magnet';
						const msg = isMagnet
							? { type: 'add_torrent', magnet: link.url, force: true }
							: { type: 'add_torrent', torrent_url: link.url, force: true };
						chrome.runtime.sendMessage(msg);
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

	// Relay scan button
	const relayScanBtn = document.getElementById('relay-scan-btn');
	const relayResults = document.getElementById('relay-results');
	const relayLoading = document.getElementById('relay-loading');

	// Show relay button (always available — server enriches with metadata)
	relayScanBtn.style.display = 'block';

	relayScanBtn.addEventListener('click', async () => {
		relayScanBtn.style.display = 'none';
		relayLoading.style.display = 'block';

		try {
			// Get filtered HTML from content script
			const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
			const pageData = await chrome.tabs.sendMessage(activeTab.id, { type: 'get_filtered_html' });

			// Get access token from background
			const token = await chrome.runtime.sendMessage({ type: 'getStorage', key: 'access_token' });

			const resp = await fetch('https://www.seedr.cc/api/scrape/html/torrents', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					url: pageData.url,
					html: pageData.html,
					access_token: token.value
				})
			});

			const data = await resp.json();
			relayLoading.style.display = 'none';

			if (data.torrents && data.torrents.length > 0) {
				relayResults.style.display = 'block';
				relayResults.innerHTML = '<strong style="display:block;margin-bottom:8px;">Server found:</strong>';
				data.torrents.forEach(t => {
					const row = document.createElement('div');
					row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; padding:8px; margin-bottom:6px; background:white; border-radius:6px; box-shadow:0 1px 3px rgba(0,0,0,0.1);';

					const label = document.createElement('span');
					label.style.cssText = 'font-size:13px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:200px;';
					label.textContent = t.title || t.hash?.substring(0, 16) || 'Unknown';
					label.title = t.magnet || t.hash;

					const btn = document.createElement('button');
					btn.textContent = 'Add';
					btn.style.cssText = 'background:#4a90e2; color:white; border:none; padding:4px 10px; border-radius:4px; cursor:pointer; font-size:12px; flex-shrink:0; margin-left:8px;';
					btn.addEventListener('click', () => {
						chrome.runtime.sendMessage({ type: 'add_torrent', magnet: t.magnet, force: true });
						btn.textContent = '\u2713';
						btn.style.backgroundColor = '#27ae60';
						btn.disabled = true;
					});

					row.appendChild(label);
					row.appendChild(btn);
					relayResults.appendChild(row);
				});
			} else {
				relayResults.style.display = 'block';
				relayResults.textContent = 'No torrents found on this page.';
			}
		} catch (error) {
			relayLoading.style.display = 'none';
			relayResults.style.display = 'block';
			relayResults.textContent = 'Scan failed: ' + error.message;
		}
	});
});
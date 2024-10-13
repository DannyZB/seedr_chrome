export const s_storage = {
	settings: {
		control_torrents: false,
		control_magnets: false,
		access_token: '',
		refresh_token: '',
		username: ''
	},

	set: async function(setting, value) {
		if (typeof this.settings[setting] === 'undefined') {
			console.log("Illegal setting passed to storage");
			throw new Error("Illegal setting");
		} else {
			this.settings[setting] = value;
			let i = {};
			i[setting] = value;

			try {
				await new Promise((resolve, reject) => {
					chrome.storage.local.set(i, () => {
						if (chrome.runtime.lastError) {
							reject(chrome.runtime.lastError);
						} else {
							console.log('Setting ' + setting + ' : ' + value + ' saved');
							resolve();
						}
					});
				});
				return value;
			} catch (error) {
				console.error("Error saving setting:", error);
				throw error;
			}
		}
	},

	get: async function(setting) {
		if (typeof this.settings[setting] === 'undefined') {
			console.log("Illegal setting passed to storage");
			throw new Error("Illegal setting");
		} else {
			try {
				const data = await new Promise((resolve, reject) => {
					chrome.storage.local.get(setting, (result) => {
						if (chrome.runtime.lastError) {
							reject(chrome.runtime.lastError);
						} else {
							resolve(result);
						}
					});
				});

				if (typeof data[setting] !== 'undefined') {
					this.settings[setting] = data[setting];
				}
				return this.settings[setting];
			} catch (error) {
				console.error("Error retrieving setting:", error);
				throw error;
			}
		}
	}
};
export var SeedrStorage = function(){
	this.settings = {
		control_torrents	: false,
		control_magnets 	: false,
		access_token		: '',
		refresh_token		: '',
		username			: ''
	};
	
	var s = this;
	this.settings.each(function(key,value){
		chrome.storage.local.get(key,function(data){
			if(typeof data[key] !== 'undefined'){
				s.settings[key] = data[key];
			}
		});
	});

	this.set = function(setting,value) {
		if(typeof this.settings[setting] === 'undefined'){
			console.log("Illegal setting passed to storage");
		} else {
			this.settings[setting] = value;
			var i = {};
			i[setting] = value;
			chrome.storage.local.set(i,function(data){
				console.log('Setting ' + setting + ' : ' + value + ' saved');
			});
		}
	};

	this.get = function(setting){
		if(typeof this.settings[setting] === 'undefined'){
			console.log("Illegal setting passed to storage");
		} else {
			return this.settings[setting];
		}
	};
};

export var s_storage = new SeedrStorage();
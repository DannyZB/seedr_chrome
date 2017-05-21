// First generation of the app , very simple oAuth2 without local storage of tokens

var SeedrOAuth = function(grant_type, client_id, access_token_url, apiUrl) {
  this.grant_type = grant_type;
  this.client_id = client_id;
  this.access_token_url = access_token_url;
  this.refresh_token_url = access_token_url;
  this.apiUrl = apiUrl;

  var refreshTimeout;
  var oa = this;

  setTimeout(function(){
    if(s_storage.get('access_token') !== '') {
      refreshTimeout = setTimeout(function(){oa.getTokenFromRefresh();},180000); // Refresh access token 2 minutes before expire

      oa.refresh_token = s_storage.get('refresh_token');
      oa.access_token = s_storage.get('access_token');
      oa.username = s_storage.get('username');
    } else {
      oa.username = '';
      oa.access_token = '';
      oa.refresh_token = '';
    }
  },2500);


  this.getAccessToken = function(post_params,callback) {
    var base_data = {
      "grant_type": this.grant_type,
      "client_id" : this.client_id
    };
    oa.callback = callback;

    $.ajax({
      url:this.access_token_url,
      type:"POST",
      data:$.extend(base_data,post_params),
      dataType:"json",
      success:function(data){
        data.result = true;
        oa.callback(data);
        oa.access_token = data.access_token;
        oa.refresh_token = data.refresh_token;
        oa.username = data.username;

        s_storage.set('access_token',data.access_token);
        s_storage.set('refresh_token',data.refresh_token);
        s_storage.set('username',data.username);

        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(function(){oa.getTokenFromRefresh();},data.expires_in*1000 - 120*1000); // Refresh access token 2 minutes before expire

        chrome.tabs.query({active: true},function(tabs){
          var tab = tabs[0];
            notify('Seedr: extension now logged in!','success',2000,
              [
              {addClass: 'seedr-button seedr-reset seedr-button-success', text: 'Visit Seedr >', url:"https://www.seedr.cc/"}],
              tab.id
            );
        });
      },
      error:function(data){
        data.result = false;
        oa.callback(data);
      }
    });
  };

  this.testToken = function(callback) {
    if(this.access_token === ''){
      callback(false);
    } else {
      $.ajax({
        url:this.apiUrl,
        type:"POST",
        data:{'func':'test','access_token':oauth.access_token},
        dataType:"json",
        success:function(data){
          callback(true);
        },
        error:function(data){
          oa.getTokenFromRefresh(function(result){
            callback(result);
          });
        }
      });
    }
  };

  this.getTokenFromRefresh = function(callback) {
    var base_data = {
      "grant_type": "refresh_token",
      "refresh_token" : this.refresh_token,
      "client_id" : this.client_id
    };
    var oa = this;

    $.ajax({
      url:this.refresh_token_url,
      type:"POST",
      data:base_data,
      dataType:"json",
      success:function(data){
        oa.access_token = data.access_token;
        s_storage.set('access_token',data.access_token);

        clearTimeout(refreshTimeout);
        refreshTimeout = setTimeout(function(){oa.getTokenFromRefresh();},data.expires_in*1000 - 120*1000); // Refresh access token 2 minutes before expire
        if(typeof callback !== 'undefined')
          callback(true);
      },
      error:function(data){
        this.access_token = '';
        if(typeof callback != 'undefined')
          callback(false);
      }
    });
  };

  this.login = function(username,access_token,access_token_expire,refresh_token) {
    this.username=username;
    this.access_token=access_token;
    this.refresh_token = refresh_token;

    s_storage.set('access_token',access_token);
    s_storage.set('refresh_token',refresh_token);
    s_storage.set('username',username);

    clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(function(){
      oa.getTokenFromRefresh();
    },access_token_expire*1000 - 120*1000); // Refresh access token 2 minutes before expire
  };

  this.logout = function(){
    this.access_token = '';
    this.refresh_token = '';
    this.username = '';

    s_storage.set('access_token','');
    s_storage.set('refresh_token','');
    s_storage.set('username','');

    chrome.tabs.query({active: true},function(tabs){
      var tab = tabs[0];
      notify('Seedr: Extension is now logged out!','success',1500,
        [
        {addClass: 'seedr-button seedr-reset seedr-button-success', text: 'Visit Seedr >', url:"https://www.seedr.cc/"}],
        tab.id
      );
    });
  };

  this.query = function(func,data,callback,error_function){
    if(typeof error_function === 'undefined'){
        error_function = false;
    }
    
    var f = new FormData();

    $.each(data,function(i,e){
      if(e instanceof Object) {
        if(typeof e.filename !== 'undefined'){
          f.set(i,e.data,e.filename);
          return;
        }
      }

      f.set(i,e);
    });

    f.set('func',func);
    f.set('access_token',oauth.access_token);

    $.ajax({
        url:apiUrl,
        cache:false,
        processData: false, // Don't process the files
        contentType: false, // Set content type to false as jQuery will tell the server its a query string request
        type:"POST",
        dataType:"json",
        data:f,
        success:function(data){
            callback(data);
        },
        error:function(xhr, ajaxOptions, thrownError){
          var result = xhr.responseJSON;
          console.log("CONTENT JSON Error " + xhr.status + " : " + thrownError);
          if(result){
            if(result.error == 'invalid_token' || result.error == 'expired_token') {
              oa.getTokenFromRefresh(function(result){
                if(result == true) {
                  oa.query(func,data,callback,error_function);
                } else {
                  if(error_function !== false){
                      error_function({result:'login_required'});
                  }
                }
              });
            } else {
              error_function({result:'fetch_error'});
            }
          } else {
            error_function({result:'fetch_error'});
          }
        }
    });
  };
};
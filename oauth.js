// First generation of the app , very simple oAuth2 without local storage of tokens

var SeedrOAuth = function(grant_type, client_id, access_token_url, apiUrl) {
  this.grant_type = grant_type;
  this.client_id = client_id;
  this.access_token = '';
  this.access_token_expire = 0;
  this.refresh_token = '';
  this.refresh_token_expire = 0;
  this.access_token_url = access_token_url;
  this.refresh_token_url = access_token_url;
  this.apiUrl = apiUrl;

  var oa = this;

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
        oa.access_token_expire = data.expires_in + Date.now()/1000;
        oa.refresh_token = data.refresh_token;
        oa.refresh_token_expire = 14*24*3600 + Date.now()/1000; // Default 14-day refresh token

        setTimeout(function(){oa.getTokenFromRefresh();},data.expires_in*1000 - 120*1000); // Refresh access token 2 minutes before expire
        if(post_params.username!='auto_load'){
          notify("Login successful","The extension is now active",0.8);
        } else {
          $('#account-tab').show();
        }
      },
      error:function(data){
        data.result = false;
        oa.callback(data);
        if(post_params.username!='auto_load'){
          //chrome.extension.getBackgroundPage().notify("Login error",data.responseJSON.error_description,20);
        }
      }
    });
  };

  this.testToken = function(callback) {
    if(this.access_token == ''){
      callback(false);
    } else {
      $.ajax({
        url:this.apiUrl,
        type:"POST",
        data:{'func':'test','access_token':oauth.access_token},
        dataType:"json",
        success:function(data){
          if(data.result != 'login_required' && data.error != 'invalid_token'){
            callback(true);
          } else {
            callback(false);
          }
        },
        error:function(data){
          callback(false);
        }
      });
    }
  }

  this.getTokenFromRefresh = function() {
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
        oa.access_token_expire = data.expires_in + Date.now()/1000;

        setTimeout(function(){oa.getTokenFromRefresh();},data.expires_in*1000 - 120*1000); // Refresh access token 1 hour before it expires
      },
      error:function(data){
        this.access_token = '';
        this.access_token_expire = 0;
        chrome.extension.getBackgroundPage().notify("Token refresh error",data.responseJSON.error_description,20);
      }
    });
  }

  this.logout = function(){
    this.access_token = '';
    this.access_token_expire = 0;
    this.refresh_token = '';
    this.refresh_token_expire = 0;

    s_storage.access_token = '';
    s_storage.refresh_token = '';
    s_storage.access_token_expire = 0;
    s_storage.refresh_token_expire = 0;

    notify("Seedr","Extension now logged out",0.5);
  }

  this.query = function(func,data,callback,error_function){
    if(typeof is_displayed === 'undefined'){
        is_displayed = false;
    }
    if(typeof error_function === 'undefined'){
        error_function = false;
    }

    if(is_displayed){
        showLoading();
    }
    
    $.ajax({
        url:apiUrl,
        type:"POST",
        dataType:"json",
        data:$.extend({'func':func,'access_token':oauth.access_token},data),
        success:function(data){
            if(is_displayed)
              hideLoading();
            
            if(data.result == "login_required"){ // User not logged in or session timed out
              console.log('login required');
            } else if(data.result == "replace_token"){ 
              oa.getAccessToken(
                {
                  username:'auto_load',
                  password:'password'
                },
                function(data2){
                  callback(data);
                }
              );
            }
            callback(data);
        },
        error:function(xhr, ajaxOptions, thrownError){
            console.log("CONTENT JSON Error " + xhr.status + " : " + thrownError);
            
            if(is_displayed){
                hideLoading();
            }
            if(error_function != false){
                error_function();
            }
        }
    });       
  };
};
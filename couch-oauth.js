var config =  require('./config.js'), 
    nano = require('nano')(config.couch_auth_db_url),
    serializer = require('serializer'),
    users = nano.use('_users');  

function create_oauth_tokens(secret_base, user, callback) {
    console.log("in create_oauth_tokens, secretBase is: %d,%s",secret_base.length,secret_base);
    var consumer_key = serializer.randomString(96);
    var token_key = serializer.randomString(96);    
    user.oauth = {
        consumer_keys: {},
        tokens: {}
    };
    user.oauth.consumer_keys[consumer_key] = create_secret(secret_base);    
    user.oauth.tokens[token_key] = create_secret(secret_base);
    users.insert(user, user._id, function(err, response) {
        if (err || !response.ok) {
            console.log("ERROR Updating user with credentials:");
            console.dir(response);
            callback(response);            
        } else {
            callback(null, denormalize_oauth(user));
        }
    });
}

function create_secret(secret_base) {
    var encrypt_key = serializer.randomString(48);
    var validate_key = serializer.randomString(48);
    var secret_string = serializer.secureStringify(secret_base, encrypt_key, validate_key);
    if (secret_string.length > 80) {
        secret_string = secret_string.substr(30,50);    
    }
    return secret_string;
}

function denormalize_oauth(user) {
    var key;
    for (key in user.oauth.consumer_keys) {
        user.consumer_key = key;
        user.consumer_secret = user.oauth.consumer_keys[key];        
        break;
    }
    for (key in user.oauth.tokens) {
        user.token_key = key;        
        user.token_secret = user.oauth.tokens[key];
        break;
    }
    return user;
}

function validate_oauth(oauth) {
    try {
        if (Object.keys(oauth.consumer_keys).length > 0 && Object.keys(oauth.tokens).length > 0) {
            return true;
        }
    } catch (ex) {
        //oauth is bad, just let the false return;
    }
    return false;
}
                                
module.exports = function(accessToken, refreshToken, profile, callback) {
    var user_key = 'org.couchdb.user:'+profile._json.email;
    users.get(user_key, {}, function(err, body) {
        if (err) {
            callback(err);
            return;
        }        
        if (validate_oauth(body.oauth)) {
            callback(null, denormalize_oauth(body));            
        } else {
            create_oauth_tokens(accessToken, body, callback);
        }
    });
};

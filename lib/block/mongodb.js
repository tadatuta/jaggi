var inherit = require('inherit'),
    Block = require('../block'),
    MongoClient = require('mongodb').MongoClient,
    Vow = require('vow'),
    connections = {};

module.exports = inherit(Block, {
    run : function(params, promise) {

        var credentials = params.credentials,
            credentialsStr = JSON.stringify(credentials),
            login = credentials.username ? (credentials.username + ':' + credentials.password + '@') : '',
            connectionHandler = function(err, connection) {
                if (err) {
                    connections[credentialsStr] = null;
                    return promise.reject(new MongodbError(err));
                }

                connections[credentialsStr].fulfill(connection);

                var collection = connection.collection(params.collection),
                    query = params.query || {},
                    args = Array.isArray(query)? query.concat([queryHandler]) : [query, queryHandler];

                collection[params.operation || 'find'].apply(collection, args);
            },
            queryHandler = function(err, data) {
                if (err) return promise.reject(new MongodbError(err));

                if (!data) return promise.fulfill(data);

                data.toArray ?
                    data.toArray(function(err, data) {
                        if (err) {
                            connections[credentialsStr] = null;
                            promise.reject(new MongodbError(err));
                            return;
                        }

                        promise.fulfill(data);
                    }) :
                    promise.fulfill(data);
            };

        if (!connections[credentialsStr]) {
            connections[credentialsStr] = Vow.promise();
            MongoClient.connect('mongodb://' + login + (credentials.host || 'localhost') + ':' + (credentials.port || 27017) + '/' + credentials.database, connectionHandler);
            return;
        }

        connections[credentialsStr].then(function(connection) {
            connectionHandler(null, connection);
        });
    }
});

var MongodbError = inherit(Error, {
    __constructor : function(err) {
        this.code = err.code;
        this.message = err.errmsg || 'unspecified error';
    },

    toString : function() {
        return 'MongodbError: ' + this.code + ', ' + this.message;
    }
});
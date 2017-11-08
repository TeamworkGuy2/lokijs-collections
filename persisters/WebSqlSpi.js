"use strict";
/*! websql.js | MIT license | Stepan Riha | http://bitbucket.org/nonplus/websql-js
 * websql.js may be freely distributed under the MIT license.
 * converted to TypeScript at 2017-11-04 by TeamworkGuy2
 */
/*jslint undef: true, white: true, browser: true, devel: true, indent: 4, sloppy: false */
/*global alert: false, define: true*/
/** Module that wraps asynchronous WebSQL calls with deferred promises and provides SQL utility methods.
 *
 * Promises are **resolved** when asynchronous database callback is finished.
 * Promises are **rejected** with an `Error` object that may contain one or more of the following:
 *  - `message`: Describing what failed
 *  - `exception`: Exception that was thrown
 *  - `sqlError`: Error returned by WebSQL
 *  - `sql`: statement that was executing
 *
 * ## Getting Started
 *
 * Websql can be loaded via a commonjs 'require()' call
 *
 * Websql can produce deferred promises using
 * - [`when.js`](https://github.com/cujojs/when)
 * - [`Q.js`](https://github.com/kriskowal/q)
 * - [`jQuery's Deferred`](http://api.jquery.com/category/deferred-object/)
 * - Other...
 *
 * If a promise provider isn't loaded into the global scope, you need to use
 * the `websql.config()` method to tell it which provider to use.
 *
 *     // Using a CommonJS Promises/A implementation:
 *     define(["websql", "when"], function(websql, when) {
 *         websql.config({ defer: when.defer });
 *     })
 *
 *     // Using jQuery Deferred implementation:
 *     define(["websql", "jquery"], function(websql, $) {
 *         websql.config({ defer: $.Deferred });
 *     })
 *
 * ## Using the API
 * Example:
 *     var wsdb = websql("test");
 *     wsdb.read("SELECT * FROM ...").then(function(resultSet) { ... });
 *
 * ## Public Methods ##
 * ### websql() or websql(Database) or websql(name, _version_, _displayName_, _estimatedSize_)
 * Constructor for `WebsqlDatabase` wrapper objects.
 * - `websql()` creates an uninitialized instance.  Use the `openDatabase` method to initialize it.
 * - `websql(Database)` creates an instance from an native Database opened via `window.openDatabase(...)`
 * - `websql(name, ...)` takes the same parameters as the `window.openDatabase` function, but supplies
 * default values for unspecified parameters.
 * Returns: new instance of `WebsqlDatabase` wrapper class.
 * Usage:
 *     var wsdb = websql("test", "Test Database", 2 * 1024 * 1024);
 *     wsdb.execute("INSERT INTO ...").then(function(resultSet) { ... })
 * More usage:
 *     var wsdb = websql("test");
 *     wsdb.execute("INSERT INTO ...").then(function(resultSet) { ... })
 *
 *     var database = window.openDatabase(...);
 *     var wsdb = websql(database);
 */
var WebSqlUtil;
(function (WebSqlUtil) {
    function newWebSqlDbInst(name, version, displayName, estimatedSize, utilSettings) {
        var util = new DbUtils(utilSettings);
        var db = new WebSqlDatabase(util, name, version, displayName, estimatedSize);
        return db;
    }
    WebSqlUtil.newWebSqlDbInst = newWebSqlDbInst;
    var WebSqlDatabase = (function () {
        function WebSqlDatabase(util, name, version, displayName, estimatedSize) {
            this.util = util;
            this.transaction = this.transaction.bind(this);
            this.readTransaction = this.readTransaction.bind(this);
            // Initialize db from native Database or by opening `name`
            if (util._isDatabase(name)) {
                this.initDb(name);
                var dfd = util.defer();
                this.init = dfd.promise;
                dfd.resolve(this);
            }
            else if (name) {
                this.openDatabase(name, version, displayName, estimatedSize);
            }
        }
        /** initialize this WebSqlDatabase's underlying WebSql interface to the specific Database instance
         * @param db: the database to use as this instance's underlying WebSQL interface
         */
        WebSqlDatabase.prototype.initDb = function (db) {
            this.db = db;
            this.dbFuncs = {
                version: db.version,
                transaction: db.transaction.bind(db),
                readTransaction: db.readTransaction.bind(db),
                changeVersion: db.changeVersion.bind(db)
            };
        };
        /** Calls window.openDatabase().
         * - version defaults to `""`
         * - displayName defaults to `name`
         * - estimatedSize defaults to `2 * 1024 * 1024`
         * Returns: promise that resolves with this `WebsqlDatabase` instance
         * Usage:
         *     wsdb.openDatabase("test", "Test Database", 2 * 1024 * 1024))
         *         .then(function(wsdb) {...});
         * More usage:
         *     wsdb.openDatabase("test"))
         *         .then(function(wsdb) {...});
         */
        WebSqlDatabase.prototype.openDatabase = function (name, version, displayName, estimatedSize) {
            var util = this.util;
            var self = this;
            util.log(util.DEBUG, "openDatabase", name, version, displayName, estimatedSize);
            if (!displayName) {
                displayName = name;
            }
            if (!version) {
                version = "";
            }
            if (!estimatedSize) {
                if (window.navigator.userAgent.match(/(iPad|iPhone);.*CPU.*OS 7_0/i)) {
                    estimatedSize = 5 * 1024 * 1024;
                }
                else {
                    estimatedSize = 50 * 1024 * 1024;
                }
            }
            var dfd = util.defer();
            try {
                if (!window.openDatabase) {
                    util._rejectError(dfd, "WebSQL not implemented");
                }
                else {
                    // seems to synchronously open WebSQL, even though window.openDatabase is async
                    var db = window.openDatabase(name, version, displayName, estimatedSize);
                    self.initDb(db);
                    if (util._isDatabase(self.db)) {
                        dfd.resolve(self);
                    }
                    else {
                        util._rejectError(dfd, "Failed to open database");
                    }
                }
            }
            catch (ex) {
                util._rejectError(dfd, "Failed to open database " + name, { exception: ex });
            }
            this.init = dfd.promise;
            return this.init;
        };
        /** Returns: promise that resolves once the database version has been changed
         * Usage:
         *     wsdb.changeVersion("1", "2", function (xact) {
         *         xact.executeSQL(...);
         *     }).then(function() {...});
         */
        WebSqlDatabase.prototype.changeVersion = function (oldVersion, newVersion, xactCallback) {
            var funcName = "changeVersion";
            var util = this.util;
            var dfd = util.defer();
            if (!util._isDatabase(this.db)) {
                util._rejectError(dfd, "Database not specified (db='" + this.db + "')");
                return dfd.promise;
            }
            util.log(util.DEBUG, funcName, oldVersion, newVersion);
            try {
                this.dbFuncs.changeVersion(oldVersion, newVersion, xactCallback, function (sqlError) {
                    util._rejectError(dfd, "Failed to change version", { sqlError: sqlError });
                }, function () {
                    dfd.resolve(null);
                });
            }
            catch (ex) {
                util._rejectError(dfd, "Failed changeVersion(db, '" + oldVersion + "', '" + newVersion + "')", { exception: ex });
            }
            return dfd.promise;
        };
        /** Queries the sqlite_master table for user tables
         * Returns: promise that resolves with an array of table information records
         * Usage:
         *     wsdb.getTables().then(function(tables) {
         *         for(var i = 0; i < tables.length; i++) {
         *             var name = tables[i].name;
         *             var sql = tables[i].sql;
         *             ...
         *         }
         *     });
         */
        WebSqlDatabase.prototype.getTables = function () {
            var sql = "SELECT name, type, sql FROM sqlite_master " +
                "WHERE type in ('table') AND name NOT LIKE '?_?_%' ESCAPE '?'";
            return this.execSqlStatements(this.readTransaction, { sql: sql }, function (rs) {
                var tables = [];
                var rows = rs.rows;
                for (var i = 0, size = rows.length; i < size; i++) {
                    tables.push(rows.item(i));
                }
                return tables;
            }, "read");
        };
        /** Queries the sqlite_master for a table by name
         * Returns: promise that resolves with table info or with `undefined` if table
         * does not exist.
         * Usage:
         *     wsdb.tableExists("person").then(function (table) {
         *         alert("table " + (table ? "exists" : "does not exist"));
         *     });
         */
        WebSqlDatabase.prototype.tableExists = function (name) {
            var sql = "SELECT * FROM sqlite_master WHERE name = ?";
            return this.readRow([{ sql: sql, args: [[name]] }], function (row) {
                return row || undefined;
            });
        };
        /** Drops all the tables in the database.
         * Returns: promise that resolves with this `WebsqlDatabase`
         * Usage:
         *     wsdb.destroyDatabase()
         *         .then(function (wsdb) {...});
         */
        WebSqlDatabase.prototype.destroyDatabase = function () {
            return this.changeVersion(this.db.version, "", function (xact) {
                var sql = "SELECT name FROM sqlite_master " +
                    "WHERE type in ('table') AND name NOT LIKE '?_?_%' ESCAPE '?'";
                xact.executeSql(sql, [], function (xact, rs) {
                    var rows = rs.rows;
                    for (var i = 0, size = rows.length; i < size; i++) {
                        var sql = 'DROP TABLE "' + rows.item(i).name + '"';
                        xact.executeSql(sql);
                    }
                });
            });
        };
        /** Calls xactCallback(xact) from within a database transaction
         * Returns: promise that resolves with the database
         * Usage:
         *     wsdb.transaction(function (xact) {
         *         xact.executeSQL(...);
         *     }).then(function (wsdb) {...});
         *
         * More usage:
         *     var addressId;
         *     var personId;
         *
         *     function insertPerson(xact) {
         *         return xact.executeSql(
         *             "INSERT INTO person ...", [...],
         *             function (xact, rs) {
         *                 personId = rs.insertId;
         *                 insertAddress(xact, personId);
         *             }
         *         )
         *     }
         *
         *     function insertAddress(xact, personId) {
         *         return wsdb.executeSql(xact,
         *             "INSERT INTO address (person, ...) VALUES (?, ...)",
         *             [personId, ...],
         *             function (xact, rs) {
         *                 addressId = rs.insertId;
         *             }
         *         )
         *     }
         *
         *     wsdb.transaction(function (xact) {
         *         insertPerson(xact);
         *     }).then(function(wsdb) {
         *         alert("Created person " + personId + " with address " + addressId);
         *     });
         */
        WebSqlDatabase.prototype.transaction = function (xactCallback) {
            return this.executeTransaction(this.dbFuncs.transaction, "transaction", xactCallback);
        };
        /** Calls xactCallback(xact) from within a database read transaction
         * Returns: promise that resolves with the database
         * Usage:
         *     wsdb.readTransaction(function (xact) {
         *         xact.executeSQL(...);
         *     }).then(function (wsdb) {...});
         */
        WebSqlDatabase.prototype.readTransaction = function (xactCallback) {
            return this.executeTransaction(this.dbFuncs.readTransaction, "readTransaction", xactCallback);
        };
        /** Call 'webSqlFunc' method on 'db'
         * Implements common behavior for 'wsdb.transaction' and 'wsdb.readTransaction'
         */
        WebSqlDatabase.prototype.executeTransaction = function (webSqlFunc, webSqlFuncName, xactCallback) {
            var util = this.util;
            var dfd = util.defer();
            if (!util._isDatabase(this.db)) {
                util._rejectError(dfd, "Database not specified (db='" + this.db + "')");
                return dfd.promise;
            }
            try {
                webSqlFunc(function (xact) {
                    try {
                        xactCallback(xact);
                    }
                    catch (exception) {
                        util._rejectError(dfd, webSqlFuncName + " callback threw an exception", { exception: exception });
                    }
                    return;
                }, function (sqlError) {
                    util._rejectError(dfd, "Failed executing " + webSqlFuncName.replace(/transaction/i, "") + " transaction", { sqlError: sqlError });
                    return;
                }, function () {
                    dfd.resolve(null);
                    return;
                });
            }
            catch (exception) {
                util._rejectError(dfd, "Failed calling " + webSqlFuncName, { exception: exception });
            }
            return dfd.promise;
        };
        /** Method for executing a transaction with a one or more `sqlStatement`
         * with the specified `args`, calling the `rsCallback` with the result set(s).
         * The `args` and `rsCallback` are optional.
         * * Passing a _single_ `sqlStatement` string with `args` that is an _array of arrays_,
         * the statement is executed with each row in the `args`.
         * Passing an array of `{ sql, args}` objects to `sqlStatement`
         * executes the `sql` in each row with the row's `args` (or the parameter `args`).
         *
         * Returns: promise that resolves with `rsCallback` result
         * or the resultSet, if no `rsCallback` specified.  If an array of statements or arguments
         * is specified, the promise resolves with an array of results/resultSets.
         *
         * Basic Usage:
         *     wsdb.execute("DELETE FROM person")
         *         .then(function (resultSet) {...});
         *
         * Other Usage: (single `sqlStatement` with multiple sets of `args`)
         *     wsdb.execute(
         *             "INSERT INTO person (first, last) VALUES (?, ?)",
         *             [
         *                 ["John", "Doe"],
         *                 ["Jane", "Doe"]
         *             ],
         *             // called for each row in args
         *             function (rs) {
         *                 console.log("Inserted person", rs.insertId);
         *                 return rs.insertId;
         *             }
         *     ).then(function (insertIds) {
         *         var personId1 = insertIds[0], personId2 = insertIds[1];
         *         ...
         *     });
         *
         * Other Usage: (multiple `sqlStatement` with multiple sets of `args`)
         *     wsdb.execute(
         *             [{
         *                 sql: "UPDATE person SET (first=?, last=?) WHERE id=?",
         *                 args: ["Robert", "Smith", 23]
         *             }, {
         *                 sql: "UPDATE address SET (street=?, city=?, zip=?) WHERE id=?",
         *                 args: ["Sesame St.", "Austin", "78758", 45]
         *             }],
         *             // called for each object in args
         *             function (rs) {
         *                 console.log("Updated object: ", rs.rowsAffected);
         *                 return rs.rowsAffected;
         *             }
         *     ).then(function (results) {
         *         var numPersons = results[0], numAddresses = results[1];
         *         ...
         *     });
         */
        WebSqlDatabase.prototype.executeQuery = function (sqlStatement) {
            return this.execSqlStatements(this.transaction, sqlStatement, null, "execute");
        };
        WebSqlDatabase.prototype.executeQueries = function (sqlStatements) {
            return this.execSqlStatements(this.transaction, sqlStatements, null, "execute");
        };
        WebSqlDatabase.prototype.execute = function (sqlStatements, rsCallback) {
            return this.execSqlStatements(this.transaction, sqlStatements, rsCallback, "execute");
        };
        /** Method for executing a readTransaction with a one or more `sqlStatement`
         * with the specified `args`, calling the `rsCallback` with the result set(s).
         * The `args` and `rsCallback` are optional.
         * Passing a _single_ `sqlStatement` string with `args` that is an _array of arrays_,
         * the statement is executed with each row in the `args`.
         * Passing an array of `{ sql, args}` objects to `sqlStatement`
         * executes the `sql` in each row with the row's `args` (or the parameter `args`).
         * Returns: promise that resolves with `rsCallback` result
         * or the resultSet, if no `rsCallback` specified.  If an array of statements or arguments
         * is specified, the promise resolves with an array of results/resultSets.
         * Usage:
         *     wsdb.read("SELECT * FROM person WHERE first = ?",
         *             ["Bob"],
         *             function (rs) {
         *                 var rows = rs.rows;
         *                 for(var i = 0; i < rows.length; i++) {
         *                     ...
         *                 }
         *                 return result;
         *             }
         *     ).then(function (result) {...});
         *
         * Other Usage: (single `sqlStatement` with multiple sets of `args`)
         *     wsdb.read("SELECT * FROM person WHERE first = ?",
         *             [
         *                 ["Bob"],
         *                 ["John"]
         *             ],
         *             // called for each row in args
         *             function (rs) {
         *                 return rs.rows;
         *             }
         *     ).then(function (results) {
         *         var bobRows = results[0], johnRows = results[1];
         *         ...
         *     });
         *
         * Other Usage: (multiple `sqlStatement` with multiple sets of `args`)
         *     wsdb.read([{
         *             sql: "SELECT * FROM person WHERE id=?",
         *             args: [23]
         *         }, {
         *             sql: "SELECT * FROM address WHERE state in (?, ?, ?)",
         *             args: ["CA", "FL", "TX"]
         *
         *         }],
         *         // called for each object in args
         *         function (rs) {
         *             return rs.rows;
         *         }
         *     ).then(function (results) {
         *         var person23rows = results[0], addressRows = results[1];
         *         ...
         *     });
         */
        WebSqlDatabase.prototype.read = function (sqlStatements, rsCallback) {
            return this.execSqlStatements(this.readTransaction, sqlStatements, rsCallback, "read");
        };
        /** Method for executing a readTransaction with a single `sqlStatement` that's expected to return a single row.
         * The specified `rowCallback` is called with the row in the resultset
         * or with `undefined` if resultset contains no rows.
         * If the query does not return a row, the `defaultValue` is returned instead.
         * @returns promise that resolves with the `rowCallback` result or the row, if no `rowCallback` specified.
         * If no rows are selected and `rowCallback` isn't specified, the promise resolves with the `defaultRow`.
         * The promise is rejected if the query returns multiple rows or if it returns
         * zero rows and no `rowCallback` and `defaultRow` were specified.
         * Usage:
         *     wsdb.readRow("SELECT * FROM person WHERE id = ?", [123], function (row) {
         *         if(!row) {
         *             // person not found
         *         }
         *         else {
         *             ...
         *         }
         *     }).then(function (result) {...});
         */
        WebSqlDatabase.prototype.readRow = function (sqlStatements, rowCallback, defaultValue) {
            var util = this.util;
            return util.pipe(this.read(sqlStatements), function (rs) {
                var row;
                if (rs.rows.length > 1) {
                    return util._rejectError(util.defer(), new Error("Query returned " + rs.rows.length + " rows"));
                }
                if (rs.rows.length === 0) {
                    if (defaultValue) {
                        row = defaultValue;
                    }
                    else if (rowCallback) {
                        row = rowCallback();
                    }
                    else {
                        return util._rejectError(util.defer(), new Error("Query returned 0 rows"));
                    }
                }
                else {
                    row = rs.rows.item(0);
                    if (rowCallback) {
                        row = rowCallback(row);
                    }
                }
                return row;
            });
        };
        WebSqlDatabase.prototype.execSqlStatements = function (xactMethod, sqlStatements, rsCallback, xactMethodType) {
            var start = new Date().getTime();
            if (!window["startQueriesTime"]) {
                window["startQueriesTime"] = start;
            }
            var util = this.util;
            var isArray = util._isArray(sqlStatements);
            var sqls = (isArray ? sqlStatements : [sqlStatements]);
            var results = [];
            var pipeReturn = util.pipe(xactMethod(function (xact) {
                for (var i = 0; i < sqls.length; i++) {
                    var cmnd = sqls[i];
                    var params = (typeof cmnd.args === "undefined" ? null : cmnd.args);
                    if (params == null || params.length === 0) {
                        xact.executeSql(cmnd.sql, null, function (xact, rs) {
                            results.push(rsCallback ? rsCallback(rs) : rs);
                        });
                    }
                    else {
                        for (var j = 0, szJ = params.length; j < szJ; j++) {
                            xact.executeSql(cmnd.sql, params[j], function (xact, rs) {
                                results.push(rsCallback ? rsCallback(rs) : rs);
                            });
                        }
                    }
                }
            }), function () {
                return isArray ? results : results[0];
            }, function (err) {
                err.sql = sqls;
                return err;
            });
            if (util.timingLogging) {
                pipeReturn.done(function () {
                    var end = new Date().getTime();
                    var time = end - start;
                    window["endQueriesTime"] = end;
                    util.log(util.DEBUG, "websql finish args: ", xactMethodType, sqls.length, sqls);
                    util.log(util.DEBUG, "websql runtime: ", time);
                });
            }
            return pipeReturn;
        };
        return WebSqlDatabase;
    }());
    WebSqlUtil.WebSqlDatabase = WebSqlDatabase;
    /** Utility functions used by WebSqlDatabase class
     * @since 2015-2-4
     */
    var DbUtils = (function () {
        /** Sets `websql` configuration:
         * `defer`: specifies the function that constructs a deferred object.
         *   Default is window.when, window.Q or window.jQuery.Deferred, if present.
         * `trace`: specifies the object used for logging messages. Default is `window.console`.
         * `logVerbosity`: specifies verbosity of logging (NONDE, ERROR or DEBUG). Default is `websql.log.NONE`.
         */
        function DbUtils(settings) {
            var _this = this;
            this.NONE = DbUtils.logLevels.NONE;
            this.ERROR = DbUtils.logLevels.ERROR;
            this.DEBUG = DbUtils.logLevels.DEBUG;
            this.verbosity = this.NONE;
            this.timingLogging = (localStorage.getItem("LogWebsql"));
            if (this._isFunction(settings.defer)) {
                this.defer = settings.defer;
            }
            if (settings.trace != null && this._isFunction(settings.trace.log)) {
                this.trace = settings.trace;
            }
            if (typeof settings.logVerbosity !== "undefined") {
                this.verbosity = settings.logVerbosity;
            }
            this._isArray = Array.isArray || (function (obj) { return _this._toString(obj) === "[object Array]"; });
            this._isArray = this._isArray.bind(this);
            this._toString = this._toString.bind(this);
            this._isString = this._isString.bind(this);
            this._isDatabase = this._isDatabase.bind(this);
            this._isFunction = this._isFunction.bind(this);
            this._isPromise = this._isPromise.bind(this);
            this.pipe = this.pipe.bind(this);
            this.log = this.log.bind(this);
            this.setConsole = this.setConsole.bind(this);
            this._rejectError = this._rejectError.bind(this);
        }
        // Internal Functions
        DbUtils.prototype._toString = function (obj) { return Object.prototype.toString.call(obj); };
        DbUtils.prototype._isString = function (fn) { return this._toString(fn) === "[object String]"; };
        DbUtils.prototype._isDatabase = function (db) { return this._toString(db) === "[object Database]"; };
        DbUtils.prototype._isFunction = function (fn) { return this._toString(fn) === "[object Function]"; };
        DbUtils.prototype._isPromise = function (obj) { return obj && this._isFunction(obj.then); };
        /** Calls `onSuccess` or `onError` when `promise` is resolved.
         * Returns a new promise that is resolved/rejected based on the
         * values returned from the callbacks.
         */
        DbUtils.prototype.pipe = function (p, onSuccess, onError) {
            var self = this;
            var dfd = this.defer();
            p.then(function (val) {
                var res;
                if (onSuccess) {
                    res = onSuccess(val);
                }
                if (self._isPromise(res)) {
                    res.then(dfd.resolve, dfd.reject);
                }
                else {
                    dfd.resolve(res);
                }
            }, function (err) {
                if (onError) {
                    err = onError(err);
                }
                if (self._isPromise(err)) {
                    err.then(dfd.resolve, dfd.reject);
                }
                else {
                    dfd.reject(err);
                }
            });
            return dfd.promise;
        };
        /** Log statement if level > verbosity
         * Usage:
         *     log(DEBUG, "Calling function", functionName);
         *     log(ERROR, "Something horrible happened:", error);
         */
        DbUtils.prototype.log = function (level) {
            var args = [];
            for (var _i = 1; _i < arguments.length; _i++) {
                args[_i - 1] = arguments[_i];
            }
            if (level <= this.verbosity && this.trace) {
                args.unshift("websql");
                if (this._isFunction(this.trace.text)) {
                    this.trace.text(args, "color: purple");
                }
                else if (level === this.ERROR && this._isFunction(this.trace.error)) {
                    this.trace.error(args);
                }
                else if (this._isFunction(this.trace.log)) {
                    this.trace.log(args);
                }
            }
        };
        DbUtils.prototype.setConsole = function (console) {
            this.trace = console;
        };
        DbUtils.prototype._rejectError = function (dfd, error, options) {
            if (typeof error === "string") {
                error = new Error(error);
            }
            if (options != null) {
                if (options.exception)
                    error.exception = options.exception;
                if (options.sqlError)
                    error.sqlError = options.sqlError;
            }
            this.log(this.ERROR, "ERROR: " + (error.exception || error.sqlError || error.message));
            dfd.reject(error);
            return dfd.promise;
        };
        /** Predefined log verbosity levels:
         * `websql.log.NONE`: No logging.
         * `websql.log.ERROR`: Log errors.
         * `websql.log.DEBUG`: Verbose logging.
         */
        DbUtils.logLevels = {
            NONE: 0,
            ERROR: 1,
            DEBUG: 2
        };
        return DbUtils;
    }());
    WebSqlUtil.DbUtils = DbUtils;
})(WebSqlUtil || (WebSqlUtil = {}));
module.exports = WebSqlUtil;

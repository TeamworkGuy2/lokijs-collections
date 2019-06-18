"use strict";
var DbUtil = require("./DbUtil");
/*! websql.js | MIT license | Stepan Riha | http://bitbucket.org/nonplus/websql-js
 * websql.js may be freely distributed under the MIT license.
 * converted to TypeScript at 2017-11-04 by TeamworkGuy2
 */
/** Module that wraps asynchronous WebSQL calls with deferred promises and provides SQL utility methods.
 *
 * Promises are **resolved** when asynchronous database callback is finished.
 * Promises are **rejected** with an `Error` object that may contain one or more of the following:
 *  - `message`: Describing what failed
 *  - `exception`: Exception that was thrown
 *  - `sqlError`: Error returned by WebSQL
 *  - `sql`: statement that was executing
 *
 * ## Using the API
 * Example:
 *     var wsdb = WebSqlSpi.newWebSqlDb(nameOrDbInst, _version_, _displayName_, _estimatedSize_, utilSettings);
 *     wsdb.read({ sql: "SELECT * FROM ..." }).then(function(resultSet) { ... });
 *
 * ## Public Methods ##
 * - `newWebSqlDb(nameOrDb, ...)` takes the same parameters as the `window.openDatabase` function, and used default values for unspecified parameters.
 * Returns: new a promise which resolves with the new `WebsqlDatabase` wrapper class.
 * Usage:
 *     var wsdb = WebSqlSpi.newWebSqlDb("test", 1, "Test Database", 2 * 1024 * 1024, new DbUtil(...));
 *     wsdb.execute({ sql: "INSERT INTO ...", args: [...] }).then(function(resultSet) { ... })
 */
var WebSqlSpi = /** @class */ (function () {
    function WebSqlSpi(db, util) {
        this.db = db;
        this.util = util;
        this.transaction = this.transaction.bind(this);
        this.readTransaction = this.readTransaction.bind(this);
    }
    /** Returns: promise that resolves once the database version has been changed
     * Usage:
     *     wsdb.changeVersion(1, 2, function (xact) {
     *         xact.executeSQL(...);
     *     }).then(function() {...});
     */
    WebSqlSpi.prototype.changeVersion = function (oldVersion, newVersion, xactCallback) {
        var util = this.util;
        var dfd = util.defer();
        if (!util.isDatabase(this.db)) {
            util.rejectError(dfd, "Database not specified (db='" + this.db + "')");
            return dfd.promise;
        }
        util.log(util.DEBUG, "changeVersion", oldVersion, newVersion);
        try {
            this.db.changeVersion("" + oldVersion, "" + newVersion, xactCallback, function (sqlError) {
                util.rejectError(dfd, "Failed to change version", { sqlError: sqlError });
            }, function () {
                dfd.resolve(null);
            });
        }
        catch (ex) {
            util.rejectError(dfd, "Failed changeVersion(db, '" + oldVersion + "', '" + newVersion + "')", { exception: ex });
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
    WebSqlSpi.prototype.getTables = function () {
        var sql = "SELECT name, type, sql FROM sqlite_master " +
            "WHERE type in ('table') AND name NOT LIKE '?_?_%' ESCAPE '?'";
        return this.execSqlStatements(this.readTransaction, "read", { sql: sql }, function (rs) {
            var tables = [];
            var rows = rs.rows;
            for (var i = 0, size = rows.length; i < size; i++) {
                tables.push(rows.item(i));
            }
            return tables;
        });
    };
    /** Queries the sqlite_master for a table by name
     * Returns: promise that resolves with table info or with `undefined` if table
     * does not exist.
     * Usage:
     *     wsdb.tableExists("person").then(function (table) {
     *         alert("table " + (table ? "exists" : "does not exist"));
     *     });
     */
    WebSqlSpi.prototype.tableExists = function (name) {
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
    WebSqlSpi.prototype.destroyDatabase = function () {
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
     *         return xact.executeSql("INSERT INTO person ...", [...],
     *             function (xact, rs) {
     *                 personId = rs.insertId;
     *                 insertAddress(xact, personId);
     *             }
     *         )
     *     }
     *
     *     function insertAddress(xact, personId) {
     *         return wsdb.executeSql(xact, "INSERT INTO address (person, ...) VALUES (?, ...)",
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
    WebSqlSpi.prototype.transaction = function (xactCallback) {
        return this.executeTransaction("transaction", xactCallback);
    };
    /** Calls xactCallback(xact) from within a database read transaction
     * Returns: promise that resolves with the database
     * Usage:
     *     wsdb.readTransaction(function (xact) {
     *         xact.executeSQL(...);
     *     }).then(function (wsdb) {...});
     */
    WebSqlSpi.prototype.readTransaction = function (xactCallback) {
        return this.executeTransaction("readTransaction", xactCallback);
    };
    /** Call 'webSqlFunc' method on 'db'
     * Implements common behavior for 'wsdb.transaction' and 'wsdb.readTransaction'
     */
    WebSqlSpi.prototype.executeTransaction = function (webSqlFuncName, xactCallback) {
        var util = this.util;
        var dfd = util.defer();
        if (!util.isDatabase(this.db)) {
            util.rejectError(dfd, "Database not specified (db='" + this.db + "')");
            return dfd.promise;
        }
        var webSqlFunc = this.db[webSqlFuncName];
        if (!webSqlFunc) {
            util.rejectError(dfd, "Database function '" + webSqlFuncName + "' does not exist");
            return dfd.promise;
        }
        try {
            webSqlFunc(function (xact) {
                try {
                    xactCallback(xact);
                }
                catch (exception) {
                    util.rejectError(dfd, webSqlFuncName + " callback threw an exception", { exception: exception });
                }
            }, function (sqlError) {
                util.rejectError(dfd, "Failed executing " + webSqlFuncName.replace(/transaction/i, "") + " transaction", { sqlError: sqlError });
            }, function () {
                dfd.resolve(null);
            });
        }
        catch (exception) {
            util.rejectError(dfd, "Failed calling " + webSqlFuncName, { exception: exception });
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
     *     wsdb.execute("INSERT INTO person (first, last) VALUES (?, ?)",
     *         [
     *             ["John", "Doe"],
     *             ["Jane", "Doe"]
     *         ],
     *         // called for each row in args
     *         function (rs) {
     *             console.log("Inserted person", rs.insertId);
     *             return rs.insertId;
     *         }
     *     ).then(function (insertIds) {
     *         var personId1 = insertIds[0], personId2 = insertIds[1];
     *         ...
     *     });
     *
     * Other Usage: (multiple `sqlStatement` with multiple sets of `args`)
     *     wsdb.execute(
     *         [{
     *             sql: "UPDATE person SET (first=?, last=?) WHERE id=?",
     *             args: ["Robert", "Smith", 23]
     *         }, {
     *             sql: "UPDATE address SET (street=?, city=?, zip=?) WHERE id=?",
     *             args: ["Sesame St.", "Austin", "78758", 45]
     *         }],
     *         // called for each object in args
     *         function (rs) {
     *             console.log("Updated object: ", rs.rowsAffected);
     *             return rs.rowsAffected;
     *         }
     *     ).then(function (results) {
     *         var numPersons = results[0], numAddresses = results[1];
     *         ...
     *     });
     */
    WebSqlSpi.prototype.executeQuery = function (sqlStatement) {
        return this.execSqlStatements(this.transaction, "execute", sqlStatement, null);
    };
    WebSqlSpi.prototype.executeQueries = function (sqlStatements) {
        return this.execSqlStatements(this.transaction, "execute", sqlStatements, null);
    };
    WebSqlSpi.prototype.execute = function (sqlStatements, rsCallback) {
        return this.execSqlStatements(this.transaction, "execute", sqlStatements, rsCallback);
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
     *         ["Bob"],
     *         function (rs) {
     *             var rows = rs.rows;
     *             for(var i = 0; i < rows.length; i++) {
     *                 ...
     *             }
     *             return result;
     *         }
     *     ).then(function (result) {...});
     *
     * Other Usage: (single `sqlStatement` with multiple sets of `args`)
     *     wsdb.read("SELECT * FROM person WHERE first = ?",
     *         [ ["Bob"], ["John"] ],
     *         // called for each row in args
     *         function (rs) {
     *             return rs.rows;
     *         }
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
    WebSqlSpi.prototype.read = function (sqlStatements, rsCallback) {
        return this.execSqlStatements(this.readTransaction, "read", sqlStatements, rsCallback);
    };
    /** Method for executing a readTransaction with a single `sqlStatement` that's expected to return a single row.
     * The `rowCallback` function is called with the first row in the resultset
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
    WebSqlSpi.prototype.readRow = function (sqlStatements, rowCallback, defaultValue) {
        var util = this.util;
        return util.pipe(this.read(sqlStatements), function (rs) {
            var row;
            if (Array.isArray(rs) || rs.rows.length > 1) {
                return util.rejectError(util.defer(), new Error("Query returned " + (Array.isArray(rs) ? "array of " + rs.length + " result sets" : rs.rows.length + " rows")));
            }
            else if (rs.rows.length === 0) {
                if (defaultValue) {
                    row = defaultValue;
                }
                else if (rowCallback) {
                    row = rowCallback();
                }
                else {
                    return util.rejectError(util.defer(), new Error("Query returned 0 rows"));
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
    WebSqlSpi.prototype.execSqlStatements = function (xactMethod, xactMethodType, sqlStatements, rsCallback) {
        var start = new Date().getTime();
        if (typeof window !== "undefined" && !window["startQueriesTime"]) {
            window["startQueriesTime"] = start;
        }
        var util = this.util;
        var isAry = Array.isArray(sqlStatements);
        var sqls = (isAry ? sqlStatements : [sqlStatements]);
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
            return isAry ? results : results[0];
        }, function (err) {
            err.sql = sqls;
            return err;
        });
        if (util.logTimings) {
            pipeReturn.done(function () {
                var end = new Date().getTime();
                var time = end - start;
                if (typeof window !== "undefined") {
                    window["endQueriesTime"] = end;
                }
                util.log(util.DEBUG, "websql finish args: ", xactMethodType, sqls.length, sqls);
                util.log(util.DEBUG, "websql runtime: ", time);
            });
        }
        return pipeReturn;
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
    WebSqlSpi.openDatabase = function (util, name, version, displayName, estimatedSize) {
        util.log(util.DEBUG, "openDatabase", name, version, displayName, estimatedSize);
        if (!displayName)
            displayName = name;
        if (!version)
            version = "";
        if (!estimatedSize) {
            if (typeof window !== "undefined" && window.navigator.userAgent.match(/(iPad|iPhone);.*CPU.*OS 7_0/i)) {
                estimatedSize = 5 * 1024 * 1024;
            }
            else {
                estimatedSize = 50 * 1024 * 1024;
            }
        }
        var dfd = util.defer();
        try {
            if (typeof window === "undefined" || !window.openDatabase) {
                util.rejectError(dfd, "WebSQL not implemented");
            }
            else {
                // seems to synchronously open WebSQL, even though window.openDatabase is async
                var db = window.openDatabase(name, version, displayName, estimatedSize);
                if (util.isDatabase(db)) {
                    dfd.resolve(db);
                }
                else {
                    util.rejectError(dfd, "Failed to open database");
                }
            }
        }
        catch (ex) {
            util.rejectError(dfd, "Failed to open database " + name, { exception: ex });
        }
        return dfd.promise;
    };
    WebSqlSpi.newWebSqlDb = function (name, version, displayName, estimatedSize, utilSettings) {
        var util = new DbUtil("WebSQL", "[object Database]", utilSettings);
        // Create WebSQL wrapper from native Database or by opening 'name' DB
        var pOpen;
        if (util.isDatabase(name)) {
            var dfd = util.defer();
            dfd.resolve(name);
            pOpen = dfd.promise;
        }
        else {
            pOpen = WebSqlSpi.openDatabase(util, name, version, displayName, estimatedSize);
        }
        return pOpen.then(function (dbInst) { return new WebSqlSpi(dbInst, util); });
    };
    return WebSqlSpi;
}());
module.exports = WebSqlSpi;

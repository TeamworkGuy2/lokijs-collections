/// <reference types="websql" />
import DbUtil = require("./DbUtil");

declare var window: any;

type SqlStatementType = WebSqlSpi.SqlStatementType;

interface SqlQuery extends WebSqlSpi.SqlQuery {
}

interface SqlTableInfo extends WebSqlSpi.SqlTableInfo {
}

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
class WebSqlSpi {
    public db!: Database;
    public util!: DbUtil<Database>;


    constructor(db: Database, util: DbUtil<Database>) {
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
    public changeVersion(oldVersion: number, newVersion: number, xactCallback: SQLTransactionCallback): PsPromise<void, Error> {
        var util = this.util;
        var dfd = util.defer<void>();
        if (!util.isDatabase(this.db)) {
            util.rejectError(dfd, "Database not specified (db='" + this.db + "')");
            return dfd.promise;
        }

        util.log(util.DEBUG, "changeVersion", oldVersion, newVersion);

        try {
            this.db.changeVersion("" + oldVersion, "" + newVersion, xactCallback, function (sqlError) {
                util.rejectError(dfd, "Failed to change version", { sqlError: sqlError });
            }, function () {
                dfd.resolve(<void><any>null);
            });
        } catch (ex) {
            util.rejectError(dfd, "Failed changeVersion(db, '" + oldVersion + "', '" + newVersion + "')", { exception: ex });
        }
        return dfd.promise;
    }


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
    public getTables(): PsPromise<SqlTableInfo[], any> {
        var sql = "SELECT name, type, sql FROM sqlite_master " +
            "WHERE type in ('table') AND name NOT LIKE '?_?_%' ESCAPE '?'";
        return this.execSqlStatements(this.readTransaction, "read", { sql }, function (rs) {
            var tables: SqlTableInfo[] = [];
            var rows = rs.rows;
            for (var i = 0, size = rows.length; i < size; i++) {
                tables.push(rows.item(i));
            }
            return tables;
        });
    }


    /** Queries the sqlite_master for a table by name
     * Returns: promise that resolves with table info or with `undefined` if table
     * does not exist.
     * Usage:
     *     wsdb.tableExists("person").then(function (table) {
     *         alert("table " + (table ? "exists" : "does not exist"));
     *     });
     */
    public tableExists(name: string): PsPromise<any, any> {
        var sql = "SELECT * FROM sqlite_master WHERE name = ?";
        return this.readRow([{ sql, args: [[name]] }], function (row) {
            return row || undefined;
        });
    }


    /** Drops all the tables in the database.
     * Returns: promise that resolves with this `WebsqlDatabase`
     * Usage:
     *     wsdb.destroyDatabase()
     *         .then(function (wsdb) {...});
     */
    public destroyDatabase(): PsPromise<void, any> {
        return this.changeVersion(<any>this.db.version, <any>"", function (xact) {
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
    }


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
    public transaction(xactCallback: SQLTransactionCallback) {
        return this.executeTransaction("transaction", xactCallback);
    }


    /** Calls xactCallback(xact) from within a database read transaction
     * Returns: promise that resolves with the database
     * Usage:
     *     wsdb.readTransaction(function (xact) {
     *         xact.executeSQL(...);
     *     }).then(function (wsdb) {...});
     */
    public readTransaction(xactCallback: SQLTransactionCallback) {
        return this.executeTransaction("readTransaction", xactCallback);
    }


    /** Call 'webSqlFunc' method on 'db'
     * Implements common behavior for 'wsdb.transaction' and 'wsdb.readTransaction'
     */
    public executeTransaction(webSqlFuncName: ("transaction" | "readTransaction"), xactCallback: SQLTransactionCallback): PsPromise<void, Error> {
        var util = this.util;
        var dfd = util.defer<void>();
        if (!util.isDatabase(this.db)) {
            util.rejectError(dfd, "Database not specified (db='" + this.db + "')");
            return dfd.promise;
        }
        if (this.db[webSqlFuncName] == null) {
            util.rejectError(dfd, "Database function '" + webSqlFuncName + "' does not exist");
            return dfd.promise;
        }

        try {
            this.db[webSqlFuncName](function (xact) {
                try {
                    xactCallback(xact);
                } catch (exception) {
                    util.rejectError(dfd, webSqlFuncName + " callback threw an exception", { exception: exception });
                }
            }, function (sqlError) {
                util.rejectError(dfd, "Failed executing " + webSqlFuncName.replace(/transaction/i, "") + " transaction", { sqlError: sqlError });
            }, function () {
                dfd.resolve(<void><any>null);
            });
        } catch (exception) {
            util.rejectError(dfd, "Failed calling " + webSqlFuncName, { exception: exception });
        }

        return dfd.promise;
    }


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
    public executeQuery(sqlStatement: SqlQuery): PsPromise<SQLResultSet, Error> {
        return this.execSqlStatements(this.transaction, "execute", sqlStatement, null);
    }

    public executeQueries(sqlStatements: SqlQuery[]): PsPromise<SQLResultSet[], Error> {
        return this.execSqlStatements(this.transaction, "execute", sqlStatements, null);
    }

    public execute<U>(sqlStatements: SqlQuery | SqlQuery[], rsCallback?: (rs: SQLResultSet) => U): PsPromise<U | SQLResultSet | SQLResultSet[] | U[], Error> {
        return this.execSqlStatements(this.transaction, "execute", sqlStatements, rsCallback);
    }


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
    public read<U>(sqlStatements: SqlQuery | SqlQuery[], rsCallback?: (rs: SQLResultSet) => U) {
        return this.execSqlStatements(this.readTransaction, "read", sqlStatements, rsCallback);
    }


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
    public readRow(sqlStatements: SqlQuery | SqlQuery[], rowCallback?: (row?: any) => void, defaultValue?: any) {
        var util = this.util;

        return util.pipe(<PsPromise<SQLResultSet | SQLResultSet[], any>>this.read(sqlStatements), function (rs: SQLResultSet | SQLResultSet[]) {
            var row: any;
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
    }


    /** Execute sqlStatement in the context of `xactMethod`
     * Implements common behavior for `wsdb.execute` and `wsdb.read`
     */
    execSqlStatements<T, U>(xactMethod: (callback: SQLTransactionCallback) => PsPromise<T, any>, xactMethodType: SqlStatementType, sqlStatements: SqlQuery[], rsCallback: null | undefined): PsPromise<SQLResultSet[], any>;
    execSqlStatements<T, U>(xactMethod: (callback: SQLTransactionCallback) => PsPromise<T, any>, xactMethodType: SqlStatementType, sqlStatements: SqlQuery[], rsCallback: (rs: SQLResultSet) => U): PsPromise<U[], any>;
    execSqlStatements<T, U>(xactMethod: (callback: SQLTransactionCallback) => PsPromise<T, any>, xactMethodType: SqlStatementType, sqlStatements: SqlQuery, rsCallback: (rs: SQLResultSet) => U): PsPromise<U, any>;
    execSqlStatements<T, U>(xactMethod: (callback: SQLTransactionCallback) => PsPromise<T, any>, xactMethodType: SqlStatementType, sqlStatements: SqlQuery, rsCallback: null | undefined): PsPromise<SQLResultSet, any>;
    execSqlStatements<T, U>(xactMethod: (callback: SQLTransactionCallback) => PsPromise<T, any>, xactMethodType: SqlStatementType, sqlStatements: SqlQuery[], rsCallback: null | undefined): PsPromise<SQLResultSet[] | SQLResultSet, any>;
    execSqlStatements<T, U>(xactMethod: (callback: SQLTransactionCallback) => PsPromise<T, any>, xactMethodType: SqlStatementType, sqlStatements: SqlQuery | SqlQuery[], rsCallback: ((rs: SQLResultSet) => U) | null | undefined): PsPromise<SQLResultSet[] | U[] | SQLResultSet | U, any>;
    execSqlStatements<T, U>(xactMethod: (callback: SQLTransactionCallback) => PsPromise<T, any>, xactMethodType: SqlStatementType, sqlStatements: SqlQuery | SqlQuery[], rsCallback: ((rs: SQLResultSet) => U) | null | undefined): PsPromise<SQLResultSet[] | U[] | SQLResultSet | U, any> {
        var start = new Date().getTime();
        if (typeof window !== "undefined" && !(<any>window)["startQueriesTime"]) {
            (<any>window)["startQueriesTime"] = start;
        }

        var util = this.util;
        var isAry = Array.isArray(sqlStatements);
        var sqls = <SqlQuery[]>(isAry ? sqlStatements : [sqlStatements]);
        var results: (SQLResultSet | U)[] = [];

        var pipeReturn = util.pipe(xactMethod(function (xact: SQLTransaction) {
            for (var i = 0; i < sqls.length; i++) {
                var cmnd: SqlQuery = sqls[i];
                var params = (typeof cmnd.args === "undefined" ? null : cmnd.args);
                if (params == null || params.length === 0) {
                    xact.executeSql(cmnd.sql, <undefined><any>null, function (xact: SQLTransaction, rs: SQLResultSet) {
                        results.push(rsCallback ? rsCallback(rs) : rs);
                    });
                }
                else {
                    for (var j = 0, szJ = params.length; j < szJ; j++) {
                        xact.executeSql(cmnd.sql, params[j], function (xact: SQLTransaction, rs: SQLResultSet) {
                            results.push(rsCallback ? rsCallback(rs) : rs);
                        });
                    }
                }
            }
        }), function () {
            return isAry ? <SQLResultSet[] | U[]>results : results[0];
        }, function (err: any) {
            err.sql = sqls;
            return err;
        });

        if (util.logTimings) {
            pipeReturn.then(function () {
                var end = new Date().getTime();
                var time = <number>end - <number>start;
                if (typeof window !== "undefined") {
                    (<any>window)["endQueriesTime"] = end;
                }

                util.log(util.DEBUG, "websql finish args: ", xactMethodType, sqls.length, sqls);
                util.log(util.DEBUG, "websql runtime: ", time);
            });
        }
        return pipeReturn;
    }


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
    public static openDatabase(util: DbUtil<Database>, name: string, version?: number | null, displayName?: string | null, estimatedSize?: number | null): PsPromise<Database, Error> {
        util.log(util.DEBUG, "openDatabase", name, version, displayName, estimatedSize);

        if (!displayName) displayName = name;
        if (!version) version = <any>"";
        if (!estimatedSize) {
            if (typeof window !== "undefined" && window.navigator.userAgent.match(/(iPad|iPhone);.*CPU.*OS 7_0/i)) {
                estimatedSize = 5 * 1024 * 1024;
            }
            else {
                estimatedSize = 50 * 1024 * 1024;
            }
        }

        var dfd = util.defer<Database>();
        try {
            if (typeof window === "undefined" || !window.openDatabase) {
                util.rejectError(dfd, "WebSQL not implemented");
            }
            else {
                // seems to synchronously open WebSQL, even though window.openDatabase is async
                var db: Database = window.openDatabase(name, version, displayName, estimatedSize);
                if (util.isDatabase(db)) {
                    dfd.resolve(db);
                }
                else {
                    util.rejectError(dfd, "Failed to open database");
                }
            }
        } catch (ex) {
            util.rejectError(dfd, "Failed to open database " + name, { exception: ex });
        }
        return dfd.promise;
    }


    public static newWebSqlDb(name: string | Database, version: number | null, displayName: string | null, estimatedSize: number | null, utilSettings: DataPersister.UtilConfig): PsPromise<WebSqlSpi, Error> {
        var util = new DbUtil<Database>("WebSQL", "[object Database]", utilSettings);

        // Create WebSQL wrapper from native Database or by opening 'name' DB
        var pOpen: PsPromise<Database, Error>;
        if (util.isDatabase(name)) {
            var dfd = util.defer<Database>();
            dfd.resolve(name);
            pOpen = dfd.promise;
        }
        else {
            pOpen = WebSqlSpi.openDatabase(util, name, version, displayName, estimatedSize);
        }

        return pOpen.then((dbInst) => new WebSqlSpi(dbInst, util));
    }

}

module WebSqlSpi {

    export type SqlStatementType = ("read" | "execute");

    export interface SqlQuery {
        sql: string;
        args?: ObjectArray[];
    }

    export interface SqlTableInfo {
        name: string;
        type: string;
        sql: string;
    }

}

export = WebSqlSpi;